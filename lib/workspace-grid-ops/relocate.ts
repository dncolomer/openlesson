import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import type { GridOpContext } from "./context";
import {
  loadWorkspaceContext,
  placedFromNodes,
  type AiBlockPayload,
  type AiSplitPayload,
} from "./shared";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { buildSkillGridLayout, type WeightedGridNeighbor } from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import {
  buildOccupancyFromPlaced,
  canPlaceAbsoluteCells,
  canPlaceFootprint,
  freeformShapeFromCells,
  isStretchHandle,
  mergeBlocksToFreeform,
  normalizeSpan,
  parseShapeCells,
  placedBlockCells,
  selectionIsFreeformLectureShape,
  splitBlocksToSingles,
  stretchBlockFromHandle,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { validateRelocatePlacements } from "@/lib/cluster-blocks";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";
import {
  composeGenerateShapeBlockSystemMessage,
  composeGenerateShapeBlockUserPrompt,
  composeMergeBlockSystemMessage,
  composeMergeBlockUserPrompt,
  composeSplitBlockSystemMessage,
  composeSplitBlockUserPrompt,
} from "@/lib/block-footprint-prompt";
import { composeJourneyGraphPromptSnippet } from "@/lib/workspace-authoring-prompt-context";
import { canPlaceOnMapGround, normalizeUnusableCells } from "@/lib/map-ground-rules";
import {
  buildShapeContextSourceOptions,
  composeShapeGenerationContext,
  enrichSelectedOptionsWithFetchedLinkBodies,
  shapeSelectionToGenerationSnippet,
  shapeSelectionToLocalContext,
} from "@/lib/shape-context-select";
import { fetchLinkBodyText } from "@/lib/fetch-link-body";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";
import { resolveCreateBlockIsStart } from "@/lib/block-starter-flag";
import {
  buildMultiBlockDagApplyUpdates,
  type MultiBlockDagDraft,
} from "@/lib/multi-block-dag";
import { normalizeLockUntilBlockIds } from "@/lib/map-ground-rules";
import {
  buildWorkspaceDagDeleteUpdates,
  normalizeWorkspaceDags,
  registerWorkspaceDagOnApply,
  removeWorkspaceDag,
  resolveWorkspaceDagForMutation,
} from "@/lib/workspace-dags";
import { buildCloneInsertPayload } from "@/lib/clone-block";
import { isCellOccupied } from "@/lib/block-skill-grid";
import {
  normalizeBlockPracticeOptions,
  serializeBlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  normalizeBlockCreatorEffects,
  serializeBlockCreatorEffects,
  validateBlockCreatorEffects,
} from "@/lib/block-creator-effects";

export async function handle_relocate(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    // Absolute per-block anchors (cluster blocks, etc.). Content/shape unchanged.
    const raw = Array.isArray(placementsBody) ? placementsBody : [];
    if (raw.length === 0) {
      return jsonError(400, "placements required for relocate");
    }
    const byPlaced = new Map(placed.map((p) => [p.id, p]));
    const next: PlacedBlockRef[] = [];
    for (const item of raw) {
      const id = String(item?.id || "").trim();
      if (!id) {
        return jsonError(400, "Each placement needs id");
      }
      const src = byPlaced.get(id);
      if (!src) {
        return jsonError(400, `Block not found or unplaced: ${id}`);
      }
      const px = Number(item.position_x);
      const py = Number(item.position_y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        return jsonError(400, `Invalid position for ${id}`);
      }
      next.push({
        id,
        position_x: Math.trunc(px),
        position_y: Math.trunc(py),
        span_w: src.span_w,
        span_h: src.span_h,
        ...(src.shape_cells ? { shape_cells: src.shape_cells } : {}),
      });
    }

    const { unusableCells: relocateUnusable } = await loadWorkspaceContext(
      supabase,
      workspaceId,
    );
    const collision = validateRelocatePlacements(
      next,
      placed,
      relocateUnusable,
    );
    if (collision) {
      return jsonError(409, collision, "relocate_collision");
    }

    for (const block of next) {
      await supabase
        .from("blocks")
        .update({
          position_x: block.position_x,
          position_y: block.position_y,
          // Preserve span/shape — relocate is position-only.
          span_w: block.span_w ?? 1,
          span_h: block.span_h ?? 1,
        })
        .eq("id", block.id);
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      planModified: true,
      updatedNodes: updatedNodes || [],
      explanation: `Relocated ${next.length} block(s).`,
    });

}
