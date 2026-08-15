/**
 * One error envelope for agent v3 and product (workspace / TAP / ILE / session-chat).
 * Shape: `{ error: { code, message } }`.
 */

import { NextResponse } from "next/server";
import { toErrorCode, type ApiError, type ErrorCode } from "@/lib/pow-api/types";

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

export function statusToErrorCode(status: number): ErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit_exceeded";
  if (status >= 500) return "internal_error";
  return "validation_error";
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
  details?: Record<string, unknown>,
): NextResponse {
  const text = String(message || "").trim() || "Request failed";
  const fallback = statusToErrorCode(status);
  const typed = toErrorCode(code, fallback);
  const extra =
    typeof code === "string" && code && code !== typed
      ? { ...(details || {}), product_code: code }
      : details;
  return NextResponse.json(buildNestedApiErrorEnvelope(typed, text, extra), {
    status,
  });
}
