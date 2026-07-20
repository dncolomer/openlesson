import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeVerticalScoreReport } from "@/lib/agent-v2/workspace-goal";
import { generateWorkspaceVerticalScoreReport } from "@/lib/agent-v2/generate-performance-report";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";
import { SCORE_VERTICALS, type ScoreVertical } from "@/lib/agent-v2/performance-report";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
  resolveScoreParticipantIds,
} from "@/lib/agent-v2/evaluation-subject";
import type { AuthContext } from "@/lib/agent-v2/types";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

function parseVertical(value: unknown): ScoreVertical {
  if (typeof value === "string" && (SCORE_VERTICALS as readonly string[]).includes(value)) {
    return value as ScoreVertical;
  }
  return "verification";
}

/**
 * Cookie/AYCL auth for Knowledge score. After access is granted, returns a
 * privileged (service-role) Supabase client for context + learner persistence —
 * same contract as TAP/ILE web routes. Authz is always checked against the
 * session user first.
 */
async function resolveWebEvalAuth(
  workspaceId: string,
  ayclToken: string | null,
): Promise<
  | {
      ok: true;
      user: User;
      /** Privileged client for post-authz read/write of learner evidence + history. */
      supabase: SupabaseClient;
      ayclAccess?: boolean;
      isOwner: boolean;
    }
  | { ok: false; response: NextResponse }
> {
  if (ayclToken) {
    const aycl = await resolveAyclAccess(ayclToken);
    if ("error" in aycl) {
      return {
        ok: false,
        response: NextResponse.json({ error: aycl.error }, { status: aycl.status }),
      };
    }
    if (aycl.workspaceId !== workspaceId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    return {
      ok: true,
      user: aycl.actingUser as User,
      supabase: aycl.supabase,
      ayclAccess: true,
      isOwner: true,
    };
  }

  const session = await requireAuthenticatedUser();
  if (!session.ok) return session;

  const admin = createAdminClient();
  const { data: plan, error: planError } = await admin
    .from("workspaces")
    .select("id, user_id, is_group")
    .eq("id", workspaceId)
    .single();

  if (planError || !plan) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Workspace not found" }, { status: 404 }),
    };
  }

  const access = canAccessWorkspaceEval({
    callerUserId: session.user.id,
    workspaceOwnerId: plan.user_id,
    isGroup: Boolean(plan.is_group),
  });
  if (resolveEvalPersistenceClientMode(access) === "deny") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user: session.user,
    supabase: admin,
    isOwner: access.isOwner,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const vertical = parseVertical(body.vertical);
    const auth = await resolveWebEvalAuth(workspaceId, ayclTokenFromBody(body));
    if (!auth.ok) return auth.response;

    const { user, supabase, isOwner: accessIsOwner } = auth;

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, description, notes, workspace_goal, is_group, organization_id",
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
        return NextResponse.json(
          {
            error:
              "Database schema is missing workspaces.workspace_goal. Apply migration 20260719120000_workspace_goal_rename.",
            code: "schema_outdated",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (!plan) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const isWorkspaceOwner = accessIsOwner || Boolean(auth.ayclAccess);

    const authCtx: AuthContext = {
      user_id: user.id,
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

    // Privileged client: group-member PoW/history + guest subject rows after server authz.
    const context = await buildWorkspacePerformanceContext({
      supabase,
      auth: authCtx,
      workspaceId,
      participantUserId: participants.participantUserId,
      participantGuestUserId: participants.participantGuestUserId,
    });

    if (
      context.payload.counts.proof_of_work_artifacts === 0 &&
      context.payload.counts.linked_sessions === 0 &&
      context.payload.counts.workspace_files === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No performance proof of work yet. Complete sessions, upload proof of work, or run a TAP block first.",
        },
        { status: 400 },
      );
    }

    const { assertEvalAllowedWithNewPow, NO_NEW_POW_CODE } = await import(
      "@/lib/agent-v2/eval-pow-gate"
    );
    try {
      await assertEvalAllowedWithNewPow(supabase, {
        workspaceId,
        vertical,
        auth: authCtx,
        participantUserId: participants.participantUserId,
        participantGuestUserId: participants.participantGuestUserId,
      });
    } catch (gateErr) {
      const code =
        gateErr && typeof gateErr === "object" && "code" in gateErr
          ? String((gateErr as { code: string }).code)
          : null;
      if (code === NO_NEW_POW_CODE) {
        return NextResponse.json(
          {
            error:
              gateErr instanceof Error
                ? gateErr.message
                : "No new proof of work since the last eval of this type.",
            code: NO_NEW_POW_CODE,
          },
          { status: 409 },
        );
      }
      throw gateErr;
    }

    const generation = await generateWorkspaceVerticalScoreReport({
      workspaceId,
      workspaceTitle: plan.title,
      workspaceRootTopic: plan.root_topic,
      storedWorkspaceGoal: plan.workspace_goal,
      fileIds: context.fileIds,
      vertical,
    });

    if (!generation.success || !generation.data) {
      return NextResponse.json(
        {
          error: generation.error || "Failed to generate report",
          code: generation.code || "performance_report_generation_failed",
        },
        { status: 502 },
      );
    }

    const finalized = finalizeVerticalScoreReport(
      generation.data,
      plan.workspace_goal,
      {
        title: plan.title,
        description: plan.description,
        notes: plan.notes,
        root_topic: plan.root_topic,
      },
      vertical,
    );

    let learning_world_model = null;
    let knowledge_config = null;
    let eval_run_history_id: string | null = null;
    let eval_run_history_error: string | null = null;
    try {
      const { updateLearnerStateAfterScore } = await import(
        "@/lib/agent-v2/learner-state-engine"
      );
      const state = await updateLearnerStateAfterScore({
        supabase,
        workspaceId,
        auth: authCtx,
        report: finalized.report,
        vertical,
        participantUserId: participants.participantUserId,
        participantGuestUserId: participants.participantGuestUserId,
        proofOfWork: context.payload.proof_of_work,
        totalBlocks: context.payload.blocks.length,
        trigger: "score",
        historySource: "web",
      });
      learning_world_model = state.worldModel;
      knowledge_config = state.knowledgeConfig;
      eval_run_history_id = state.evalRunHistoryId;
      eval_run_history_error = state.evalRunHistoryError ?? null;
    } catch (stateErr) {
      console.warn("[performance-report] learner state update failed:", stateErr);
      eval_run_history_error =
        stateErr instanceof Error ? stateErr.message : "Learner state update failed";
    }

    return NextResponse.json({
      report: finalized.report,
      vertical,
      workspace_goal: finalized.workspace_goal,
      workspace_goal_source: finalized.workspace_goal_source,
      learning_world_model,
      knowledge_config,
      subject: participants.subject,
      eval_run_history_id,
      eval_history_saved: Boolean(eval_run_history_id),
      eval_run_history_error,
      /** Always present on success so UI can show scorecard even if archive fails. */
      report_available: true,
    });
  } catch (error) {
    console.error("[performance-report] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
