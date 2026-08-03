import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { normalizeContentSamplesPayload } from "@/lib/block-example-topics";
import {
  normalizeSimulationPayload,
  type BlockSimulationResult,
} from "@/lib/block-simulation";
import {
  normalizeBlockLocalContext,
  parseBlockLocalContext,
  type BlockLocalContextInput,
  type PromptBlockInventoryItem,
} from "@/lib/prompt-workspace-context";
import {
  buildSimulationSamplesSystemPrompt,
  buildSimulationSamplesUserPrompt,
} from "@/lib/practice-item-builders";

type SamplesResponse = {
  topics?: string[];
  questions?: string[];
  exercises?: string[];
  intent?: string;
  outcome?: string;
  probes?: Array<{
    question?: string;
    coachCue?: string;
    coach_cue?: string;
    difficulty?: string;
    kind?: string;
  }>;
};

/**
 * POST — regenerate Content Samples / Simulation for a block.
 * Uses the same practice-item builders (TAP opening + domain exercise rules)
 * as live Explore/Drill generation — not a separate ad-hoc author prompt.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      blockId,
      title: titleOverride,
      description: descriptionOverride,
      planningPrompt: planningOverride,
      localContext: localContextBody,
      model: userModel,
      locale,
    } = body as {
      workspaceId?: string;
      blockId?: string;
      title?: string;
      description?: string;
      planningPrompt?: string;
      localContext?: BlockLocalContextInput | null;
      model?: string;
      locale?: string;
    };

    if (!workspaceId || !blockId) {
      return NextResponse.json(
        { error: "workspaceId and blockId are required" },
        { status: 400 },
      );
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select(
        "id, title, description, planning_prompt, local_context, position_x, position_y, span_w, span_h, is_start, next_block_ids, lock_until_block_ids",
      )
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("title, root_topic, notes, workspace_goal, description")
      .eq("id", workspaceId)
      .single();

    // Optional map inventory for topology grounding (same layers as live TAP/ILE).
    const { data: siblingBlocks } = await supabase
      .from("blocks")
      .select(
        "id, title, description, position_x, position_y, span_w, span_h, is_start, next_block_ids, lock_until_block_ids",
      )
      .eq("workspace_id", workspaceId)
      .limit(24);

    const title =
      (typeof titleOverride === "string" && titleOverride.trim()) ||
      String(block.title || "").trim() ||
      "Untitled block";
    const description =
      (typeof descriptionOverride === "string" ? descriptionOverride : null) ??
      (block.description as string | null) ??
      "";
    const planningPrompt =
      (typeof planningOverride === "string" ? planningOverride : null) ??
      (block.planning_prompt as string | null) ??
      "";

    // Prefer client-passed local context (includes just-attached materials).
    const fromClient =
      localContextBody != null
        ? normalizeBlockLocalContext(localContextBody)
        : null;
    const fromDb = normalizeBlockLocalContext(
      parseBlockLocalContext((block as { local_context?: unknown }).local_context),
    );
    const local = fromClient?.hasLocalMaterials ? fromClient : fromDb;

    const inventory: PromptBlockInventoryItem[] = (siblingBlocks || []).map((b) => ({
      id: b.id,
      title: String(b.title || "Block"),
      description: (b.description as string | null) ?? null,
      is_start: b.is_start as boolean | null,
      position_x: b.position_x as number | null,
      position_y: b.position_y as number | null,
      span_w: b.span_w as number | null,
      span_h: b.span_h as number | null,
      next_block_ids: (b.next_block_ids as string[] | null) ?? null,
      lock_until_block_ids: (b.lock_until_block_ids as string[] | null) ?? null,
    }));

    const files = [
      ...local.localFiles.map((f) => ({
        name: f.name,
        excerpt: f.excerpt ?? null,
      })),
      ...local.globalFileRefs.map((name) => ({ name, excerpt: null as string | null })),
    ];

    const system = buildSimulationSamplesSystemPrompt();
    const userPrompt = buildSimulationSamplesUserPrompt({
      workspaceTitle: workspace?.title || workspace?.root_topic || "Workspace",
      rootTopic: workspace?.root_topic,
      workspaceGoal:
        workspace?.workspace_goal || workspace?.description || workspace?.root_topic || "",
      workspaceDescription: workspace?.description,
      notes: workspace?.notes,
      blockTitle: title,
      blockDescription: description,
      planningPrompt,
      localNotes: local.notes,
      files,
      blocks: inventory,
      focusedBlockId: blockId,
      locale,
    });

    const ai = await callXaiJSON<SamplesResponse>(
      [systemMessage(system), userMessage(userPrompt)],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 1400,
        temperature: 0.55,
      },
    );

    if (!ai.success || !ai.data) {
      return NextResponse.json(
        { error: ai.error || "Failed to generate simulation" },
        { status: 502 },
      );
    }

    const samples = normalizeContentSamplesPayload(ai.data);
    const simulation: BlockSimulationResult = normalizeSimulationPayload(ai.data, {
      title,
      description,
      planningPrompt,
      localNotes: local.notes,
      hasLocalContext: local.hasLocalMaterials,
      hasPlanningPrompt: Boolean(planningPrompt.trim()),
      workspaceGoal:
        workspace?.workspace_goal || workspace?.description || workspace?.root_topic || null,
      workspaceTitle: workspace?.title || workspace?.root_topic || null,
      rootTopic: workspace?.root_topic || null,
      notes: workspace?.notes || null,
    });
    if (
      samples.topics.length === 0 &&
      samples.questions.length === 0 &&
      simulation.probes.length === 0
    ) {
      return NextResponse.json(
        { error: "Model returned empty simulation" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      // Legacy shape (Content Samples)
      topics: simulation.topics.length ? simulation.topics : samples.topics,
      questions:
        simulation.probes.length > 0
          ? simulation.probes.map((p) => p.question)
          : samples.questions,
      // Simulation shape
      intent: simulation.intent,
      outcome: simulation.outcome,
      probes: simulation.probes,
    });
  } catch (error) {
    console.error("block-content-samples error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status: status });
  }
}
