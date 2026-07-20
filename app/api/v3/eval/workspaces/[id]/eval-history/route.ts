import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { resolveEvaluationSubject } from "@/lib/agent-v2/evaluation-subject";
import {
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "@/lib/agent-v2/eval-run-history-store";
import { SCORE_VERTICALS, type ScoreVertical } from "@/lib/agent-v2/performance-report";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseVertical(value: string | null): ScoreVertical | null {
  if (!value) return null;
  if ((SCORE_VERTICALS as readonly string[]).includes(value)) return value as ScoreVertical;
  return null;
}

/**
 * GET /api/v3/eval/workspaces/{id}/eval-history
 *
 * List prior vertical eval scorecards for retroactive inspection.
 *
 * Query:
 * - user_id= | guest_user_id= — single subject by unique ID (non-admins always forced to self)
 * - user_ids=a,b,c — multi-user / group cohort filter (org admin or workspace owner)
 * - guest_user_ids=g1,g2 — multi-guest cohort filter
 * - vertical=verification|augmentation|optimization
 * - from= / to= — ISO timestamps on ran_at
 * - limit= / offset=
 *
 * Always address subjects with unique user_id / guest_user_id.
 */
export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id, is_group")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const url = new URL(req.url);
  const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);

  const requestedUserIds = parseCsv(url.searchParams.get("user_ids"));
  // Also accept repeated user_id= when listing a cohort via query expansion.
  const singleUser = url.searchParams.get("user_id");
  if (singleUser && !requestedUserIds.includes(singleUser)) {
    // Only treat as cohort when user_ids is also present; otherwise single subject via resolveEvaluationSubject.
  }

  const requestedGuestUserIds = parseCsv(url.searchParams.get("guest_user_ids"));

  const requestedSubject =
    url.searchParams.get("user_id") || url.searchParams.get("guest_user_id")
      ? resolveEvaluationSubject(
          auth,
          {
            user_id: url.searchParams.get("user_id"),
            guest_user_id: url.searchParams.get("guest_user_id"),
          },
          { isWorkspaceOwner },
        )
      : null;

  const scope = resolveHistorySubjectScope({
    authUserId: auth.user_id,
    authGuestUserId: auth.guest_user_id,
    isOrgAdmin: auth.is_org_admin,
    isWorkspaceOwner,
    requestedUserIds: requestedUserIds.length > 0 ? requestedUserIds : null,
    requestedGuestUserIds: requestedGuestUserIds.length > 0 ? requestedGuestUserIds : null,
    requestedSubject,
  });

  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
  const vertical = parseVertical(url.searchParams.get("vertical"));

  const runs = await listEvalRunHistory(supabase, {
    workspaceId,
    subject: scope.subject,
    userIds: scope.userIds,
    guestUserIds: scope.guestUserIds,
    vertical,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    limit,
    offset,
  });

  return NextResponse.json({
    workspace_id: workspaceId,
    is_group: Boolean(workspace.is_group),
    scope: {
      restricted: scope.restricted,
      subject: scope.subject ?? null,
      user_ids: scope.userIds ?? null,
      guest_user_ids: scope.guestUserIds ?? null,
    },
    count: runs.length,
    runs,
  });
}
