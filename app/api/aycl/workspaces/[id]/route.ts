import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AYCL_LANDING_WORKSPACE_SELECT,
  assembleAyclLandingSummary,
  fetchAyclLandingBlocks,
} from "@/lib/aycl-landing";

export const runtime = "nodejs";

/**
 * GET — public catalog payload for one All-You-Can-Learn workspace landing.
 * Only returns workspaces flagged is_all_you_can_learn.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const workspaceId = String(id || "").trim();
    if (!workspaceId) {
      return jsonError(400, "workspace id required");
    }

    const supabase = createAdminClient();
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select(`${AYCL_LANDING_WORKSPACE_SELECT}, created_at`)
      .eq("id", workspaceId)
      .eq("is_all_you_can_learn", true)
      .maybeSingle();

    if (error) {
      return jsonError(500, error.message);
    }
    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }

    const { data: blocks, error: blocksError } = await fetchAyclLandingBlocks(
      supabase,
      workspaceId,
    );

    if (blocksError) {
      return jsonError(500, blocksError.message || "Failed to load workspace landing");
    }

    const landing = assembleAyclLandingSummary({
      workspace,
      blocks: blocks || [],
    });

    return NextResponse.json({
      landing,
      workspace: {
        id: workspace.id,
        title: landing.title,
        description: landing.description,
        cover_image_url: landing.coverImageUrl,
      },
    });
  } catch (error) {
    console.error("[aycl/workspaces/id]", error);
    return jsonError(500, "Failed to load workspace landing");
  }
}
