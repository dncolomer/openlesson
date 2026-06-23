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

export function checkRateLimit(keyId: string, limit: number): RateLimitResult {
  const now = Date.now();
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

/** Test helper */
export function resetRateLimitsForTests() {
  buckets.clear();
}