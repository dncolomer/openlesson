import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  AYCL_LANDING_WORKSPACE_SELECT,
  assembleAyclLandingSummary,
  fetchAyclLandingBlocks,
} from "@/lib/aycl-landing";
import { presentPublicMapCatalogItem } from "@/lib/dashboard-home-catalog";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const workspaceId = String(id || "").trim();
    if (!workspaceId) return jsonError(400, "workspace id required");

    const { data: workspace, error } = await auth.supabase
      .from("workspaces")
      .select(`${AYCL_LANDING_WORKSPACE_SELECT}, created_at, is_public, is_play_copy, workspace_kind`)
      .eq("id", workspaceId)
      .eq("is_public", true)
      .maybeSingle();
    if (error) return jsonError(500, error.message);
    const card = presentPublicMapCatalogItem(workspace);
    if (!workspace || !card) return jsonError(404, "Map not found");

    const { data: blocks, error: blocksError } = await fetchAyclLandingBlocks(
      auth.supabase,
      workspaceId,
    );
    if (blocksError) return jsonError(500, blocksError.message || "Failed to load map");

    const landing = assembleAyclLandingSummary({
      workspace,
      blocks: blocks || [],
    });
    return NextResponse.json({ map: card, landing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load map";
    return jsonError(500, message);
  }
}
