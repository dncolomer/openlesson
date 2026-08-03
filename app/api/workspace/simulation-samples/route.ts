import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
  parseJsonLoose,
} from "@/lib/xai-client";
import {
  buildSimulationSamplePrompts,
  deriveSimulationSamples,
  normalizeSimulationSampleResponse,
  normalizeSimulationSampleScope,
  type SimulationSampleBlockRef,
  type SimulationSampleScope,
  type SimulationSampleWorkspaceContext,
} from "@/lib/workspace-simulation-samples";
import {
  normalizeBlockLocalContext,
  parseBlockLocalContext,
} from "@/lib/prompt-workspace-context";

type SamplesResponse = {
  topics?: string[];
  questions?: string[];
  exercises?: string[];
  probes?: Array<{
    question?: string;
    coachCue?: string;
    coach_cue?: string;
    difficulty?: string;
    kind?: string;
  }>;
};

/**
 * POST — generate Explore (questions) + Drill (exercises) samples for the
 * workspace Simulation tab. Scope: a single block **or** the entire workspace.
 *
 * Uses the same practice-item builders (TAP opening + domain exercise rules)
 * as live Explore/Drill and the per-block Simulation regenerate path.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      blockId,
      scope: scopeRaw,
      model: userModel,
      locale,
    } = body as {
      workspaceId?: string;
      blockId?: string | null;
      scope?: string | null;
      model?: string;
      locale?: string;
    };

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 },
      );
    }

    const scopeResult = normalizeSimulationSampleScope({
      scope: scopeRaw,
      blockId,
    });
    if ("error" in scopeResult) {
      return NextResponse.json({ error: scopeResult.error }, { status: 400 });
    }
    const scope: SimulationSampleScope = scopeResult;

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("title, root_topic, notes, workspace_goal, description")
      .eq("id", workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: siblingBlocks } = await supabase
      .from("blocks")
      .select(
        "id, title, description, planning_prompt, local_context, position_x, position_y, span_w, span_h, is_start, next_block_ids, lock_until_block_ids",
      )
      .eq("workspace_id", workspaceId)
      .limit(24);

    if (scope.kind === "block") {
      const found = (siblingBlocks || []).some((b) => b.id === scope.blockId);
      if (!found) {
        // Confirm the block exists even if outside the inventory limit
        const { data: one } = await supabase
          .from("blocks")
          .select("id")
          .eq("id", scope.blockId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (!one) {
          return NextResponse.json({ error: "Block not found" }, { status: 404 });
        }
      }
    }

    const blocks: SimulationSampleBlockRef[] = (siblingBlocks || []).map((b) => {
      const local = normalizeBlockLocalContext(
        parseBlockLocalContext((b as { local_context?: unknown }).local_context),
      );
      return {
        id: b.id,
        title: String(b.title || "Block"),
        description: (b.description as string | null) ?? null,
        planning_prompt: (b.planning_prompt as string | null) ?? null,
        local_context: { notes: local.notes || null },
        is_start: b.is_start as boolean | null,
        position_x: b.position_x as number | null,
        position_y: b.position_y as number | null,
        span_w: b.span_w as number | null,
        span_h: b.span_h as number | null,
        next_block_ids: (b.next_block_ids as string[] | null) ?? null,
        lock_until_block_ids: (b.lock_until_block_ids as string[] | null) ?? null,
      };
    });

    // If block scope and block was outside first-24 inventory, load it in.
    if (scope.kind === "block" && !blocks.some((b) => b.id === scope.blockId)) {
      const { data: focused } = await supabase
        .from("blocks")
        .select(
          "id, title, description, planning_prompt, local_context, position_x, position_y, span_w, span_h, is_start, next_block_ids, lock_until_block_ids",
        )
        .eq("id", scope.blockId)
        .eq("workspace_id", workspaceId)
        .single();
      if (focused) {
        const local = normalizeBlockLocalContext(
          parseBlockLocalContext(
            (focused as { local_context?: unknown }).local_context,
          ),
        );
        blocks.unshift({
          id: focused.id,
          title: String(focused.title || "Block"),
          description: (focused.description as string | null) ?? null,
          planning_prompt: (focused.planning_prompt as string | null) ?? null,
          local_context: { notes: local.notes || null },
          is_start: focused.is_start as boolean | null,
          position_x: focused.position_x as number | null,
          position_y: focused.position_y as number | null,
          span_w: focused.span_w as number | null,
          span_h: focused.span_h as number | null,
          next_block_ids: (focused.next_block_ids as string[] | null) ?? null,
          lock_until_block_ids:
            (focused.lock_until_block_ids as string[] | null) ?? null,
        });
      }
    }

    const workspaceCtx: SimulationSampleWorkspaceContext = {
      workspaceTitle: workspace.title || workspace.root_topic || "Workspace",
      rootTopic: workspace.root_topic,
      workspaceGoal:
        workspace.workspace_goal ||
        workspace.description ||
        workspace.root_topic ||
        "",
      workspaceDescription: workspace.description,
      notes: workspace.notes,
      locale,
      blocks,
    };

    const { systemPrompt, userPrompt, focusedBlockId } =
      buildSimulationSamplePrompts(scope, workspaceCtx);

    // Room for 3 questions + 3 exercises + probes; 1400 often truncates mid-JSON.
    const ai = await callXaiJSON<SamplesResponse>(
      [systemMessage(systemPrompt), userMessage(userPrompt)],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 2800,
        temperature: 0.55,
        retries: 2,
      },
    );

    let modelPayload: SamplesResponse | null = ai.success && ai.data ? ai.data : null;

    // Recover from raw model text when structured parse failed (fences / truncation).
    if (!modelPayload && ai.rawContent) {
      const recovered = parseJsonLoose<SamplesResponse>(ai.rawContent);
      if (recovered.ok) modelPayload = recovered.data;
    }

    const normalized = normalizeSimulationSampleResponse(
      modelPayload,
      scope,
      workspaceCtx,
    );

    // Pure Explore/Drill builders always produce samples for non-empty context —
    // prefer those over hard-failing the Simulation tab on LLM JSON flakiness.
    if (
      normalized.questions.length === 0 &&
      normalized.exercises.length === 0
    ) {
      const fallback = deriveSimulationSamples(scope, workspaceCtx);
      if (fallback.questions.length === 0 && fallback.exercises.length === 0) {
        return NextResponse.json(
          {
            error:
              ai.error ||
              "Model returned empty simulation samples and pure builders had no substance",
          },
          { status: 502 },
        );
      }
      console.warn(
        "[simulation-samples] empty LLM samples; using pure builders. reason=",
        ai.error || "empty",
      );
      return NextResponse.json({
        ok: true,
        scope: scope.kind,
        blockId: focusedBlockId,
        questions: fallback.questions,
        exercises: fallback.exercises,
        probes: fallback.probes,
        fallback: true,
        fallbackReason: ai.error || "empty_model_samples",
      });
    }

    return NextResponse.json({
      ok: true,
      scope: scope.kind,
      blockId: focusedBlockId,
      questions: normalized.questions,
      exercises: normalized.exercises,
      probes: normalized.probes,
      ...(modelPayload ? {} : { fallback: true, fallbackReason: ai.error || "parse_failed" }),
    });
  } catch (error) {
    console.error("simulation-samples error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status: status });
  }
}
