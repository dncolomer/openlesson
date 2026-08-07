import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ayclLandingPracticeContext,
  assembleAyclLandingSummary,
  buildAyclExploreLearnSystemPrompt,
  buildAyclExploreLearnUserPrompt,
  parseAyclExploreLearnSamples,
} from "@/lib/aycl-landing";
import {
  callXaiJSON,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";

export const runtime = "nodejs";

type SamplesAi = {
  questions?: string[];
  exercises?: string[];
};

/**
 * GET — on-demand Explore/Learn samples for the public AYCL landing page.
 * Returns raw xAI questions/exercises only. No pure-template fallback.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const workspaceId = String(id || "").trim();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspace id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select(
        "id, title, root_topic, description, workspace_goal, notes, cover_image_url, is_all_you_can_learn",
      )
      .eq("id", workspaceId)
      .eq("is_all_you_can_learn", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: blocks } = await supabase
      .from("blocks")
      .select(
        "id, title, description, status, is_start, next_block_ids, position_x, position_y, span_w, span_h",
      )
      .eq("workspace_id", workspaceId)
      .limit(40);

    const landing = assembleAyclLandingSummary({
      workspace,
      blocks: blocks || [],
    });
    const practiceCtx = ayclLandingPracticeContext(landing, blocks || []);

    const ai = await callXaiJSON<SamplesAi>(
      [
        systemMessage(buildAyclExploreLearnSystemPrompt()),
        userMessage(buildAyclExploreLearnUserPrompt(landing, blocks || [])),
      ],
      { model: DEFAULT_MODEL, maxTokens: 2200, temperature: 0.55, retries: 2 },
    );
    if (!ai.success || !ai.data) {
      return NextResponse.json(
        { error: ai.error || "Failed to generate practice content" },
        { status: 502 },
      );
    }
    const samples = parseAyclExploreLearnSamples(ai.data, practiceCtx);
    if (samples.questions.length === 0 && samples.exercises.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate practice content" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      workspaceId,
      source: "xai" as const,
      questions: samples.questions,
      exercises: samples.exercises,
      sectionTitle: "Things you'll Explore and Learn",
    });
  } catch (error) {
    console.error("[aycl/explore-samples]", error);
    return NextResponse.json(
      { error: "Failed to generate practice content" },
      { status: 500 },
    );
  }
}
