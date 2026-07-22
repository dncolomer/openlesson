import { NextRequest, NextResponse } from "next/server";
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
import { listWorkspaceSnapshotSubjects } from "@/lib/pow-api/workspace-snapshot-subjects";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/workspaces/[id]/snapshot-all
 *
 * Owner-only: generate an LWM Snapshot for every known subject in the workspace
 * (owner + PoW users/guests + session participants + prior knowledge subjects).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    if (!workspaceId) {
      return NextResponse.json({ error: "workspace id is required" }, { status: 400 });
    }

    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const supabase = createAdminClient();
    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select(
        "id, user_id, title, root_topic, description, notes, workspace_goal, organization_id, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json(
        { error: "Only the workspace owner can snapshot all users" },
        { status: 403 },
      );
    }

    const subjects = await listWorkspaceSnapshotSubjects(
      supabase,
      workspaceId,
      plan.user_id,
    );

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

    const authCtx: AuthContext = {
      user_id: user.id,
      guest_user_id: null,
      organization_id: plan.organization_id ?? null,
      is_org_admin: false,
      key_id: "web-snapshot-all",
      scopes: ["workspaces:read", "workspaces:write"],
    };

    const results: Array<{
      user_id: string | null;
      guest_user_id: string | null;
      status: "ok" | "skipped" | "failed";
      error?: string;
      code?: string;
      eval_run_history_id?: string | null;
    }> = [];

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;

    // Sequential to avoid hammering LLM / DB; maxDuration allows multi-subject runs.
    for (const subject of subjects) {
      const userId = subject.user_id ?? null;
      const guestId = subject.guest_user_id ?? null;
      try {
        const scored = await runVerticalScore({
          supabase,
          auth: authCtx,
          workspaceId,
          vertical: SNAPSHOT_VERTICAL,
          participantUserId: userId,
          participantGuestUserId: guestId,
          workspaceRow: plan,
          historySource: "web",
        });

        if (scored.empty) {
          skipped += 1;
          results.push({
            user_id: userId,
            guest_user_id: guestId,
            status: "skipped",
            error: "No performance proof of work yet",
            code: "empty",
          });
          continue;
        }

        succeeded += 1;
        results.push({
          user_id: userId,
          guest_user_id: guestId,
          status: "ok",
          eval_run_history_id: scored.eval_run_history_id ?? null,
        });
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
          skipped += 1;
          results.push({
            user_id: userId,
            guest_user_id: guestId,
            status: "skipped",
            error: message,
            code: NO_NEW_POW_CODE,
          });
          continue;
        }

        failed += 1;
        results.push({
          user_id: userId,
          guest_user_id: guestId,
          status: "failed",
          error: message,
          code: code || "score_error",
        });
      }
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
  } catch (error) {
    console.error("[workspaces/snapshot-all]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to snapshot workspace users",
      },
      { status: 500 },
    );
  }
}
