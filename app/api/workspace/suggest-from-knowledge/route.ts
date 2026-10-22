import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  assembleSuggestFromKnowledgeXaiMessages,
  normalizeSuggestFromKnowledgeResponse,
  type KnowledgeMapBlockRef,
  type KnowledgeSnapshotSuggestInput,
} from "@/lib/suggest-from-knowledge";
import { runSuggestFromKnowledgeModel } from "@/lib/run-suggest-from-knowledge-model";

/**
 * POST — Suggest from Knowledge: xAI-backed author prompts grounded in
 * current map block inventory.
 *
 * Output is one or more `prompt` strings for expand / bridge / add-block /
 * map-spot guidance fields.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId as string | undefined;
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      feature: "map",
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(Math.trunc(body.limit), 8))
        : 4;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, workspace_goal, description, notes")
      .eq("id", workspaceId)
      .maybeSingle();

    const snapshots: KnowledgeSnapshotSuggestInput[] = [];

    // --- Map / block inventory (context) ---
    let blocks: KnowledgeMapBlockRef[] = [];
    try {
      const { data: blockRows } = await supabase
        .from("blocks")
        .select(
          "id, title, description, position_x, position_y, span_w, span_h, is_start, next_block_ids, lock_until_block_ids",
        )
        .eq("workspace_id", workspaceId)
        .limit(60);
      blocks = (blockRows || []).map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        position_x: b.position_x as number | null,
        position_y: b.position_y as number | null,
        span_w: b.span_w as number | null,
        span_h: b.span_h as number | null,
        is_start: b.is_start as boolean | null,
        next_block_ids: (b.next_block_ids as string[] | null) ?? null,
        lock_until_block_ids:
          (b.lock_until_block_ids as string[] | null) ?? null,
      }));
    } catch (err) {
      console.warn("suggest-from-knowledge: blocks load failed", err);
      blocks = [];
    }

    const assembled = assembleSuggestFromKnowledgeXaiMessages(snapshots, {
      surface: body.surface,
      draftPrompt: body.draftPrompt ?? body.topic ?? body.prompt,
      workspaceTitle:
        workspace?.title || workspace?.root_topic || body.workspaceTitle,
      workspaceGoal:
        (workspace as { workspace_goal?: string | null } | null)
          ?.workspace_goal ||
        workspace?.description ||
        body.workspaceGoal,
      workspaceNotes:
        (workspace as { notes?: string | null } | null)?.notes ||
        body.workspaceNotes,
      blocks,
      limit,
    });

    const modelResult = await runSuggestFromKnowledgeModel(assembled, {
      model: typeof body.model === "string" ? body.model : undefined,
    });
    if (!modelResult.ok) {
      return jsonError(
        502,
        modelResult.error ||
          "Failed to generate knowledge suggestions (xAI unavailable or empty response)",
      );
    }

    const suggestions = normalizeSuggestFromKnowledgeResponse(modelResult.data, {
      sourceSnapshotIds: assembled.sourceSnapshotIds,
      limit,
    });

    if (suggestions.length === 0) {
      return jsonError(502, "Model returned no usable author prompts", undefined, {
        snapshotCount: assembled.snapshotCount,
        blockCount: assembled.blockCount,
      });
    }

    return NextResponse.json({
      ok: true,
      suggestions,
      snapshotCount: assembled.snapshotCount,
      blockCount: assembled.blockCount,
    });
  } catch (err) {
    console.error("suggest-from-knowledge", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}
