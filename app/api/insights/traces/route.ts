import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { fetchWorkspaceInsightThoughts } from "@/lib/insights-traces";

/**
 * GET /api/insights/traces?workspaceId=
 * Returns ILE thought traces for Knowledge Insights suggest/bookmark UI.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim();
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    // Workspace visibility is gated by RLS; missing row ⇒ not found / no access.
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError) {
      return jsonError(500, workspaceError.message);
    }
    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }

    const thoughts = await fetchWorkspaceInsightThoughts(supabase, workspaceId);
    return NextResponse.json({
      thoughts,
      count: thoughts.length,
    });
  } catch (error) {
    console.error("[insights/traces]", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to load thought traces");
  }
}
