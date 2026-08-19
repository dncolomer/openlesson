import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Get requester's profile
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

    // Get target member's profile
    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", memberId)
      .single();

    if (targetError || !targetProfile) {
      return jsonError(404, "Member not found");
    }

    // Verify they're in the same organization
    if (targetProfile.organization_id !== requesterProfile.organization_id) {
      return jsonError(400, "Member not in your organization");
    }

    // If removing self and is org admin, check if there are other org admins
    if (memberId === user.id && targetProfile.is_org_admin) {
      const { data: otherAdmins } = await adminClient
        .from("profiles")
        .select("id")
        .eq("organization_id", requesterProfile.organization_id)
        .eq("is_org_admin", true)
        .neq("id", user.id);

      if (!otherAdmins || otherAdmins.length === 0) {
        return jsonError(400, "Cannot leave as the last org admin. Promote another member first.");
      }
    }

    // Remove member from organization
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ organization_id: null, is_org_admin: false })
      .eq("id", memberId);

    if (updateError) {
      console.error("Error removing member:", updateError);
      return jsonError(500, "Failed to remove member");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return jsonError(500, "Internal server error");
  }
}
