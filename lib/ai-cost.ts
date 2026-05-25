// Per-model token pricing in USD per million tokens. The Vercel AI Gateway
// routes calls to multiple providers (Anthropic, Google, DeepSeek, OpenAI);
// this table needs an entry for every model that actually flows through.
// Update when a provider publishes new prices.
//
// Format: keys are either bare names (Anthropic direct) or `provider/model`
// (gateway routing). normalizeModel() strips the prefix when the bare name
// is in the table.

interface ModelPricing {
  inPerM: number;   // USD per 1M input tokens
  outPerM: number;  // USD per 1M output tokens
}

const PRICING: Record<string, ModelPricing> = {
  // ── Anthropic — direct + gateway-prefixed (anthropic/<name>)
  "claude-opus-4-7":     { inPerM: 5,    outPerM: 25 },
  "claude-opus-4-6":     { inPerM: 5,    outPerM: 25 },
  "claude-sonnet-4-6":   { inPerM: 3,    outPerM: 15 },
  "claude-haiku-4-5":    { inPerM: 1,    outPerM: 5  },

  // ── Google (gateway routing — google/<name>)
  // Verify prices at https://ai.google.dev/pricing — these are 2.x family.
  "google/gemini-2.5-pro":     { inPerM: 1.25,  outPerM: 10   },
  "google/gemini-2.5-flash":   { inPerM: 0.30,  outPerM: 2.50 },
  "google/gemini-2.0-pro":     { inPerM: 1.25,  outPerM: 5    },
  "google/gemini-2.0-flash":   { inPerM: 0.075, outPerM: 0.30 },

  // ── DeepSeek (gateway routing — deepseek/<name>)
  // Verify at https://api-docs.deepseek.com/quick_start/pricing
  "deepseek/deepseek-v3":      { inPerM: 0.14,  outPerM: 0.28 },
  "deepseek/deepseek-r1":      { inPerM: 0.55,  outPerM: 2.19 },
  "deepseek/deepseek-chat":    { inPerM: 0.14,  outPerM: 0.28 },

  // ── OpenAI (gateway routing — openai/<name>) — kept for completeness
  // even though no provider key is currently set. Add the key in Vercel
  // AI Gateway dashboard if you want to route to OpenAI.
  "openai/gpt-4o-mini":        { inPerM: 0.15,  outPerM: 0.6  },
  "openai/gpt-4o":             { inPerM: 2.5,   outPerM: 10   },
  "openai/gpt-4.1":            { inPerM: 2,     outPerM: 8    },
  "openai/gpt-4.1-mini":       { inPerM: 0.4,   outPerM: 1.6  },
};

function normalizeModel(model: string): string {
  // Strip provider prefix when present so "anthropic/claude-opus-4-7" → "claude-opus-4-7"
  const slash = model.indexOf("/");
  if (slash === -1) return model;
  const after = model.slice(slash + 1);
  // Only strip if the stripped form is in our table (Anthropic case);
  // Google/DeepSeek/OpenAI keys are stored WITH their prefix.
  if (PRICING[after]) return after;
  return model;
}

export function priceCall(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const key = normalizeModel(model);
  const p = PRICING[key];
  if (!p) return 0;
  const inCost = (tokensIn / 1_000_000) * p.inPerM;
  const outCost = (tokensOut / 1_000_000) * p.outPerM;
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
}

export function tierFor(model: string): "fast" | "balanced" | "smart" | "unknown" {
  const k = normalizeModel(model);
  if (k.includes("haiku") || k.includes("flash") || k.includes("mini")) return "fast";
  if (
    k.includes("sonnet") ||
    k.includes("deepseek-v3") ||
    k.includes("deepseek-chat") ||
    k.includes("gemini-2.0-pro") ||
    k.includes("gemini-2.5-pro") ||
    k === "openai/gpt-4o" ||
    k === "openai/gpt-4.1"
  ) return "balanced";
  if (k.includes("opus") || k.includes("deepseek-r1")) return "smart";
  return "unknown";
}

export type Provider = "anthropic" | "google" | "deepseek" | "openai" | "unknown";

/**
 * Extract the provider from a model identifier. Anthropic models flowing
 * direct (no provider prefix) still register as 'anthropic'. Anything that
 * doesn't match a known provider returns 'unknown' so dashboards can flag
 * spend that escaped the table.
 */
export function providerFor(model: string): Provider {
  if (!model) return "unknown";
  const lower = model.toLowerCase();
  if (lower.startsWith("anthropic/") || lower.startsWith("claude-")) return "anthropic";
  if (lower.startsWith("google/") || lower.startsWith("gemini")) return "google";
  if (lower.startsWith("deepseek/") || lower.startsWith("deepseek")) return "deepseek";
  if (lower.startsWith("openai/") || lower.startsWith("gpt-")) return "openai";
  return "unknown";
}
