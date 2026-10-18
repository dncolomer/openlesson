/**
 * Generate a question pool for a first-class flow from its topic or goal.
 * Dashboard wizard has no workspace yet; owner auth is enough.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { generateCalibrationPoolFromGoal } from "@/lib/calibration-flow";
import { parseProductFlowKind } from "@/lib/product-flow";
import { generateVerificationPoolFromTopic } from "@/lib/verification-flow";
import { callXaiJSON, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";

export const runtime = "nodejs";

async function completeWithXai(request: {
  instructions: string;
  user: string;
}): Promise<unknown> {
  const response = await callXaiJSON<unknown>(
    [systemMessage(request.instructions), userMessage(request.user)],
    { model: DEFAULT_MODEL, temperature: 0.3, maxTokens: 2000, reasoningEffort: "low" },
  );
  if (!response.success) throw new Error(response.error || "Question generation failed");
  return response.data;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const kind = parseProductFlowKind(body.kind);
    if (!kind) return jsonError(400, "kind must be verification or calibration");
    const topic = String(body.topic || "").trim();
    const goal = String(body.goal || "").trim();
    if (kind === "calibration" && !goal) return jsonError(400, "goal is required");
    if (kind === "verification" && !topic) return jsonError(400, "topic is required");
    const questions =
      kind === "calibration"
        ? await generateCalibrationPoolFromGoal({
            goal,
            complete: completeWithXai,
          })
        : await generateVerificationPoolFromTopic({
            topic,
            complete: completeWithXai,
          });
    if (questions.length === 0) return jsonError(502, "No questions generated");
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question generation failed";
    return jsonError(500, message);
  }
}
