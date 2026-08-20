/**
 * POST — Suggest a leads-to DAG among selected map blocks (xAI).
 * Returns a draft the client paints on the DAG canvas; Apply is still required.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
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
import { MULTI_BLOCK_DAG_MAX_BLOCKS } from "@/lib/multi-block-dag";
import {
  assembleSuggestDagXaiMessages,
  normalizeSuggestDagBlockIds,
  normalizeSuggestDagResponse,
  type SuggestDagBlock,
} from "@/lib/suggest-dag";

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
      return jsonError(400, "workspaceId is required");
    }

    const blockIds = normalizeSuggestDagBlockIds(body.blockIds ?? body.block_ids);
    if (blockIds.length < 2) {
      return jsonError(400, "Select at least two blocks");
    }
    if (blockIds.length > MULTI_BLOCK_DAG_MAX_BLOCKS) {
      return jsonError(
        400,
        `Select at most ${MULTI_BLOCK_DAG_MAX_BLOCKS} blocks`,
      );
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("title, root_topic, workspace_goal")
      .eq("id", workspaceId)
      .maybeSingle();

    const { data: blockRows, error: blockErr } = await supabase
      .from("blocks")
      .select(
        "id, title, description, position_x, position_y, is_start, next_block_ids",
      )
      .eq("workspace_id", workspaceId)
      .in("id", blockIds);
    if (blockErr) {
      console.error("[suggest-dag] blocks load", blockErr);
      return jsonError(500, "Failed to load blocks");
    }

    const byId = new Map(
      (blockRows || []).map((row) => [String(row.id), row as SuggestDagBlock & {
        next_block_ids?: string[] | null;
      }]),
    );
    const blocks: SuggestDagBlock[] = [];
    const currentEdges: Array<{ from: string; to: string }> = [];
    const idSet = new Set(blockIds);
    for (const id of blockIds) {
      const row = byId.get(id);
      if (!row) continue;
      blocks.push({
        id,
        title: row.title,
        description: row.description,
        position_x: row.position_x,
        position_y: row.position_y,
        is_start: row.is_start,
      });
      for (const to of row.next_block_ids || []) {
        const t = String(to || "").trim();
        if (!t || t === id || !idSet.has(t)) continue;
        currentEdges.push({ from: id, to: t });
      }
    }
    if (blocks.length < 2) {
      return jsonError(400, "Need at least two selected blocks on this workspace");
    }

    const messages = assembleSuggestDagXaiMessages({
      workspaceTitle:
        (workspace as { title?: string | null; root_topic?: string | null } | null)
          ?.title ||
        (workspace as { root_topic?: string | null } | null)?.root_topic ||
        null,
      workspaceGoal:
        (workspace as { workspace_goal?: string | null } | null)?.workspace_goal ||
        null,
      blocks,
      currentEdges,
    });

    const response = await callXaiJSON<{ edges?: unknown }>(
      [systemMessage(messages.system), userMessage(messages.user)],
      { model: DEFAULT_MODEL, maxTokens: 1_200, temperature: 0.3 },
    );
    if (!response.success) {
      console.error("[suggest-dag] xAI error", response.error);
      return jsonError(502, response.error || "Failed to suggest DAG");
    }

    const draft = normalizeSuggestDagResponse(response.data, blockIds, blocks);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[suggest-dag]", err);
    return jsonError(500, "Internal error");
  }
}
