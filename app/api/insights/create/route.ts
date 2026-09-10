import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { buildInsightCreateInsert } from "@/lib/insights";
import { INSIGHT_AESTHETIC_IMAGES } from "@/lib/insights-server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

interface CreateInsightResponse {
  title: string;
  summary: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const {
      thoughtIds,
      thoughts,
      workspaceId,
      blockId,
      chapterId,
      sessionId,
      modifyingPrompt,
      title: providedTitle,
      summary: providedSummary,
      evaluated,
    } = await req.json();
    const sourceThoughts = Array.isArray(thoughts)
      ? thoughts.filter((t: { text?: string }) => t?.text?.trim())
      : [];
    const preEvaluated =
      evaluated === true &&
      typeof providedTitle === "string" &&
      typeof providedSummary === "string" &&
      providedTitle.trim() &&
      providedSummary.trim();

    if (!preEvaluated && sourceThoughts.length === 0) {
      return jsonError(400, "At least one thought is required");
    }

    let title = preEvaluated ? String(providedTitle).trim() : "";
    let summary = preEvaluated ? String(providedSummary).trim() : "";

    if (!preEvaluated) {
      const thoughtBlock = sourceThoughts
        .map((t: { text: string }, i: number) => `${i + 1}. ${t.text.trim()}`)
        .join("\n");

      const ai = await callXaiJSON<CreateInsightResponse>(
        [
          systemMessage(
            'Turn learner thought traces into one insight bookmark. Return JSON: { "title": "4-12 words", "summary": "2-4 sentences, rephrased synthesis — not a quote dump." }',
          ),
          userMessage(
            `Thought traces:\n${thoughtBlock}\n\nSynthesize into one durable insight the learner can revisit.${
              typeof modifyingPrompt === "string" && modifyingPrompt.trim()
                ? `\n\nModifying prompt from the learner:\n${modifyingPrompt.trim().slice(0, 2000)}`
                : ""
            }`,
          ),
        ],
        { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.4 },
      );

      if (!ai.success || !ai.data?.title?.trim() || !ai.data?.summary?.trim()) {
        return jsonError(502, "Failed to synthesize insight");
      }
      title = ai.data.title.trim();
      summary = ai.data.summary.trim();
    }

    const aestheticImage =
      INSIGHT_AESTHETIC_IMAGES[Math.floor(Math.random() * INSIGHT_AESTHETIC_IMAGES.length)];

    const { data: insight, error } = await supabase
      .from("insights")
      .insert(
        buildInsightCreateInsert({
          userId: user.id,
          workspaceId,
          sessionId,
          blockId,
          chapterId,
          title,
          summary,
          thoughtIds,
          sourceThoughts,
          aestheticImage,
        }),
      )
      .select()
      .single();

    if (error || !insight) {
      return jsonError(500, error?.message || "Failed to save insight");
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("[insights/create]", error);
    return jsonError(500, "Internal server error");
  }
}