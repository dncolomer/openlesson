import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  assembleSuggestFromKnowledgeXaiMessages,
  mapEvalRunHistoryRowToSuggestInput,
  normalizeSuggestFromKnowledgeResponse,
  type KnowledgeMapBlockRef,
  type KnowledgeSnapshotSuggestInput,
} from "@/lib/suggest-from-knowledge";
import { listEvalRunHistory } from "@/lib/pow-api/eval-run-history-store";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
  parseJsonLoose,
} from "@/lib/xai-client";

type ModelSuggestResponse = {
  suggestions?: Array<{
    id?: string;
    label?: string;
    prompt?: string;
    rationale?: string;
  }>;
  prompts?: string[];
};

/**
 * POST — Suggest from Knowledge: xAI-backed author prompts grounded in
 * snapshot/eval history + current map block inventory.
 *
 * Snapshots are **context**, not the selectable product. Output is one or more
 * `prompt` strings for expand / bridge / add-block / map-spot guidance fields.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId as string | undefined;
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
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

    // --- Snapshots / reports (context) ---
    let snapshots: KnowledgeSnapshotSuggestInput[] = [];
    try {
      const rows = await listEvalRunHistory(supabase, {
        workspaceId,
        limit: 80,
      });
      snapshots = (rows || []).map((r) =>
        mapEvalRunHistoryRowToSuggestInput({
          id: r.id,
          ran_at: r.ran_at,
          score: r.score,
          workspace_goal: r.workspace_goal,
          block_id: r.block_id,
          vertical: r.vertical,
          source: r.source,
          subject_user_id: r.subject_user_id,
          subject_guest_user_id: r.subject_guest_user_id,
          // Real VerticalScoreReport: gap_analysis.gaps[].title, strengths, growth_areas
          report: r.report,
        }),
      );
    } catch (err) {
      console.warn("suggest-from-knowledge: history load failed", err);
      snapshots = [];
    }

    if (Array.isArray(body.snapshots)) {
      for (const s of body.snapshots) {
        if (s && typeof s === "object") {
          snapshots.push(s as KnowledgeSnapshotSuggestInput);
        }
      }
    }

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

    if (Array.isArray(body.blocks)) {
      for (const b of body.blocks) {
        if (b && typeof b === "object") {
          blocks.push(b as KnowledgeMapBlockRef);
        }
      }
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

    const userModel =
      typeof body.model === "string" && body.model.trim()
        ? body.model.replace(/^x-ai\//, "").trim()
        : DEFAULT_MODEL;

    const ai = await callXaiJSON<ModelSuggestResponse>(
      [
        systemMessage(assembled.systemPrompt),
        userMessage(assembled.userPrompt),
      ],
      {
        model: userModel,
        maxTokens: 1400,
        temperature: 0.55,
        retries: 2,
      },
    );

    let modelPayload: ModelSuggestResponse | null =
      ai.success && ai.data ? ai.data : null;
    if (!modelPayload && ai.rawContent) {
      const recovered = parseJsonLoose<ModelSuggestResponse>(ai.rawContent);
      if (recovered.ok) modelPayload = recovered.data;
    }

    if (!modelPayload) {
      return jsonError(502, ai.error ||
            "Failed to generate knowledge suggestions (xAI unavailable or empty response)",);
    }

    const suggestions = normalizeSuggestFromKnowledgeResponse(modelPayload, {
      sourceSnapshotIds: assembled.sourceSnapshotIds,
      limit,
    });

    if (suggestions.length === 0) {
      return jsonError(502, "Model returned no usable author prompts",
          suggestions: [],
          snapshotCount: assembled.snapshotCount,
          blockCount: assembled.blockCount,);
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
