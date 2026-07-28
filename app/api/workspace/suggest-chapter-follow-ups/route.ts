import { NextRequest, NextResponse } from "next/server";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
} from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import {
  buildChapterFollowUpContext,
  normalizeChapterFollowUpSuggestions,
} from "@/lib/ile-chapter-follow-ups";

interface SuggestChapterFollowUpsResponse {
  suggestions?: Array<{ title?: string; description?: string } | string>;
}

/**
 * After Project Mode Mark as Done: propose 3 adjacent-topic follow-up exercises
 * based on the completed chapter + solution/stash proof of work.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      stepId,
      chapterDescription,
      solutionTexts,
      stashTexts,
      locale,
    } = body as {
      sessionId?: string;
      stepId?: string;
      chapterDescription?: string;
      solutionTexts?: unknown;
      stashTexts?: unknown;
      locale?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const { data: session } = await supabase
      .from("sessions")
      .select("id, problem")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: planRow } = await supabase
      .from("session_plans")
      .select("steps, goal")
      .eq("session_id", sessionId)
      .maybeSingle();

    const steps = (planRow?.steps || []) as Array<{ id?: string; description?: string }>;
    const existingChapterDescriptions = steps
      .filter((s) => !stepId || s.id !== stepId)
      .map((s) => String(s.description || "").trim())
      .filter(Boolean);

    const solutions = Array.isArray(solutionTexts)
      ? solutionTexts.map((t) => String(t || "")).filter(Boolean)
      : [];
    const stashes = Array.isArray(stashTexts)
      ? stashTexts.map((t) => String(t || "")).filter(Boolean)
      : [];

    const ctx = buildChapterFollowUpContext({
      chapterDescription:
        String(chapterDescription || "").trim() ||
        steps.find((s) => s.id === stepId)?.description ||
        session.problem ||
        "Completed chapter",
      solutionTexts: solutions,
      stashTexts: stashes,
      existingChapterDescriptions,
    });

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale}. Titles and descriptions must be in that language.`
        : "";

    const ai = await callXaiJSON<SuggestChapterFollowUpsResponse>(
      [
        systemMessage(
          `You propose the next learning exercises after a learner marks a chapter Done in Project Mode (solo exercise, stash + solution thoughts).
Return ONLY JSON: { "suggestions": [ { "title": "...", "description": "..." }, ... ] } with exactly 3 items.
Rules:
- Each suggestion is a longer-horizon exercise suitable as a NEW chapter next to the completed one (adjacent topic, not a duplicate).
- Prefer natural extensions, deeper practice, or related skills that build on solution/stash traces.
- Avoid repeating existing chapters.
- Titles: 5–12 words, concrete. Descriptions: 1 short sentence (actionable exercise framing).
- No product jargon (Helios, PoW, TAP). No markdown.`,
        ),
        userMessage(`Session goal / block: ${planRow?.goal || session.problem || "practice"}

Completed chapter:
${ctx.chapter}

Solution stack thoughts (what they submitted as the solution):
${ctx.solutionSummary}

Stash thoughts (raw reasoning, not part of the final solution):
${ctx.stashSummary}

Existing chapters (do not duplicate):
${ctx.existingChapters}

${languageNote}`),
      ],
      { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.65 },
    );

    if (!ai.success || !ai.data) {
      return NextResponse.json(
        { error: ai.error || "Failed to generate follow-up topics" },
        { status: 502 },
      );
    }

    const suggestions = normalizeChapterFollowUpSuggestions(ai.data, 3);
    if (suggestions.length === 0) {
      return NextResponse.json({ error: "No follow-up topics generated" }, { status: 502 });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[suggest-chapter-follow-ups]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
