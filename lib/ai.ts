import Anthropic from "@anthropic-ai/sdk";
import { modelForAgent, fallbacksFor } from "./agent-models";

/**
 * AI plumbing for FirstCall OS — model-agnostic via Vercel AI Gateway.
 *
 * Routing:
 *   - If AI_GATEWAY_API_KEY is set → route through Vercel AI Gateway
 *     (model-agnostic, observability, fallbacks, zero-data-retention).
 *   - Else → direct Anthropic API.
 *
 * Either way, every existing call site keeps working without code changes
 * because we still expose the Anthropic SDK shape.
 *
 * Model tiers — ALWAYS import MODELS.* instead of hardcoding strings.
 * That way, when the right tradeoff for a task changes, we flip ONE constant.
 */

const GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Law 3 — Bounded Cost: per-day USD kill-switch.
// Reads sum(cost_usd) from agent_invocations for today. If over cap,
// next call is refused with a clear error. Cap is configurable via env.
// Set AI_KILL_SWITCH_OFF=true in Vercel env to disable (Owner override).
const DAILY_CAP_USD = Number(process.env.AI_DAILY_SPEND_CAP_USD ?? 50);
const KILL_SWITCH_OFF = process.env.AI_KILL_SWITCH_OFF === "true";

// Cached daily spend total — TTL 60s. Bounded blast radius per instance.
let _spendCache: { total: number; expiresAt: number } | null = null;

// One-email-per-day-per-instance dedupe for the kill-switch alert. Reset at
// midnight UTC because we compare against the YYYY-MM-DD date string.
let _killSwitchAlertedDate: string | null = null;

async function todaysSpendUsd(): Promise<number> {
  if (_spendCache && _spendCache.expiresAt > Date.now()) return _spendCache.total;
  try {
    const { createAdminClient } = await import("./supabase-server");
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("agent_invocations")
      .select("cost_usd")
      .gte("created_at", `${today}T00:00:00Z`);
    if (error) throw error;
    const total = (data ?? []).reduce(
      (sum: number, row: any) => sum + Number(row.cost_usd ?? 0),
      0
    );
    _spendCache = { total, expiresAt: Date.now() + 60_000 };
    return total;
  } catch {
    // Fail open on transient DB hiccup — better to allow than to block all AI.
    // Cache last-known value if we have one, else 0.
    return _spendCache?.total ?? 0;
  }
}

// Two-flag setup so we never accidentally route through the gateway when
// it isn't ready. AI_GATEWAY_ENABLED must be explicitly "true" — having a
// key alone isn't enough (the gateway 403s without a credit card on file).
// When disabled, fall through to direct Anthropic.
const GATEWAY_ENABLED =
  process.env.AI_GATEWAY_ENABLED === "true" && !!GATEWAY_KEY;

const _anthropic = new Anthropic({
  apiKey: GATEWAY_ENABLED ? GATEWAY_KEY : ANTHROPIC_KEY,
  ...(GATEWAY_ENABLED ? { baseURL: "https://ai-gateway.vercel.sh" } : {}),
});

// Wrap messages.create so every call auto-logs to agent_invocations with
// model + tokens + estimated cost. Existing call sites stay unchanged —
// they import `anthropic` and call `.messages.create(...)` exactly as before.
//
// Logging is fire-and-forget — failures NEVER block the user-facing response.
const _originalCreate = _anthropic.messages.create.bind(_anthropic.messages);

// Recognize errors that are worth retrying with a fallback model. 4xx
// (except 429) usually means our request is wrong — fallback won't help
// and would just double the cost. 5xx + network + timeout + rate-limit
// are the categories where a different provider can save the call.
function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const name = String(err?.name ?? "");
  if (name.includes("Timeout") || name.includes("Connection") || name.includes("APIConnection")) {
    return true;
  }
  const message = String(err?.message ?? "");
  if (/timed out|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|fetch failed|socket hang up/i.test(message)) {
    return true;
  }
  return false;
}

(_anthropic.messages as any).create = async function (
  params: any,
  options?: any
) {
  // Optional context tags via custom headers — they're no-ops on the API
  // and we strip them before they cause schema-validation issues. Both the
  // direct Anthropic API and Vercel AI Gateway ignore unknown x-* headers.
  const ctxAgent = params?._agent ?? null;
  const ctxTask = params?._task ?? null;
  const ctxJobId = params?._job_id ?? null;
  // Law 3 — Bounded Cost: per-call timeout (default 60s) and max_tokens
  // ceiling. Override per-call via `_timeout_ms` (e.g. vision/thinking
  // calls that legitimately need longer). SDK default is 10 minutes — too
  // long for a hung connection.
  const ctxTimeoutMs = typeof params?._timeout_ms === "number" ? params._timeout_ms : 60_000;
  // SDK default maxRetries=2 means a 60s timeout → 180s real wait (initial +
  // 2 retries). For vision/long-context calls where the FIRST attempt is most
  // of the work, a single retry is plenty — pass `_max_retries: 0` or 1 to
  // override. Default 2 stays safe for short calls that benefit from retries.
  const ctxMaxRetries =
    typeof params?._max_retries === "number" ? params._max_retries : undefined;
  // Cross-provider fallback. Pass `_fallback_models: []` to opt out; pass
  // an explicit list to override the auto-derived chain. Auto-derivation
  // only fires when AI Gateway is on (direct Anthropic SDK can't route
  // to other providers).
  const explicitFallbacks: string[] | null = Array.isArray(params?._fallback_models)
    ? params._fallback_models
    : null;

  // Resolve per-agent override BEFORE stripping. After this line,
  // params.model may differ from what the agent originally requested.
  if (ctxAgent && params?.model) {
    params.model = modelForAgent(ctxAgent, params.model);
  }
  const primaryModel = params?.model ?? "unknown";

  // Build the candidate chain: primary first, then fallbacks. Skip
  // fallbacks in direct-Anthropic mode because the SDK client is pointed
  // at api.anthropic.com and cross-provider models would 404.
  const candidates: string[] = [primaryModel];
  if (GATEWAY_ENABLED) {
    const fallbackList = explicitFallbacks ?? fallbacksFor(primaryModel);
    for (const m of fallbackList) {
      if (m && m !== primaryModel && !candidates.includes(m)) {
        candidates.push(m);
      }
    }
  }

  // Strip ANY `_*` private context field so future call sites can't leak
  // unknown tags into the upstream API (Anthropic/Gateway both 400 on
  // unknown body params). Belt-and-suspenders over the explicit captures
  // above; the explicit captures still grab the tags we care about for
  // logging.
  if (params && typeof params === "object") {
    for (const k of Object.keys(params)) {
      if (k.startsWith("_")) delete params[k];
    }
    // Default a sane max_tokens ceiling so unbounded outputs can't run away.
    // Call sites that need more should pass max_tokens explicitly.
    if (params.max_tokens == null) {
      params.max_tokens = 4096;
    }
  }

  // Law 3 — kill-switch check. Refuse the call if today's spend has hit
  // the cap. This is the single most important guard against runaway loops.
  if (!KILL_SWITCH_OFF) {
    const spent = await todaysSpendUsd();
    if (spent >= DAILY_CAP_USD) {
      const err = new Error(
        `AI daily spend cap reached: $${spent.toFixed(2)} >= $${DAILY_CAP_USD.toFixed(2)}. ` +
          `Raise AI_DAILY_SPEND_CAP_USD or set AI_KILL_SWITCH_OFF=true to override.`
      );
      // Log the refusal so the kill-switch is visible in spend dashboards.
      const killT0 = Date.now();
      Promise.resolve().then(async () => {
        try {
          const { createAdminClient } = await import("./supabase-server");
          const admin = createAdminClient();
          await admin.from("agent_invocations").insert({
            model: primaryModel,
            agent: ctxAgent,
            task: ctxTask,
            job_id: ctxJobId,
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0,
            duration_ms: Date.now() - killT0,
            error: "kill_switch: daily_cap_reached",
          });
        } catch {}
      });

      // Email alert on FIRST trip per day per instance. Without this, you
      // find out the cap fired by reading the audit log next morning. With
      // it, you know within a minute. Per-instance dedupe is sufficient —
      // worst case a few emails on day-of-trip from concurrent cold starts.
      const today = new Date().toISOString().slice(0, 10);
      if (_killSwitchAlertedDate !== today) {
        _killSwitchAlertedDate = today;
        Promise.resolve().then(async () => {
          try {
            const opsEmail = process.env.OPERATOR_EMAIL?.trim();
            if (!opsEmail) return;
            const { sendEmail } = await import("./resend");
            await sendEmail({
              to: opsEmail,
              subject: `[FirstCall OS] AI kill-switch tripped — daily cap $${DAILY_CAP_USD} reached`,
              html: `
                <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;padding:24px;color:#111;">
                  <h2 style="margin:0 0 8px;color:#b91c1c;">⛔ AI kill-switch tripped</h2>
                  <p style="margin:0 0 16px;">Today's spend reached <strong>$${spent.toFixed(2)}</strong> — at or above the configured cap of <strong>$${DAILY_CAP_USD.toFixed(2)}</strong>. All AI calls will refuse until midnight UTC or until the cap is raised.</p>
                  <p style="margin:0 0 8px;"><strong>To override now:</strong></p>
                  <ul style="margin:0 0 16px;padding-left:20px;">
                    <li>Raise <code>AI_DAILY_SPEND_CAP_USD</code> in Vercel env</li>
                    <li>Or set <code>AI_KILL_SWITCH_OFF=true</code> to bypass entirely</li>
                  </ul>
                  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Logged at /activity as <code>kill_switch: daily_cap_reached</code>. One alert per day per instance — subsequent trips today are silenced.</p>
                </div>
              `,
            });
          } catch {} // Email failure must not break anything
        });
      }

      throw err;
    }
  }

  // Fallback loop. Try each candidate model in turn. Every attempt logs
  // its own row to agent_invocations so the dashboard sees fallback usage:
  // a job that hit Anthropic 5xx then succeeded on Gemini shows two rows
  // (one error, one success), making fallback frequency observable.
  let lastError: any = null;
  for (let i = 0; i < candidates.length; i++) {
    const attemptModel = candidates[i];
    const attemptT0 = Date.now();
    params.model = attemptModel;
    try {
      const result = await _originalCreate(params, {
        ...(options ?? {}),
        timeout: ctxTimeoutMs,
        ...(ctxMaxRetries !== undefined ? { maxRetries: ctxMaxRetries } : {}),
      });
      const tIn = (result as any)?.usage?.input_tokens ?? 0;
      const tOut = (result as any)?.usage?.output_tokens ?? 0;
      const wasFallback = i > 0;
      Promise.resolve().then(async () => {
        try {
          const [{ priceCall }, { createAdminClient }] = await Promise.all([
            import("./ai-cost"),
            import("./supabase-server"),
          ]);
          const admin = createAdminClient();
          await admin.from("agent_invocations").insert({
            model: attemptModel,
            agent: ctxAgent,
            task: ctxTask,
            job_id: ctxJobId,
            tokens_in: tIn,
            tokens_out: tOut,
            cost_usd: priceCall(attemptModel, tIn, tOut),
            duration_ms: Date.now() - attemptT0,
            // Annotate fallback successes so the dashboard can flag them.
            // Stored in `error` column (no separate "fallback" column yet);
            // dashboards that filter on error must also exclude this prefix.
            error: wasFallback ? `fallback_used: primary=${primaryModel}` : null,
          });
        } catch {
          // Logging must never break a request
        }
      });
      return result;
    } catch (err: any) {
      lastError = err;
      const willRetry = i < candidates.length - 1 && isRetryableError(err);
      Promise.resolve().then(async () => {
        try {
          const { createAdminClient } = await import("./supabase-server");
          const admin = createAdminClient();
          await admin.from("agent_invocations").insert({
            model: attemptModel,
            agent: ctxAgent,
            task: ctxTask,
            job_id: ctxJobId,
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0,
            duration_ms: Date.now() - attemptT0,
            error: String(err?.message ?? err).slice(0, 500),
          });
        } catch {}
      });
      if (!willRetry) throw err;
      // Otherwise loop continues with next candidate model.
    }
  }
  // Should be unreachable — loop returns on success or throws on final
  // failure. Defensive throw in case the loop body is restructured.
  throw lastError ?? new Error("AI call failed after exhausting fallback chain.");
};

export const anthropic = _anthropic;

export const AI_PROVIDER: "gateway" | "direct" = GATEWAY_ENABLED ? "gateway" : "direct";

const PROVIDER_PREFIX = GATEWAY_ENABLED ? "anthropic/" : "";

/**
 * Tiered models. Pick by what the task actually needs.
 *
 * FAST (Haiku 4.5) — classification, parsing, lead research, light extraction.
 *   Cheap + fast. Use whenever a precise schema is enforced and the task is
 *   not multi-hop.
 *
 * BALANCED (Sonnet 4.6) — drafts that a human reviews (estimates, legal docs,
 *   adjuster outreach). Good reasoning at moderate cost. Default for "agent
 *   produces a draft, person approves."
 *
 * SMART (Opus 4.7) — vision-heavy scope analysis (Argus), chat/orchestration
 *   (Solomon), anything where wrong answers are expensive.
 */
export const MODELS = {
  FAST: `${PROVIDER_PREFIX}claude-haiku-4-5`,
  BALANCED: `${PROVIDER_PREFIX}claude-sonnet-4-6`,
  SMART: `${PROVIDER_PREFIX}claude-opus-4-7`,
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * Pick a model by intent without thinking about provider strings:
 *   modelFor("fast") → "claude-haiku-4-5"
 */
export function modelFor(tier: Lowercase<ModelTier> | ModelTier): string {
  const upper = tier.toUpperCase() as ModelTier;
  return MODELS[upper];
}
