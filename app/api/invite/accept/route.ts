import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// GET /api/invite/accept?token=xxx - Get invite details
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Get invite and organization details
    const { data: invite, error } = await adminClient
      .from("organization_invites")
      .select(`
        id,
        token,
        used_by,
        used_at,
        organization:organizations(id, name, slug)
      `)
      .eq("token", token)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    }

    // Handle the organization relation - could be array or object depending on Supabase version
    const orgData = invite.organization;
    const org = Array.isArray(orgData) ? orgData[0] : orgData;

    return NextResponse.json({
      invite: {
        id: invite.id,
        token: invite.token,
        is_used: invite.used_by !== null,
        organization: org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
        } : null,
      },
    });
  } catch (error) {
    console.error("Get invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/invite/accept - Accept an invite
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Get the invite
    const { data: invite, error: inviteError } = await adminClient
      .from("organization_invites")
      .select(`
        id,
        organization_id,
        used_by,
        organization:organizations(id, name, slug)
      `)
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    }

    // Check if invite is already used
    if (invite.used_by) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
    }

    // Get user's current profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Check if user already belongs to an organization
    if (profile.organization_id) {
      return NextResponse.json({ 
        error: "You already belong to an organization. Please leave your current organization first." 
      }, { status: 400 });
    }

    // Mark the invite as used
    const { error: updateInviteError } = await adminClient
      .from("organization_invites")
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateInviteError) {
      console.error("Error updating invite:", updateInviteError);
      return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
    }

    // Update user's organization
    const { error: updateProfileError } = await adminClient
      .from("profiles")
      .update({ organization_id: invite.organization_id, is_org_admin: false })
      .eq("id", user.id);

    if (updateProfileError) {
      console.error("Error updating profile:", updateProfileError);
      // Try to rollback the invite update
      await adminClient
        .from("organization_invites")
        .update({ used_by: null, used_at: null })
        .eq("id", invite.id);
      return NextResponse.json({ error: "Failed to join organization" }, { status: 500 });
    }

    // Handle the organization relation - could be array or object depending on Supabase version
    const orgData = invite.organization;
    const org = Array.isArray(orgData) ? orgData[0] : orgData;

    return NextResponse.json({
      success: true,
      organization: org ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
      } : null,
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
