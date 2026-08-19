/**
 * One error envelope for agent v3 and product (workspace / TAP / ILE / session-chat).
 * Shape: `{ error: { code, message } }`.
 */

import { NextResponse } from "next/server";
import {
  statusToErrorCode,
  toErrorCode,
  type ApiError,
  type ApiErrorDetails,
  type ErrorCode,
  type TapbenchErrorDetails,
} from "@/lib/api/error-codes";

export type { ApiError, ApiErrorDetails, ErrorCode, TapbenchErrorDetails };
export { statusToErrorCode, toErrorCode };

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
  details?: ApiErrorDetails,
): { error: ApiError } {
  const extra =
    details && Object.keys(details).length > 0 ? details : undefined;
  return {
    error: extra
      ? { code, message, details: extra }
      : { code, message },
  };
}

/** Message from either nested or legacy string envelopes. */
export function errorMessageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

export function jsonError(
  status: number,
  message: string,
  code?: ErrorCode | string,
  details?: ApiErrorDetails,
): NextResponse {
  const text = String(message || "").trim() || "Request failed";
  const typed = toErrorCode(code, statusToErrorCode(status));
  return NextResponse.json(buildNestedApiErrorEnvelope(typed, text, details), {
    status,
  });
}
