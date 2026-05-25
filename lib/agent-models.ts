// Agent → model routing config. Two layers:
//
//   1. PER-AGENT OVERRIDE — swap a specific agent off Anthropic onto a
//      cheaper Gateway-routed provider (Gemini / DeepSeek). Applied BEFORE
//      the call. Resolved by env var first, then static map. Default empty
//      so the system behaves exactly as before until you opt an agent in.
//
//   2. FALLBACK CHAIN — when a model fails with a retryable error
//      (timeout / network / 429 / 5xx), the wrapper retries with the next
//      model in the chain. This is belt-and-suspenders over Vercel AI
//      Gateway routing rules; it ensures resilience even when the gateway
//      dashboard isn't configured.
//
// To override an agent without redeploying, set a Vercel env var:
//     MODEL_HUNTER=deepseek/deepseek-v3
//     MODEL_ECHO=google/gemini-2.5-flash
// Restart picks it up. To revert: delete the env var.

import type { Provider } from "./ai-cost";

const NORMALIZE_AGENT = (agent: string) => agent.toLowerCase().trim();

// Static overrides — empty by default. Add entries here if you want a
// particular agent permanently routed off Anthropic. Env vars take
// precedence so you can experiment without code changes.
const PER_AGENT_MODEL: Record<string, string> = {
  // Examples (commented — flip on by uncommenting OR by setting MODEL_<AGENT>):
  // hunter: "deepseek/deepseek-v3",     // 5–15× cheaper than Haiku for cold-email drafts
  // echo:   "google/gemini-2.5-flash",  // chat-y; latency-tolerant; ~3× cheaper than Haiku
  // extract: "deepseek/deepseek-v3",    // structured-output extraction; cheap models do well here
};

/**
 * Resolve the model an agent should use. Falls back to the agent's
 * declared default (e.g. MODELS.FAST) when no override is configured.
 */
export function modelForAgent(
  agent: string | null | undefined,
  defaultModel: string
): string {
  if (!agent) return defaultModel;
  const a = NORMALIZE_AGENT(agent);
  const envKey = `MODEL_${a.toUpperCase()}`;
  const envVal = process.env[envKey]?.trim();
  if (envVal) return envVal;
  if (PER_AGENT_MODEL[a]) return PER_AGENT_MODEL[a];
  return defaultModel;
}

// Per-model fallback chain. Order matters — earlier entries are tried first.
// Cross-provider fallbacks of similar capability (NOT cheaper-tier downgrades,
// because a fallback that produces worse output is worse than a clean failure).
const FALLBACK_CHAIN: Record<string, string[]> = {
  // Anthropic → Google / DeepSeek (your provisioned BYOK providers)
  "claude-haiku-4-5":  ["google/gemini-2.5-flash", "deepseek/deepseek-chat"],
  "claude-sonnet-4-6": ["google/gemini-2.5-pro",   "deepseek/deepseek-v3"],
  "claude-opus-4-7":   ["deepseek/deepseek-r1",    "google/gemini-2.5-pro"],

  // Gateway-routed → Anthropic (closing the loop)
  "google/gemini-2.5-flash": ["anthropic/claude-haiku-4-5"],
  "google/gemini-2.5-pro":   ["anthropic/claude-sonnet-4-6"],
  "deepseek/deepseek-v3":    ["anthropic/claude-haiku-4-5"],
  "deepseek/deepseek-chat":  ["anthropic/claude-haiku-4-5"],
  "deepseek/deepseek-r1":    ["anthropic/claude-opus-4-7"],
};

/**
 * Look up the fallback chain for a model. Strips the "anthropic/" prefix
 * so direct and gateway-prefixed Anthropic calls share a chain. Returns
 * empty array when no fallback is configured.
 */
export function fallbacksFor(model: string): string[] {
  if (!model) return [];
  const stripped = model.startsWith("anthropic/") ? model.slice("anthropic/".length) : model;
  return FALLBACK_CHAIN[stripped] ?? FALLBACK_CHAIN[model] ?? [];
}

// Public-facing summary used by the AI Routing settings page.
export interface RoutingSummary {
  perAgentOverrides: Array<{ agent: string; model: string; from: "env" | "static" }>;
  fallbackChains: Array<{ model: string; chain: string[] }>;
}

const KNOWN_AGENTS = [
  "argus", "ledger", "esquire", "solomon", "hunter",
  "extract", "abacus", "echo", "athena", "turing",
] as const;

export function describeRouting(): RoutingSummary {
  const perAgentOverrides: RoutingSummary["perAgentOverrides"] = [];
  for (const agent of KNOWN_AGENTS) {
    const envKey = `MODEL_${agent.toUpperCase()}`;
    const envVal = process.env[envKey]?.trim();
    if (envVal) {
      perAgentOverrides.push({ agent, model: envVal, from: "env" });
    } else if (PER_AGENT_MODEL[agent]) {
      perAgentOverrides.push({ agent, model: PER_AGENT_MODEL[agent], from: "static" });
    }
  }
  const fallbackChains = Object.entries(FALLBACK_CHAIN).map(([model, chain]) => ({
    model,
    chain,
  }));
  return { perAgentOverrides, fallbackChains };
}

// Re-export Provider type for downstream consumers.
export type { Provider };
