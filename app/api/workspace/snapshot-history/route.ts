import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "@/lib/pow-api/eval-run-history-store";
import { getAllEvalPowGateStatuses } from "@/lib/pow-api/eval-pow-gate";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
  resolveEvaluationSubject,
} from "@/lib/pow-api/evaluation-subject";
import { SCORE_VERTICALS, type ScoreVertical } from "@/lib/pow-api/performance-report";
import type { AuthContext } from "@/lib/pow-api/types";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function parseCsv(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseVertical(value: unknown): ScoreVertical | null {
  if (typeof value !== "string") return null;
  if ((SCORE_VERTICALS as readonly string[]).includes(value)) return value as ScoreVertical;
  return null;
}

/**
 * Session auth first, then privileged client for history reads (owner cohort /
 * group self) after canAccessWorkspaceEval — mirrors performance-report.
 */
async function resolveWebAuth(
  workspaceId: string,
  ayclToken?: string | null,
): Promise<
  | { ok: true; user: User; supabase: SupabaseClient; ayclAccess?: boolean; isOwner: boolean }
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
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, user_id, is_group")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Workspace not found" }, { status: 404 }),
    };
  }

  const access = canAccessWorkspaceEval({
    callerUserId: session.user.id,
    workspaceOwnerId: workspace.user_id,
    isGroup: Boolean(workspace.is_group),
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

async function handle(
  workspaceId: string,
  userId: string,
  supabase: SupabaseClient,
  query: {
    user_ids?: string | null;
    guest_user_ids?: string | null;
    user_id?: string | null;
    guest_user_id?: string | null;
    vertical?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: string | null;
    offset?: string | null;
    /** Goals fingerprint for re-run gate (PoW∪goals uniqueness). */
    goals_fingerprint?: string | null;
    goal_mode?: string | null;
    adhoc_goal?: string | null;
    goal_ids?: string | null;
  },
  opts: { isOwner: boolean; ayclAccess?: boolean },
) {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, user_id, is_group, organization_id, workspace_goal")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return { error: "Workspace not found", status: 404 as const };
  }

  const isWorkspaceOwner = opts.isOwner || Boolean(opts.ayclAccess);
  const authLike: AuthContext = {
    user_id: userId,
    guest_user_id: null,
    organization_id: workspace.organization_id ?? null,
    is_org_admin: false,
    key_id: "web",
    scopes: ["workspaces:read"] as AuthContext["scopes"],
  };

  const requestedUserIds = parseCsv(query.user_ids);
  const requestedGuestUserIds = parseCsv(query.guest_user_ids);

  // Unique IDs only — no subject=me token.
  const hasSubjectParams = Boolean(query.user_id || query.guest_user_id);
  const requestedSubject = hasSubjectParams
    ? resolveEvaluationSubject(
        authLike,
        {
          user_id: query.user_id || userId,
          guest_user_id: query.guest_user_id,
        },
        { isWorkspaceOwner },
      )
    : isWorkspaceOwner
      ? null
      : { user_id: userId };

  const scope = resolveHistorySubjectScope({
    authUserId: userId,
    isOrgAdmin: false,
    isWorkspaceOwner,
    requestedUserIds: requestedUserIds.length > 0 ? requestedUserIds : null,
    requestedGuestUserIds: requestedGuestUserIds.length > 0 ? requestedGuestUserIds : null,
    requestedSubject,
  });

  const limit = Math.min(500, Math.max(1, Number(query.limit || 50) || 50));
  const offset = Math.max(0, Number(query.offset || 0) || 0);

  const runs = await listEvalRunHistory(supabase, {
    workspaceId,
    subject: scope.subject,
    userIds: scope.userIds,
    guestUserIds: scope.guestUserIds,
    vertical: parseVertical(query.vertical),
    from: query.from,
    to: query.to,
    limit,
    offset,
  });

  const eligibilitySubject = scope.subject;
  const participantUserId = eligibilitySubject?.user_id ?? null;
  const participantGuestUserId = eligibilitySubject?.guest_user_id ?? null;

  // Goals-aware gate: default / adhoc / selected are distinct snapshot identities.
  const { resolveGoalsForEligibility } = await import("@/lib/pow-api/goals-eligibility");
  const goalIds = parseCsv(query.goal_ids);
  const goalsResolved = await resolveGoalsForEligibility(supabase, {
    workspaceId,
    auth: authLike,
    goalsFingerprint: query.goals_fingerprint,
    selectionBody: {
      goal_mode: query.goal_mode,
      adhoc_goal: query.adhoc_goal,
      goal_ids: goalIds.length > 0 ? goalIds : undefined,
    },
    participantUserId,
    participantGuestUserId,
    storedWorkspaceGoal:
      (workspace as { workspace_goal?: string | null }).workspace_goal ?? null,
  });

  const eligibility = await getAllEvalPowGateStatuses(supabase, {
    workspaceId,
    auth: authLike,
    participantUserId,
    participantGuestUserId,
    goalsFingerprint: goalsResolved.goals_fingerprint,
  });

  return {
    status: 200 as const,
    body: {
      workspace_id: workspaceId,
      is_group: Boolean(workspace.is_group),
      is_owner: isWorkspaceOwner,
      scope: {
        restricted: scope.restricted,
        subject: scope.subject ?? null,
        user_ids: scope.userIds ?? null,
        guest_user_ids: scope.guestUserIds ?? null,
      },
      count: runs.length,
      runs,
      eligibility,
      goals_fingerprint: goalsResolved.goals_fingerprint,
      evaluated_goals: goalsResolved.evaluated_goals,
    },
  };
}

/**
 * Cookie-auth Evaluation surface for workspace UI.
 * Access: workspace owner (full), group members (self subject), AYCL token.
 * Persistence client: privileged after authz (see resolveEvalPersistenceClientMode).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await resolveWebAuth(workspaceId, url.searchParams.get("ayclToken"));
    if (!auth.ok) return auth.response;
    const result = await handle(
      workspaceId,
      auth.user.id,
      auth.supabase,
      {
        user_ids: url.searchParams.get("user_ids"),
        guest_user_ids: url.searchParams.get("guest_user_ids"),
        user_id: url.searchParams.get("user_id"),
        guest_user_id: url.searchParams.get("guest_user_id"),
        vertical: url.searchParams.get("vertical"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        limit: url.searchParams.get("limit"),
        offset: url.searchParams.get("offset"),
        goals_fingerprint: url.searchParams.get("goals_fingerprint"),
        goal_mode: url.searchParams.get("goal_mode"),
        adhoc_goal: url.searchParams.get("adhoc_goal"),
        goal_ids: url.searchParams.get("goal_ids"),
      },
      { isOwner: auth.isOwner, ayclAccess: auth.ayclAccess },
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.body);
  } catch (error) {
    console.error("[workspace/snapshot-history] GET failed:", error);
    return NextResponse.json({ error: "Failed to load eval history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await resolveWebAuth(workspaceId, ayclTokenFromBody(body));
    if (!auth.ok) return auth.response;
    const result = await handle(
      workspaceId,
      auth.user.id,
      auth.supabase,
      {
        user_ids:
          typeof body.user_ids === "string"
            ? body.user_ids
            : Array.isArray(body.user_ids)
              ? body.user_ids.join(",")
              : null,
        guest_user_ids:
          typeof body.guest_user_ids === "string"
            ? body.guest_user_ids
            : Array.isArray(body.guest_user_ids)
              ? body.guest_user_ids.join(",")
              : null,
        user_id: typeof body.user_id === "string" ? body.user_id : null,
        guest_user_id: typeof body.guest_user_id === "string" ? body.guest_user_id : null,
        vertical: typeof body.vertical === "string" ? body.vertical : null,
        from: typeof body.from === "string" ? body.from : null,
        to: typeof body.to === "string" ? body.to : null,
        limit: body.limit != null ? String(body.limit) : null,
        offset: body.offset != null ? String(body.offset) : null,
        goals_fingerprint:
          typeof body.goals_fingerprint === "string" ? body.goals_fingerprint : null,
        goal_mode: typeof body.goal_mode === "string" ? body.goal_mode : null,
        adhoc_goal: typeof body.adhoc_goal === "string" ? body.adhoc_goal : null,
        goal_ids: Array.isArray(body.goal_ids)
          ? body.goal_ids.filter((id: unknown) => typeof id === "string").join(",")
          : typeof body.goal_ids === "string"
            ? body.goal_ids
            : null,
      },
      { isOwner: auth.isOwner, ayclAccess: auth.ayclAccess },
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.body);
  } catch (error) {
    console.error("[workspace/snapshot-history] POST failed:", error);
    return NextResponse.json({ error: "Failed to load eval history" }, { status: 500 });
  }
}
