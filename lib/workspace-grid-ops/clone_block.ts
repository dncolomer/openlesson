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

export async function handle_clone_block(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    const sourceId =
      typeof (body as { sourceBlockId?: unknown }).sourceBlockId === "string"
        ? String((body as { sourceBlockId?: string }).sourceBlockId).trim()
        : typeof blockId === "string"
          ? blockId.trim()
          : "";
    const row =
      typeof (body as { row?: unknown }).row === "number"
        ? Math.trunc((body as { row: number }).row)
        : NaN;
    const col =
      typeof (body as { col?: unknown }).col === "number"
        ? Math.trunc((body as { col: number }).col)
        : NaN;
    if (!sourceId || !Number.isFinite(row) || !Number.isFinite(col)) {
      return jsonError(400, "sourceBlockId, row, and col are required for clone_block");
    }
    const source = nodes.find((n) => n.id === sourceId);
    if (!source) {
      return jsonError(404, "Source block not found");
    }
    if (isCellOccupied(occupancy, row, col)) {
      return jsonError(409, "That grid slot is already occupied");
    }
    const { unusableCells: cloneUnusable } = await loadWorkspaceContext(
      supabase,
      workspaceId,
    );
    const ground = canPlaceOnMapGround([{ row, col }], cloneUnusable);
    if (!ground.ok && ground.reason === "unusable") {
      return jsonError(409, "Target cell is unusable ground", "unusable_ground");
    }

    const built = buildCloneInsertPayload({
      source: {
        title: source.title,
        description: source.description,
        planning_prompt:
          typeof (source as { planning_prompt?: unknown }).planning_prompt ===
          "string"
            ? String((source as { planning_prompt?: string }).planning_prompt)
            : null,
        local_context:
          (source as { local_context?: unknown }).local_context ?? null,
      },
      target: { row, col },
    });

    const insertPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      title: built.title,
      description: built.description,
      is_start: built.is_start,
      next_block_ids: built.next_block_ids,
      lock_until_block_ids: built.lock_until_block_ids,
      status: built.status,
      position_x: built.position_x,
      position_y: built.position_y,
      span_w: built.span_w,
      span_h: built.span_h,
      shape_cells: built.shape_cells,
      ...(built.planning_prompt
        ? { planning_prompt: built.planning_prompt }
        : {}),
      ...(built.local_context != null
        ? { local_context: built.local_context }
        : {}),
    };

    let { data: newNode, error: insertError } = await supabase
      .from("blocks")
      .insert(insertPayload)
      .select()
      .single();

    if (
      insertError &&
      /span_w|span_h|shape_cells|local_context|planning_prompt|lock_until|schema cache/i.test(
        insertError.message || "",
      )
    ) {
      const {
        span_w: _sw,
        span_h: _sh,
        shape_cells: _sc,
        local_context: _lc,
        planning_prompt: _pp,
        lock_until_block_ids: _lu,
        ...rest
      } = insertPayload;
      let retryPayload: Record<string, unknown> = { ...rest };
      let retry = await supabase
        .from("blocks")
        .insert(retryPayload)
        .select()
        .single();
      if (
        retry.error &&
        /local_context|planning_prompt|schema cache/i.test(
          retry.error.message || "",
        )
      ) {
        const {
          local_context: __lc,
          planning_prompt: __pp,
          ...withoutOptional
        } = retryPayload;
        retry = await supabase
          .from("blocks")
          .insert(withoutOptional)
          .select()
          .single();
      }
      newNode = retry.data;
      insertError = retry.error;
    }

    if (insertError || !newNode) {
      return jsonError(500, insertError?.message || "Failed to clone block");
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      planModified: true,
      updatedNodes: updatedNodes || [],
      placedNodeId: newNode.id,
      explanation: `Cloned "${built.title}" to (${row}, ${col}).`,
    });

}
