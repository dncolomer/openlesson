/**
 * POST: xAI suggests internet external sources for Add / geometry-create local context.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ayclTokenFromBody,
  guardWorkspaceRoute,
} from "@/lib/api/require-auth";
import {
  callXaiJSON,
  DEFAULT_MODEL,
  systemMessage,
  userMessage,
} from "@/lib/xai-client";
import {
  buildSuggestExternalContextMessages,
  normalizeExternalContextSuggestions,
} from "@/lib/suggest-external-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId.trim()
        : typeof body.workspace_id === "string"
          ? body.workspace_id.trim()
          : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const topicRaw =
      typeof body.topic === "string"
        ? body.topic
        : typeof body.prompt === "string"
          ? body.prompt
          : "";
    const topic = topicRaw.replace(/\s+/g, " ").trim();
    if (!topic) {
      return NextResponse.json(
        { error: "topic or prompt is required" },
        { status: 400 },
      );
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    let workspaceTitle: string | null = null;
    try {
      const { data: plan } = await auth.supabase
        .from("workspaces")
        .select("title, root_topic")
        .eq("id", workspaceId)
        .maybeSingle();
      workspaceTitle =
        (plan as { title?: string; root_topic?: string } | null)?.title ||
        (plan as { root_topic?: string } | null)?.root_topic ||
        null;
    } catch {
      /* optional */
    }

    const messages = buildSuggestExternalContextMessages({
      topic: topic.slice(0, 2_000),
      workspaceTitle,
    });

    const response = await callXaiJSON<{
      suggestions?: unknown;
      sources?: unknown;
      resources?: unknown;
    }>([systemMessage(messages.system), userMessage(messages.user)], {
      model: DEFAULT_MODEL,
      maxTokens: 1_600,
      temperature: 0.35,
    });

    if (!response.success) {
      console.error("[suggest-external-context] xAI error", response.error);
      return NextResponse.json(
        {
          error: response.error || "Failed to suggest external sources",
          suggestions: [],
        },
        { status: 502 },
      );
    }

    const suggestions = normalizeExternalContextSuggestions(response.data);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[suggest-external-context]", err);
    return NextResponse.json(
      { error: "Internal error", suggestions: [] },
      { status: 500 },
    );
  }
}
