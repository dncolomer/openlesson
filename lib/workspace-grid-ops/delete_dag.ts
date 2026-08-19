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

export async function handle_delete_dag(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    const id = typeof dagId === "string" ? dagId.trim() : "";
    if (!id) {
      return jsonError(400, "dagId required for delete_dag");
    }
    const refs = nodes.map((n) => ({
      id: n.id,
      title: n.title,
      next_block_ids: Array.isArray(n.next_block_ids)
        ? (n.next_block_ids as string[])
        : [],
      lock_until_block_ids: Array.isArray(n.lock_until_block_ids)
        ? (n.lock_until_block_ids as string[])
        : [],
    }));
    let existing: ReturnType<typeof normalizeWorkspaceDags> = [];
    try {
      const { data: planRow } = await supabase
        .from("workspaces")
        .select("workspace_dags")
        .eq("id", workspaceId)
        .single();
      existing = normalizeWorkspaceDags(
        (planRow as { workspace_dags?: unknown } | null)?.workspace_dags,
      );
    } catch {
      existing = [];
    }
    // Registry or discovered-from-next (so map graphs without workspace_dags still delete)
    const record = resolveWorkspaceDagForMutation(existing, id, refs);
    if (!record) {
      return jsonError(404, "DAG not found");
    }
    const updates = buildWorkspaceDagDeleteUpdates(record.blockIds, refs);
    for (const u of updates) {
      const lock_until_block_ids = normalizeLockUntilBlockIds(
        u.lock_until_block_ids,
        u.blockId,
      );
      const next_block_ids = (u.next_block_ids || [])
        .map((nid) => String(nid || "").trim())
        .filter((nid) => nid && nid !== u.blockId);
      await supabase
        .from("blocks")
        .update({
          next_block_ids,
          lock_until_block_ids,
        })
        .eq("id", u.blockId)
        .eq("workspace_id", workspaceId);
    }
    const workspaceDags = removeWorkspaceDag(existing, id);
    try {
      await supabase
        .from("workspaces")
        .update({ workspace_dags: workspaceDags })
        .eq("id", workspaceId);
    } catch {
      // Column may be missing — edge clear still applied.
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      planModified: true,
      updatedNodes: updatedNodes || [],
      workspaceDags,
      deletedDagId: id,
      explanation: `Deleted DAG and cleared within-DAG next links (${record.blockIds.length} blocks).`,
    });

}
