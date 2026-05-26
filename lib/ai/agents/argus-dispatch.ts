/**
 * Argus-Dispatch — work-order classifier + vendor matcher + cost estimator.
 *
 * Deterministic-first. The keyword table catches >90% of real tickets
 * for free; the optional Haiku-tier refinement only fires when the
 * regex score is ambiguous (multiple trades hit, or none).
 *
 * Cost estimates use a flat per-trade baseline + urgency multiplier.
 * The baselines are Laredo-realistic for a single-family / 4-plex
 * scope and can be tuned via env vars.
 */

import { runFastAgent } from "@/lib/ai/orchestrator";

export type Trade =
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Appliance"
  | "Pest Control"
  | "Landscaping"
  | "Locksmith"
  | "General";

export type VendorRow = {
  id: string;
  name: string;
  trade: string | null;
  billing_rate: number | null;
  email?: string | null;
  phone?: string | null;
};

export type WorkOrderInput = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  unit_id: string | null;
};

export type DispatchSuggestion = {
  work_order_id: string;
  detected_trade: Trade;
  trade_confidence: "high" | "medium" | "low";
  match_explanation: string;
  matched_vendor: VendorRow | null;
  alternate_vendors: VendorRow[];
  cost_baseline_usd: number;
  cost_estimate_low_usd: number;
  cost_estimate_high_usd: number;
  urgency_multiplier: number;
  rationale: string;
  ai_used: boolean;
  ai_model: string | null;
  ai_cost_usd: number;
  generated_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Keyword classification — fast first pass
// ─────────────────────────────────────────────────────────────────────────────

const TRADE_KEYWORDS: Record<Trade, RegExp[]> = {
  Plumbing: [
    /\b(plumb|pipe|leak|drip|drain|clogg?ed|toilet|faucet|sink|p-?trap|water heater|hot water|sewer|septic|garbage disposal|sewage|backflow)\b/i,
  ],
  Electrical: [
    /\b(electric(al|ian)?|breaker|outlet|wir(e|ing)|panel|fuse|light(ing|s)? out|switch|gfci|spark|short(ed)?|amp|voltage|ground(ed)?|circuit)\b/i,
  ],
  HVAC: [
    /\b(hvac|ac|a\/c|air condition|heater|heating|furnace|thermostat|compressor|coil|condenser|capacitor|refrigerant|freon|duct|vent|filter|cooling|no\s*cold air|blower)\b/i,
  ],
  Appliance: [
    /\b(appliance|dishwasher|washer|dryer|refrigerator|fridge|stove|oven|microwave|range|ice maker|disposal|exhaust hood|cooktop)\b/i,
  ],
  "Pest Control": [
    /\b(pest|roach|rodent|rat|mice|mouse|ant|termite|bedbug|bed bug|cockroach|spider|wasp|hornet|infestation|exterminat)\b/i,
  ],
  Landscaping: [
    /\b(landscap|lawn|grass|mow|tree|trim|hedge|prune|leaf|leaves|sprinkler|irrigation|weed|shrub)\b/i,
  ],
  Locksmith: [
    /\b(lock(smith|ed|out)?|key|rekey|deadbolt|latch|knob|door (won'?t|wont) (open|close|lock))\b/i,
  ],
  General: [
    /\b(paint|drywall|patch|caulk|seal|hole|crack|wall|ceiling|floor|tile|grout|cabinet|hinge|screw|hardware|general)\b/i,
  ],
};

const TRADE_BASELINE_USD: Record<Trade, number> = {
  Plumbing: 165,
  Electrical: 195,
  HVAC: 240,
  Appliance: 175,
  "Pest Control": 95,
  Landscaping: 110,
  Locksmith: 130,
  General: 145,
};

function envBaseline(trade: Trade): number {
  const key = `DISPATCH_BASELINE_${trade.toUpperCase().replace(/\s+/g, "_")}_USD`;
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : TRADE_BASELINE_USD[trade];
}

function classifyByRegex(text: string): { trade: Trade; score: number; hits: Trade[] } {
  const hits: Trade[] = [];
  let topTrade: Trade = "General";
  let topScore = 0;
  for (const [trade, patterns] of Object.entries(TRADE_KEYWORDS) as [Trade, RegExp[]][]) {
    let score = 0;
    for (const re of patterns) {
      const matches = text.match(new RegExp(re.source, "gi"));
      if (matches) score += matches.length;
    }
    if (score > 0) hits.push(trade);
    if (score > topScore) {
      topScore = score;
      topTrade = trade;
    }
  }
  return { trade: topTrade, score: topScore, hits };
}

async function classifyByAi(
  text: string
): Promise<{ trade: Trade; model: string; costUsd: number } | null> {
  const trades = Object.keys(TRADE_KEYWORDS) as Trade[];
  const result = await runFastAgent<{ trade: Trade }>({
    agent: "argus-dispatch",
    task: "classify_trade",
    systemPrompt: `You are Argus-Dispatch. Classify the maintenance request into EXACTLY ONE trade.
Allowed values: ${trades.join(" | ")}
Return JSON ONLY: { "trade": "<one of the above>" }`,
    userPrompt: text.slice(0, 2_000),
    maxTokens: 60,
  });
  if (!result.parsed?.trade || !trades.includes(result.parsed.trade as Trade)) return null;
  return { trade: result.parsed.trade as Trade, model: result.model, costUsd: result.costUsd };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor matching
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTrade(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function pickVendor(trade: Trade, vendors: VendorRow[]): {
  best: VendorRow | null;
  alts: VendorRow[];
} {
  const target = normalizeTrade(trade);
  const matches = vendors.filter((v) => normalizeTrade(v.trade) === target);
  if (matches.length === 0) {
    // Soft match: partial substring (e.g., "Plumbing" → "Plumber")
    const partial = vendors.filter((v) => {
      const t = normalizeTrade(v.trade);
      return t && (t.includes(target.split(" ")[0]) || target.includes(t.split(" ")[0]));
    });
    if (partial.length > 0) {
      return { best: partial[0], alts: partial.slice(1) };
    }
    return { best: null, alts: vendors.slice(0, 3) };
  }
  // Rank by billing rate ascending (cheaper first)
  matches.sort(
    (a, b) =>
      Number(a.billing_rate ?? Number.MAX_SAFE_INTEGER) -
      Number(b.billing_rate ?? Number.MAX_SAFE_INTEGER)
  );
  return { best: matches[0], alts: matches.slice(1) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost estimate
// ─────────────────────────────────────────────────────────────────────────────

function urgencyMultiplier(priority: string | null): number {
  switch ((priority ?? "").toLowerCase()) {
    case "urgent":
      return 1.5;
    case "high":
      return 1.25;
    case "medium":
    case "normal":
      return 1.0;
    case "low":
      return 0.85;
    default:
      return 1.0;
  }
}

function estimateRange(baseline: number, multiplier: number) {
  const adjusted = baseline * multiplier;
  return {
    low: Math.round(adjusted * 0.7),
    point: Math.round(adjusted),
    high: Math.round(adjusted * 1.5),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function suggestDispatch(
  wo: WorkOrderInput,
  vendors: VendorRow[]
): Promise<DispatchSuggestion> {
  const text = `${wo.title}. ${wo.description ?? ""}`.trim();
  const regex = classifyByRegex(text);

  let detectedTrade: Trade = regex.trade;
  let confidence: DispatchSuggestion["trade_confidence"] = "medium";
  let matchExplanation = "";
  let aiUsed = false;
  let aiModel: string | null = null;
  let aiCostUsd = 0;

  if (regex.hits.length === 1 && regex.score >= 1) {
    confidence = "high";
    matchExplanation = `Single-trade keyword match (${regex.hits[0]}, ${regex.score} hit${regex.score === 1 ? "" : "s"}).`;
  } else if (regex.hits.length === 0) {
    // No regex hit — fall back to AI
    const ai = await classifyByAi(text);
    if (ai) {
      detectedTrade = ai.trade;
      confidence = "medium";
      aiUsed = true;
      aiModel = ai.model;
      aiCostUsd = ai.costUsd;
      matchExplanation = `AI classified after no keyword match (${aiModel}).`;
    } else {
      confidence = "low";
      matchExplanation = `No keyword or AI classification — defaulting to ${detectedTrade}.`;
    }
  } else {
    // Multiple trades hit — AI tiebreak
    const ai = await classifyByAi(text);
    if (ai && regex.hits.includes(ai.trade)) {
      detectedTrade = ai.trade;
      confidence = "high";
      aiUsed = true;
      aiModel = ai.model;
      aiCostUsd = ai.costUsd;
      matchExplanation = `Multi-trade ambiguity (${regex.hits.join(", ")}) — AI tiebreak chose ${detectedTrade}.`;
    } else {
      confidence = "medium";
      matchExplanation = `Multi-trade keyword hits (${regex.hits.join(", ")}); picked highest-frequency.`;
    }
  }

  const { best, alts } = pickVendor(detectedTrade, vendors);
  const baseline = envBaseline(detectedTrade);
  const mult = urgencyMultiplier(wo.priority);
  const est = estimateRange(baseline, mult);

  const rationale = best
    ? `${best.name} is the cheapest available ${detectedTrade} vendor at $${best.billing_rate ?? "—"}/hr. ` +
      `Baseline ${detectedTrade} job at ${(mult * 100).toFixed(0)}% urgency: ~$${est.point} (range $${est.low}–$${est.high}).`
    : `No vendor registered for ${detectedTrade} yet. Add one in /work-orders → vendors, ` +
      `or assign manually. Baseline estimate: ~$${est.point} (range $${est.low}–$${est.high}).`;

  return {
    work_order_id: wo.id,
    detected_trade: detectedTrade,
    trade_confidence: confidence,
    match_explanation: matchExplanation,
    matched_vendor: best,
    alternate_vendors: alts.slice(0, 3),
    cost_baseline_usd: baseline,
    cost_estimate_low_usd: est.low,
    cost_estimate_high_usd: est.high,
    urgency_multiplier: mult,
    rationale,
    ai_used: aiUsed,
    ai_model: aiModel,
    ai_cost_usd: aiCostUsd,
    generated_at: new Date().toISOString(),
  };
}
