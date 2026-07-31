/**
 * Resolve TAPBench session context for Stash/Submit routes.
 * Session token may be provided via X-Tapbench-Session, body.session_token,
 * or Authorization Bearer (when it resolves as a TAPBench token).
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractTapbenchSessionToken,
  resolveTapbenchSessionToken,
} from "./tapbench-store";
import {
  stashTapbenchContextFromResolved,
  type StashTapbenchContext,
} from "./stash-api";
import type { ResolveTapbenchSessionError } from "./tapbench";

export type StashTapbenchAuthResult =
  | { ok: true; tapbench: StashTapbenchContext; workspaceId: string }
  | { ok: false; error: ResolveTapbenchSessionError | { ok: false; code: "missing"; message: string } };

/**
 * Try to load TAPBench context from the request. Returns null context when no token
 * was provided (caller continues with normal API-key auth). When a token is present
 * but invalid/expired, returns ok: false so the route can reject.
 */
export async function resolveStashTapbenchFromRequest(
  req: NextRequest,
  supabase: SupabaseClient,
  options?: {
    body?: Record<string, unknown> | null;
    workspaceId?: string;
    nowMs?: number;
    /** When true, missing token is ok:false missing; default treats missing as no-op. */
    requireToken?: boolean;
  },
): Promise<
  | { mode: "none" }
  | { mode: "ok"; tapbench: StashTapbenchContext; workspaceId: string }
  | { mode: "error"; status: number; code: string; message: string; body?: Record<string, unknown> }
> {
  const body = options?.body ?? null;
  const token = extractTapbenchSessionToken({
    authorizationHeader: req.headers.get("Authorization"),
    tapbenchHeader: req.headers.get("X-Tapbench-Session") || req.headers.get("x-tapbench-session"),
    bodySessionToken: body?.session_token ?? body?.sessionToken,
  });

  if (!token) {
    if (options?.requireToken) {
      return {
        mode: "error",
        status: 401,
        code: "unauthorized",
        message: "TAPBench session token is required",
      };
    }
    return { mode: "none" };
  }

  const resolved = await resolveTapbenchSessionToken(
    supabase,
    token,
    options?.nowMs ?? Date.now(),
  );

  if (!resolved.ok) {
    if (resolved.code === "session_expired") {
      return {
        mode: "error",
        status: 401,
        code: "session_expired",
        message: resolved.message,
        body: {
          expires_at: resolved.expires_at,
          remaining_ms: 0,
          tapbench: true,
        },
      };
    }
    if (resolved.code === "session_revoked") {
      return {
        mode: "error",
        status: 401,
        code: "session_revoked",
        message: resolved.message,
        body: { tapbench: true },
      };
    }
    // Token looked like a TAPBench attempt but not found — if also using API key path,
    // callers may ignore not_found when Bearer is an API key. We only hard-fail when
    // X-Tapbench-Session or body.session_token was explicit.
    const explicit =
      Boolean(req.headers.get("X-Tapbench-Session") || req.headers.get("x-tapbench-session")) ||
      Boolean(body?.session_token || body?.sessionToken);
    if (!explicit) {
      return { mode: "none" };
    }
    return {
      mode: "error",
      status: 401,
      code: "session_not_found",
      message: resolved.message,
      body: { tapbench: true },
    };
  }

  if (options?.workspaceId && resolved.workspace_id !== options.workspaceId) {
    return {
      mode: "error",
      status: 403,
      code: "forbidden",
      message: "TAPBench session does not match this workspace",
      body: { tapbench: true },
    };
  }

  return {
    mode: "ok",
    tapbench: stashTapbenchContextFromResolved(resolved),
    workspaceId: resolved.workspace_id,
  };
}
