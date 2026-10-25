/**
 * Owner Home dashboard: recent verification and calibration flows
 * owned by the caller (owner_user_id).
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
import { productFlowOwnerTitle } from "@/lib/product-flow";

export const runtime = "nodejs";

const FLOW_LIMIT = 8;

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const [verificationRes, calibrationRes] = await Promise.all([
      auth.supabase
        .from("workspace_verification_flows")
        .select("id, workspace_id, owner_user_id, name, topic, questions, public_token, created_at")
        .eq("owner_user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(FLOW_LIMIT),
      auth.supabase
        .from("workspace_calibration_flows")
        .select("id, workspace_id, owner_user_id, name, goal, questions, public_token, created_at")
        .eq("owner_user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(FLOW_LIMIT),
    ]);

    const verification: DashboardRecentFlow[] = sortDashboardRecentFlows(
      (verificationRes.data || [])
        .map((row) =>
          presentDashboardRecentFlow({
            id: row.id,
            kind: "verify",
            name: (row as { name?: unknown }).name,
            title: row.topic,
            workspaceId: row.workspace_id,
            workspaceTitle: productFlowOwnerTitle("verification"),
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
            name: (row as { name?: unknown }).name,
            title: row.goal,
            workspaceId: row.workspace_id,
            workspaceTitle: productFlowOwnerTitle("calibration"),
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
