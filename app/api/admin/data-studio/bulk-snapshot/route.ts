import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  buildBulkSnapshotJobs,
  selectWorkspacesForBulkSnapshot,
  type BulkSnapshotWorkspaceRef,
  type PlatformBulkSnapshotEvent,
  workspaceBulkLabel,
} from "@/lib/admin/data-studio";
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
import { labelForSnapshotSubject } from "@/lib/pow-api/snapshot-all-progress";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  status?: string | null;
};

async function scoreOneSubject(options: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  authCtx: AuthContext;
  workspaceId: string;
  plan: SnapshotWorkspaceRow;
  subject: SnapshotSubjectRef;
}): Promise<{
  user_id: string | null;
  guest_user_id: string | null;
  status: "ok" | "skipped" | "failed";
  error?: string;
  code?: string;
  eval_run_history_id?: string | null;
  label?: string;
}> {
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
 * GET /api/admin/data-studio/bulk-snapshot
 * List eligible workspaces for bulk LWM Snapshot (admin preview).
 *
 * POST /api/admin/data-studio/bulk-snapshot
 * Platform-wide bulk LWM Snapshot across selected or all eligible workspaces.
 * Body: { workspaceIds?: string[], all?: boolean, stream?: boolean, includeArchived?: boolean, maxWorkspaces?: number }
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data, error } = await adminClient
      .from("workspaces")
      .select("id, title, root_topic, user_id, organization_id, status")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[admin/data-studio/bulk-snapshot] list", error);
      return NextResponse.json({ error: "Failed to list workspaces" }, { status: 500 });
    }

    const workspaces = (data || []).map((w) => ({
      id: w.id as string,
      title: w.title as string | null,
      root_topic: w.root_topic as string | null,
      user_id: w.user_id as string | null,
      organization_id: w.organization_id as string | null,
      status: w.status as string | null,
      label: workspaceBulkLabel(w as BulkSnapshotWorkspaceRef),
    }));

    return NextResponse.json({
      workspaces,
      total: workspaces.length,
      label: LWM_SNAPSHOT_LABEL,
    });
  } catch (error) {
    console.error("[admin/data-studio/bulk-snapshot] GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const accept = req.headers.get("accept") || "";
    const wantStream =
      body.stream === true ||
      accept.includes("application/x-ndjson") ||
      accept.includes("text/event-stream");

    const workspaceIds = Array.isArray(body.workspaceIds)
      ? (body.workspaceIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    const all = body.all === true;
    const includeArchived = body.includeArchived === true;
    const maxWorkspaces = Math.min(
      100,
      Math.max(1, Number(body.maxWorkspaces) || 50),
    );

    if (!all && workspaceIds.length === 0) {
      return NextResponse.json(
        { error: "Provide workspaceIds[] or all: true" },
        { status: 400 },
      );
    }

    let wsQuery = adminClient
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, description, notes, workspace_goal, organization_id, evaluation_mode, protocol_config, external_refs, status",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (!includeArchived) {
      wsQuery = wsQuery.neq("status", "archived");
    }

    const { data: wsRows, error: wsError } = await wsQuery;
    if (wsError) {
      console.error("[admin/data-studio/bulk-snapshot] workspaces", wsError);
      return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 });
    }

    const selected = selectWorkspacesForBulkSnapshot(
      (wsRows || []) as BulkSnapshotWorkspaceRef[],
      { workspaceIds, all, includeArchived },
    ).slice(0, maxWorkspaces);

    if (selected.length === 0) {
      return NextResponse.json({
        success: true,
        total_workspaces: 0,
        total_jobs: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        results: [],
        message: "No eligible workspaces selected",
      });
    }

    // Load full plan rows keyed by id
    const planById = new Map<string, SnapshotWorkspaceRow>();
    for (const row of wsRows || []) {
      planById.set(row.id as string, row as SnapshotWorkspaceRow);
    }

    const subjectsByWorkspace: Record<string, SnapshotSubjectRef[]> = {};
    for (const ws of selected) {
      const plan = planById.get(ws.id);
      subjectsByWorkspace[ws.id] = await listWorkspaceSnapshotSubjects(
        adminClient,
        ws.id,
        plan?.user_id ?? ws.user_id,
      );
    }

    const jobs = buildBulkSnapshotJobs({
      workspaces: selected,
      subjectsByWorkspace,
      currentUserId: user.id,
    });

    const authCtxFor = (plan: SnapshotWorkspaceRow): AuthContext => ({
      user_id: user.id,
      guest_user_id: null,
      organization_id: plan.organization_id ?? null,
      is_org_admin: true,
      key_id: "admin-data-studio-bulk-snapshot",
      scopes: ["workspaces:read", "workspaces:write"],
    });

    if (!wantStream) {
      const results: Array<
        Awaited<ReturnType<typeof scoreOneSubject>> & {
          workspace_id: string;
          workspace_label: string;
        }
      > = [];
      let succeeded = 0;
      let skipped = 0;
      let failed = 0;

      for (const job of jobs) {
        const plan = planById.get(job.workspace_id);
        if (!plan) {
          failed += 1;
          results.push({
            workspace_id: job.workspace_id,
            workspace_label: job.workspace_label,
            user_id: job.subject.user_id ?? null,
            guest_user_id: job.subject.guest_user_id ?? null,
            status: "failed",
            error: "Workspace plan missing",
            code: "workspace_missing",
            label: job.subject_label,
          });
          continue;
        }
        const result = await scoreOneSubject({
          supabase: adminClient,
          authCtx: authCtxFor(plan),
          workspaceId: job.workspace_id,
          plan,
          subject: job.subject,
        });
        results.push({
          ...result,
          workspace_id: job.workspace_id,
          workspace_label: job.workspace_label,
        });
        if (result.status === "ok") succeeded += 1;
        else if (result.status === "skipped") skipped += 1;
        else failed += 1;
      }

      return NextResponse.json({
        success: true,
        label: LWM_SNAPSHOT_LABEL,
        total_workspaces: selected.length,
        total_jobs: jobs.length,
        succeeded,
        skipped,
        failed,
        results,
      });
    }

    // NDJSON stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: PlatformBulkSnapshotEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          emit({
            type: "start",
            total_workspaces: selected.length,
            total_jobs: jobs.length,
            label: LWM_SNAPSHOT_LABEL,
          });

          if (jobs.length === 0) {
            emit({
              type: "complete",
              total_workspaces: selected.length,
              total_jobs: 0,
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
          let globalIndex = 0;

          // Group jobs by workspace for workspace_start/complete events
          const byWs = new Map<string, typeof jobs>();
          for (const job of jobs) {
            const list = byWs.get(job.workspace_id) || [];
            list.push(job);
            byWs.set(job.workspace_id, list);
          }

          let wsIndex = 0;
          for (const ws of selected) {
            wsIndex += 1;
            const wsJobs = byWs.get(ws.id) || [];
            emit({
              type: "workspace_start",
              workspace_id: ws.id,
              workspace_label: workspaceBulkLabel(ws),
              workspace_index: wsIndex,
              total_workspaces: selected.length,
              subject_count: wsJobs.length,
            });

            let wsOk = 0;
            let wsSkip = 0;
            let wsFail = 0;
            const plan = planById.get(ws.id);

            for (const job of wsJobs) {
              globalIndex += 1;
              emit({
                type: "job_start",
                index: globalIndex,
                total: jobs.length,
                workspace_id: job.workspace_id,
                workspace_label: job.workspace_label,
                user_id: job.subject.user_id ?? null,
                guest_user_id: job.subject.guest_user_id ?? null,
                label: job.subject_label,
              });

              let result: Awaited<ReturnType<typeof scoreOneSubject>>;
              if (!plan) {
                result = {
                  user_id: job.subject.user_id ?? null,
                  guest_user_id: job.subject.guest_user_id ?? null,
                  status: "failed",
                  error: "Workspace plan missing",
                  code: "workspace_missing",
                  label: job.subject_label,
                };
              } else {
                result = await scoreOneSubject({
                  supabase: adminClient,
                  authCtx: authCtxFor(plan),
                  workspaceId: job.workspace_id,
                  plan,
                  subject: job.subject,
                });
              }

              if (result.status === "ok") {
                succeeded += 1;
                wsOk += 1;
              } else if (result.status === "skipped") {
                skipped += 1;
                wsSkip += 1;
              } else {
                failed += 1;
                wsFail += 1;
              }

              emit({
                type: "job",
                index: globalIndex,
                total: jobs.length,
                workspace_id: job.workspace_id,
                workspace_label: job.workspace_label,
                user_id: result.user_id,
                guest_user_id: result.guest_user_id,
                status: result.status,
                error: result.error,
                code: result.code,
                eval_run_history_id: result.eval_run_history_id,
                label: result.label || job.subject_label,
              });
            }

            emit({
              type: "workspace_complete",
              workspace_id: ws.id,
              workspace_label: workspaceBulkLabel(ws),
              succeeded: wsOk,
              skipped: wsSkip,
              failed: wsFail,
              total: wsJobs.length,
            });
          }

          emit({
            type: "complete",
            total_workspaces: selected.length,
            total_jobs: jobs.length,
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
                : "Failed to run platform bulk snapshot",
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
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[admin/data-studio/bulk-snapshot] POST", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run platform bulk snapshot",
      },
      { status: 500 },
    );
  }
}
