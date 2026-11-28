/**
 * Owner Home dashboard: recent knowledge verification protocols
 * in the caller's active organization.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardRecentFlows,
  type DashboardRecentFlow,
} from "@/lib/dashboard-home";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import { isMissingOrganizationIdColumn } from "@/lib/organization/membership";
import { productFlowOwnerTitle } from "@/lib/product-flow";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const FLOW_LIMIT = 8;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const organizationId = org.organizationId;
    const admin = createAdminClient();
    let verificationRes = organizationId
      ? await admin
          .from("verify_flows")
          .select("id, owner_user_id, name, topic, questions, public_token, created_at")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(FLOW_LIMIT)
      : await admin
          .from("verify_flows")
          .select("id, owner_user_id, name, topic, questions, public_token, created_at")
          .eq("owner_user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(FLOW_LIMIT);
    if (verificationRes.error && organizationId && isMissingOrganizationIdColumn(verificationRes.error)) {
      verificationRes = await admin
        .from("verify_flows")
        .select("id, owner_user_id, name, topic, questions, public_token, created_at")
        .eq("owner_user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(FLOW_LIMIT);
    }

    const protocols: DashboardRecentFlow[] = sortDashboardRecentFlows(
      (verificationRes.data || [])
        .map((row) =>
          presentDashboardRecentFlow({
            id: row.id,
            name: (row as { name?: unknown }).name,
            title: row.topic,
            workspaceId: null,
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
