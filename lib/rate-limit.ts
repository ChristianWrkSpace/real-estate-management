// Simple in-memory sliding-window rate limiter.
// IMPORTANT: this is per-Vercel-instance (not global). For real production scale,
// swap for Upstash Redis. Good enough for early traffic + AI cost protection.

type Bucket = number[]; // timestamps in ms

const buckets = new Map<string, Bucket>();

interface RateLimitOptions {
  /** unique key (e.g., "user:{id}:ai" or "ip:{ip}:login") */
  key: string;
  /** max requests in the window */
  max: number;
  /** window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const arr = buckets.get(opts.key) ?? [];
  const recent = arr.filter((t) => t > cutoff);

  if (recent.length >= opts.max) {
    // Persist the hit so the security activity dashboard can surface it.
    // Fire-and-forget — we don't await, and we don't import logAudit at the
    // top to avoid forcing a server-only dependency on every checkRateLimit
    // call site (some callers run in edge / middleware contexts).
    import("./audit")
      .then(({ logAudit }) =>
        logAudit({
          user: null,
          action: "rate_limit.hit",
          entity_type: "rate_limit",
          details: { key: opts.key, max: opts.max, window_ms: opts.windowMs },
        })
      )
      .catch(() => {
        // Audit failures never break the request path
      });
    return {
      ok: false,
      remaining: 0,
      resetAt: recent[0] + opts.windowMs,
    };
  }

  recent.push(now);
  buckets.set(opts.key, recent);
  return {
    ok: true,
    remaining: opts.max - recent.length,
    resetAt: now + opts.windowMs,
  };
}

// Periodic cleanup so the Map doesn't grow unbounded.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export function maybeSweep(maxAgeMs: number = 60 * 60 * 1000) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const cutoff = now - maxAgeMs;
  for (const [key, arr] of buckets.entries()) {
    const recent = arr.filter((t) => t > cutoff);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}

// Common presets
export const LIMITS = {
  ai_call: { max: 30, windowMs: 60 * 1000 }, // 30 AI calls per minute per user
  ai_call_hourly: { max: 200, windowMs: 60 * 60 * 1000 },
  login_attempt: { max: 10, windowMs: 5 * 60 * 1000 }, // 10 login tries per 5 min per IP
} as const;
