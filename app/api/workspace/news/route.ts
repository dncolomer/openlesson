import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  callXaiWithSchema,
  userMessage,
  systemMessage,
  DEFAULT_MODEL,
  type JsonSchema,
} from "@/lib/xai-client";
import {
  buildWorkspaceNewsQuery,
  normalizeWorkspaceNewsItems,
  WORKSPACE_NEWS_JSON_SCHEMA,
  type WorkspaceNewsContext,
} from "@/lib/workspace-news";

/**
 * POST /api/workspace/news
 * xAI-backed news items for the empty map right pane (workspace topic/context).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as WorkspaceNewsContext & {
      workspaceId?: string;
    };

    const ctx: WorkspaceNewsContext = {
      workspaceTitle: body.workspaceTitle,
      rootTopic: body.rootTopic,
      workspaceGoal: body.workspaceGoal,
      workspaceDescription: body.workspaceDescription,
      notes: body.notes,
    };

    const query = buildWorkspaceNewsQuery(ctx);
    if (!query.trim()) {
      return jsonError(400, "missing_topic");
    }

    const newsSchema: JsonSchema = {
      name: WORKSPACE_NEWS_JSON_SCHEMA.name,
      schema: {
        type: "object",
        properties: WORKSPACE_NEWS_JSON_SCHEMA.schema.properties as Record<
          string,
          unknown
        >,
        required: [...WORKSPACE_NEWS_JSON_SCHEMA.schema.required],
        additionalProperties: false,
      },
    };

    const response = await callXaiWithSchema<{ items: unknown[] }>(
      [
        systemMessage(
          "You are a research assistant. Return only structured JSON of recent news relevant to the given learning topic. Prefer real public article URLs.",
        ),
        userMessage(query),
      ],
      newsSchema,
      {
        model: DEFAULT_MODEL,
        temperature: 0.3,
        maxTokens: 1200,
        retries: 2,
      },
    );

    if (!response.success || !response.data) {
      return jsonError(502, response.error || "xai_failed", undefined, {
        queryPreview: query.slice(0, 200),
      });
    }

    const items = normalizeWorkspaceNewsItems(response.data);
    return NextResponse.json({
      items,
      queryPreview: query.slice(0, 200),
    });
  } catch (error) {
    console.error("workspace news error:", error);
    return jsonError(500, error instanceof Error ? error.message : "unknown_error");
  }
}
