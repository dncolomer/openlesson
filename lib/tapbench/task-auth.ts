import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import type { AuthContext } from "@/lib/pow-api/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireTapbenchTaskAuth(
  req: NextRequest,
  workspaceId: string,
): Promise<
  | { ok: true; auth: AuthContext; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const authed = await authenticateRequest(req, "workspaces:write");
  if (authed instanceof NextResponse) return { ok: false, response: authed };
  if (authed.auth.auth_method !== "tapbench_key") {
    return {
      ok: false,
      response: errorResponse(
        403,
        "forbidden",
        "This action requires a TAPBench key for this Benchmark Task",
      ),
    };
  }
  if (authed.auth.tapbench_workspace_id !== workspaceId) {
    return {
      ok: false,
      response: errorResponse(
        403,
        "forbidden",
        "This TAPBench key is not issued for this Benchmark Task",
      ),
    };
  }
  return { ok: true, auth: authed.auth, supabase: authed.supabase };
}
