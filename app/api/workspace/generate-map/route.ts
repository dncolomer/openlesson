import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { blockMapGlyphDbFields } from "@/lib/block-map-glyph";
import { buildGenerateMap } from "@/lib/generate-map";
import { insertGeneratedWorkspaceBlocks } from "@/lib/insert-workspace-blocks";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";
import { placedBlockCells, type PlacedBlockRef } from "@/lib/skill-grid-ops";
import type { WorkspaceBlockRef } from "@/lib/workspace-spatial-create";

export const runtime = "nodejs";
export const maxDuration = 180;

interface GeneratedBlockCopy {
  title?: string;
  description?: string;
  keyword?: string;
}

/**
 * Creator Generate Map: fill an empty cell with the chosen map type.
 * The foundation lands on that empty cell. Existing blocks are not replaced.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const mapTypeId = typeof body.mapTypeId === "string" ? body.mapTypeId.trim() : "";
    const modifier = typeof body.modifier === "string" ? body.modifier : "";
    const anchorRow = Number(body.anchorRow);
    const anchorCol = Number(body.anchorCol);
    if (!workspaceId || !mapTypeId || !Number.isInteger(anchorRow) || !Number.isInteger(anchorCol)) {
      return jsonError(400, "workspaceId, map type, and an empty anchor cell are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, notes, workspace_goal, unusable_cells")
      .eq("id", workspaceId)
      .single();
    if (planError || !plan) return jsonError(404, "Workspace not found");

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("id, position_x, position_y, span_w, span_h, shape_cells")
      .eq("workspace_id", workspaceId);
    if (nodesError || !nodes) return jsonError(500, "Failed to fetch blocks");

    const occupied: Array<{ row: number; col: number }> = [];
    for (const node of nodes) {
      if (typeof node.position_x !== "number" || typeof node.position_y !== "number") continue;
      const placed: PlacedBlockRef = {
        id: node.id,
        position_x: node.position_x,
        position_y: node.position_y,
        span_w: node.span_w,
        span_h: node.span_h,
        shape_cells: node.shape_cells as PlacedBlockRef["shape_cells"],
      };
      for (const cell of placedBlockCells(placed)) occupied.push(cell);
    }
    for (const cell of normalizeUnusableCells(plan.unusable_cells)) occupied.push(cell);
    if (occupied.some((cell) => cell.row === anchorRow && cell.col === anchorCol)) {
      return jsonError(409, "Select an empty cell");
    }

    const { data: files } = await supabase
      .from("workspace_files")
      .select("file_name")
      .eq("workspace_id", workspaceId);

    const planResult = buildGenerateMap({
      anchor: { row: anchorRow, col: anchorCol },
      modifier,
      mapTypeId,
      occupied,
      goal: plan.workspace_goal || plan.root_topic,
      notes: plan.notes,
      fileNames: (files || [])
        .map((file) => (typeof file.file_name === "string" ? file.file_name : ""))
        .filter(Boolean),
    });
    if (planResult.placements.length === 0) {
      return jsonError(409, "No free cells for this map type around the selected block");
    }

    const slotList = planResult.placements
      .map((cell, index) => `${index + 1}. position_x=${cell.position_x}, position_y=${cell.position_y}`)
      .join("\n");
    const response = await callXaiJSON<{ blocks?: GeneratedBlockCopy[] }>(
      [
        userMessage(`${planResult.prompt}

Return JSON with exactly ${planResult.placements.length} blocks, in this order:
${slotList}

{
  "blocks": [
    { "title": "3-8 words", "description": "1 sentence", "keyword": "Two Words" }
  ]
}`),
      ],
      {
        model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL,
        maxTokens: Math.min(5000, 900 + planResult.placements.length * 120),
        temperature: 0.3,
      },
    );
    const copies = response.success && response.data?.blocks ? response.data.blocks : [];
    const blocks: WorkspaceBlockRef[] = planResult.placements.map((cell, index) => {
      const copy = copies[index];
      const title =
        (typeof copy?.title === "string" && copy.title.trim()) ||
        `${modifier.trim() || "Map"} ${index + 1}`;
      const glyph = blockMapGlyphDbFields(
        { keyword: copy?.keyword, title },
        title,
      );
      return {
        id: `gm${index + 1}`,
        title: title.slice(0, 180),
        description:
          typeof copy?.description === "string" ? copy.description.trim().slice(0, 500) : "",
        is_start: false,
        next: [],
        position_x: cell.position_x,
        position_y: cell.position_y,
        map_keyword: glyph.map_keyword,
        map_icon: glyph.map_icon,
      };
    });

    await insertGeneratedWorkspaceBlocks(supabase, workspaceId, blocks);

    const occupiedKeys = new Set(occupied.map((cell) => `${cell.row}:${cell.col}`));
    const mergedUnusable = normalizeUnusableCells([
      ...normalizeUnusableCells(plan.unusable_cells),
      ...planResult.translatedBlocked.filter((cell) => {
        if (cell.row === anchorRow && cell.col === anchorCol) return false;
        return !occupiedKeys.has(`${cell.row}:${cell.col}`);
      }),
    ]);
    await supabase
      .from("workspaces")
      .update({ unusable_cells: mergedUnusable })
      .eq("id", workspaceId);

    const { data: updatedNodes, error: fetchError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);
    if (fetchError) {
      return jsonError(500, "Blocks created but failed to refresh the map");
    }

    return NextResponse.json({
      planModified: true,
      added: blocks.length,
      mapTypeId: planResult.mapTypeId,
      updatedNodes: updatedNodes || [],
      unusable_cells: mergedUnusable,
    });
  } catch (error) {
    console.error("[workspace/generate-map]", error);
    return jsonError(500, error instanceof Error ? error.message : "Internal error");
  }
}
