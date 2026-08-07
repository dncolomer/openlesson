import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LWM_SNAPSHOT_LABEL,
  SNAPSHOT_VERTICAL,
} from "@/lib/pow-api/performance-report";
import { runVerticalScore } from "@/lib/pow-api/run-vertical-score";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
  resolveScoreParticipantIds,
} from "@/lib/pow-api/evaluation-subject";
import type { AuthContext } from "@/lib/pow-api/types";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NO_NEW_POW_CODE } from "@/lib/pow-api/eval-pow-gate";
import { toErrorCode } from "@/lib/pow-api/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Cookie/AYCL auth for Knowledge LWM Snapshot. After access is granted, returns a
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

/**
 * Generate a new LWM Snapshot for a subject (single strategy — former verification path).
 * Used by the LWM box "Generate new snapshot" control and any web callers.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const auth = await resolveWebEvalAuth(workspaceId, ayclTokenFromBody(body));
    if (!auth.ok) return auth.response;

    const { user, supabase, isOwner: accessIsOwner } = auth;

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
        return NextResponse.json(
          {
            error:
              "No performance proof of work yet. Complete sessions, upload proof of work, or run a TAP block first.",
          },
          { status: 400 },
        );
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
        return NextResponse.json(
          {
            error:
              scoreErr instanceof Error
                ? scoreErr.message
                : `No new proof of work since the last ${LWM_SNAPSHOT_LABEL}.`,
            code: NO_NEW_POW_CODE,
          },
          { status: 409 },
        );
      }
      throw scoreErr;
    }
  } catch (error) {
    console.error("[performance-report] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
