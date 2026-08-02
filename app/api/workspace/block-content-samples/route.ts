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
} from "@/lib/prompt-workspace-context";

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
 * POST — regenerate Content Samples (topics + practice questions) for a block,
 * using title/description/planning prompt and the latest local context.
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
      .select("id, title, description, planning_prompt, local_context")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("title, root_topic, notes, workspace_goal")
      .eq("id", workspaceId)
      .single();

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

    const localParts: string[] = [];
    if (local.notes) localParts.push(`Block local notes:\n${local.notes}`);
    if (local.globalFileRefs.length) {
      localParts.push(
        `Referenced workspace files:\n${local.globalFileRefs.map((n) => `- ${n}`).join("\n")}`,
      );
    }
    if (local.localFiles.length) {
      localParts.push(
        `Local materials:\n${local.localFiles
          .map((f) => `- ${f.name}${f.excerpt ? `: ${String(f.excerpt).slice(0, 400)}` : ""}`)
          .join("\n")}`,
      );
    }
    if (local.externalResourceIds.length) {
      localParts.push(
        `External resource ids: ${local.externalResourceIds.join(", ")}`,
      );
    }

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale}. Topics and questions must be in that language.`
        : "";

    const workspaceTitle =
      workspace?.title || workspace?.root_topic || "Workspace";
    const goal = workspace?.workspace_goal || workspace?.root_topic || "";

    const userPrompt = `Workspace: ${workspaceTitle}
${goal ? `Goal: ${goal}\n` : ""}${workspace?.notes ? `Workspace notes (excerpt):\n${String(workspace.notes).slice(0, 1200)}\n` : ""}
Block title: ${title}
${description ? `Block description: ${description}\n` : ""}${planningPrompt ? `Planning prompt: ${planningPrompt}\n` : ""}
${localParts.length ? `LOCAL CONTEXT (prioritize this when generating simulation content):\n${localParts.join("\n\n")}\n` : "No local context attached yet.\n"}
Generate sample practice items for this block (what might appear in Explore or Drill):
- questions: EXACTLY 3 dialogue / think-aloud questions a partner or coach might ask
- exercises: EXACTLY 3 short solo exercise prompts (do/solve/outline out loud)
- topics: optional 3–6 short topic phrases
- probes (preferred): 6 items total — 3 with kind "question" and 3 with kind "exercise"
  Each probe: { "question": string, "kind": "question"|"exercise", "difficulty": "warmup"|"core"|"stretch", "contextSources": string[] }
  contextSources: short labels for what influenced the item (e.g. "Title", "Description", "Planning prompt", "Local notes", file names). Omit if none.

Prioritize the latest local context and block text. Avoid generic fluff.
${languageNote}`;

    const ai = await callXaiJSON<SamplesResponse>(
      [
        systemMessage(
          'You write sample practice items for a learning block. Return JSON only: { "topics": string[], "questions": string[3], "exercises": string[3], "probes": [{ "question": string, "kind": "question"|"exercise", "difficulty": "warmup"|"core"|"stretch", "contextSources": string[] }] }. Exactly 3 questions and 3 exercises.',
        ),
        userMessage(userPrompt),
      ],
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
    return NextResponse.json({ error: message }, { status });
  }
}
