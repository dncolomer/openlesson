import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { runVerticalScore } from "@/lib/pow-api/run-vertical-score";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { toErrorCode } from "@/lib/pow-api/types";
import { LWM_SNAPSHOT_LABEL, SNAPSHOT_VERTICAL } from "@/lib/pow-api/performance-report";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * Primary LWM Snapshot score endpoint (sole product snapshot strategy).
 * GHC is secondary on the same report.
 */
export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select(
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs"
    )
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const stylePrompt =
    typeof body.style_prompt === "string" ? body.style_prompt.trim() : "";
  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
  const { resolveScoreParticipantIds } = await import("@/lib/pow-api/evaluation-subject");
  const { participantUserId, participantGuestUserId } = resolveScoreParticipantIds({
    auth,
    isWorkspaceOwner,
    requestedUserId: typeof body.user_id === "string" ? body.user_id : null,
    requestedGuestUserId: typeof body.guest_user_id === "string" ? body.guest_user_id : null,
  });

  if (blockId) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
  }

  try {
    const scored = await runVerticalScore({
      supabase,
      auth,
      workspaceId,
      vertical: SNAPSHOT_VERTICAL,
      blockId,
      stylePrompt,
      participantUserId,
      participantGuestUserId,
      workspaceRow: workspace,
      goalSelectionBody: body,
    });

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        {
          mode: "score",
          strategy: "lwm_snapshot",
          vertical: SNAPSHOT_VERTICAL,
          label: LWM_SNAPSHOT_LABEL,
          evaluation_mode: scored.evaluation_mode,
          privacy: scored.privacy,
          workspace_goal: scored.workspace_goal,
          workspace_goal_source: scored.workspace_goal_source,
          evaluated_goals: scored.evaluated_goals,
          goals_fingerprint: scored.goals_fingerprint,
          report: scored.report,
          protocol_report: scored.protocol_report,
          proof_of_work_summary: scored.proof_of_work_summary,
          file_ids: scored.file_ids,
          learning_world_model: scored.learning_world_model ?? undefined,
          knowledge_config: scored.knowledge_config ?? undefined,
        },
        {
          endpoint: "lwm_snapshot",
          workspace_id: workspaceId,
          block_id: blockId,
          mode: "score",
          report: scored.report,
          proof_of_work_artifacts: scored.proof_of_work_summary?.proof_of_work_artifacts,
          workspace_title: workspace.title || workspace.root_topic || null,
          workspace_goal: scored.workspace_goal,
          learning_world_model: scored.learning_world_model,
          artifact_summary:
            scored.report.summary || `${LWM_SNAPSHOT_LABEL} ${scored.report.score}`,
        }
      )
    );
  } catch (error) {
    console.error("[agent/lwm-snapshot] failed:", error);
    const message =
      error instanceof Error ? error.message : `Failed to generate ${LWM_SNAPSHOT_LABEL}`;
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
    return errorResponse(status, code, message);
  }
}
