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

// POST /api/admin/organizations/[orgId]/invites - Create invite token(s)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { count = 1 } = await request.json();
    
    // Limit to max 50 invites at once
    const inviteCount = Math.min(Math.max(1, count), 50);

    const adminClient = getAdminClient();

    // Verify organization exists
    const { data: org } = await adminClient
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Generate invites
    const invites = [];
    for (let i = 0; i < inviteCount; i++) {
      invites.push({
        organization_id: orgId,
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
    console.error("Admin create invites error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/organizations/[orgId]/invites - Delete unused invite
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Only delete if unused
    const { error } = await adminClient
      .from("organization_invites")
      .delete()
      .eq("id", inviteId)
      .eq("organization_id", orgId)
      .is("used_by", null);

    if (error) {
      console.error("Error deleting invite:", error);
      return NextResponse.json({ error: "Failed to delete invite" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
