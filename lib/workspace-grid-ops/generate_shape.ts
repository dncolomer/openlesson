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

export async function handle_generate_shape(ctx: GridOpContext): Promise<Response | null> {
  const {
    supabase, workspaceId, body, nodes, occupancy, placed, placedOccupancy,
    skillNodes, prompt, cells, blockIds, dRow, dCol, title, description, blockId,
    stretchHandleBody, isStartBody, weightedNeighbors, contextSourceKeys,
    dagDraft, dagId, placementsBody, locale, userModel,
  } = ctx;
  void skillNodes;
    const selection = Array.isArray(cells) ? cells : [];
    const freeformSel = selectionIsFreeformLectureShape(selection);
    if (!freeformSel.footprint || freeformSel.reason === "empty") {
      return jsonError(400, "cells required for generate_shape");
    }
    if (freeformSel.reason === "not_contiguous") {
      return jsonError(
        400,
        "Select a contiguous region (edge-connected cells). Diagonal-only gaps are not allowed.",
        "selection_not_contiguous",
        { selectedCount: freeformSel.selectedCount },
      );
    }
    const footprint = freeformSel.footprint;
    const shapeCells = freeformSel.shape_cells;
    const absolute =
      freeformShapeFromCells(selection)?.absoluteCells ?? selection;
    if (!prompt?.trim()) {
      return jsonError(400, "prompt required for generate_shape");
    }
    // Only selected cells must be free (freeform shapes may leave bbox holes empty).
    if (!canPlaceAbsoluteCells(absolute, placedOccupancy)) {
      return jsonError(409, "One or more selected cells are already occupied", "cells_occupied");
    }

    const {
      plan,
      fileNames,
      fileRows,
      externalResources,
      unusableCells: shapeUnusable,
    } = await loadWorkspaceContext(supabase, workspaceId);
    const ground = canPlaceOnMapGround(absolute, shapeUnusable);
    if (!ground.ok && ground.reason === "unusable") {
      return jsonError(409, "Selection includes unusable ground cells", "unusable_ground");
    }

    const selectedKeys = Array.isArray(contextSourceKeys)
      ? contextSourceKeys.map((k) => String(k || "").trim()).filter(Boolean)
      : [];
    const baseShapeOptions = buildShapeContextSourceOptions({
      notes: plan?.notes ?? "",
      files: fileRows.map((f) => ({
        id: f.id,
        file_name: f.file_name,
      })),
      externalResources,
    });
    // Fetch page bodies for selected external/internet links so generation
    // uses linked content (not only title/URL/description).
    const { options: shapeOptions } =
      await enrichSelectedOptionsWithFetchedLinkBodies({
        selectedKeys,
        options: baseShapeOptions,
        fetchBody: (url) => fetchLinkBodyText(url),
      });
    const selectedSnippet = shapeSelectionToGenerationSnippet(selectedKeys, shapeOptions);
    const localContext = shapeSelectionToLocalContext(selectedKeys, shapeOptions);
    const normalizedLocal = localContext
      ? normalizeBlockLocalContext(localContext)
      : null;

    const baseContext = composeBlockGenerationContext({
      workspaceTitle: plan?.title || plan?.root_topic || undefined,
      goal: plan?.workspace_goal || plan?.root_topic,
      // When user selected a subset, do not force full workspace notes into
      // the "always" block — selected materials are primary.
      notes: selectedKeys.length > 0 ? undefined : plan?.notes,
      fileNames: selectedKeys.length > 0 ? undefined : fileNames,
    });
    const context = composeShapeGenerationContext({
      baseContext,
      selectedSnippet,
    });

    const spatialNeighbors =
      Array.isArray(weightedNeighbors) && weightedNeighbors.length > 0
        ? weightedNeighbors
            .map(
              (n) =>
                `"${n.title}" at (${n.row},${n.col}), distance ${n.distance}, weight ${n.weight.toFixed(2)}`,
            )
            .join("\n")
        : "none";
    const journeySnippet = composeJourneyGraphPromptSnippet(
      nodes.map((n) => ({
        id: n.id,
        title: n.title,
        next_block_ids: n.next_block_ids as string[] | null,
        lock_until_block_ids: n.lock_until_block_ids as string[] | null,
      })),
      {
        focusBlockIds: Array.isArray(weightedNeighbors)
          ? weightedNeighbors.map((n) => String(n.id || "")).filter(Boolean)
          : undefined,
        maxLines: 20,
      },
    );
    const neighborSummary = journeySnippet
      ? `${spatialNeighbors}\n\n${journeySnippet}`
      : spatialNeighbors;

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Title and description must be in that language.`
        : "";

    const cellCount = absolute.length;
    const aiPrompt = composeGenerateShapeBlockUserPrompt({
      context,
      spanW: footprint.span_w,
      spanH: footprint.span_h,
      anchorRow: footprint.position_y,
      anchorCol: footprint.position_x,
      neighborSummary,
      userRequest: prompt.trim(),
      languageNote: languageNote || undefined,
      cellCount,
      freeform: Boolean(shapeCells),
      selectedMaterialsSnippet: selectedSnippet || undefined,
    });

    const aiResponse = await callXaiJSON<AiBlockPayload>(
      [systemMessage(composeGenerateShapeBlockSystemMessage()), userMessage(aiPrompt)],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 600,
        temperature: 0.5,
      },
    );

    if (!aiResponse.success || !aiResponse.data?.title?.trim()) {
      return jsonError(502, aiResponse.error || "Failed to generate block");
    }

    const local_context =
      localContext && normalizedLocal?.hasLocalMaterials
        ? {
            notes: localContext.notes ?? null,
            global_file_refs: localContext.global_file_refs ?? null,
            local_files: localContext.local_files ?? null,
            external_resource_ids: localContext.external_resource_ids ?? null,
          }
        : null;

    // Author may flag starter; empty map still gets a start when author left it off.
    const authorStarter =
      typeof isStartBody === "boolean"
        ? isStartBody
        : typeof (body as { isStart?: unknown }).isStart === "boolean"
          ? Boolean((body as { isStart?: boolean }).isStart)
          : undefined;

    const glyph = blockMapGlyphDbFields(
      aiResponse.data,
      aiResponse.data.title.trim(),
    );
    const insertPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      title: aiResponse.data.title.trim(),
      description: aiResponse.data.description?.trim() || "",
      is_start: resolveCreateBlockIsStart({
        authorStarter,
        existingBlockCount: nodes.length,
      }),
      next_block_ids: [],
      status: "available",
      position_x: footprint.position_x,
      position_y: footprint.position_y,
      span_w: footprint.span_w,
      span_h: footprint.span_h,
      shape_cells: shapeCells,
      map_keyword: glyph.map_keyword,
      map_icon: glyph.map_icon,
      ...(local_context ? { local_context } : {}),
    };

    let { data: newNode, error: insertError } = await supabase
      .from("blocks")
      .insert(insertPayload)
      .select()
      .single();

    // Graceful fallback if span/shape/local_context/glyph columns not migrated yet
    if (
      insertError &&
      /span_w|span_h|shape_cells|local_context|map_keyword|map_icon|schema cache/i.test(insertError.message || "")
    ) {
      const {
        span_w: _sw,
        span_h: _sh,
        shape_cells: _sc,
        local_context: _lc,
        map_keyword: _mk,
        map_icon: _mi,
        ...rest
      } =
        insertPayload;
      const glyphMissing = /map_keyword|map_icon/i.test(insertError.message || "");
      const glyphFields = glyphMissing
        ? {}
        : { map_keyword: glyph.map_keyword, map_icon: glyph.map_icon };
      let retryPayload: Record<string, unknown> = {
        ...rest,
        span_w: footprint.span_w,
        span_h: footprint.span_h,
        ...(local_context ? { local_context } : {}),
        ...glyphFields,
      };
      let retry = await supabase.from("blocks").insert(retryPayload).select().single();
      if (retry.error && /span_w|span_h|schema cache/i.test(retry.error.message || "")) {
        retryPayload = {
          ...rest,
          ...(local_context ? { local_context } : {}),
          ...glyphFields,
        };
        retry = await supabase.from("blocks").insert(retryPayload).select().single();
      }
      if (retry.error && /local_context|schema cache/i.test(retry.error.message || "")) {
        const { local_context: __lc, ...withoutLocal } = retryPayload;
        retry = await supabase.from("blocks").insert(withoutLocal).select().single();
      }
      if (retry.error && /map_keyword|map_icon|schema cache/i.test(retry.error.message || "")) {
        const {
          map_keyword: __mk,
          map_icon: __mi,
          ...stripped
        } = retryPayload;
        retry = await supabase.from("blocks").insert(stripped).select().single();
      }
      newNode = retry.data;
      insertError = retry.error;
    }

    if (insertError || !newNode) {
      return jsonError(500, "Failed to create block");
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
      explanation: `Added "${newNode.title}" (${cellCount} cell${cellCount === 1 ? "" : "s"}${
        shapeCells ? " freeform" : ` ${footprint.span_w}×${footprint.span_h}`
      }).`,
      appearSequentially: true,
    });

}
