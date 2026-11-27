/**
 * Owner dashboard: Knowledge regions for Protocols.
 * Create goes through region simulation, not attach-from-flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { presentDashboardKnowledgeRegions } from "@/lib/dashboard-knowledge-regions";
import { isMissingOrganizationIdColumn } from "@/lib/organization/membership";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import { rejectedProtocolKind } from "@/lib/product-flow";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    if (rejectedProtocolKind(new URL(req.url).searchParams.get("kind"))) {
      return jsonError(400, "Only knowledge verification protocols are supported");
    }

    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const organizationId = org.organizationId;
    const admin = createAdminClient();
    const select =
      "id, workspace_id, owner_user_id, name, description, subject_count, created_at, embedding_model_id";
    let listed = organizationId
      ? await admin
          .from("knowledge_regions")
          .select(select)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
      : await admin
          .from("knowledge_regions")
          .select(select)
          .eq("owner_user_id", auth.user.id)
          .order("created_at", { ascending: false });
    if (listed.error && organizationId && isMissingOrganizationIdColumn(listed.error)) {
      listed = await admin
        .from("knowledge_regions")
        .select(select)
        .eq("owner_user_id", auth.user.id)
        .order("created_at", { ascending: false });
    }

    if (listed.error) {
      return NextResponse.json({ regions: [] });
    }

    const ownerFilter = organizationId ? null : auth.user.id;
    return NextResponse.json({
      regions: presentDashboardKnowledgeRegions(listed.data || [], ownerFilter),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load knowledge regions";
    return jsonError(500, message);
  }
}

export async function POST() {
  return jsonError(400, "Regions are created by running a simulation");
}
