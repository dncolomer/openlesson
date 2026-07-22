import { NextRequest, NextResponse } from "next/server";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { runVerticalScore } from "@/lib/pow-api/run-vertical-score";
import { TAP_AUTO_SCORE_VERTICAL } from "@/lib/pow-api/performance-report";
import type { AuthContext } from "@/lib/pow-api/types";
import { toErrorCode } from "@/lib/pow-api/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Optional TAP-session helper to run LWM Snapshot for a participant.
 * Product snapshot generation is manual (Knowledge UI) or Snapshot API
 * POST .../lwm-snapshot / MCP lwm_snapshot — not invoked automatically on TAP end.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data: workspace } = await access.supabase
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", access.workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const auth: AuthContext = {
      user_id: access.guestUserId ? null : access.userId,
      guest_user_id: access.guestUserId,
      organization_id: access.organizationId,
      is_org_admin: false,
      key_id: "tap-performance",
      scopes: ["workspaces:read"],
    };

    const participantUserId = access.guestUserId ? null : access.userId;
    const participantGuestUserId = access.guestUserId;

    const scored = await runVerticalScore({
      supabase: access.supabase,
      auth,
      workspaceId: access.workspaceId,
      vertical: TAP_AUTO_SCORE_VERTICAL,
      blockId: blockId || access.blockId,
      participantUserId,
      participantGuestUserId,
      workspaceRow: workspace,
      historySource: "tap",
    });

    if (scored.empty) {
      return NextResponse.json(
        { error: "No performance proof of work yet for this participant." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      report: scored.report,
      vertical: TAP_AUTO_SCORE_VERTICAL,
      workspace_goal: scored.workspace_goal,
      workspace_goal_source: scored.workspace_goal_source,
      learning_world_model: scored.learning_world_model ?? null,
      knowledge_config: scored.knowledge_config ?? null,
      eval_run_history_id: scored.eval_run_history_id ?? null,
      eval_history_saved: Boolean(scored.eval_run_history_id),
      eval_run_history_error: scored.eval_run_history_error ?? null,
      report_available: true,
    });
  } catch (error) {
    console.error("[workspace-tap-score/performance] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const code = toErrorCode(
      error && typeof error === "object" && "code" in error
        ? (error as { code: unknown }).code
        : undefined,
    );
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : code === "no_new_pow"
          ? 409
          : 500;
    return NextResponse.json(
      { error: message, code: code !== "internal_error" ? code : undefined },
      { status },
    );
  }
}
