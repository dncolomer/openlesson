/**
 * Shared API error codes for product + agent v3.
 * `code` is an honest string — product codes are first-class, not remapped
 * through a closed Proof-of-Work enum.
 */

export const KNOWN_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limit_exceeded",
  "internal_error",
  "validation_error",
  "session_expired",
  "session_revoked",
  "aycl_authoring_required",
  "profile_required",
  "product_access_required",
  "auth_required",
  "api_plan_required",
  "guest_missing",
  "schema_outdated",
  "invalid_link",
  "block_not_found",
  "unusable_ground",
  "relocate_collision",
  "cells_occupied",
  "revoked",
  "archived",
  "not_public",
  "block_required",
  "email_exists",
  "group_mode_removed",
  "workspace_not_found",
  "no_new_pow",
  "model_id_required",
  "custom_verification_model_error",
  "region_id_required",
  "knowledge_distance_error",
  "key_revoked",
  "key_expired",
  "guest_not_found",
  "performance_report_generation_failed",
  "usage_limit_reached",
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];
export type ErrorCode = KnownErrorCode;

const KNOWN_ERROR_CODE_SET = new Set<string>(KNOWN_ERROR_CODES);

export interface TapbenchErrorDetails {
  expires_at?: string;
  remaining_ms?: number;
  tapbench?: boolean;
}

export type ApiErrorDetails = TapbenchErrorDetails & Record<string, unknown>;

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ApiErrorDetails;
}

export function statusToErrorCode(status: number): ErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit_exceeded";
  if (status >= 500) return "internal_error";
  return "validation_error";
}

/** Closed set only. Unknown / empty → fallback. */
export function toErrorCode(value: unknown, fallback: ErrorCode = "internal_error"): ErrorCode {
  if (typeof value === "string" && KNOWN_ERROR_CODE_SET.has(value.trim())) {
    return value.trim() as ErrorCode;
  }
  return fallback;
}
