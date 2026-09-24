/**
 * Rate limiter — in-process Map by default; Redis when RATE_LIMIT_REDIS_URL is set.
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

type RedisLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
};

let redisClient: RedisLike | null | undefined;

async function getRedis(): Promise<RedisLike | null> {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.RATE_LIMIT_REDIS_URL?.trim();
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    // Dynamic import so CI/local without ioredis still works.
    const mod = await import("ioredis").catch(() => null);
    if (!mod) {
      console.warn("[rate-limit] RATE_LIMIT_REDIS_URL set but ioredis not installed; using memory");
      redisClient = null;
      return null;
    }
    const Redis = mod.default;
    const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect().catch(() => undefined);
    redisClient = client;
    return client;
  } catch (err) {
    console.warn("[rate-limit] redis init failed", err instanceof Error ? err.message : err);
    redisClient = null;
    return null;
  }
}

async function rateLimitRedis(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const rkey = `rl:${opts.key}`;
  try {
    const count = await redis.incr(rkey);
    if (count === 1) await redis.pexpire(rkey, opts.windowMs);
    const ttl = await redis.pttl(rkey);
    if (count > opts.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttl, 0) / 1000)),
      };
    }
    return {
      ok: true,
      remaining: Math.max(0, opts.limit - count),
      retryAfterSeconds: 0,
    };
  } catch {
    return null;
  }
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

export function sweepRateLimitBuckets(): void {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

let checkCount = 0;

/** Sync path — memory only (call sites that cannot await). */
export function rateLimitChecked(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  checkCount += 1;
  if (checkCount % 500 === 0) sweepRateLimitBuckets();
  return rateLimit(opts);
}

/** Prefer Redis when configured; fall back to memory. */
export async function rateLimitCheckedAsync(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const viaRedis = await rateLimitRedis(opts);
  if (viaRedis) return viaRedis;
  return rateLimitChecked(opts);
}
