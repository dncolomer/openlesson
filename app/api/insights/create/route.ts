import { NextRequest, NextResponse } from "next/server";
import { INSIGHT_AESTHETIC_IMAGES } from "@/lib/insights-server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

interface CreateInsightResponse {
  title: string;
  summary: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { thoughtIds, thoughts, workspaceId, blockId, sessionId } = await req.json();
    const sourceThoughts = Array.isArray(thoughts)
      ? thoughts.filter((t: { text?: string }) => t?.text?.trim())
      : [];
    if (sourceThoughts.length === 0) {
      return NextResponse.json({ error: "At least one thought is required" }, { status: 400 });
    }

    const thoughtBlock = sourceThoughts
      .map((t: { text: string }, i: number) => `${i + 1}. ${t.text.trim()}`)
      .join("\n");

    const ai = await callXaiJSON<CreateInsightResponse>(
      [
        systemMessage(
          'Turn learner thought traces into one insight bookmark. Return JSON: { "title": "4-12 words", "summary": "2-4 sentences, rephrased synthesis — not a quote dump." }',
        ),
        userMessage(`Thought traces:\n${thoughtBlock}\n\nSynthesize into one durable insight the learner can revisit.`),
      ],
      { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.4 },
    );

    if (!ai.success || !ai.data?.title?.trim() || !ai.data?.summary?.trim()) {
      return NextResponse.json({ error: "Failed to synthesize insight" }, { status: 502 });
    }

    const aestheticImage =
      INSIGHT_AESTHETIC_IMAGES[Math.floor(Math.random() * INSIGHT_AESTHETIC_IMAGES.length)];

    const { data: insight, error } = await supabase
      .from("insights")
      .insert({
        user_id: user.id,
        workspace_id: workspaceId || null,
        block_id: blockId || null,
        session_id: sessionId || null,
        title: ai.data.title.trim(),
        summary: ai.data.summary.trim(),
        thought_ids: Array.isArray(thoughtIds) ? thoughtIds : [],
        source_thoughts: sourceThoughts,
        aesthetic_image: aestheticImage,
        is_public: true,
      })
      .select()
      .single();

    if (error || !insight) {
      return NextResponse.json({ error: error?.message || "Failed to save insight" }, { status: 500 });
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("[insights/create]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}