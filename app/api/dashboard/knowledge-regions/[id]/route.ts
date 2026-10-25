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

    const { data: row, error } = await auth.supabase
      .from("custom_verification_models")
      .select(
        "id, workspace_id, owner_user_id, product, name, description, subject_count, created_at, embedding_model_id",
      )
      .eq("id", id)
      .eq("owner_user_id", auth.user.id)
      .maybeSingle();
    if (error || !row) return jsonError(404, "Region not found");

    const kind =
      requested ||
      (row.product === "calibration" || row.product === "verification"
        ? row.product
        : "verification");
    const presented = presentDashboardKnowledgeRegions([row], kind, auth.user.id)[0];
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
