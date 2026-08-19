import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { buildSkillGridLayout } from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import { buildOccupancyFromPlaced } from "@/lib/skill-grid-ops";
import { dispatchGridOp } from "@/lib/workspace-grid-ops/dispatch";
import { placedFromNodes, type GridOp } from "@/lib/workspace-grid-ops/shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const op = body.op as GridOp | undefined;
    if (!workspaceId || !op) {
      return jsonError(400, "workspaceId and op are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
      return jsonError(500, "Failed to fetch blocks");
    }

    const skillNodes = toSkillGridNodes(nodes);
    const { occupancy } = buildSkillGridLayout(skillNodes);
    const placed = placedFromNodes(nodes);
    const placedOccupancy = buildOccupancyFromPlaced(placed);

    const result = await dispatchGridOp(op, {
      supabase,
      workspaceId,
      body,
      nodes,
      occupancy,
      placed,
      placedOccupancy,
      skillNodes,
      userModel: body.model,
      locale: body.locale,
      prompt: body.prompt,
      cells: body.cells,
      blockIds: body.blockIds,
      dRow: body.dRow ?? 0,
      dCol: body.dCol ?? 0,
      title: body.title,
      description: body.description,
      blockId: body.blockId,
      stretchHandleBody: body.handle,
      isStartBody: body.is_start,
      weightedNeighbors: body.weightedNeighbors,
      contextSourceKeys: body.contextSourceKeys,
      dagDraft: body.dagDraft,
      dagId: body.dagId,
      placementsBody: body.placements,
    });
    if (result) return result;
    return jsonError(400, `Unknown op: ${op}`);
  } catch (error) {
    console.error("Grid ops error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return jsonError(status, message);
  }
}
