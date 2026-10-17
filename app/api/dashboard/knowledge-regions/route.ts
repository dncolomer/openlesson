/**
 * Owner dashboard: Knowledge regions on Verification or Calibration workspaces.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const kind = parseDashboardKnowledgeRegionKind(
      new URL(req.url).searchParams.get("kind"),
    );
    if (!kind) return jsonError(400, "kind must be verification or calibration");

    const { data: workspaces, error: workspaceError } = await auth.supabase
      .from("workspaces")
      .select("id, title, root_topic, workspace_kind")
      .eq("user_id", auth.user.id)
      .neq("status", "archived");

    if (workspaceError) {
      return NextResponse.json({ kind, regions: [] });
    }

    const listed = Array.isArray(workspaces) ? workspaces : [];
    const ids = listed.map((row) => String(row.id || "")).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ kind, regions: [] });
    }

    const { data: rows, error } = await auth.supabase
      .from("custom_verification_models")
      .select("id, workspace_id, name, description, subject_count, created_at")
      .in("workspace_id", ids)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ kind, regions: [] });
    }

    return NextResponse.json({
      kind,
      regions: presentDashboardKnowledgeRegions(listed, rows || [], kind),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load knowledge regions";
    return jsonError(500, message);
  }
}
