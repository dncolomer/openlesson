/**
 * One authenticator for /api/v3/stash/* — API key only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/pow-api/auth";
import type { AuthContext } from "@/lib/pow-api/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthenticateStashResult =
  | {
      ok: true;
      auth: AuthContext;
      supabase: SupabaseClient;
    }
  | { ok: false; response: NextResponse };

export async function authenticateStashRequest(
  req: NextRequest,
  _workspaceId: string,
  _body: Record<string, unknown>,
): Promise<AuthenticateStashResult> {
  const apiAuth = await authenticateRequest(req, "workspaces:write");
  if (apiAuth instanceof NextResponse) {
    return { ok: false, response: apiAuth };
  }
  return { ok: true, auth: apiAuth.auth, supabase: apiAuth.supabase };
}
