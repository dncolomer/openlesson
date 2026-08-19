import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LWM_SNAPSHOT_LABEL,
  SNAPSHOT_VERTICAL,
} from "@/lib/pow-api/performance-report";
import { runVerticalScore } from "@/lib/pow-api/run-vertical-score";
import { NO_NEW_POW_CODE } from "@/lib/pow-api/eval-pow-gate";
import { toErrorCode } from "@/lib/pow-api/types";
import type { AuthContext } from "@/lib/pow-api/types";
import {
  listWorkspaceSnapshotSubjects,
  type SnapshotSubjectRef,
} from "@/lib/pow-api/workspace-snapshot-subjects";
import {
  labelForSnapshotSubject,
  type SnapshotAllProgressEvent,
} from "@/lib/pow-api/snapshot-all-progress";
import {
  parseGoalSelectionFromBody,
  type GoalSelectionInput,
} from "@/lib/pow-api/goals";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Matches runVerticalScore workspaceRow shape (no Record widen). */
type SnapshotWorkspaceRow = {
  id: string;
  title: string | null;
  root_topic: string | null;
  description: string | null;
  notes: string | null;
  workspace_goal: string | null;
  organization_id?: string | null;
  user_id?: string;
  evaluation_mode?: string | null;
  protocol_config?: unknown;
  external_refs?: unknown;
};

type SubjectRunResult = {
  user_id: string | null;
  guest_user_id: string | null;
  status: "ok" | "skipped" | "failed";
  error?: string;
  code?: string;
  eval_run_history_id?: string | null;
  label?: string;
};

async function scoreOneSubject(options: {
  supabase: ReturnType<typeof createAdminClient>;
  authCtx: AuthContext;
  workspaceId: string;
  plan: SnapshotWorkspaceRow;
  subject: SnapshotSubjectRef;
  /** Shared goal selection applied to every subject in the batch. */
  goalSelection?: GoalSelectionInput | null;
  goalSelectionBody?: Record<string, unknown> | null;
}): Promise<SubjectRunResult> {
  const userId = options.subject.user_id ?? null;
  const guestId = options.subject.guest_user_id ?? null;
  const label = labelForSnapshotSubject(options.subject, {
    currentUserId: options.authCtx.user_id,
  });

  try {
    const scored = await runVerticalScore({
      supabase: options.supabase,
      auth: options.authCtx,
      workspaceId: options.workspaceId,
      vertical: SNAPSHOT_VERTICAL,
      participantUserId: userId,
      participantGuestUserId: guestId,
      workspaceRow: options.plan,
      historySource: "web",
      goalSelection: options.goalSelection ?? null,
      goalSelectionBody: options.goalSelectionBody ?? null,
    });

    if (scored.empty) {
      return {
        user_id: userId,
        guest_user_id: guestId,
        status: "skipped",
        error: "No performance proof of work yet",
        code: "empty",
        label,
      };
    }

    return {
      user_id: userId,
      guest_user_id: guestId,
      status: "ok",
      eval_run_history_id: scored.eval_run_history_id ?? null,
      label,
    };
  } catch (scoreErr) {
    const code = toErrorCode(
      scoreErr && typeof scoreErr === "object" && "code" in scoreErr
        ? (scoreErr as { code: unknown }).code
        : undefined,
    );
    const message =
      scoreErr instanceof Error
        ? scoreErr.message
        : `Failed to generate ${LWM_SNAPSHOT_LABEL}`;

    if (code === NO_NEW_POW_CODE) {
      return {
        user_id: userId,
        guest_user_id: guestId,
        status: "skipped",
        error: message,
        code: NO_NEW_POW_CODE,
        label,
      };
    }

    return {
      user_id: userId,
      guest_user_id: guestId,
      status: "failed",
      error: message,
      code: code || "score_error",
      label,
    };
  }
}

/**
 * POST /api/workspaces/[id]/snapshot-all
 *
 * Owner-only: generate an LWM Snapshot for every known subject in the workspace
 * (owner + PoW users/guests + session participants + prior knowledge subjects).
 *
 * Body: `{ "stream": true, goal_mode?, adhoc_goal?, goal_ids? }` (or Accept:
 * application/x-ndjson) for progressive NDJSON events so the LWM UI can show
 * live progress. Goal selection matches single-subject LWM Snapshot and is
 * applied to every subject. Default is a single JSON summary (dashboard card).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    if (!workspaceId) {
      return jsonError(400, "workspace id is required");
    }

    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const goalSelection = parseGoalSelectionFromBody(body);
    if (goalSelection.mode === "adhoc") {
      const text =
        typeof goalSelection.adhoc_goal === "string"
          ? goalSelection.adhoc_goal.trim()
          : "";
      if (!text) {
        return jsonError(400, "adhoc_goal is required when goal_mode is adhoc");
      }
    }
    if (goalSelection.mode === "selected") {
      const ids = goalSelection.goal_ids ?? goalSelection.selected_goal_ids ?? [];
      if (!ids.length) {
        return jsonError(400, "goal_ids is required when goal_mode is selected");
      }
    }

    const accept = req.headers.get("accept") || "";
    const wantStream =
      body.stream === true ||
      accept.includes("application/x-ndjson") ||
      accept.includes("text/event-stream");

    const supabase = createAdminClient();
    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, description, notes, workspace_goal, organization_id, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return jsonError(404, "Workspace not found");
    }

    if (plan.user_id !== user.id) {
      return jsonError(403, "Only the workspace owner can snapshot all users");
    }

    const subjects = await listWorkspaceSnapshotSubjects(
      supabase,
      workspaceId,
      plan.user_id,
    );

    const authCtx: AuthContext = {
      user_id: user.id,
      guest_user_id: null,
      organization_id: plan.organization_id ?? null,
      is_org_admin: false,
      key_id: "web-snapshot-all",
      scopes: ["workspaces:read", "workspaces:write"],
    };

    if (!wantStream) {
      if (subjects.length === 0) {
        return NextResponse.json({
          success: true,
          workspace_id: workspaceId,
          total: 0,
          succeeded: 0,
          skipped: 0,
          failed: 0,
          results: [],
          message: "No subjects found for this workspace",
        });
      }

      const results: SubjectRunResult[] = [];
      let succeeded = 0;
      let skipped = 0;
      let failed = 0;

      for (const subject of subjects) {
        const result = await scoreOneSubject({
          supabase,
          authCtx,
          workspaceId,
          plan,
          subject,
          goalSelection,
          goalSelectionBody: body,
        });
        results.push(result);
        if (result.status === "ok") succeeded += 1;
        else if (result.status === "skipped") skipped += 1;
        else failed += 1;
      }

      return NextResponse.json({
        success: true,
        workspace_id: workspaceId,
        label: LWM_SNAPSHOT_LABEL,
        total: subjects.length,
        succeeded,
        skipped,
        failed,
        results,
      });
    }

    // Progressive NDJSON stream for LWM UI
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: SnapshotAllProgressEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          emit({
            type: "start",
            workspace_id: workspaceId,
            total: subjects.length,
            label: LWM_SNAPSHOT_LABEL,
          });

          if (subjects.length === 0) {
            emit({
              type: "complete",
              workspace_id: workspaceId,
              total: 0,
              succeeded: 0,
              skipped: 0,
              failed: 0,
              label: LWM_SNAPSHOT_LABEL,
            });
            controller.close();
            return;
          }

          let succeeded = 0;
          let skipped = 0;
          let failed = 0;

          for (let i = 0; i < subjects.length; i++) {
            const subject = subjects[i];
            const index = i + 1;
            const label = labelForSnapshotSubject(subject, {
              currentUserId: user.id,
            });

            emit({
              type: "subject_start",
              index,
              total: subjects.length,
              user_id: subject.user_id ?? null,
              guest_user_id: subject.guest_user_id ?? null,
              label,
            });

            const result = await scoreOneSubject({
              supabase,
              authCtx,
              workspaceId,
              plan,
              subject,
              goalSelection,
              goalSelectionBody: body,
            });

            if (result.status === "ok") succeeded += 1;
            else if (result.status === "skipped") skipped += 1;
            else failed += 1;

            emit({
              type: "subject",
              index,
              total: subjects.length,
              user_id: result.user_id,
              guest_user_id: result.guest_user_id,
              status: result.status,
              error: result.error,
              code: result.code,
              eval_run_history_id: result.eval_run_history_id,
              label: result.label || label,
            });
          }

          emit({
            type: "complete",
            workspace_id: workspaceId,
            total: subjects.length,
            succeeded,
            skipped,
            failed,
            label: LWM_SNAPSHOT_LABEL,
          });
          controller.close();
        } catch (error) {
          emit({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "Failed to snapshot workspace users",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        // Disable buffering on some proxies
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[workspaces/snapshot-all]", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to snapshot workspace users",);
  }
}
