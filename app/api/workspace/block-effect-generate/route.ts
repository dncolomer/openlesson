/**
 * Generate block content for creator effects:
 * - dynamic: unlocked block from completed learner history
 * - generator_cell: create a new block on an empty cell after generator completes
 */

import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import {
  composeDynamicGenerationUserPrompt,
  composeEffectGenerationSystemMessage,
  composeGeneratorTargetUserPrompt,
  formatGeneratorGeometryNote,
  normalizeEffectGenerationResult,
  type EffectGenerationMode,
} from "@/lib/block-effect-generation";
import {
  generatorCellKey,
  isDynamicEffectEnabled,
  isGeneratorEffectEnabled,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import { isBlockCompletedStatus } from "@/lib/map-ground-rules";
import { buildSkillGridLayout, isCellOccupied } from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";
import { createAdminClient } from "@/lib/supabase/admin";

type EffectMode = EffectGenerationMode | "generator_cell";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      mode,
      blockId,
      generatorBlockId,
      row: rowBody,
      col: colBody,
      model: userModel,
      locale,
    } = body as {
      workspaceId?: string;
      mode?: EffectMode;
      blockId?: string;
      generatorBlockId?: string;
      row?: number;
      col?: number;
      model?: string;
      locale?: string;
    };

    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    if (
      mode !== "dynamic" &&
      mode !== "generator_cell" &&
      mode !== "generator_target"
    ) {
      return NextResponse.json(
        {
          error: "mode must be dynamic | generator_cell",
        },
        { status: 400 },
      );
    }

    // generator_target kept as alias → generator_cell for older clients
    const effectiveMode: "dynamic" | "generator_cell" =
      mode === "generator_target" ? "generator_cell" : mode;

    if (effectiveMode === "dynamic" && (!blockId || typeof blockId !== "string")) {
      return NextResponse.json({ error: "blockId is required" }, { status: 400 });
    }

    const ayclToken = ayclTokenFromBody(body as Record<string, unknown>);
    // Learners may generate effect content; not full authoring tools.
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken,
      requireAyclAuthoring: false,
    });
    if (!auth.ok) return auth.response;
    // Admin client for effect writes: learners mark Done and Generator must be
    // able to insert/update blocks even when RLS only allows workspace owners.
    // Access is still gated by guardWorkspaceRoute above.
    const supabase = createAdminClient();

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, description, notes, workspace_goal, unusable_cells")
      .eq("id", workspaceId)
      .single();

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError) {
      return NextResponse.json({ error: "Failed to load blocks" }, { status: 500 });
    }

    const blocks = (nodes || []) as Array<Record<string, unknown>>;

    const languageNote =
      locale && locale !== "en"
        ? `Write title and description in locale language: ${locale}.`
        : undefined;

    const wsTitle =
      (workspace as { title?: string } | null)?.title ||
      (workspace as { root_topic?: string } | null)?.root_topic;
    const wsGoal = (workspace as { workspace_goal?: string } | null)?.workspace_goal;

    const model =
      typeof userModel === "string" && userModel.trim()
        ? userModel.trim()
        : DEFAULT_MODEL;

    // ── generator_cell: insert a new block at empty (row, col) ───────────
    if (effectiveMode === "generator_cell") {
      const genId = String(generatorBlockId || "").trim();
      if (!genId) {
        return NextResponse.json(
          { error: "generatorBlockId is required for generator_cell" },
          { status: 400 },
        );
      }
      const row = Number(rowBody);
      const col = Number(colBody);
      if (!Number.isFinite(row) || !Number.isFinite(col)) {
        return NextResponse.json(
          { error: "row and col are required for generator_cell" },
          { status: 400 },
        );
      }
      const cell = { row: Math.trunc(row), col: Math.trunc(col) };

      const generator = blocks.find((b) => String(b.id) === genId);
      if (!generator) {
        return NextResponse.json(
          { error: "Generator block not found" },
          { status: 404 },
        );
      }
      const genEffects = parseBlockCreatorEffects(generator.creator_effects, {
        selfBlockId: genId,
      });
      if (!isGeneratorEffectEnabled(genEffects)) {
        return NextResponse.json(
          { error: "Generator effect is not enabled on the source block" },
          { status: 400 },
        );
      }
      const allowed = genEffects.generator.targetCells.some(
        (c) => c.row === cell.row && c.col === cell.col,
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "Cell is not a generator empty target of the source" },
          { status: 400 },
        );
      }

      const skillNodes = toSkillGridNodes(
        blocks as unknown as Parameters<typeof toSkillGridNodes>[0],
      );
      const { occupancy } = buildSkillGridLayout(skillNodes);
      if (isCellOccupied(occupancy, cell.row, cell.col)) {
        return NextResponse.json(
          { error: "Target cell is no longer empty" },
          { status: 409 },
        );
      }

      const geometryNote = formatGeneratorGeometryNote({
        generator: {
          position_x:
            typeof generator.position_x === "number"
              ? generator.position_x
              : null,
          position_y:
            typeof generator.position_y === "number"
              ? generator.position_y
              : null,
        },
        target: {
          position_x: cell.col,
          position_y: cell.row,
        },
      });

      const userPrompt = composeGeneratorTargetUserPrompt({
        workspaceTitle: wsTitle,
        workspaceGoal: wsGoal,
        generatorTitle:
          generator.title != null ? String(generator.title) : null,
        generatorDescription:
          generator.description != null ? String(generator.description) : null,
        targetSeedTitle: null,
        targetSeedDescription: null,
        geometryNote:
          geometryNote ||
          `Empty cell at row ${cell.row}, col ${cell.col} (${generatorCellKey(cell)}).`,
        languageNote,
      });

      const generated = await callXaiJSON<{
        title?: string;
        description?: string;
      }>(
        [
          systemMessage(composeEffectGenerationSystemMessage()),
          userMessage(userPrompt),
        ],
        { model, maxTokens: 700, temperature: 0.5 },
      );

      if (!generated.success || !generated.data) {
        return NextResponse.json(
          {
            error:
              generated.error ||
              "Failed to generate block content for generator cell",
          },
          { status: 502 },
        );
      }

      const result = normalizeEffectGenerationResult(generated.data, {
        title: "Generated topic",
        description: "",
      });

      const insertPayload: Record<string, unknown> = {
        workspace_id: workspaceId,
        title: result.title,
        description: result.description,
        is_start: false,
        next_block_ids: [],
        status: "available",
        position_x: cell.col,
        position_y: cell.row,
      };

      const { data: newNode, error: insertError } = await supabase
        .from("blocks")
        .insert(insertPayload)
        .select()
        .single();

      if (insertError || !newNode) {
        return NextResponse.json(
          {
            error:
              insertError?.message ||
              "Failed to create generated block on empty cell",
          },
          { status: 500 },
        );
      }

      const { data: updatedNodes } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      return NextResponse.json({
        ok: true,
        mode: "generator_cell",
        blockId: newNode.id,
        row: cell.row,
        col: cell.col,
        title: result.title,
        description: result.description,
        updatedNodes: updatedNodes || [],
      });
    }

    // ── dynamic: update existing block from learner history ──────────────
    if (effectiveMode !== "dynamic") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const target = blocks.find((b) => String(b.id) === blockId);
    if (!target) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const effects = parseBlockCreatorEffects(target.creator_effects, {
      selfBlockId: String(blockId),
    });

    if (!isDynamicEffectEnabled(effects)) {
      return NextResponse.json(
        { error: "Dynamic effect is not enabled on this block" },
        { status: 400 },
      );
    }
    const completedBlocks = blocks
      .filter((b) => isBlockCompletedStatus(String(b.status || "")))
      .map((b) => ({
        id: String(b.id),
        title: b.title != null ? String(b.title) : null,
        description: b.description != null ? String(b.description) : null,
        status: b.status != null ? String(b.status) : null,
      }));
    const userPrompt = composeDynamicGenerationUserPrompt({
      workspaceTitle: wsTitle,
      workspaceGoal: wsGoal,
      blockSeedTitle: target.title != null ? String(target.title) : null,
      blockSeedDescription:
        target.description != null ? String(target.description) : null,
      completedBlocks,
      languageNote,
    });

    const generated = await callXaiJSON<{ title?: string; description?: string }>(
      [
        systemMessage(composeEffectGenerationSystemMessage()),
        userMessage(userPrompt),
      ],
      { model, maxTokens: 700, temperature: 0.5 },
    );

    if (!generated.success || !generated.data) {
      return NextResponse.json(
        {
          error:
            generated.error ||
            "Failed to generate block content for effect",
        },
        { status: 502 },
      );
    }

    const result = normalizeEffectGenerationResult(generated.data, {
      title: target.title != null ? String(target.title) : null,
      description:
        target.description != null ? String(target.description) : null,
    });

    const { error: updateError } = await supabase
      .from("blocks")
      .update({
        title: result.title,
        description: result.description,
      })
      .eq("id", blockId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update block with generated content" },
        { status: 500 },
      );
    }

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ok: true,
      mode: effectiveMode,
      blockId,
      title: result.title,
      description: result.description,
      updatedNodes: updatedNodes || [],
    });
  } catch (err) {
    console.error("[block-effect-generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
