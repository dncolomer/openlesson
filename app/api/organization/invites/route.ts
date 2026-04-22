import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/organization/invites - Create invite token(s) (org admin only)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: "You don't belong to an organization" }, { status: 400 });
    }

    if (!profile.is_org_admin) {
      return NextResponse.json({ error: "Only org admins can create invites" }, { status: 403 });
    }

    const { count = 1 } = await request.json();
    
    // Limit to max 50 invites at once
    const inviteCount = Math.min(Math.max(1, count), 50);

    const adminClient = getAdminClient();

    // Generate invites
    const invites = [];
    for (let i = 0; i < inviteCount; i++) {
      invites.push({
        organization_id: profile.organization_id,
        token: generateToken(),
        created_by: user.id,
      });
    }

    const { data: createdInvites, error } = await adminClient
      .from("organization_invites")
      .insert(invites)
      .select();

    if (error) {
      console.error("Error creating invites:", error);
      return NextResponse.json({ error: "Failed to create invites" }, { status: 500 });
    }

    return NextResponse.json({ invites: createdInvites });
  } catch (error) {
    console.error("Create invites error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/organization/invites - Revoke an unused invite (org admin only)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: "You don't belong to an organization" }, { status: 400 });
    }

    if (!profile.is_org_admin) {
      return NextResponse.json({ error: "Only org admins can revoke invites" }, { status: 403 });
    }

    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Only delete if unused and belongs to this org
    const { error } = await adminClient
      .from("organization_invites")
      .delete()
      .eq("id", inviteId)
      .eq("organization_id", profile.organization_id)
      .is("used_by", null);

    if (error) {
      console.error("Error deleting invite:", error);
      return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
