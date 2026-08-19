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

export async function handle_update_block(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    if (!blockId || typeof title !== "string" || !title.trim()) {
      return jsonError(400, "blockId and title are required");
    }
    const existing = nodes.find((n) => n.id === blockId);
    if (!existing) return jsonError(404, "Block not found");

    const updateFields: Record<string, unknown> = {
      title: title.trim(),
      description:
        typeof description === "string"
          ? description.trim()
          : existing.description || "",
    };
    // Author starter flag when provided (boolean true|false).
    if (typeof isStartBody === "boolean") {
      updateFields.is_start = isStartBody;
    }
    // Practice launch limits when provided.
    const practiceRaw =
      (body as { practice_options?: unknown; practiceOptions?: unknown })
        .practice_options ??
      (body as { practiceOptions?: unknown }).practiceOptions;
    if (practiceRaw !== undefined) {
      updateFields.practice_options = serializeBlockPracticeOptions(
        normalizeBlockPracticeOptions(
          practiceRaw as Parameters<typeof normalizeBlockPracticeOptions>[0],
        ),
      );
    }

    // Combinable creator effects when provided.
    const effectsRaw =
      (body as { creator_effects?: unknown; creatorEffects?: unknown })
        .creator_effects ??
      (body as { creatorEffects?: unknown }).creatorEffects;
    if (effectsRaw !== undefined) {
      const validated = validateBlockCreatorEffects({
        blockId,
        effects: normalizeBlockCreatorEffects(effectsRaw, {
          selfBlockId: blockId,
        }),
        blocks: nodes.map((n) => ({
          id: String(n.id),
          lock_until_block_ids: (
            n as { lock_until_block_ids?: string[] | null }
          ).lock_until_block_ids,
          next_block_ids: n.next_block_ids,
          position_x: (n as { position_x?: number | null }).position_x,
          position_y: (n as { position_y?: number | null }).position_y,
        })),
      });
      if (!validated.ok) {
        return jsonError(400, validated.error);
      }
      updateFields.creator_effects = serializeBlockCreatorEffects(
        validated.effects,
        { selfBlockId: blockId },
      );
    }

    let { error: updateError } = await supabase
      .from("blocks")
      .update(updateFields)
      .eq("id", blockId);

    // Graceful if practice_options / creator_effects columns not migrated yet.
    if (
      updateError &&
      /practice_options|creator_effects|schema cache/i.test(
        updateError.message || "",
      )
    ) {
      const {
        practice_options: _po,
        creator_effects: _ce,
        ...withoutOptional
      } = updateFields;
      // Retry without missing columns one at a time.
      let retryFields = { ...updateFields };
      if (/creator_effects/i.test(updateError.message || "")) {
        const { creator_effects: __ce, ...rest } = retryFields;
        retryFields = rest;
      }
      if (/practice_options/i.test(updateError.message || "")) {
        const { practice_options: __po, ...rest } = retryFields;
        retryFields = rest;
      }
      // If message is generic schema cache, drop both optional fields.
      if (/schema cache/i.test(updateError.message || "")) {
        retryFields = withoutOptional;
      }
      const retry = await supabase
        .from("blocks")
        .update(retryFields)
        .eq("id", blockId);
      updateError = retry.error;
    }

    if (updateError) {
      return jsonError(500, "Failed to update block");
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      planModified: true,
      updatedNodes: updatedNodes || [],
      explanation: `Updated block "${title.trim()}".`,
    });

}
