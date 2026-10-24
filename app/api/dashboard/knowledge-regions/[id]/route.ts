/**
 * Owner dashboard: one Knowledge region.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  dashboardKnowledgeRegionHref,
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";
import { workspaceProductShell } from "@/lib/workspace-kind";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const requested = parseDashboardKnowledgeRegionKind(
      req.nextUrl.searchParams.get("kind"),
    );

    const { data: workspaces } = await auth.supabase
      .from("workspaces")
      .select("id, title, root_topic, workspace_kind")
      .eq("user_id", auth.user.id)
      .neq("status", "archived");
    const listed = Array.isArray(workspaces) ? workspaces : [];
    const ids = listed.map((row) => String(row.id || "")).filter(Boolean);
    if (ids.length === 0) return jsonError(404, "Region not found");

    const { data: row, error } = await auth.supabase
      .from("custom_verification_models")
      .select("id, workspace_id, name, description, subject_count, created_at, embedding_model_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return jsonError(404, "Region not found");

    const workspace = listed.find((item) => String(item.id) === String(row.workspace_id));
    if (!workspace) return jsonError(404, "Region not found");
    const kind =
      requested ||
      (workspaceProductShell(workspace.workspace_kind) === "calibration"
        ? "calibration"
        : "verification");
    const presented = presentDashboardKnowledgeRegions(listed, [row], kind)[0];
    if (!presented) return jsonError(404, "Region not found");
    return NextResponse.json({
      kind,
      region: presented,
      regionPath: dashboardKnowledgeRegionHref(kind, presented.id),
      workspaceId: presented.workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load knowledge region";
    return jsonError(500, message);
  }
}
