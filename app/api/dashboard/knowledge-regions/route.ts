/**
 * Owner dashboard: Knowledge regions for Verification, Calibration, or Solve flows.
 * Create goes through region simulation, not attach-from-flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";
import { parseProductFlowKind } from "@/lib/product-flow";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const kind = parseDashboardKnowledgeRegionKind(
      new URL(req.url).searchParams.get("kind"),
    );
    if (!kind) return jsonError(400, "kind must be verification, calibration, or solve");

    const { data: rows, error } = await auth.supabase
      .from("knowledge_regions")
      .select(
        "id, workspace_id, owner_user_id, product, name, description, subject_count, created_at, embedding_model_id",
      )
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ kind, regions: [] });
    }

    return NextResponse.json({
      kind,
      regions: presentDashboardKnowledgeRegions(rows || [], kind, auth.user.id),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load knowledge regions";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const kind = parseProductFlowKind(body.kind) || parseDashboardKnowledgeRegionKind(body.kind);
    if (!kind) return jsonError(400, "kind must be verification, calibration, or solve");
    return jsonError(400, "Regions are created by running a simulation");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create knowledge region";
    return jsonError(500, message);
  }
}
