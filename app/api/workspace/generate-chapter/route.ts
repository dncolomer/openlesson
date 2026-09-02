import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
} from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import {
  composeIleChapterGenerateSystemMessage,
  composeIleChapterGenerateUserPrompt,
  normalizeIleChapterGenerateResult,
} from "@/lib/ile-chapter-generate";
import { resolveIleSessionModeFromBody } from "@/lib/ile-mode";

interface GenerateChapterResponse {
  title?: string;
  description?: string;
  keyword?: string;
}

/**
 * Author one ILE chapter (title + description + 1–2 word map keyword),
 * matching workspace add-block-at-slot generation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      seed,
      prompt,
      title,
      locale,
    } = body as {
      sessionId?: string;
      seed?: string;
      prompt?: string;
      title?: string;
      locale?: string;
    };

    if (!sessionId || typeof sessionId !== "string") {
      return jsonError(400, "sessionId is required");
    }

    const source = String(seed || prompt || title || "").trim();
    if (!source) {
      return jsonError(400, "seed is required");
    }

    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const sessionMode = resolveIleSessionModeFromBody(body);

    const { data: session } = await supabase
      .from("sessions")
      .select("id, problem")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) {
      return jsonError(404, "Session not found");
    }

    const { data: planRow } = await supabase
      .from("session_plans")
      .select("steps, goal")
      .eq("session_id", sessionId)
      .maybeSingle();

    const steps = (planRow?.steps || []) as Array<{ description?: string }>;
    const existingChapters = steps
      .map((s) => String(s.description || "").trim())
      .filter(Boolean);

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale}. Title, description, and keyword must be in that language.`
        : "";

    const ai = await callXaiJSON<GenerateChapterResponse>(
      [
        systemMessage(composeIleChapterGenerateSystemMessage(sessionMode)),
        userMessage(
          [
            composeIleChapterGenerateUserPrompt({
              seed: source,
              sessionGoal: planRow?.goal || session.problem,
              existingChapters,
            }),
            languageNote,
          ]
            .filter(Boolean)
            .join("\n\n"),
        ),
      ],
      { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.5 },
    );

    if (!ai.success || !ai.data) {
      return jsonError(502, ai.error || "Failed to generate chapter");
    }

    const generated = normalizeIleChapterGenerateResult(ai.data, source);
    if (!generated) {
      return jsonError(502, "No chapter generated");
    }

    return NextResponse.json(generated);
  } catch (error) {
    console.error("[generate-chapter]", error);
    return jsonError(500, "Internal server error");
  }
}
