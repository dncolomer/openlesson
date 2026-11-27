import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import {
  parseOrganizationMemberAdminFlag,
  wouldLeaveOrganizationWithoutAdmin,
} from "@/lib/organization/membership";
import {
  listOrganizationMemberRows,
  removeOrganizationMembership,
  setOrganizationMemberRole,
  userIsOrgAdminForOrganization,
} from "@/lib/organization/membership-store";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

function memberIdFromBody(body: Record<string, unknown>): string {
  return String(body.memberId || body.member_id || "").trim();
}

// PATCH /api/organization/members — org admin sets another member's role
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const memberId = memberIdFromBody(body);
    const isOrgAdmin = parseOrganizationMemberAdminFlag(body);

    if (!memberId) {
      return jsonError(400, "Member ID required");
    }
    if (isOrgAdmin === null) {
      return jsonError(400, "Role must be admin or member");
    }

    const org = await resolveDashboardOrganizationId({
      req: request,
      userId: user.id,
      email: user.email,
      body,
    });
    if (!org.ok) return org.response;
    if (!org.organizationId) {
      return jsonError(400, "You don't belong to an organization");
    }

    const adminClient = getAdminClient();
    const requesterIsAdmin = await userIsOrgAdminForOrganization(adminClient, {
      userId: user.id,
      organizationId: org.organizationId,
      email: user.email,
    });
    if (!requesterIsAdmin) {
      return jsonError(403, "Only org admins can change member roles");
    }

    const memberRows = await listOrganizationMemberRows(
      adminClient,
      org.organizationId,
    );
    const target = memberRows.find((row) => row.userId === memberId);
    if (!target) {
      return jsonError(400, "Member not in your organization");
    }

    if (target.isOrgAdmin && !isOrgAdmin) {
      if (wouldLeaveOrganizationWithoutAdmin(memberRows, memberId)) {
        return jsonError(
          400,
          "Cannot demote the last org admin. Promote another member first.",
        );
      }
    }

    await setOrganizationMemberRole(
      adminClient,
      memberId,
      org.organizationId,
      isOrgAdmin,
    );

    return NextResponse.json({
      success: true,
      memberId,
      is_org_admin: isOrgAdmin,
    });
  } catch (error) {
    console.error("Change member role error:", error);
    return jsonError(500, "Internal server error");
  }
}

// DELETE /api/organization/members - Remove a member from organization
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { memberId } = await request.json();

    if (!memberId) {
      return jsonError(400, "Member ID required");
    }

    const { data: requesterProfile, error: requesterError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (requesterError || !requesterProfile) {
      return jsonError(404, "Profile not found");
    }

    if (!requesterProfile.organization_id) {
      return jsonError(400, "You don't belong to an organization");
    }

    if (!requesterProfile.is_org_admin) {
      return jsonError(403, "Only org admins can remove members");
    }

    const adminClient = getAdminClient();
    const memberRows = await listOrganizationMemberRows(
      adminClient,
      requesterProfile.organization_id,
    );
    const target = memberRows.find((row) => row.userId === memberId);

    if (!target) {
      return jsonError(400, "Member not in your organization");
    }

    if (
      memberId === user.id &&
      target.isOrgAdmin &&
      wouldLeaveOrganizationWithoutAdmin(memberRows, memberId)
    ) {
      return jsonError(400, "Cannot leave as the last org admin. Promote another member first.");
    }

    await removeOrganizationMembership(
      adminClient,
      memberId,
      requesterProfile.organization_id,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return jsonError(500, "Internal server error");
  }
}
