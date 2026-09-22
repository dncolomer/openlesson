import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
} from "@/lib/xai-client";
import {
  SCOUT_FOLLOWUP_QUESTION_COUNT,
  buildScoutQuestionsSystemMessage,
  buildScoutQuestionsUserPrompt,
  normalizeScoutQuestions,
} from "@/lib/scout-session";

export const runtime = "nodejs";
export const maxDuration = 45;

interface ScoutQuestionsResponse {
  questions?: unknown;
}

/**
 * On-demand Scout follow-up questions from current canvas/path context.
 * Returns exactly 3 short inquisitive questions (never answers).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";
    const locale =
      body.conversationLanguage != null
        ? String(body.conversationLanguage)
        : body.locale != null
          ? String(body.locale)
          : "";

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
      focusSessionId,
      entryQueryParams: entryQueryParamsFromBody(body as Record<string, unknown>),
    });
    if ("error" in access) {
      return jsonError(access.status, access.error);
    }

    const countRaw = Number(body.count);
    const count =
      Number.isFinite(countRaw) && countRaw > 0
        ? Math.min(8, Math.floor(countRaw))
        : SCOUT_FOLLOWUP_QUESTION_COUNT;

    const path = Array.isArray(body.path)
      ? body.path.map((p: unknown) => String(p ?? "").trim()).filter(Boolean)
      : [];

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale}. Question text must be in that language.`
        : "";

    const ai = await callXaiJSON<ScoutQuestionsResponse>(
      [
        systemMessage(
          buildScoutQuestionsSystemMessage(count) +
            (languageNote ? `\n${languageNote}` : ""),
        ),
        userMessage(
          buildScoutQuestionsUserPrompt({
            seedTitle: body.seedTitle ?? body.seedText ?? "",
            seedDescription: body.seedDescription ?? "",
            path,
            canvasText: body.canvasText ?? "",
            currentNode: body.currentNode ?? "",
            count,
          }),
        ),
      ],
      {
        model: DEFAULT_MODEL,
        maxTokens: 800,
        temperature: 0.85,
      },
    );

    const questions = normalizeScoutQuestions(
      ai.success ? (ai.data?.questions ?? ai.data) : null,
      count,
    );

    return NextResponse.json({ questions, count });
  } catch (err) {
    console.error("[scout-questions]", err);
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to generate Scout questions",
    );
  }
}
