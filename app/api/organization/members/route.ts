import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listOrganizationMemberRows,
  removeOrganizationMembership,
} from "@/lib/organization/membership-store";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
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

    if (memberId === user.id && target.isOrgAdmin) {
      const otherAdmins = memberRows.filter(
        (row) => row.userId !== user.id && row.isOrgAdmin,
      );
      if (otherAdmins.length === 0) {
        return jsonError(400, "Cannot leave as the last org admin. Promote another member first.");
      }
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
