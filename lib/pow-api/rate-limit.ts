const WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

function pruneExpiredBuckets(now: number) {
  // Best-effort durability: prevent unbounded Map growth across warm serverless instances.
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

function checkLocalRateLimit(keyId: string, limit: number): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const safeLimit = Math.max(1, limit);
  let bucket = buckets.get(keyId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(keyId, bucket);
  }

  if (bucket.count >= safeLimit) {
    return {
      allowed: false,
      limit: safeLimit,
      remaining: 0,
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/**
 * Optional shared rate limit via Upstash Redis REST when env is configured.
 * Falls back to in-process map so API stays available without Redis.
 */
async function checkUpstashRateLimit(keyId: string, limit: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const safeLimit = Math.max(1, limit);
  const redisKey = `agent-rl:${keyId}`;
  const now = Date.now();
  const windowSec = Math.ceil(WINDOW_MS / 1000);

  try {
    // INCR + EXPIRE pipeline via Upstash REST
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSec, "NX"],
        ["PTTL", redisKey],
      ]),
      // Do not hang request if Redis is slow — caller falls back.
      signal: AbortSignal.timeout(800),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number | string }>;
    const count = Number(data?.[0]?.result ?? 0);
    const pttl = Number(data?.[2]?.result ?? WINDOW_MS);
    const resetAt = now + (pttl > 0 ? pttl : WINDOW_MS);

    if (!Number.isFinite(count) || count <= 0) return null;

    if (count > safeLimit) {
      return {
        allowed: false,
        limit: safeLimit,
        remaining: 0,
        resetAt,
      };
    }

    return {
      allowed: true,
      limit: safeLimit,
      remaining: Math.max(0, safeLimit - count),
      resetAt,
    };
  } catch {
    return null;
  }
}

/**
 * Rate limit check. Uses Upstash when configured; otherwise process-local map
 * (same availability semantics as before, with bucket pruning).
 */
export function checkRateLimit(keyId: string, limit: number): RateLimitResult {
  return checkLocalRateLimit(keyId, limit);
}

/** Async variant used by agent auth when shared store may be available. */
export async function checkRateLimitAsync(keyId: string, limit: number): Promise<RateLimitResult> {
  const shared = await checkUpstashRateLimit(keyId, limit);
  if (shared) return shared;
  return checkLocalRateLimit(keyId, limit);
}

/** Test helper */
export function resetRateLimitsForTests() {
  buckets.clear();
}
