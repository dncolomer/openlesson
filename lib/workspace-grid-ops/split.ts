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

export async function handle_split(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    const ids = Array.isArray(blockIds) ? blockIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return jsonError(400, "blockIds required for split");
    }
    const targets = nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) {
      return jsonError(400, "No blocks to split");
    }

    const singles = splitBlocksToSingles(
      targets
        .filter((n) => n.position_x != null && n.position_y != null)
        .map((n) => ({
          id: n.id,
          position_x: n.position_x!,
          position_y: n.position_y!,
          span_w: normalizeSpan(n.span_w),
          span_h: normalizeSpan(n.span_h),
        })),
    );

    const { plan, fileNames } = await loadWorkspaceContext(supabase, workspaceId);
    const context = composeBlockGenerationContext({
      workspaceTitle: plan?.title || plan?.root_topic || undefined,
      goal: plan?.workspace_goal || plan?.root_topic,
      notes: plan?.notes,
      fileNames,
    });
    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Titles and descriptions must be in that language.`
        : "";

    // Only expand multi-cell blocks; 1x1 stay as-is
    for (const target of targets) {
      const spanW = normalizeSpan(target.span_w);
      const spanH = normalizeSpan(target.span_h);
      if (spanW === 1 && spanH === 1) continue;

      const parts = singles.filter((s) => s.sourceId === target.id);
      if (parts.length <= 1) continue;

      const partSpecs = parts.map((p, index) => ({
        position_x: p.position_x,
        position_y: p.position_y,
        index,
      }));

      const aiPrompt = composeSplitBlockUserPrompt({
        context,
        sourceTitle: String(target.title || ""),
        sourceDescription: target.description,
        sourceSpanW: spanW,
        sourceSpanH: spanH,
        parts: partSpecs,
        languageNote: languageNote || undefined,
        userGuidance:
          prompt?.trim() ||
          "Decompose into focused subtopics that together cover the parent scope.",
      });

      const aiResponse = await callXaiJSON<AiSplitPayload>(
        [systemMessage(composeSplitBlockSystemMessage()), userMessage(aiPrompt)],
        {
          model: userModel || DEFAULT_MODEL,
          maxTokens: 1200,
          temperature: 0.45,
        },
      );

      const named = new Map<number, { title: string; description: string }>();
      if (aiResponse.success && Array.isArray(aiResponse.data?.parts)) {
        for (const part of aiResponse.data.parts) {
          if (typeof part?.index !== "number" || !part.title?.trim()) continue;
          named.set(part.index, {
            title: part.title.trim(),
            description: part.description?.trim() || "",
          });
        }
      }

      // Keep first cell on original block; create new blocks for remaining
      const [first, ...rest] = parts;
      const firstName = named.get(0);
      await supabase
        .from("blocks")
        .update({
          position_x: first.position_x,
          position_y: first.position_y,
          span_w: 1,
          span_h: 1,
          shape_cells: null,
          title: firstName?.title || target.title,
          description: firstName?.description || target.description || "",
        })
        .eq("id", target.id);

      for (let i = 0; i < rest.length; i++) {
        const part = rest[i];
        const name = named.get(i + 1);
        await supabase.from("blocks").insert({
          workspace_id: workspaceId,
          title: name?.title || `${target.title} · ${part.position_y},${part.position_x}`,
          description: name?.description || target.description || "",
          is_start: false,
          next_block_ids: [],
          status: "available",
          position_x: part.position_x,
          position_y: part.position_y,
          span_w: 1,
          span_h: 1,
        });
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
      explanation: `Split selection into single-square blocks (size-aware ILE/TAP scopes).`,
      appearSequentially: true,
    });

}
