import { NextRequest, NextResponse } from "next/server";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { finalizeVerticalScoreReport } from "@/lib/pow-api/workspace-goal";
import { buildWorkspacePerformanceContext } from "@/lib/pow-api/performance-context";
import { generateWorkspaceVerticalScoreReport } from "@/lib/pow-api/generate-performance-report";
import { TAP_AUTO_SCORE_VERTICAL } from "@/lib/pow-api/performance-report";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * TAP post-session auto-results always use the verification score only —
 * TAP is a verification tool.
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
      .select("id, user_id, title, root_topic, description, notes, workspace_goal")
      .eq("id", access.workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const context = await buildWorkspacePerformanceContext({
      supabase: access.supabase,
      auth: {
        user_id: access.guestUserId ? null : access.userId,
        guest_user_id: access.guestUserId,
        organization_id: access.organizationId,
        is_org_admin: false,
        key_id: "tap-performance",
        scopes: ["workspaces:read"],
      },
      workspaceId: access.workspaceId,
      blockId: blockId || access.blockId,
      participantUserId: access.guestUserId ? null : access.userId,
      participantGuestUserId: access.guestUserId,
    });

    if (
      context.payload.counts.proof_of_work_artifacts === 0 &&
      context.payload.counts.linked_sessions === 0 &&
      context.payload.counts.workspace_files === 0
    ) {
      return NextResponse.json(
        { error: "No performance proof of work yet for this participant." },
        { status: 400 }
      );
    }

    const generation = await generateWorkspaceVerticalScoreReport({
      workspaceId: access.workspaceId,
      workspaceTitle: workspace.title,
      workspaceRootTopic: workspace.root_topic,
      storedWorkspaceGoal: workspace.workspace_goal,
      fileIds: context.fileIds,
      vertical: TAP_AUTO_SCORE_VERTICAL,
    });

    if (!generation.success || !generation.data) {
      return NextResponse.json(
        {
          error: generation.error || "Failed to generate report",
          code: generation.code || "performance_report_generation_failed",
        },
        { status: 502 }
      );
    }

    const finalized = finalizeVerticalScoreReport(
      generation.data,
      workspace.workspace_goal,
      {
        title: workspace.title,
        description: workspace.description,
        notes: workspace.notes,
      },
      TAP_AUTO_SCORE_VERTICAL
    );

    return NextResponse.json({
      report: finalized.report,
      vertical: TAP_AUTO_SCORE_VERTICAL,
      workspace_goal: finalized.workspace_goal,
      workspace_goal_source: finalized.workspace_goal_source,
    });
  } catch (error) {
    console.error("[workspace-tap-score/performance] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
