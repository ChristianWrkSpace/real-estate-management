/**
 * Multi-agent LLM router for PropMan OS.
 *
 * Tiering:
 *   - FAST_MODEL  → cheap, fast classification / extraction (Ledger)
 *   - FRONTIER_MODEL → deep reasoning, financial audits (Argus)
 *
 * Every invocation is persisted to ai_logs (best-effort — never throws
 * back to the caller).
 */

import { aiClient } from "@/lib/ai-client";
import type { AICompletionResult } from "@/lib/ai-provider";
import { createAdminClient } from "@/lib/supabase-server";

export const FAST_MODEL = "claude-haiku-4-5";
export const FRONTIER_MODEL = "claude-opus-4-7";

type RouteTier = "fast" | "frontier";

export type RunAgentOptions = {
  agent: string;
  task: string;
  systemPrompt: string;
  userPrompt: string;
  tier: RouteTier;
  maxTokens?: number;
  /** When true, log the raw model output payload into ai_logs.output_data.raw */
  storeRaw?: boolean;
  /** Override the auto-selected model (advanced; usually leave undefined) */
  modelOverride?: string;
};

export type RunAgentResult<T = unknown> = {
  success: boolean;
  content: string;
  parsed?: T;
  model: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  logId?: string;
  error?: string;
};

function pickModel(tier: RouteTier, override?: string): string {
  if (override) return override;
  return tier === "frontier" ? FRONTIER_MODEL : FAST_MODEL;
}

async function logToDb(payload: {
  agent_name: string;
  task_description: string;
  model_used: string;
  token_cost: number;
  status: "succeeded" | "failed";
  output_data: Record<string, unknown>;
}): Promise<string | undefined> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_logs")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.warn("ai_logs insert failed:", error.message);
      return undefined;
    }
    return data?.id;
  } catch (err) {
    console.warn("ai_logs insert threw:", err);
    return undefined;
  }
}

/**
 * Try to parse the model output as JSON. Strips ```json fences and stray prose
 * around a JSON object.
 */
export function tryParseJson<T = unknown>(content: string): T | undefined {
  const fenced = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return undefined;
  }
}

/**
 * Core entry point — runs a single agent invocation, logs it, returns result.
 */
export async function runAgent<T = unknown>(
  opts: RunAgentOptions
): Promise<RunAgentResult<T>> {
  const model = pickModel(opts.tier, opts.modelOverride);

  let response: AICompletionResult | undefined;
  let error: string | undefined;

  try {
    response = await aiClient.complete({
      model,
      systemPrompt: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userPrompt }],
      maxTokens: opts.maxTokens ?? (opts.tier === "frontier" ? 2048 : 512),
      _agent: opts.agent,
      _task: opts.task,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const success = !!response && !error;
  const content = response?.content ?? "";
  const parsed = success ? tryParseJson<T>(content) : undefined;

  const logId = await logToDb({
    agent_name: opts.agent,
    task_description: opts.task,
    model_used: response?.model ?? model,
    token_cost: response?.costUsd ?? 0,
    status: success ? "succeeded" : "failed",
    output_data: success
      ? {
          parsed: parsed ?? null,
          ...(opts.storeRaw ? { raw: content } : {}),
          tokens_in: response?.tokensIn ?? 0,
          tokens_out: response?.tokensOut ?? 0,
        }
      : { error: error ?? "unknown" },
  });

  return {
    success,
    content,
    parsed,
    model: response?.model ?? model,
    costUsd: response?.costUsd ?? 0,
    tokensIn: response?.tokensIn ?? 0,
    tokensOut: response?.tokensOut ?? 0,
    logId,
    error,
  };
}

/**
 * Shortcut helpers (clearer call sites).
 */
export const runFastAgent = <T = unknown>(
  o: Omit<RunAgentOptions, "tier">
) => runAgent<T>({ ...o, tier: "fast" });

export const runFrontierAgent = <T = unknown>(
  o: Omit<RunAgentOptions, "tier">
) => runAgent<T>({ ...o, tier: "frontier" });
