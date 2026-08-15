/**
 * Product/workspace routes still return `{ error: string }`.
 * Agent v3 / pow-api routes return `{ error: { code, message } }`.
 * OpenAPI/generated clients wait until these are one envelope.
 */

import type { ApiError, ErrorCode } from "@/lib/pow-api/types";

export type ApiErrorEnvelopeKind = "nested_code" | "string_error" | "unknown";

export function classifyApiErrorEnvelope(body: unknown): ApiErrorEnvelopeKind {
  if (!body || typeof body !== "object") return "unknown";
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") return "string_error";
  if (
    err &&
    typeof err === "object" &&
    typeof (err as { code?: unknown }).code === "string" &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return "nested_code";
  }
  return "unknown";
}

export function buildNestedApiErrorEnvelope(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): { error: ApiError } {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

/** True when agent + product routes share one envelope (they do not yet). */
export function apiErrorEnvelopesAreUnified(): boolean {
  return false;
}
