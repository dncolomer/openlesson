/**
 * Owner Home dashboard: recent verification and calibration flows
 * across the caller's workspaces (the flows themselves, not the workspaces).
 */
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardRecentFlows,
  type DashboardRecentFlow,
} from "@/lib/dashboard-home";

export const runtime = "nodejs";

const FLOW_LIMIT = 8;

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { data: workspaces, error: workspaceError } = await auth.supabase
      .from("workspaces")
      .select("id, title, root_topic")
      .eq("user_id", auth.user.id)
      .neq("status", "archived");

    if (workspaceError) {
      return NextResponse.json({ verification: [], calibration: [] });
    }

    const listed = Array.isArray(workspaces) ? workspaces : [];
    const ids = listed.map((row) => String(row.id || "")).filter(Boolean);
    const titles = new Map(
      listed.map((row) => [
        String(row.id),
        String(row.title || row.root_topic || "Workspace"),
      ]),
    );
    if (ids.length === 0) {
      return NextResponse.json({ verification: [], calibration: [] });
    }

    const [verificationRes, calibrationRes] = await Promise.all([
      auth.supabase
        .from("workspace_verification_flows")
        .select("id, workspace_id, topic, questions, public_token, created_at")
        .in("workspace_id", ids)
        .order("created_at", { ascending: false })
        .limit(FLOW_LIMIT),
      auth.supabase
        .from("workspace_calibration_flows")
        .select("id, workspace_id, goal, questions, public_token, created_at")
        .in("workspace_id", ids)
        .order("created_at", { ascending: false })
        .limit(FLOW_LIMIT),
    ]);

    const verification: DashboardRecentFlow[] = sortDashboardRecentFlows(
      (verificationRes.data || [])
        .map((row) =>
          presentDashboardRecentFlow({
            id: row.id,
            kind: "verify",
            title: row.topic,
            workspaceId: row.workspace_id,
            workspaceTitle: titles.get(String(row.workspace_id)),
            createdAt: row.created_at,
            publicToken: row.public_token,
            questionCount: questionCountFromUnknown(row.questions),
          }),
        )
        .filter((row): row is DashboardRecentFlow => Boolean(row)),
      FLOW_LIMIT,
    );

    const calibration: DashboardRecentFlow[] = sortDashboardRecentFlows(
      (calibrationRes.data || [])
        .map((row) =>
          presentDashboardRecentFlow({
            id: row.id,
            kind: "calibrate",
            title: row.goal,
            workspaceId: row.workspace_id,
            workspaceTitle: titles.get(String(row.workspace_id)),
            createdAt: row.created_at,
            publicToken: row.public_token,
            questionCount: questionCountFromUnknown(row.questions),
          }),
        )
        .filter((row): row is DashboardRecentFlow => Boolean(row)),
      FLOW_LIMIT,
    );

    return NextResponse.json({ verification, calibration });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load recent flows";
    return jsonError(500, message);
  }
}
