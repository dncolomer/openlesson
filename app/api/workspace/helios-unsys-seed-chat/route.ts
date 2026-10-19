import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  callXaiJSON,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
import { buildHeliosUnsysSeedSystemPrompt } from "@/lib/prompt-kernel";
import {
  formatAuthorUnsysSeedForPrompt,
  formatAuthorUnsysSelectionForPrompt,
  parseAuthorUnsysHeliosChatTurn,
} from "@/lib/author-unsys-helios";
import { normalizeAuthorUnsysModel } from "@/lib/author-unsys-model";

type HeliosUnsysSeedChatBody = {
  reply: string;
  toolCalls?: unknown;
  tool_calls?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "").trim();
    const userPrompt = String(body.userPrompt || body.prompt || "").trim();
    if (!workspaceId || !userPrompt) {
      return jsonError(400, "workspaceId and userPrompt are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      feature: "map",
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;

    const model = normalizeAuthorUnsysModel(body.seedModel ?? body.seed);
    const blockTitle = String(body.blockTitle || model?.chapterTitle || "").trim();
    const focusId = String(
      body.focusId || model?.focusId || model?.rootId || "",
    ).trim();
    const history = Array.isArray(body.messages)
      ? (body.messages as Array<{ role?: string; content?: string }>)
          .map(
            (m) =>
              `${m.role === "assistant" ? "Helios" : "Author"}: ${String(m.content || "")}`,
          )
          .join("\n")
      : "";

    const user = [
      `Workspace: ${workspaceId}`,
      `Block: ${blockTitle || String(body.blockId || "").trim() || "selected block"}`,
      formatAuthorUnsysSelectionForPrompt({ model, focusId }),
      formatAuthorUnsysSeedForPrompt({
        blockTitle,
        model,
        focusId,
      }),
      history ? `CONVERSATION:\n${history}` : "",
      `Author: ${userPrompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const ai = await callXaiJSON<HeliosUnsysSeedChatBody>(
      [systemMessage(buildHeliosUnsysSeedSystemPrompt()), userMessage(user)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 4000,
        temperature: 0.3,
      },
    );
    if (!ai.success || !ai.data) {
      return jsonError(502, ai.error || "Helios could not reply");
    }
    const parsed = parseAuthorUnsysHeliosChatTurn(ai.data);
    return NextResponse.json({
      reply: parsed.reply || "Ready.",
      toolCalls: parsed.toolCalls,
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Helios could not reply",
    );
  }
}
