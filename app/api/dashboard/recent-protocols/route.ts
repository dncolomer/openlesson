/**
 * Owner Home dashboard: recent knowledge verification protocols
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

    const verificationRes = await auth.supabase
      .from("verify_flows")
      .select("id, workspace_id, owner_user_id, name, topic, questions, public_token, created_at")
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(FLOW_LIMIT);

    const protocols: DashboardRecentFlow[] = sortDashboardRecentFlows(
      (verificationRes.data || [])
        .map((row) =>
          presentDashboardRecentFlow({
            id: row.id,
            name: (row as { name?: unknown }).name,
            title: row.topic,
            workspaceId: row.workspace_id,
            workspaceTitle: productFlowOwnerTitle(),
            createdAt: row.created_at,
            publicToken: row.public_token,
            challenge: row.topic,
            topic: row.topic,
            questionCount: questionCountFromUnknown(row.questions),
          }),
        )
        .filter((row): row is DashboardRecentFlow => Boolean(row)),
      FLOW_LIMIT,
    );

    return NextResponse.json({ protocols, verification: protocols });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load recent protocols";
    return jsonError(500, message);
  }
}
