import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { jsonError } from "@/lib/api-error-envelope";

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse and validate a JSON request body against a Zod schema, returning a
 * standardized `jsonError(400, ...)` envelope on invalid JSON or schema failure.
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
  options?: { invalidJsonMessage?: string; fallbackMessage?: string },
): Promise<ParsedBody<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError(400, options?.invalidJsonMessage ?? "Invalid JSON body"),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message =
      firstIssue?.message || options?.fallbackMessage || "Invalid request body";
    return {
      ok: false,
      response: jsonError(400, message),
    };
  }

  return { ok: true, data: parsed.data };
}
