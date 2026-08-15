import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
} from "@/lib/xai-client";
import {
  buildRabbitHoleQuestionsSystemMessage,
  buildRabbitHoleQuestionsUserPrompt,
  normalizeRabbitHoleQuestions,
  questionsNeededForRound,
} from "@/lib/rabbit-hole-expand";

interface RabbitHoleExpandQuestionsResponse {
  questions?: unknown;
}

/**
 * Generate rabbit-hole style questions for Expand-block exploration.
 * Body: workspaceId, seedTitle, seedDescription?, path?: string[], depth?: number, count?: number
 * Returns { questions: string[] } of length 3 (depth 0) or 2 (follow-up).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      seedTitle,
      seedDescription,
      path,
      depth: depthRaw,
      count: countRaw,
      model: userModel,
      locale,
    } = body as {
      workspaceId?: string;
      seedTitle?: string;
      seedDescription?: string;
      path?: unknown;
      depth?: unknown;
      count?: unknown;
      model?: string;
      locale?: string;
    };

    if (!workspaceId || typeof workspaceId !== "string") {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;

    const depth =
      typeof depthRaw === "number" && Number.isFinite(depthRaw)
        ? Math.max(0, Math.floor(depthRaw))
        : 0;
    const countFromBody =
      typeof countRaw === "number" && Number.isFinite(countRaw)
        ? Math.max(1, Math.floor(countRaw))
        : null;
    const count = countFromBody ?? questionsNeededForRound(depth);

    const pathList = Array.isArray(path)
      ? path.map((p) => String(p ?? "").trim()).filter(Boolean)
      : [];

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale}. Question text must be in that language.`
        : "";

    const ai = await callXaiJSON<RabbitHoleExpandQuestionsResponse>(
      [
        systemMessage(
          buildRabbitHoleQuestionsSystemMessage(count) +
            (languageNote ? `\n${languageNote}` : ""),
        ),
        userMessage(
          buildRabbitHoleQuestionsUserPrompt({
            seedTitle: seedTitle || "Untitled block",
            seedDescription: seedDescription || "",
            path: pathList,
            count,
          }),
        ),
      ],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 800,
        temperature: 0.85,
      },
    );

    const questions = normalizeRabbitHoleQuestions(
      ai.success ? (ai.data?.questions ?? ai.data) : null,
      count,
    );

    return NextResponse.json({ questions, count, depth });
  } catch (err) {
    console.error("[rabbit-hole-expand]", err);
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to generate rabbit-hole questions",
    );
  }
}
