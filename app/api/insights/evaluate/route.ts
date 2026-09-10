import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  allowIleTypedInsightCreate,
  parseIleTypedInsightVerdict,
} from "@/lib/ile-turn-insights";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

type EvaluateInsightResponse = {
  accepted?: boolean;
  correct?: boolean;
  goodEnough?: boolean;
  title?: string;
  summary?: string;
  reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const chapterLabel =
      typeof body?.chapterLabel === "string" ? body.chapterLabel.trim() : "";
    if (!text) {
      return jsonError(400, "Insight text is required");
    }

    const ai = await callXaiJSON<EvaluateInsightResponse>(
      [
        systemMessage(
          `You evaluate a learner's typed insight from an interactive learning session.
Decide whether it is correct and/or good enough to keep as a durable insight bookmark.

Return JSON only:
{
  "accepted": true | false,
  "correct": true | false,
  "goodEnough": true | false,
  "title": "4-12 words (only when accepted)",
  "summary": "2-4 sentences, rephrased (only when accepted)",
  "reason": "short explanation of the verdict"
}

Rules:
- accepted is true only when the insight is factually sound enough to keep (correct) or a genuine, specific takeaway (goodEnough).
- Refuse slogans, empty tautologies, off-topic text, or claims that are clearly wrong.
- Do not invent curriculum facts the learner did not state; you may lightly rephrase an accepted insight.`,
        ),
        userMessage(
          `Typed insight:\n${text.slice(0, 4000)}${
            chapterLabel ? `\n\nLinked chapter:\n${chapterLabel.slice(0, 200)}` : ""
          }`,
        ),
      ],
      { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.2 },
    );

    if (!ai.success || !ai.data) {
      return jsonError(502, "Failed to evaluate insight");
    }

    const verdict = parseIleTypedInsightVerdict(ai.data);
    const allowed = allowIleTypedInsightCreate(verdict);
    return NextResponse.json({
      ...verdict,
      accepted: allowed,
      allowed,
    });
  } catch (error) {
    console.error("[insights/evaluate]", error);
    return jsonError(500, "Internal server error");
  }
}
