import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { buildSkillGridLayout, type WeightedGridNeighbor } from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import {
  buildOccupancyFromPlaced,
  canPlaceAbsoluteCells,
  canPlaceFootprint,
  freeformShapeFromCells,
  mergeBlocksToFreeform,
  normalizeSpan,
  parseShapeCells,
  placedBlockCells,
  selectionIsFreeformLectureShape,
  splitBlocksToSingles,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";
import {
  composeGenerateShapeBlockSystemMessage,
  composeGenerateShapeBlockUserPrompt,
  composeMergeBlockSystemMessage,
  composeMergeBlockUserPrompt,
  composeSplitBlockSystemMessage,
  composeSplitBlockUserPrompt,
} from "@/lib/block-footprint-prompt";
import { canPlaceOnMapGround, normalizeUnusableCells } from "@/lib/map-ground-rules";
import {
  buildShapeContextSourceOptions,
  composeShapeGenerationContext,
  shapeSelectionToGenerationSnippet,
  shapeSelectionToLocalContext,
} from "@/lib/shape-context-select";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";
import { resolveCreateBlockIsStart } from "@/lib/block-starter-flag";

type GridOp =
  | "generate_shape"
  | "merge"
  | "split"
  | "move"
  | "update_block"
  | "delete_block";

interface AiBlockPayload {
  title: string;
  description: string;
}

interface AiSplitPayload {
  parts?: Array<{ index?: number; title?: string; description?: string }>;
}

async function loadWorkspaceContext(supabase: SupabaseClient, workspaceId: string) {
  const { data: plan } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, description, notes, workspace_goal, unusable_cells")
    .eq("id", workspaceId)
    .single();

  const { data: files } = await supabase
    .from("workspace_files")
    .select("id, file_name")
    .eq("workspace_id", workspaceId);

  // External resources table may not be migrated yet — degrade gracefully.
  let externalRows: Array<{
    id: string;
    title?: string | null;
    url?: string | null;
    description?: string | null;
  }> = [];
  const externalQuery = await supabase
    .from("workspace_external_resources")
    .select("id, title, url, description")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true });
  if (externalQuery.error) {
    const msg = externalQuery.error.message || "";
    if (!/schema cache|does not exist|workspace_external_resources/i.test(msg)) {
      console.error("[grid-ops] external resources load:", externalQuery.error);
    }
  } else {
    externalRows = (externalQuery.data || []) as typeof externalRows;
  }

  const fileRows = (files || []) as Array<{ id?: string; file_name?: string }>;
  return {
    plan,
    fileNames: fileRows.map((f) => f.file_name).filter(Boolean) as string[],
    fileRows,
    externalResources: externalRows,
    unusableCells: normalizeUnusableCells(
      (plan as { unusable_cells?: unknown } | null)?.unusable_cells,
    ),
  };
}

function placedFromNodes(nodes: Array<{
  id: string;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: unknown;
}>): PlacedBlockRef[] {
  return nodes
    .filter((n) => n.position_x != null && n.position_y != null)
    .map((n) => ({
      id: n.id,
      position_x: n.position_x!,
      position_y: n.position_y!,
      span_w: normalizeSpan(n.span_w),
      span_h: normalizeSpan(n.span_h),
      shape_cells: parseShapeCells(n.shape_cells ?? null),
    }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      op,
      prompt,
      cells,
      blockIds,
      dRow = 0,
      dCol = 0,
      title,
      description,
      blockId,
      is_start: isStartBody,
      model: userModel,
      locale,
      weightedNeighbors,
      contextSourceKeys,
    } = body as {
      workspaceId?: string;
      op?: GridOp;
      prompt?: string;
      cells?: Array<{ row: number; col: number }>;
      blockIds?: string[];
      dRow?: number;
      dCol?: number;
      title?: string;
      description?: string;
      blockId?: string;
      /** Author starter flag (update_block / generate_shape). */
      is_start?: boolean;
      model?: string;
      locale?: string;
      weightedNeighbors?: WeightedGridNeighbor[];
      /** Selected Context sources for generate_shape (files / external / notes). */
      contextSourceKeys?: string[];
    };

    if (!workspaceId || !op) {
      return NextResponse.json({ error: "workspaceId and op are required" }, { status: 400 });
    }

    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 });
    }

    const skillNodes = toSkillGridNodes(nodes);
    const { occupancy } = buildSkillGridLayout(skillNodes);
    const placed = placedFromNodes(nodes);
    const placedOccupancy = buildOccupancyFromPlaced(placed);

    if (op === "update_block") {
      if (!blockId || typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ error: "blockId and title are required" }, { status: 400 });
      }
      const existing = nodes.find((n) => n.id === blockId);
      if (!existing) return NextResponse.json({ error: "Block not found" }, { status: 404 });

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

      const { error: updateError } = await supabase
        .from("blocks")
        .update(updateFields)
        .eq("id", blockId);

      if (updateError) {
        return NextResponse.json({ error: "Failed to update block" }, { status: 500 });
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

    if (op === "delete_block") {
      if (!blockId || typeof blockId !== "string") {
        return NextResponse.json({ error: "blockId is required" }, { status: 400 });
      }
      const existing = nodes.find((n) => n.id === blockId);
      if (!existing) return NextResponse.json({ error: "Block not found" }, { status: 404 });

      // Strip deleted id from peers' next / lock-until lists.
      for (const n of nodes) {
        if (n.id === blockId) continue;
        const nextIds = Array.isArray(n.next_block_ids)
          ? (n.next_block_ids as string[]).filter((id) => id !== blockId)
          : [];
        const lockIds = Array.isArray(n.lock_until_block_ids)
          ? (n.lock_until_block_ids as string[]).filter((id) => id !== blockId)
          : [];
        const prevNext = Array.isArray(n.next_block_ids) ? n.next_block_ids : [];
        const prevLock = Array.isArray(n.lock_until_block_ids) ? n.lock_until_block_ids : [];
        if (nextIds.length !== prevNext.length || lockIds.length !== prevLock.length) {
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
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);

      if (deleteError) {
        return NextResponse.json({ error: "Failed to delete block" }, { status: 500 });
      }

      // If the deleted block was the start, promote the earliest remaining block.
      if (existing.is_start) {
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
        deletedBlockId: blockId,
        explanation: `Deleted block "${existing.title || blockId}".`,
      });
    }

    if (op === "move") {
      const ids = Array.isArray(blockIds) ? blockIds.filter(Boolean) : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: "blockIds required for move" }, { status: 400 });
      }
      const moving = placed.filter((p) => ids.includes(p.id));
      if (moving.length !== ids.length) {
        return NextResponse.json({ error: "One or more blocks not found or unplaced" }, { status: 400 });
      }
      const next = translateBlocksPreservingShape(
        moving,
        Number(dRow) || 0,
        Number(dCol) || 0,
        placedOccupancy,
      );
      if (!next) {
        return NextResponse.json({ error: "Move collides with occupied cells" }, { status: 409 });
      }

      const { unusableCells: moveUnusable } = await loadWorkspaceContext(supabase, workspaceId);
      for (const block of next) {
        const cells = placedBlockCells(block);
        const ground = canPlaceOnMapGround(cells, moveUnusable);
        if (!ground.ok && ground.reason === "unusable") {
          return NextResponse.json(
            { error: "Move lands on unusable ground", code: "unusable_ground" },
            { status: 409 },
          );
        }
      }

      for (const block of next) {
        await supabase
          .from("blocks")
          .update({
            position_x: block.position_x,
            position_y: block.position_y,
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
        explanation: `Moved ${next.length} block(s).`,
      });
    }

    if (op === "split") {
      const ids = Array.isArray(blockIds) ? blockIds.filter(Boolean) : [];
      if (ids.length === 0) {
        return NextResponse.json({ error: "blockIds required for split" }, { status: 400 });
      }
      const targets = nodes.filter((n) => ids.includes(n.id));
      if (targets.length === 0) {
        return NextResponse.json({ error: "No blocks to split" }, { status: 400 });
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
          sourceTitle: target.title,
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

    if (op === "merge") {
      const ids = Array.isArray(blockIds) ? blockIds.filter(Boolean) : [];
      if (ids.length < 2) {
        return NextResponse.json({ error: "Select at least two blocks to merge" }, { status: 400 });
      }
      const targets = nodes.filter((n) => ids.includes(n.id));
      if (targets.length < 2) {
        return NextResponse.json({ error: "Not enough blocks to merge" }, { status: 400 });
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
        return NextResponse.json({ error: "Could not compute merge footprint" }, { status: 400 });
      }
      const footprint = freeform.footprint;

      // Only the union of source cells is required free (ignoring the sources themselves).
      if (!canPlaceAbsoluteCells(freeform.absoluteCells, placedOccupancy, ids)) {
        return NextResponse.json(
          { error: "Merge region collides with other blocks" },
          { status: 409 },
        );
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
          title: t.title,
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
        return NextResponse.json({ error: aiResponse.error || "Failed to merge blocks" }, { status: 502 });
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

      const mergeUpdate: Record<string, unknown> = {
        title: aiResponse.data.title.trim(),
        description: aiResponse.data.description?.trim() || "",
        position_x: footprint.position_x,
        position_y: footprint.position_y,
        span_w: footprint.span_w,
        span_h: footprint.span_h,
        shape_cells: freeform.shape_cells,
        is_start: targets.some((t) => t.is_start) || false,
      };
      let { error: mergeErr } = await supabase.from("blocks").update(mergeUpdate).eq("id", keepId);
      if (mergeErr && /shape_cells|schema cache/i.test(mergeErr.message || "")) {
        const { shape_cells: _sc, ...withoutShape } = mergeUpdate;
        const retry = await supabase.from("blocks").update(withoutShape).eq("id", keepId);
        mergeErr = retry.error;
      }
      if (mergeErr) {
        return NextResponse.json({ error: "Failed to update merged block" }, { status: 500 });
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

    if (op === "generate_shape") {
      const selection = Array.isArray(cells) ? cells : [];
      const freeformSel = selectionIsFreeformLectureShape(selection);
      if (!freeformSel.footprint || freeformSel.reason === "empty") {
        return NextResponse.json({ error: "cells required for generate_shape" }, { status: 400 });
      }
      if (freeformSel.reason === "not_contiguous") {
        return NextResponse.json(
          {
            error:
              "Select a contiguous region (edge-connected cells). Diagonal-only gaps are not allowed.",
            code: "selection_not_contiguous",
            selectedCount: freeformSel.selectedCount,
          },
          { status: 400 },
        );
      }
      const footprint = freeformSel.footprint;
      const shapeCells = freeformSel.shape_cells;
      const absolute =
        freeformShapeFromCells(selection)?.absoluteCells ?? selection;
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "prompt required for generate_shape" }, { status: 400 });
      }
      // Only selected cells must be free (freeform shapes may leave bbox holes empty).
      if (!canPlaceAbsoluteCells(absolute, placedOccupancy)) {
        return NextResponse.json(
          {
            error: "One or more selected cells are already occupied",
            code: "cells_occupied",
          },
          { status: 409 },
        );
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
        return NextResponse.json(
          {
            error: "Selection includes unusable ground cells",
            code: "unusable_ground",
          },
          { status: 409 },
        );
      }

      const selectedKeys = Array.isArray(contextSourceKeys)
        ? contextSourceKeys.map((k) => String(k || "").trim()).filter(Boolean)
        : [];
      const shapeOptions = buildShapeContextSourceOptions({
        notes: plan?.notes ?? "",
        files: fileRows.map((f) => ({
          id: f.id,
          file_name: f.file_name,
        })),
        externalResources,
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

      const neighborSummary =
        Array.isArray(weightedNeighbors) && weightedNeighbors.length > 0
          ? weightedNeighbors
              .map(
                (n) =>
                  `"${n.title}" at (${n.row},${n.col}), distance ${n.distance}, weight ${n.weight.toFixed(2)}`,
              )
              .join("\n")
          : "none";

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
        return NextResponse.json({ error: aiResponse.error || "Failed to generate block" }, { status: 502 });
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
        ...(local_context ? { local_context } : {}),
      };

      let { data: newNode, error: insertError } = await supabase
        .from("blocks")
        .insert(insertPayload)
        .select()
        .single();

      // Graceful fallback if span/shape/local_context columns not migrated yet
      if (
        insertError &&
        /span_w|span_h|shape_cells|local_context|schema cache/i.test(insertError.message || "")
      ) {
        const { span_w: _sw, span_h: _sh, shape_cells: _sc, local_context: _lc, ...rest } =
          insertPayload;
        let retryPayload: Record<string, unknown> = {
          ...rest,
          span_w: footprint.span_w,
          span_h: footprint.span_h,
          ...(local_context ? { local_context } : {}),
        };
        let retry = await supabase.from("blocks").insert(retryPayload).select().single();
        if (retry.error && /span_w|span_h|schema cache/i.test(retry.error.message || "")) {
          retryPayload = {
            ...rest,
            ...(local_context ? { local_context } : {}),
          };
          retry = await supabase.from("blocks").insert(retryPayload).select().single();
        }
        if (retry.error && /local_context|schema cache/i.test(retry.error.message || "")) {
          const { local_context: __lc, ...withoutLocal } = retryPayload;
          retry = await supabase.from("blocks").insert(withoutLocal).select().single();
        }
        newNode = retry.data;
        insertError = retry.error;
      }

      if (insertError || !newNode) {
        return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
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

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (error) {
    console.error("Grid ops error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
