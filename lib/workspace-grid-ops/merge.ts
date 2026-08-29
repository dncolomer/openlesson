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
import { blockMapGlyphDbFields } from "@/lib/block-map-glyph";

export async function handle_merge(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    const ids = Array.isArray(blockIds) ? blockIds.filter(Boolean) : [];
    if (ids.length < 2) {
      return jsonError(400, "Select at least two blocks to merge");
    }
    const targets = nodes.filter((n) => ids.includes(n.id));
    if (targets.length < 2) {
      return jsonError(400, "Not enough blocks to merge");
    }

    const mergePlaced = targets
      .filter((n) => n.position_x != null && n.position_y != null)
      .map((n) => ({
        id: n.id,
        position_x: n.position_x!,
        position_y: n.position_y!,
        span_w: normalizeSpan(n.span_w),
        span_h: normalizeSpan(n.span_h),
        shape_cells: parseShapeCells((n as { shape_cells?: unknown }).shape_cells ?? null),
      }));
    const freeform = mergeBlocksToFreeform(mergePlaced);
    if (!freeform) {
      return jsonError(400, "Could not compute merge footprint");
    }
    const footprint = freeform.footprint;

    // Only the union of source cells is required free (ignoring the sources themselves).
    if (!canPlaceAbsoluteCells(freeform.absoluteCells, placedOccupancy, ids)) {
      return jsonError(409, "Merge region collides with other blocks");
    }

    const { plan, fileNames } = await loadWorkspaceContext(supabase, workspaceId);
    const context = composeBlockGenerationContext({
      workspaceTitle: plan?.title || plan?.root_topic || undefined,
      goal: plan?.workspace_goal || plan?.root_topic,
      notes: plan?.notes,
      fileNames,
    });

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Title and description must be in that language.`
        : "";

    const aiPrompt = composeMergeBlockUserPrompt({
      context,
      sourceBlocks: targets.map((t) => ({
        title: String(t.title || ""),
        span_w: normalizeSpan(t.span_w),
        span_h: normalizeSpan(t.span_h),
        description: t.description,
      })),
      resultSpanW: footprint.span_w,
      resultSpanH: footprint.span_h,
      userGuidance: prompt?.trim() || "Synthesize a broader topic that unifies these blocks.",
      languageNote: languageNote || undefined,
    });

    const aiResponse = await callXaiJSON<AiBlockPayload>(
      [systemMessage(composeMergeBlockSystemMessage()), userMessage(aiPrompt)],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 700,
        temperature: 0.4,
      },
    );

    if (!aiResponse.success || !aiResponse.data?.title?.trim()) {
      return jsonError(502, aiResponse.error || "Failed to merge blocks");
    }

    const keepId = targets[0].id;
    const dropIds = targets.slice(1).map((t) => t.id);

    // Rewire next_block_ids that pointed at dropped blocks toward keepId
    for (const node of nodes) {
      const next = (node.next_block_ids || []) as string[];
      if (!next.some((id) => dropIds.includes(id))) continue;
      const rewritten = Array.from(
        new Set(next.map((id) => (dropIds.includes(id) ? keepId : id)).filter((id) => id !== node.id)),
      );
      await supabase.from("blocks").update({ next_block_ids: rewritten }).eq("id", node.id);
    }

    const glyph = blockMapGlyphDbFields(
      aiResponse.data,
      aiResponse.data.title.trim(),
    );
    const mergeUpdate: Record<string, unknown> = {
      title: aiResponse.data.title.trim(),
      description: aiResponse.data.description?.trim() || "",
      position_x: footprint.position_x,
      position_y: footprint.position_y,
      span_w: footprint.span_w,
      span_h: footprint.span_h,
      shape_cells: freeform.shape_cells,
      is_start: targets.some((t) => t.is_start) || false,
      map_keyword: glyph.map_keyword,
      map_icon: glyph.map_icon,
    };
    let { error: mergeErr } = await supabase.from("blocks").update(mergeUpdate).eq("id", keepId);
    if (mergeErr && /shape_cells|map_keyword|map_icon|schema cache/i.test(mergeErr.message || "")) {
      const { shape_cells: _sc, ...withoutShape } = mergeUpdate;
      let retry = await supabase.from("blocks").update(withoutShape).eq("id", keepId);
      mergeErr = retry.error;
      if (mergeErr && /map_keyword|map_icon|schema cache/i.test(mergeErr.message || "")) {
        const { map_keyword: _mk, map_icon: _mi, ...withoutGlyph } = withoutShape;
        retry = await supabase.from("blocks").update(withoutGlyph).eq("id", keepId);
        mergeErr = retry.error;
      }
    }
    if (mergeErr) {
      return jsonError(500, "Failed to update merged block");
    }

    if (dropIds.length) {
      await supabase.from("blocks").delete().in("id", dropIds);
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      planModified: true,
      updatedNodes: updatedNodes || [],
      placedNodeId: keepId,
      explanation: `Merged into "${aiResponse.data.title.trim()}".`,
      appearSequentially: true,
    });

}
