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

export async function handle_delete_blocks(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    const ids = Array.isArray(blockIds)
      ? blockIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return jsonError(400, "blockIds required for delete_blocks");
    }
    const idSet = new Set(ids);
    const existing = nodes.filter((n) => idSet.has(n.id));
    if (existing.length === 0) {
      return jsonError(404, "No matching blocks");
    }
    const hadStart = existing.some((n) => n.is_start);

    // Strip deleted ids from peers that remain.
    for (const n of nodes) {
      if (idSet.has(n.id)) continue;
      const nextIds = Array.isArray(n.next_block_ids)
        ? (n.next_block_ids as string[]).filter((id) => !idSet.has(id))
        : [];
      const lockIds = Array.isArray(n.lock_until_block_ids)
        ? (n.lock_until_block_ids as string[]).filter((id) => !idSet.has(id))
        : [];
      const prevNext = Array.isArray(n.next_block_ids) ? n.next_block_ids : [];
      const prevLock = Array.isArray(n.lock_until_block_ids)
        ? n.lock_until_block_ids
        : [];
      if (
        nextIds.length !== prevNext.length ||
        lockIds.length !== prevLock.length
      ) {
        await supabase
          .from("blocks")
          .update({
            next_block_ids: nextIds,
            lock_until_block_ids: lockIds,
          })
          .eq("id", n.id);
      }
    }

    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .in("id", ids)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      return jsonError(500, "Failed to delete blocks");
    }

    if (hadStart) {
      const { data: remaining } = await supabase
        .from("blocks")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true })
        .limit(1);
      const promoteId = remaining?.[0]?.id;
      if (promoteId) {
        await supabase.from("blocks").update({ is_start: true }).eq("id", promoteId);
      }
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      planModified: true,
      updatedNodes: updatedNodes || [],
      deletedBlockIds: ids,
      explanation: `Deleted ${ids.length} block(s).`,
    });

}
