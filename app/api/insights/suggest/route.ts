import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

interface SuggestInsightsResponse {
  suggestions: Array<{
    title: string;
    summary: string;
    thoughtIds: string[];
  }>;
}

const MAX_THOUGHTS = 50;
const MAX_SUGGESTIONS = 4;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { thoughts } = await req.json();
    const sourceThoughts = Array.isArray(thoughts)
      ? thoughts
          .filter((thought: { id?: string; text?: string }) => typeof thought?.id === "string" && thought?.text?.trim())
          .slice(0, MAX_THOUGHTS)
          .map((thought: { id: string; text: string }) => ({
            id: thought.id,
            text: thought.text.trim(),
          }))
      : [];

    if (sourceThoughts.length < 2) {
      return NextResponse.json({ error: "At least two thought traces are required" }, { status: 400 });
    }

    const thoughtBlock = sourceThoughts
      .map((thought, index) => `[${thought.id}] ${index + 1}. ${thought.text}`)
      .join("\n");
    const validIds = new Set(sourceThoughts.map((thought) => thought.id));

    const ai = await callXaiJSON<SuggestInsightsResponse>(
      [
        systemMessage(
          `Analyze learner thought traces and propose up to ${MAX_SUGGESTIONS} insight bookmarks. Each insight should group related traces into one durable takeaway.

Return JSON only:
{
  "suggestions": [
    {
      "title": "4-12 words",
      "summary": "2-3 sentences describing the synthesized insight",
      "thoughtIds": ["id-from-input", "..."]
    }
  ]
}

Rules:
- Use only thoughtIds that appear in the input (the bracketed ids).
- Prefer 1-3 suggestions when patterns are clear; return an empty suggestions array if nothing is worth bookmarking.
- Each suggestion must include at least 2 thoughtIds.
- Traces may appear in at most one suggestion.`,
        ),
        userMessage(`Thought traces:\n${thoughtBlock}\n\nSuggest insight bookmarks that group related traces.`),
      ],
      { model: DEFAULT_MODEL, maxTokens: 900, temperature: 0.35 },
    );

    if (!ai.success || !Array.isArray(ai.data?.suggestions)) {
      return NextResponse.json({ error: "Failed to suggest insights" }, { status: 502 });
    }

    const suggestions = ai.data.suggestions
      .map((entry) => ({
        title: entry.title?.trim() || "",
        summary: entry.summary?.trim() || "",
        thoughtIds: Array.isArray(entry.thoughtIds)
          ? [...new Set(entry.thoughtIds.filter((id) => validIds.has(id)))]
          : [],
      }))
      .filter((entry) => entry.title && entry.summary && entry.thoughtIds.length >= 2)
      .slice(0, MAX_SUGGESTIONS);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[insights/suggest]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}