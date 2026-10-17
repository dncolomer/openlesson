import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { guardSessionRoute } from "@/lib/api/require-auth";
import {
  buildCalibratePoolSystemMessage,
  buildCalibratePoolUserPrompt,
  normalizeCalibrateQuestions,
} from "@/lib/calibrate-session";
import { SOUNDING_POOL_COUNT } from "@/lib/calibrate-sounding";
import { isDashboardPlaySession, normalizeDashboardPlayPrompt } from "@/lib/dashboard-play";
import { callXaiJSON, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = String(body.sessionId || "").trim();
    if (!sessionId) return jsonError(400, "sessionId is required");

    const auth = await guardSessionRoute(sessionId, {});
    if (!auth.ok) return auth.response;

    const { data: session, error } = await auth.supabase
      .from("sessions")
      .select("problem, metadata")
      .eq("id", sessionId)
      .single();
    if (error || !session) return jsonError(404, "Session not found");
    if (!isDashboardPlaySession(session.metadata)) {
      return jsonError(400, "Not a play session");
    }

    const prompt =
      normalizeDashboardPlayPrompt(body.prompt) ||
      normalizeDashboardPlayPrompt(session.problem);
    if (!prompt) return jsonError(400, "prompt is required");

    const ai = await callXaiJSON<{ questions?: unknown }>(
      [
        systemMessage(buildCalibratePoolSystemMessage(SOUNDING_POOL_COUNT)),
        userMessage(
          buildCalibratePoolUserPrompt({
            seedTitle: prompt,
            count: SOUNDING_POOL_COUNT,
          }),
        ),
      ],
      { model: DEFAULT_MODEL, maxTokens: 1200, temperature: 0.85 },
    );
    const questions = normalizeCalibrateQuestions(
      ai.success ? (ai.data?.questions ?? ai.data) : null,
    );
    if (questions.length === 0) {
      return jsonError(500, "Could not generate calibration questions");
    }
    return NextResponse.json({ questions });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Could not generate calibration questions",
    );
  }
}
