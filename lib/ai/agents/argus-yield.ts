/**
 * Argus-Yield — Laredo 78040 market rent intelligence agent.
 *
 * Deterministic, zero-cost fallback by design. The agent computes a
 * synthetic per-unit market rent from a published local baseline
 * (2BR/1BA = $950/mo for ZIP 78040 as of 2026Q2) and grades each unit
 * against it. No external API call is required — the math is the
 * fallback.
 *
 * Override the baseline via env:
 *   - YIELD_BASELINE_2BR1BA_USD     (default 950)
 *   - YIELD_BEDROOM_STEP_USD        (default 200)
 *   - YIELD_BATHROOM_STEP_USD       (default 75)
 *   - YIELD_PER_SQFT_DELTA_USD      (default 0.45)
 *   - YIELD_BASELINE_SQFT           (default 850)
 *   - YIELD_LOSS_FLAG_PCT           (default 10)   // flag if actual < target − this%
 *   - YIELD_RENEWAL_WINDOW_DAYS     (default 90)   // urgent if lease ends within
 */

import { runFastAgent } from "@/lib/ai/orchestrator";

export type UnitYieldInput = {
  unit_id: string;
  unit_number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  status: string;
  active_lease_id: string | null;
  active_lease_rent: number | null;
  active_lease_end: string | null; // YYYY-MM-DD
  tenant_name: string | null;
};

export type UnitYieldRow = {
  unit_id: string;
  unit_number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  status: string;
  current_rent: number | null;
  target_rent: number;
  monthly_loss: number | null;     // null when vacant or unknown
  loss_pct: number | null;         // (target − current) / target
  delta_label: "above" | "at" | "below" | "vacant";
  renewal_window_days: number | null;
  flags: string[];
};

export type LossToLeaseAnalysis = {
  zip: string;
  baseline_2br1ba_usd: number;
  loss_flag_pct: number;
  renewal_window_days: number;

  total_units: number;
  occupied_units: number;
  vacant_units: number;
  monthly_current_total: number;
  monthly_market_potential: number;
  monthly_loss_to_lease: number;
  annual_loss_to_lease: number;
  monthly_vacancy_loss: number;       // sum of target_rent for vacant units
  capture_rate_pct: number;           // current / potential

  avg_actual_rent: number | null;
  avg_target_rent: number;

  flagged_units: UnitYieldRow[];
  rows: UnitYieldRow[];

  narrative: string | null;
  narrative_model: string | null;
  narrative_cost_usd: number;

  generated_at: string;
};

const DEFAULTS = {
  baseline2br1ba: 950,
  bedroomStep: 200,
  bathroomStep: 75,
  perSqftDelta: 0.45,
  baselineSqft: 850,
  lossFlagPct: 10,
  renewalWindowDays: 90,
  rentFloor: 650,
  rentCeiling: 1800,
};

function num(envName: string, fallback: number): number {
  const v = Number(process.env[envName]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function computeTargetRent(args: {
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
}): number {
  const baseline = num("YIELD_BASELINE_2BR1BA_USD", DEFAULTS.baseline2br1ba);
  const brStep = num("YIELD_BEDROOM_STEP_USD", DEFAULTS.bedroomStep);
  const baStep = num("YIELD_BATHROOM_STEP_USD", DEFAULTS.bathroomStep);
  const sqftDelta = num("YIELD_PER_SQFT_DELTA_USD", DEFAULTS.perSqftDelta);
  const baselineSqft = num("YIELD_BASELINE_SQFT", DEFAULTS.baselineSqft);

  // Start from the 2BR/1BA baseline
  let target = baseline;

  // Bedroom adjustment vs 2BR baseline
  const beds = args.bedrooms ?? 2;
  target += (beds - 2) * brStep;

  // Bathroom adjustment vs 1BA baseline
  const baths = args.bathrooms ?? 1;
  target += (baths - 1) * baStep;

  // Sqft adjustment vs baseline sqft
  if (args.sqft && args.sqft > 0) {
    target += (args.sqft - baselineSqft) * sqftDelta;
  }

  // Clamp to a sane Laredo range
  return Math.max(DEFAULTS.rentFloor, Math.min(DEFAULTS.rentCeiling, Math.round(target)));
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function unitRow(unit: UnitYieldInput, flagPct: number, renewalDays: number): UnitYieldRow {
  const target = computeTargetRent(unit);
  const current = unit.active_lease_rent;
  const isVacant = !current || unit.status === "vacant";
  const monthlyLoss = !isVacant && current != null ? Math.max(0, target - current) : null;
  const lossPct =
    !isVacant && current != null && target > 0
      ? Math.max(0, (target - current) / target) * 100
      : null;
  const renewalIn = daysUntil(unit.active_lease_end);

  const flags: string[] = [];
  let deltaLabel: UnitYieldRow["delta_label"] = "at";
  if (isVacant) {
    deltaLabel = "vacant";
    flags.push(`Vacant — $${target}/mo of unrealized rent.`);
  } else if (current != null && current > target * 1.02) {
    deltaLabel = "above";
  } else if (lossPct != null && lossPct >= flagPct) {
    deltaLabel = "below";
    flags.push(
      `Under-market by ${lossPct.toFixed(1)}% ($${Math.round(monthlyLoss ?? 0)}/mo) — raise at renewal.`
    );
  } else if (lossPct != null && lossPct > 0) {
    deltaLabel = "below";
  }

  if (renewalIn != null && renewalIn >= 0 && renewalIn <= renewalDays) {
    flags.push(`Lease ends in ${renewalIn} days — renewal window open.`);
  }
  if (renewalIn != null && renewalIn < 0) {
    flags.push(`Lease expired ${Math.abs(renewalIn)} days ago — month-to-month risk.`);
  }

  return {
    unit_id: unit.unit_id,
    unit_number: unit.unit_number,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    sqft: unit.sqft,
    status: unit.status,
    current_rent: current,
    target_rent: target,
    monthly_loss: monthlyLoss,
    loss_pct: lossPct,
    delta_label: deltaLabel,
    renewal_window_days: renewalIn,
    flags,
  };
}

const YIELD_SYSTEM = `You are Argus-Yield, the rent-pricing strategist for a small Laredo 78040 4-plex.
Style: Jack Dorsey — declarative, terse, no headers, no bullets, ≤80 words.
Given the pre-computed loss-to-lease numbers, state the bottom line first (how much is leaking, why).
Reference the exact dollar amounts and capture rate.
End with one concrete action (e.g., "Notice rent increase on Unit 1 at renewal — adds $X/yr").
Return JSON ONLY (no fences) with shape { "narrative": string }.`;

export async function analyzeUnits(
  units: UnitYieldInput[],
  opts: { zip?: string; includeNarrative?: boolean } = {}
): Promise<LossToLeaseAnalysis> {
  const baseline = num("YIELD_BASELINE_2BR1BA_USD", DEFAULTS.baseline2br1ba);
  const flagPct = num("YIELD_LOSS_FLAG_PCT", DEFAULTS.lossFlagPct);
  const renewalDays = num("YIELD_RENEWAL_WINDOW_DAYS", DEFAULTS.renewalWindowDays);
  const zip = opts.zip ?? "78040";

  const rows = units.map((u) => unitRow(u, flagPct, renewalDays));

  const occupied = rows.filter((r) => r.delta_label !== "vacant");
  const vacant = rows.filter((r) => r.delta_label === "vacant");

  const monthlyCurrentTotal = occupied.reduce((s, r) => s + (r.current_rent ?? 0), 0);
  const monthlyMarketPotential = rows.reduce((s, r) => s + r.target_rent, 0);
  const monthlyLossToLease = occupied.reduce((s, r) => s + (r.monthly_loss ?? 0), 0);
  const monthlyVacancyLoss = vacant.reduce((s, r) => s + r.target_rent, 0);
  const captureRate =
    monthlyMarketPotential > 0
      ? (monthlyCurrentTotal / monthlyMarketPotential) * 100
      : 0;

  const avgActual =
    occupied.length > 0
      ? occupied.reduce((s, r) => s + (r.current_rent ?? 0), 0) / occupied.length
      : null;
  const avgTarget =
    rows.length > 0 ? rows.reduce((s, r) => s + r.target_rent, 0) / rows.length : 0;

  const flagged = rows.filter((r) => r.flags.length > 0);

  const base: LossToLeaseAnalysis = {
    zip,
    baseline_2br1ba_usd: baseline,
    loss_flag_pct: flagPct,
    renewal_window_days: renewalDays,

    total_units: rows.length,
    occupied_units: occupied.length,
    vacant_units: vacant.length,
    monthly_current_total: monthlyCurrentTotal,
    monthly_market_potential: monthlyMarketPotential,
    monthly_loss_to_lease: monthlyLossToLease,
    annual_loss_to_lease: monthlyLossToLease * 12,
    monthly_vacancy_loss: monthlyVacancyLoss,
    capture_rate_pct: captureRate,

    avg_actual_rent: avgActual,
    avg_target_rent: avgTarget,

    flagged_units: flagged,
    rows,

    narrative: null,
    narrative_model: null,
    narrative_cost_usd: 0,
    generated_at: new Date().toISOString(),
  };

  if (!opts.includeNarrative) return base;

  try {
    const summary = {
      zip,
      baseline_2br1ba_usd: baseline,
      total_units: base.total_units,
      occupied_units: base.occupied_units,
      vacant_units: base.vacant_units,
      monthly_current_total: base.monthly_current_total,
      monthly_market_potential: base.monthly_market_potential,
      monthly_loss_to_lease: base.monthly_loss_to_lease,
      annual_loss_to_lease: base.annual_loss_to_lease,
      monthly_vacancy_loss: base.monthly_vacancy_loss,
      capture_rate_pct: base.capture_rate_pct,
      flagged_units: flagged.map((r) => ({
        unit: r.unit_number,
        current: r.current_rent,
        target: r.target_rent,
        monthly_loss: r.monthly_loss,
        renewal_in_days: r.renewal_window_days,
      })),
    };
    const result = await runFastAgent<{ narrative: string }>({
      agent: "argus-yield",
      task: "loss_to_lease_narrative",
      systemPrompt: YIELD_SYSTEM,
      userPrompt: JSON.stringify(summary, null, 2),
      maxTokens: 300,
      storeRaw: true,
    });
    if (result.parsed) {
      base.narrative = result.parsed.narrative;
      base.narrative_model = result.model;
      base.narrative_cost_usd = result.costUsd;
    }
  } catch {
    /* deterministic output is enough */
  }

  return base;
}
