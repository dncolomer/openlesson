import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { buildSkillGridLayout, type WeightedGridNeighbor } from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import {
  buildOccupancyFromPlaced,
  canPlaceFootprint,
  footprintFromCells,
  mergeBlockFootprints,
  normalizeSpan,
  splitBlocksToSingles,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";

type GridOp = "generate_shape" | "merge" | "split" | "move" | "update_block";

interface AiBlockPayload {
  title: string;
  description: string;
}

async function loadWorkspaceContext(supabase: SupabaseClient, workspaceId: string) {
  const { data: plan } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, description, notes, conversion_goal")
    .eq("id", workspaceId)
    .single();

  const { data: files } = await supabase
    .from("workspace_files")
    .select("file_name")
    .eq("workspace_id", workspaceId);

  return {
    plan,
    fileNames: (files || []).map((f: { file_name: string }) => f.file_name).filter(Boolean),
  };
}

function placedFromNodes(nodes: Array<{
  id: string;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
}>): PlacedBlockRef[] {
  return nodes
    .filter((n) => n.position_x != null && n.position_y != null)
    .map((n) => ({
      id: n.id,
      position_x: n.position_x!,
      position_y: n.position_y!,
      span_w: normalizeSpan(n.span_w),
      span_h: normalizeSpan(n.span_h),
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
      model: userModel,
      locale,
      weightedNeighbors,
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
      model?: string;
      locale?: string;
      weightedNeighbors?: WeightedGridNeighbor[];
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

      const { error: updateError } = await supabase
        .from("blocks")
        .update({
          title: title.trim(),
          description: typeof description === "string" ? description.trim() : existing.description || "",
        })
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

      // Only expand multi-cell blocks; 1x1 stay as-is
      for (const target of targets) {
        const spanW = normalizeSpan(target.span_w);
        const spanH = normalizeSpan(target.span_h);
        if (spanW === 1 && spanH === 1) continue;

        const parts = singles.filter((s) => s.sourceId === target.id);
        if (parts.length <= 1) continue;

        // Keep first cell on original block; create new blocks for remaining
        const [first, ...rest] = parts;
        await supabase
          .from("blocks")
          .update({
            position_x: first.position_x,
            position_y: first.position_y,
            span_w: 1,
            span_h: 1,
            title: target.title,
            description: target.description || "",
          })
          .eq("id", target.id);

        for (const part of rest) {
          await supabase.from("blocks").insert({
            workspace_id: workspaceId,
            title: `${target.title} · ${part.position_y},${part.position_x}`,
            description: target.description || "",
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

      // Also support multi-block selection: if multiple 1x1 selected, split is a no-op geometrically
      // (already singles). Done.

      const { data: updatedNodes } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        planModified: true,
        updatedNodes: updatedNodes || [],
        explanation: `Split selection into single-square blocks.`,
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

      const footprint = mergeBlockFootprints(
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
      if (!footprint) {
        return NextResponse.json({ error: "Could not compute merge footprint" }, { status: 400 });
      }

      // Allow placement ignoring the blocks being merged
      if (!canPlaceFootprint(footprint, occupancy, ids)) {
        return NextResponse.json({ error: "Merge footprint collides with other blocks" }, { status: 409 });
      }

      const { plan, fileNames } = await loadWorkspaceContext(supabase, workspaceId);
      const context = composeBlockGenerationContext({
        workspaceTitle: plan?.title || plan?.root_topic || undefined,
        goal: plan?.conversion_goal || plan?.root_topic,
        notes: plan?.notes,
        fileNames,
      });

      const titles = targets.map((t) => t.title).join(", ");
      const languageNote =
        locale && locale !== "en"
          ? `Respond in ${locale} language. Title and description must be in that language.`
          : "";

      const aiPrompt = `${context}

Merge these learning blocks into one larger topic that covers the combined geometric region:
${titles}

User guidance: ${prompt?.trim() || "Synthesize a broader topic that unifies these blocks."}

Return one block title and description for the merged topic.${languageNote ? `\n\n${languageNote}` : ""}`;

      const aiResponse = await callXaiJSON<AiBlockPayload>(
        [
          systemMessage(
            'You merge learning blocks into one larger topic. Return JSON only: { "title": "...", "description": "..." }.',
          ),
          userMessage(aiPrompt),
        ],
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

      await supabase
        .from("blocks")
        .update({
          title: aiResponse.data.title.trim(),
          description: aiResponse.data.description?.trim() || "",
          position_x: footprint.position_x,
          position_y: footprint.position_y,
          span_w: footprint.span_w,
          span_h: footprint.span_h,
          is_start: targets.some((t) => t.is_start) || false,
        })
        .eq("id", keepId);

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
      const footprint = footprintFromCells(selection);
      if (!footprint) {
        return NextResponse.json({ error: "cells required for generate_shape" }, { status: 400 });
      }
      if (!prompt?.trim()) {
        return NextResponse.json({ error: "prompt required for generate_shape" }, { status: 400 });
      }
      if (!canPlaceFootprint(footprint, occupancy)) {
        return NextResponse.json({ error: "Selected cells are occupied" }, { status: 409 });
      }

      const { plan, fileNames } = await loadWorkspaceContext(supabase, workspaceId);
      const context = composeBlockGenerationContext({
        workspaceTitle: plan?.title || plan?.root_topic || undefined,
        goal: plan?.conversion_goal || plan?.root_topic,
        notes: plan?.notes,
        fileNames,
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

      const aiPrompt = `${context}

Target multi-cell region: anchor (${footprint.position_y},${footprint.position_x}) span ${footprint.span_w}×${footprint.span_h}
Nearby blocks:
${neighborSummary}

User request: "${prompt.trim()}"

Create exactly one learning block that occupies this combined shape.${languageNote ? `\n\n${languageNote}` : ""}`;

      const aiResponse = await callXaiJSON<AiBlockPayload>(
        [
          systemMessage(
            'You create a single learning block for a multi-cell skill grid region. Return JSON only: { "title": "...", "description": "..." }.',
          ),
          userMessage(aiPrompt),
        ],
        {
          model: userModel || DEFAULT_MODEL,
          maxTokens: 600,
          temperature: 0.5,
        },
      );

      if (!aiResponse.success || !aiResponse.data?.title?.trim()) {
        return NextResponse.json({ error: aiResponse.error || "Failed to generate block" }, { status: 502 });
      }

      const insertPayload: Record<string, unknown> = {
        workspace_id: workspaceId,
        title: aiResponse.data.title.trim(),
        description: aiResponse.data.description?.trim() || "",
        is_start: nodes.length === 0,
        next_block_ids: [],
        status: "available",
        position_x: footprint.position_x,
        position_y: footprint.position_y,
        span_w: footprint.span_w,
        span_h: footprint.span_h,
      };

      let { data: newNode, error: insertError } = await supabase
        .from("blocks")
        .insert(insertPayload)
        .select()
        .single();

      // Graceful fallback if span columns not migrated yet
      if (insertError && /span_w|span_h|schema cache/i.test(insertError.message || "")) {
        const { span_w: _sw, span_h: _sh, ...withoutSpan } = insertPayload;
        const retry = await supabase.from("blocks").insert(withoutSpan).select().single();
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
        explanation: `Added "${newNode.title}" spanning ${footprint.span_w}×${footprint.span_h}.`,
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
