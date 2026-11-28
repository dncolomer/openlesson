import type { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { checkRateLimitAsync } from "@/lib/pow-api/rate-limit";

/**
 * Best-effort client IP extraction for serverless/edge rate limiting.
 */
export function clientIpFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Enforce a per-IP rate limit scoped to an endpoint name.
 * Returns null when allowed, or a 429 NextResponse with Retry-After header.
 */
export async function enforceIpRateLimit(
  req: NextRequest,
  scope: string,
  limitPerMinute: number,
): Promise<NextResponse | null> {
  const ip = clientIpFromRequest(req);
  const result = await checkRateLimitAsync(`ip:${scope}:${ip}`, limitPerMinute);
  if (result.allowed) return null;

  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  const res = jsonError(429, "Too many requests. Please try again shortly.");
  res.headers.set("Retry-After", String(retryAfterSec));
  res.headers.set("X-RateLimit-Limit", String(result.limit));
  res.headers.set("X-RateLimit-Remaining", "0");
  return res;
}
