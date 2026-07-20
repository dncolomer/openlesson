import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { loadWorkspaceProofOfWorkStats } from "@/lib/pow-api/proof-of-work-stats";

export const runtime = "nodejs";

/**
 * Cookie-auth Evaluation surface for workspace UI.
 * GET ?workspaceId=
 * POST { workspaceId, ayclToken? }
 */
async function handle(workspaceId: string, supabase: import("@supabase/supabase-js").SupabaseClient) {
  return loadWorkspaceProofOfWorkStats(supabase, workspaceId);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;
    const stats = await handle(workspaceId, auth.supabase);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[workspace/proof-of-work-stats] GET failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load proof-of-work stats" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const stats = await handle(workspaceId, auth.supabase);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[workspace/proof-of-work-stats] POST failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load proof-of-work stats" },
      { status: 500 }
    );
  }
}
