/**
 * Shared API error codes for product + agent v3.
 * `code` is an honest string — product codes are first-class, not remapped
 * through a closed Proof-of-Work enum.
 */

export type ErrorCode = string;

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export function statusToErrorCode(status: number): ErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit_exceeded";
  if (status >= 500) return "internal_error";
  return "validation_error";
}

/** Non-empty string codes pass through. Empty / non-string → fallback. */
export function toErrorCode(value: unknown, fallback: ErrorCode = "internal_error"): ErrorCode {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}
