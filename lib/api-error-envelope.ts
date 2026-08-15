/**
 * One error envelope for agent v3 and product (workspace / TAP / ILE / session-chat).
 * Shape: `{ error: { code, message } }`.
 */

import { NextResponse } from "next/server";
import {
  statusToErrorCode,
  toErrorCode,
  type ApiError,
  type ErrorCode,
} from "@/lib/api/error-codes";

export type { ApiError, ErrorCode };
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
  extras?: Record<string, unknown>,
): { error: ApiError } {
  const extraFields = extras && Object.keys(extras).length > 0 ? extras : null;
  return {
    error: {
      code,
      message,
      ...(extraFields || {}),
    },
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
  code?: ErrorCode,
  details?: Record<string, unknown>,
): NextResponse {
  const text = String(message || "").trim() || "Request failed";
  const typed = toErrorCode(code, statusToErrorCode(status));
  return NextResponse.json(buildNestedApiErrorEnvelope(typed, text, details), {
    status,
  });
}
