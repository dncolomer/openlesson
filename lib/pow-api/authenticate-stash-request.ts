/**
 * One authenticator for /api/v3/stash/* — API key or TAPBench token.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { authenticateRequest, getServiceClient } from "@/lib/pow-api/auth";
import { resolveStashTapbenchFromRequest } from "@/lib/pow-api/stash-tapbench-auth";
import type { AuthContext } from "@/lib/pow-api/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StashTapbenchContext } from "@/lib/pow-api/stash-api";

export type AuthenticateStashResult =
  | {
      ok: true;
      auth: AuthContext;
      supabase: SupabaseClient;
      tapbenchCtx: StashTapbenchContext | null;
    }
  | { ok: false; response: NextResponse };

export async function authenticateStashRequest(
  req: NextRequest,
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<AuthenticateStashResult> {
  const apiAuth = await authenticateRequest(req, "workspaces:write");
  let auth: AuthContext;
  let supabase: SupabaseClient;
  let tapbenchCtx: StashTapbenchContext | null = null;

  if (apiAuth instanceof NextResponse) {
    supabase = await getServiceClient();
    const tb = await resolveStashTapbenchFromRequest(req, supabase, {
      body,
      workspaceId,
      requireToken: true,
    });
    if (tb.mode === "error") {
      return {
        ok: false,
        response: jsonError(tb.status, tb.message, tb.code, tb.body),
      };
    }
    if (tb.mode !== "ok") {
      return { ok: false, response: apiAuth };
    }
    tapbenchCtx = tb.tapbench;
    auth = {
      user_id: null,
      guest_user_id: tb.tapbench.guest_user_id,
      organization_id: null,
      is_org_admin: false,
      key_id: `tapbench:${tb.tapbench.linkId}`,
      scopes: ["workspaces:write"],
    };
    return { ok: true, auth, supabase, tapbenchCtx };
  }

  auth = apiAuth.auth;
  supabase = apiAuth.supabase;
  if (auth.auth_method === "tapbench_key") {
    const { stashContextFromTapbenchKey } = await import("@/lib/tapbench/pow-auth");
    const {
      assertTapbenchGuestForKey,
      supabaseTapbenchGuestStore,
      tapbenchGuestIdFromRequest,
    } = await import("@/lib/tapbench/guests");
    const fromKey = stashContextFromTapbenchKey(auth, workspaceId);
    if (!fromKey) {
      return {
        ok: false,
        response: jsonError(
          403,
          "This TAPBench key is not issued for this Benchmark Task",
          "forbidden",
        ),
      };
    }
    const guestId = tapbenchGuestIdFromRequest(req, body);
    if (!guestId) {
      return {
        ok: false,
        response: jsonError(
          400,
          "Mint a guest and send X-Tapbench-Guest (or guest_user_id) for this run",
          "validation_error",
        ),
      };
    }
    try {
      const guest = await assertTapbenchGuestForKey(
        supabaseTapbenchGuestStore(supabase),
        auth.key_id,
        guestId,
      );
      if (guest.stopped_at) {
        return {
          ok: false,
          response: jsonError(
            409,
            "This TAPBench guest run has been stopped",
            "session_stopped",
          ),
        };
      }
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err && typeof err.status === "number"
          ? err.status
          : 404;
      const message = err instanceof Error ? err.message : "Unknown TAPBench guest";
      return {
        ok: false,
        response: jsonError(status, message, "guest_not_found"),
      };
    }
    const withGuest: AuthContext = {
      ...auth,
      user_id: null,
      guest_user_id: guestId,
    };
    const ctx = stashContextFromTapbenchKey(withGuest, workspaceId);
    return { ok: true, auth: withGuest, supabase, tapbenchCtx: ctx };
  }
  const tb = await resolveStashTapbenchFromRequest(req, supabase, {
    body,
    workspaceId,
  });
  if (tb.mode === "error") {
    return {
      ok: false,
      response: jsonError(tb.status, tb.message, tb.code, tb.body),
    };
  }
  if (tb.mode === "ok") {
    tapbenchCtx = tb.tapbench;
    if (tb.tapbench.guest_user_id) {
      auth = {
        ...auth,
        user_id: null,
        guest_user_id: tb.tapbench.guest_user_id,
      };
    }
  }
  return { ok: true, auth, supabase, tapbenchCtx };
}
