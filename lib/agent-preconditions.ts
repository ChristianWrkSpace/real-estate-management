/**
 * Law 1 — Bounded Inputs.
 *
 * Agents must declare their required inputs and refuse to fire without them.
 * No tokens spent, no hallucinated output, no telemetry pollution.
 *
 * Pattern at a call site:
 *
 *   try {
 *     requireInputs("argus.scope_assessment", job, ["dispatch_inputs.ceiling_height_ft"]);
 *   } catch (err) {
 *     if (err instanceof PreconditionError) return { error: err.message };
 *     throw err;
 *   }
 *
 * For freshness guards (don't re-run if recent + unchanged):
 *   if (isFresh(job.scope_analyzed_at, 24)) return { ok: true, skipped: "fresh" };
 */

export class PreconditionError extends Error {
  agent: string;
  missing: string[];

  constructor(agent: string, missing: string[], hint?: string) {
    const detail = hint ? ` — ${hint}` : "";
    super(
      `[${agent}] cannot run: missing required input${
        missing.length === 1 ? "" : "s"
      } ${missing.join(", ")}${detail}`
    );
    this.name = "PreconditionError";
    this.agent = agent;
    this.missing = missing;
  }
}

/**
 * Validate that `keys` are all present (non-null, non-empty) on `inputs`.
 * Supports dot-paths for nested fields: "dispatch_inputs.ceiling_height_ft".
 *
 * Throws PreconditionError if anything is missing.
 */
export function requireInputs(
  agent: string,
  inputs: Record<string, any> | null | undefined,
  keys: string[],
  hint?: string
): void {
  const missing: string[] = [];
  for (const key of keys) {
    if (!hasValue(inputs, key)) missing.push(key);
  }
  if (missing.length > 0) throw new PreconditionError(agent, missing, hint);
}

function hasValue(obj: Record<string, any> | null | undefined, path: string): boolean {
  if (!obj) return false;
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return false;
    cur = cur[p];
  }
  if (cur == null) return false;
  if (typeof cur === "string" && cur.trim() === "") return false;
  if (Array.isArray(cur) && cur.length === 0) return false;
  if (typeof cur === "object" && Object.keys(cur).length === 0) return false;
  return true;
}

/**
 * Freshness guard. Returns true if `lastRunAt` is within `withinHours`.
 * Use to skip an agent re-run when inputs haven't changed and the previous
 * output is still recent enough to trust.
 */
export function isFresh(
  lastRunAt: string | Date | null | undefined,
  withinHours: number
): boolean {
  if (!lastRunAt) return false;
  const t = typeof lastRunAt === "string" ? new Date(lastRunAt).getTime() : lastRunAt.getTime();
  if (Number.isNaN(t)) return false;
  const ageHours = (Date.now() - t) / 3_600_000;
  return ageHours < withinHours;
}
