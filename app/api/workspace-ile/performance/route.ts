import { NextRequest, NextResponse } from "next/server";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import { runVerticalScore } from "@/lib/pow-api/run-vertical-score";
import {
  LWM_SNAPSHOT_LABEL,
  SESSION_AUTO_SNAPSHOT_VERTICAL,
} from "@/lib/pow-api/performance-report";
import type { AuthContext } from "@/lib/pow-api/types";
import { toErrorCode } from "@/lib/pow-api/types";
import { ayclTokenFromBody } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Optional ILE-session helper to run LWM Snapshot for a participant.
 * Product snapshot generation is manual (Knowledge UI) or Snapshot API
 * POST .../lwm-snapshot / MCP lwm_snapshot — not invoked automatically on ILE end.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const sessionId = body.sessionId ? String(body.sessionId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const ileToken = ileTokenFromPowBody(body as Record<string, unknown>);
    const ayclToken = ayclTokenFromBody(body);

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    let supabase = createAdminClient();
    let auth: AuthContext;
    let participantUserId: string | null = null;
    let participantGuestUserId: string | null = null;
    let workspaceRow: {
      id: string;
      title: string | null;
      root_topic: string | null;
      description: string | null;
      notes: string | null;
      workspace_goal: string | null;
      evaluation_mode?: string | null;
      protocol_config?: unknown;
      external_refs?: unknown;
    } | null = null;

    if (ileToken) {
      const access = await requireSessionWorkspaceProofOfWorkAccess(
        workspaceId,
        sessionId || null,
        { ileToken },
      );
      if (access instanceof NextResponse) return access;

      supabase = access.supabase as typeof supabase;
      // Score the link participant (guest), not the workspace owner used for PoW writes.
      participantGuestUserId = access.auth.guest_user_id;
      participantUserId = participantGuestUserId
        ? null
        : access.auth.user_id && access.auth.user_id !== access.userId
          ? access.auth.user_id
          : access.userId;
      // Auth context for gate/history: subject is the participant.
      auth = {
        ...access.auth,
        user_id: participantGuestUserId ? null : participantUserId,
        guest_user_id: participantGuestUserId,
      };

      const { data: workspace } = await supabase
        .from("workspaces")
        .select(
          "id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs",
        )
        .eq("id", workspaceId)
        .single();
      workspaceRow = workspace;
    } else if (ayclToken) {
      const aycl = await resolveAyclAccess(ayclToken);
      if ("error" in aycl) {
        return NextResponse.json({ error: aycl.error }, { status: aycl.status });
      }
      if (aycl.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      supabase = aycl.supabase as typeof supabase;
      auth = {
        user_id: aycl.actingUser.id,
        guest_user_id: null,
        organization_id: null,
        is_org_admin: false,
        key_id: "aycl-ile-performance",
        scopes: ["workspaces:read"],
      };
      participantUserId = aycl.actingUser.id;
      const { data: workspace } = await supabase
        .from("workspaces")
        .select(
          "id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs",
        )
        .eq("id", workspaceId)
        .single();
      workspaceRow = workspace;
    } else {
      // Cookie session (owner / group member ILE inside product)
      const cookieClient = await createClient();
      const {
        data: { user },
      } = await cookieClient.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      auth = {
        user_id: user.id,
        guest_user_id: null,
        organization_id: null,
        is_org_admin: false,
        key_id: "ile-performance",
        scopes: ["workspaces:read"],
      };
      participantUserId = user.id;
      const { data: workspace } = await supabase
        .from("workspaces")
        .select(
          "id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs",
        )
        .eq("id", workspaceId)
        .single();
      workspaceRow = workspace;
    }

    if (!workspaceRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const scored = await runVerticalScore({
      supabase,
      auth,
      workspaceId,
      vertical: SESSION_AUTO_SNAPSHOT_VERTICAL,
      blockId,
      participantUserId,
      participantGuestUserId,
      workspaceRow,
      historySource: "ile",
    });

    if (scored.empty) {
      return NextResponse.json(
        { error: "No performance proof of work yet for this participant." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      report: scored.report,
      vertical: SESSION_AUTO_SNAPSHOT_VERTICAL,
      strategy: "lwm_snapshot",
      label: LWM_SNAPSHOT_LABEL,
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
    console.error("[workspace-ile/performance] Error:", error);
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
