/**
 * One authenticator for /api/v3/stash/* — API key or TAPBench token.
 */

import { NextRequest, NextResponse } from "next/server";
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
        response: NextResponse.json(
          { error: { code: tb.code, message: tb.message, ...(tb.body || {}) } },
          { status: tb.status },
        ),
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
  const tb = await resolveStashTapbenchFromRequest(req, supabase, {
    body,
    workspaceId,
  });
  if (tb.mode === "error") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: tb.code, message: tb.message, ...(tb.body || {}) } },
        { status: tb.status },
      ),
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
