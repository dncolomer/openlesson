import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import {
  buildSkillGridLayout,
  formatWeightedNeighborhoodSummary,
  isCellOccupied,
  type WeightedGridNeighbor,
} from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";
import {
  buildShapeContextSourceOptions,
  composeShapeGenerationContext,
  shapeSelectionToGenerationSnippet,
  shapeSelectionToLocalContext,
} from "@/lib/shape-context-select";
import { normalizeBlockLocalContext } from "@/lib/prompt-workspace-context";
import { resolveCreateBlockIsStart } from "@/lib/block-starter-flag";
import {
  normalizeBlockCreatorEffects,
  serializeBlockCreatorEffects,
  validateBlockCreatorEffects,
  hasAnyCreatorEffect,
} from "@/lib/block-creator-effects";
import {
  composeAddBlockAtSlotSystemMessage,
  composeJourneyGraphPromptSnippet,
} from "@/lib/workspace-authoring-prompt-context";

interface AddBlockResponse {
  title: string;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      row,
      col,
      prompt,
      model: userModel,
      locale,
      weightedNeighbors,
      contextSourceKeys,
      is_start: isStartBody,
      isStart: isStartCamel,
      /** Combinable creator effects from blank-cell Add drawers. */
      creator_effects: creatorEffectsSnake,
      creatorEffects: creatorEffectsCamel,
      /** "bridge" → knowledge-bridge system framing (suggestion 7). */
      intent,
    } = body;

    if (!workspaceId || typeof row !== "number" || typeof col !== "number" || !prompt?.trim()) {
      return NextResponse.json({ error: "Plan ID, grid position, and prompt are required" }, { status: 400 });
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("id, user_id, root_topic, title, description, notes, workspace_goal")
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 });
    }

    const { data: workspaceFiles } = await supabase
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
        console.error("[add-block-at-slot] external resources load:", externalQuery.error);
      }
    } else {
      externalRows = (externalQuery.data || []) as typeof externalRows;
    }

    const skillNodes = toSkillGridNodes(nodes);
    const { occupancy } = buildSkillGridLayout(skillNodes);

    if (isCellOccupied(occupancy, row, col)) {
      return NextResponse.json({ error: "That grid slot is already occupied" }, { status: 409 });
    }

    const hasSavedCollision = nodes.some(
      (node) => node.position_x === col && node.position_y === row,
    );
    if (hasSavedCollision) {
      return NextResponse.json({ error: "That grid slot is already occupied" }, { status: 409 });
    }

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Title and description must be in that language.`
        : "";

    const workspaceTitle = plan.title || plan.root_topic || "Untitled workspace";
    const neighborSummary = Array.isArray(weightedNeighbors) && weightedNeighbors.length > 0
      ? formatWeightedNeighborhoodSummary(weightedNeighbors as WeightedGridNeighbor[])
      : "none";

    const blockList = nodes
      .map((node) => {
        const coords =
          node.position_x != null && node.position_y != null
            ? ` at (${node.position_y},${node.position_x})`
            : "";
        return `- ${node.title}${coords}`;
      })
      .join("\n");

    // Same context-source attach model as multi-cell generate_shape.
    const selectedKeys = Array.isArray(contextSourceKeys)
      ? contextSourceKeys.map((k: unknown) => String(k || "").trim()).filter(Boolean)
      : [];
    const shapeOptions = buildShapeContextSourceOptions({
      notes: plan.notes ?? "",
      files: (workspaceFiles || []).map((f: { id?: string; file_name?: string }) => ({
        id: f.id,
        file_name: f.file_name,
      })),
      externalResources: externalRows,
    });
    const selectedSnippet = shapeSelectionToGenerationSnippet(selectedKeys, shapeOptions);
    const localContext = shapeSelectionToLocalContext(selectedKeys, shapeOptions);
    const normalizedLocal = localContext
      ? normalizeBlockLocalContext(localContext)
      : null;

    const fileNames = (workspaceFiles || [])
      .map((f: { file_name?: string }) => f.file_name)
      .filter(Boolean) as string[];

    const alwaysContext = composeBlockGenerationContext({
      workspaceTitle,
      goal: plan.workspace_goal || plan.root_topic,
      // When user selected a subset, do not force full workspace notes into
      // the "always" block — selected materials are primary.
      notes: selectedKeys.length > 0 ? undefined : plan.notes,
      fileNames: selectedKeys.length > 0 ? undefined : fileNames,
    });
    const withSelected = composeShapeGenerationContext({
      baseContext: alwaysContext,
      selectedSnippet,
    });

    const journeySnippet = composeJourneyGraphPromptSnippet(
      (nodes || []).map((n: {
        id: string;
        title?: string | null;
        next_block_ids?: string[] | null;
        lock_until_block_ids?: string[] | null;
      }) => ({
        id: n.id,
        title: n.title,
        next_block_ids: n.next_block_ids,
        lock_until_block_ids: n.lock_until_block_ids,
      })),
      {
        focusBlockIds: Array.isArray(weightedNeighbors)
          ? (weightedNeighbors as WeightedGridNeighbor[]).map((n) => n.id)
          : undefined,
        maxLines: 20,
      },
    );

    const aiPrompt = `${withSelected}
${plan.description ? `Description: ${plan.description}\n` : ""}Existing blocks:
${blockList || "(none yet)"}

Target grid slot: row ${row}, column ${col}
Nearby blocks (distance-weighted influence — closer blocks matter more):
${neighborSummary}
${journeySnippet ? `\n${journeySnippet}\n` : ""}
User request for the new block: "${prompt.trim()}"

Create exactly one learning block that belongs at this grid slot. The topic should fit the spatial context: complement nearby blocks, avoid duplicates, and respect distance-weighted influence and any journey/DAG edges above.${selectedKeys.length > 0 ? " Prioritize the creator-selected materials above." : " Always honor workspace files and notes as context."}${languageNote ? `\n\n${languageNote}` : ""}`;

    const aiResponse = await callXaiJSON<AddBlockResponse>(
      [
        systemMessage(
          composeAddBlockAtSlotSystemMessage(
            typeof intent === "string" ? intent : null,
          ),
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

    const local_context =
      localContext && normalizedLocal?.hasLocalMaterials
        ? {
            notes: localContext.notes ?? null,
            global_file_refs: localContext.global_file_refs ?? null,
            local_files: localContext.local_files ?? null,
            external_resource_ids: localContext.external_resource_ids ?? null,
          }
        : null;

    const authorStarter =
      typeof isStartBody === "boolean"
        ? isStartBody
        : typeof isStartCamel === "boolean"
          ? isStartCamel
          : undefined;

    // Creator effects drafted on blank-cell Add (Dynamic / Generator).
    const effectsRaw = creatorEffectsSnake ?? creatorEffectsCamel;
    let creatorEffectsWire: Record<string, unknown> | null = null;
    if (effectsRaw !== undefined && effectsRaw !== null) {
      const validated = validateBlockCreatorEffects({
        // New block has no id yet — use placeholder; strip self from generator targets.
        blockId: "__new_block__",
        effects: normalizeBlockCreatorEffects(effectsRaw, {
          selfBlockId: "__new_block__",
        }),
        blocks: nodes.map((n) => ({
          id: String(n.id),
          lock_until_block_ids: (
            n as { lock_until_block_ids?: string[] | null }
          ).lock_until_block_ids,
          next_block_ids: n.next_block_ids,
        })),
        // Dynamic may be flagged before path edges exist.
        allowDynamicWithoutDag: true,
      });
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      if (hasAnyCreatorEffect(validated.effects)) {
        creatorEffectsWire = serializeBlockCreatorEffects(validated.effects, {
          selfBlockId: "__new_block__",
        });
      }
    }

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
      position_x: col,
      position_y: row,
      ...(local_context ? { local_context } : {}),
      ...(creatorEffectsWire ? { creator_effects: creatorEffectsWire } : {}),
    };

    let { data: newNode, error: insertError } = await supabase
      .from("blocks")
      .insert(insertPayload)
      .select()
      .single();

    // Graceful fallback if optional columns not migrated yet
    if (
      insertError &&
      /local_context|creator_effects|schema cache/i.test(insertError.message || "")
    ) {
      let retryPayload = { ...insertPayload };
      if (/creator_effects/i.test(insertError.message || "")) {
        const { creator_effects: _ce, ...rest } = retryPayload;
        retryPayload = rest;
      }
      if (/local_context/i.test(insertError.message || "")) {
        const { local_context: _lc, ...rest } = retryPayload;
        retryPayload = rest;
      }
      if (/schema cache/i.test(insertError.message || "")) {
        const {
          local_context: _lc,
          creator_effects: _ce,
          ...rest
        } = insertPayload;
        retryPayload = rest;
      }
      const retry = await supabase.from("blocks").insert(retryPayload).select().single();
      newNode = retry.data;
      insertError = retry.error;
    }

    if (insertError || !newNode) {
      return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
    }

    const { data: updatedNodes, error: fetchError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (fetchError) {
      return NextResponse.json({ error: "Block created but failed to refresh plan" }, { status: 500 });
    }

    return NextResponse.json({
      explanation: `Added "${newNode.title}" at grid slot (${row}, ${col}).`,
      planModified: true,
      updatedNodes: updatedNodes || [],
      placedNodeId: newNode.id,
    });
  } catch (error) {
    console.error("Add block at slot error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}