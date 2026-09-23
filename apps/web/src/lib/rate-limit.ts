/**
 * In-process rate limiter (Map keyed by IP + route).
 * Optional Redis can replace this later; Map is fine for single-instance MVP.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterSeconds: 0 };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Periodic cleanup to avoid unbounded Map growth. */
export function sweepRateLimitBuckets(): void {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

// Opportunistic sweep every ~500 checks via counter
let checkCount = 0;
export function rateLimitChecked(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  checkCount += 1;
  if (checkCount % 500 === 0) sweepRateLimitBuckets();
  return rateLimit(opts);
}
