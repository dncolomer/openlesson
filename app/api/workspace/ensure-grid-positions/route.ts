import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { persistSkillGridPositions, toSkillGridNodes } from "@/lib/skill-grid-positions";

/** Backfill missing block coordinates for legacy workspaces without 2D data. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "Plan ID is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (nodesError || !nodes) {
      return jsonError(500, "Failed to fetch blocks");
    }

    const needsBackfill = nodes.some(
      (node) => node.position_x == null || node.position_y == null,
    );

    if (!needsBackfill) {
      return NextResponse.json({ changed: false, updatedNodes: nodes });
    }

    const skillNodes = toSkillGridNodes(nodes);
    await persistSkillGridPositions(supabase, skillNodes, {
      onlyWithoutSavedPosition: true,
    });

    const { data: updatedNodes, error: fetchError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (fetchError) {
      return jsonError(500, "Backfill failed to refresh nodes");
    }

    return NextResponse.json({ changed: true, updatedNodes: updatedNodes || [] });
  } catch (error) {
    console.error("Ensure grid positions error:", error);
    return jsonError(500, "Internal error");
  }
}