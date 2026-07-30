import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { parsePositiveInt } from "@/lib/admin/data-studio";

export const runtime = "nodejs";

/**
 * GET /api/admin/data-studio/snapshots
 *
 * Browse current/latest knowledge-config snapshot models and eval-run history.
 * Query:
 *   kind=knowledge|eval|both (default both)
 *   workspaceId=
 *   page, pageSize
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const kind = (params.get("kind") || "both").toLowerCase();
    const page = parsePositiveInt(params.get("page"), 1, 10_000);
    const pageSize = parsePositiveInt(params.get("pageSize"), 25, 100);
    const workspaceId = (params.get("workspaceId") || "").trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const result: {
      knowledgeConfigs: unknown[];
      evalRuns: unknown[];
      knowledgeTotal: number;
      evalTotal: number;
      page: number;
      pageSize: number;
    } = {
      knowledgeConfigs: [],
      evalRuns: [],
      knowledgeTotal: 0,
      evalTotal: 0,
      page,
      pageSize,
    };

    if (kind === "knowledge" || kind === "both") {
      let q = adminClient
        .from("knowledge_config_snapshots")
        .select(
          "id, workspace_id, subject_user_id, subject_guest_user_id, embedding_model_id, dim, as_of_ms, pow_event_count, confidence, trigger, lwm_id, created_at",
          { count: "exact" },
        )
        .order("as_of_ms", { ascending: false });
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data, count, error } = await q.range(from, to);
      if (error) {
        console.error("[admin/data-studio/snapshots] knowledge:", error);
        return NextResponse.json({ error: "Failed to load knowledge configs" }, { status: 500 });
      }
      result.knowledgeConfigs = data || [];
      result.knowledgeTotal = count || 0;
    }

    if (kind === "eval" || kind === "both") {
      let q = adminClient
        .from("eval_run_history")
        .select(
          "id, workspace_id, subject_user_id, subject_guest_user_id, vertical, score, ghc_score, ghc_confidence, workspace_goal, block_id, source, ran_at, created_at",
          { count: "exact" },
        )
        .order("ran_at", { ascending: false });
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data, count, error } = await q.range(from, to);
      if (error) {
        console.error("[admin/data-studio/snapshots] eval:", error);
        return NextResponse.json({ error: "Failed to load eval history" }, { status: 500 });
      }
      result.evalRuns = data || [];
      result.evalTotal = count || 0;
    }

    // Workspace titles for display
    const wsIds = [
      ...new Set(
        [
          ...(result.knowledgeConfigs as Array<{ workspace_id?: string }>).map((r) => r.workspace_id),
          ...(result.evalRuns as Array<{ workspace_id?: string }>).map((r) => r.workspace_id),
        ].filter(Boolean) as string[],
      ),
    ];
    const workspaceTitles: Record<string, string> = {};
    if (wsIds.length > 0) {
      const { data: workspaces } = await adminClient
        .from("workspaces")
        .select("id, title, root_topic")
        .in("id", wsIds);
      for (const ws of workspaces || []) {
        workspaceTitles[ws.id] = (ws.title || ws.root_topic || ws.id) as string;
      }
    }

    return NextResponse.json({
      ...result,
      workspaceTitles,
      knowledgeTotalPages: Math.max(1, Math.ceil(result.knowledgeTotal / pageSize)),
      evalTotalPages: Math.max(1, Math.ceil(result.evalTotal / pageSize)),
    });
  } catch (error) {
    console.error("[admin/data-studio/snapshots]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
