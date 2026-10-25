/**
 * Public Verification canvas command chat. Calls xAI and returns a canvas turn.
 * Does not require a tutoring TAP session. Proof of work is stored at End session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { callXai, systemMessage, userMessage } from "@/lib/xai-client";
import { ileSessionChatCanvasReply } from "@/lib/learn-work-canvas";
import { withConversationLanguageInstruction } from "@/lib/tutoring-languages";
import {
  buildVerificationFlowChatSystemPrompt,
  buildVerificationFlowChatUserMessage,
} from "@/lib/verification-flow-chat";
import { getVerificationFlowByToken } from "@/lib/verification-flow-repository";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const flow = await getVerificationFlowByToken(token);
    if (!flow) return jsonError(404, "Verification flow not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const thought = String(body.thought || "").trim();
    if (!thought) return jsonError(400, "thought is required");

    const conversationLanguage =
      body.conversationLanguage != null
        ? String(body.conversationLanguage)
        : body.tutoringLanguage != null
          ? String(body.tutoringLanguage)
          : "";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const workCanvasScene = (body.workCanvasScene ?? null) as IleWorkCanvasScene | null;

    const systemPrompt = withConversationLanguageInstruction(
      buildVerificationFlowChatSystemPrompt(flow.topic),
      conversationLanguage,
    );
    const response = await callXai(
      [
        systemMessage(systemPrompt),
        userMessage(
          buildVerificationFlowChatUserMessage({
            thought,
            messages: messages as Array<{ role?: string; content?: string }>,
            workCanvasScene,
            workspaceTitle: flow.topic,
          }),
        ),
      ],
      {
        maxTokens: 800,
        temperature: 0.55,
        fetchTimeout: 60000,
      },
    );

    if (!response.success || !response.data) {
      return jsonError(500, response.error || "Failed to generate Verify response");
    }

    const canvasReply = ileSessionChatCanvasReply(String(response.data));
    return NextResponse.json({
      message: canvasReply.message || String(response.data).trim(),
      canvasElements: canvasReply.canvasElements,
      raw: canvasReply.raw,
    });
  } catch (error) {
    console.error("[verification-flow/public/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(500, message);
  }
}
