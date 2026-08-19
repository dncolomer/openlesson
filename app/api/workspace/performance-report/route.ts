import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody } from "@/lib/api/require-auth";
import {
  LWM_SNAPSHOT_LABEL,
  SNAPSHOT_VERTICAL,
} from "@/lib/pow-api/performance-report";
import { runVerticalScore } from "@/lib/pow-api/run-vertical-score";
import { resolveScoreParticipantIds } from "@/lib/pow-api/evaluation-subject";
import type { AuthContext } from "@/lib/pow-api/types";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { NO_NEW_POW_CODE } from "@/lib/pow-api/eval-pow-gate";
import { toErrorCode } from "@/lib/pow-api/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Generate a new LWM Snapshot for a subject (single strategy — former verification path).
 * Used by the LWM box "Generate new snapshot" control and any web callers.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await requireProductWorkspaceEvalAuth(
      workspaceId,
      ayclTokenFromBody(body),
    );
    if (!auth.ok) return auth.response;

    const { supabase, isOwner: accessIsOwner, subjectId } = auth;

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, description, notes, workspace_goal, is_group, organization_id, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", workspaceId)
      .single();

    if (planError) {
      console.error("[performance-report] workspace load failed:", planError.message, planError.code);
      if (
        /workspace_goal|column/i.test(planError.message || "") ||
        planError.code === "42703" ||
        planError.code === "PGRST204"
      ) {
        return jsonError(500, "Database schema is missing workspaces.workspace_goal. Apply migration 20260719120000_workspace_goal_rename.", "schema_outdated",);
      }
      return jsonError(404, "Workspace not found");
    }

    if (!plan) {
      return jsonError(404, "Workspace not found");
    }

    const isWorkspaceOwner = accessIsOwner;

    // Scoring identity is the policy subject (aycl:{purchaseId} for AYCL), never the
    // owner UUID. This is AuthContext attribution, not an auth.users FK write.
    const authCtx: AuthContext = {
      user_id: subjectId,
      guest_user_id: null,
      organization_id: plan.organization_id ?? null,
      is_org_admin: false,
      key_id: "web",
      scopes: ["workspaces:read"],
    };

    const participants = resolveScoreParticipantIds({
      auth: authCtx,
      isWorkspaceOwner,
      requestedUserId: typeof body.user_id === "string" ? body.user_id : null,
      requestedGuestUserId: typeof body.guest_user_id === "string" ? body.guest_user_id : null,
    });

    try {
      const scored = await runVerticalScore({
        supabase,
        auth: authCtx,
        workspaceId,
        vertical: SNAPSHOT_VERTICAL,
        participantUserId: participants.participantUserId,
        participantGuestUserId: participants.participantGuestUserId,
        workspaceRow: plan,
        historySource: "web",
        goalSelectionBody: body as Record<string, unknown>,
      });

      if (scored.empty) {
        return jsonError(400, "No performance proof of work yet. Complete sessions, upload proof of work, or run a TAP block first.",);
      }

      return NextResponse.json({
        report: scored.report,
        vertical: SNAPSHOT_VERTICAL,
        strategy: "lwm_snapshot",
        label: LWM_SNAPSHOT_LABEL,
        workspace_goal: scored.workspace_goal,
        workspace_goal_source: scored.workspace_goal_source,
        evaluated_goals: scored.evaluated_goals,
        goals_fingerprint: scored.goals_fingerprint,
        learning_world_model: scored.learning_world_model ?? null,
        knowledge_config: scored.knowledge_config ?? null,
        subject: participants.subject,
        eval_run_history_id: scored.eval_run_history_id ?? null,
        eval_history_saved: Boolean(scored.eval_run_history_id),
        eval_run_history_error: scored.eval_run_history_error ?? null,
        report_available: true,
      });
    } catch (scoreErr) {
      const code = toErrorCode(
        scoreErr && typeof scoreErr === "object" && "code" in scoreErr
          ? (scoreErr as { code: unknown }).code
          : undefined,
      );
      if (code === NO_NEW_POW_CODE) {
        return jsonError(409, scoreErr instanceof Error
                ? scoreErr.message
                : `No new proof of work since the last ${LWM_SNAPSHOT_LABEL}.`, NO_NEW_POW_CODE,);
      }
      throw scoreErr;
    }
  } catch (error) {
    console.error("[performance-report] Error:", error);
    return jsonError(500, "Internal server error");
  }
}
