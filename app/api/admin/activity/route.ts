import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  activityWindowStart,
  mergeActivityEvents,
  parseActivityWindow,
  rankActiveUsers,
  type RawActivityRow,
} from "@/lib/admin/activity";
import { adminTimedSessionActivitySummary } from "@/lib/admin/product-labels";
import {
  ADMIN_POW_SELECT,
  mapProofOfWorkRow,
  proofOfWorkSummary,
} from "@/lib/admin/proof-of-work";
import { getProfileEmail } from "@/lib/admin/users";

export const runtime = "nodejs";

const SOURCE_LIMIT = 150;

function clampLimit(value: string | null, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const params = request.nextUrl.searchParams;
    const window = parseActivityWindow(params.get("window"));
    const activityLimit = clampLimit(params.get("activityLimit"), 40, 100);
    const usersLimit = clampLimit(params.get("usersLimit"), 25, 50);
    const since = activityWindowStart(window).toISOString();

    const [ileRes, tapRes, powRes, workspaceRes] = await Promise.all([
      adminClient
        .from("sessions")
        .select("id, user_id, problem, status, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(SOURCE_LIMIT),
      adminClient
        .from("workspace_tap_sessions")
        .select(
          "id, user_id, status, created_at, workspace_id, overall_score, interaction_kind",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(SOURCE_LIMIT),
      adminClient
        .from("workspace_proof_of_work")
        .select(ADMIN_POW_SELECT)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(SOURCE_LIMIT),
      adminClient
        .from("workspaces")
        .select("id, user_id, title, root_topic, status, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(SOURCE_LIMIT),
    ]);

    if (ileRes.error || tapRes.error || powRes.error || workspaceRes.error) {
      console.error("Admin activity query error:", {
        ile: ileRes.error,
        tap: tapRes.error,
        pow: powRes.error,
        workspace: workspaceRes.error,
      });
      return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
    }

    const powWorkspaceIds = [
      ...new Set(
        (powRes.data || [])
          .map((row) => row.workspace_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const workspaceTitleById = new Map<string, string>();
    if (powWorkspaceIds.length > 0) {
      const { data: workspaces } = await adminClient
        .from("workspaces")
        .select("id, title, root_topic")
        .in("id", powWorkspaceIds);
      for (const ws of workspaces || []) {
        workspaceTitleById.set(ws.id, ws.title || ws.root_topic || ws.id);
      }
    }

    const raw: RawActivityRow[] = [];

    for (const row of ileRes.data || []) {
      raw.push({
        id: row.id,
        type: "ile_session",
        createdAt: row.created_at,
        summary: row.problem || "Untitled session",
        status: row.status,
        href: `/admin/sessions/${row.id}`,
        userId: row.user_id || null,
      });
    }

    for (const row of tapRes.data || []) {
      raw.push({
        id: row.id,
        type: "tap_session",
        createdAt: row.created_at,
        summary: adminTimedSessionActivitySummary({
          interaction_kind: (row as { interaction_kind?: string | null }).interaction_kind,
          overall_score: row.overall_score,
        }),
        status: row.status,
        href: `/admin/sessions/${row.id}`,
        userId: row.user_id || null,
        interaction_kind: (row as { interaction_kind?: string | null }).interaction_kind ?? null,
      });
    }

    for (const row of powRes.data || []) {
      const workspaceTitle = row.workspace_id
        ? workspaceTitleById.get(row.workspace_id) || null
        : null;
      const details = mapProofOfWorkRow(row, workspaceTitle);
      const href = row.workspace_id
        ? `/admin/workspaces/${row.workspace_id}`
        : row.user_id
          ? `/admin/users/${row.user_id}`
          : "/admin";
      raw.push({
        id: row.id,
        type: "proof_of_work",
        createdAt: row.created_at,
        summary: proofOfWorkSummary(details),
        href,
        userId: row.user_id || null,
        details,
      });
    }

    for (const row of workspaceRes.data || []) {
      raw.push({
        id: row.id,
        type: "workspace_created",
        createdAt: row.created_at,
        summary: row.title || row.root_topic || "Untitled workspace",
        status: row.status,
        href: `/admin/workspaces/${row.id}`,
        userId: row.user_id || null,
      });
    }

    const userIds = [
      ...new Set(raw.map((r) => r.userId).filter((id): id is string => Boolean(id))),
    ];

    const profileMap = new Map<
      string,
      { username: string | null; email: string | null; plan: string }
    >();
    const userMap = new Map<
      string,
      { id: string | null; username: string | null; email: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, username, plan")
        .in("id", userIds);

      const emails = await Promise.all(
        userIds.map(async (id) => [id, await getProfileEmail(adminClient, id)] as const)
      );
      const emailById = new Map(emails);

      for (const profile of profiles || []) {
        const email = emailById.get(profile.id) || null;
        profileMap.set(profile.id, {
          username: profile.username,
          email,
          plan: profile.plan || "inactive",
        });
        userMap.set(profile.id, {
          id: profile.id,
          username: profile.username,
          email,
        });
      }

      for (const id of userIds) {
        if (!userMap.has(id)) {
          const email = emailById.get(id) || null;
          userMap.set(id, { id, username: null, email });
          profileMap.set(id, { username: null, email, plan: "inactive" });
        }
      }
    }

    const recentActivity = mergeActivityEvents(raw, userMap, activityLimit);
    const activeUsers = rankActiveUsers(raw, profileMap, usersLimit);

    return NextResponse.json({
      window,
      since,
      recentActivity,
      activeUsers,
    });
  } catch (error) {
    console.error("Admin activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
