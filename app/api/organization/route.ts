import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// GET /api/organization - Get current user's organization details
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's profile with organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ organization: null, is_org_admin: false });
    }

    const adminClient = getAdminClient();

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get members if user is org admin
    let members: Array<{
      id: string;
      username: string | null;
      is_org_admin: boolean;
      created_at: string;
      plan: string;
      subscription_status: string;
      email: string | null;
    }> = [];
    let invites: Array<{
      id: string;
      token: string;
      used_by: string | null;
      used_at: string | null;
      created_at: string;
    }> = [];

    if (profile.is_org_admin) {
      // Get members
      const { data: membersData } = await adminClient
        .from("profiles")
        .select("id, username, is_org_admin, created_at, plan, subscription_status")
        .eq("organization_id", profile.organization_id)
        .order("is_org_admin", { ascending: false })
        .order("created_at", { ascending: true });

      // Get auth users for email info
      const memberIds = (membersData || []).map(m => m.id);
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      
      members = (membersData || []).map(m => {
        const authUser = authUsers.users.find(a => a.id === m.id);
        return {
          ...m,
          email: authUser?.email || null,
        };
      });

      // Get invites
      const { data: invitesData } = await adminClient
        .from("organization_invites")
        .select("id, token, used_by, used_at, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      invites = invitesData || [];
    }

    return NextResponse.json({
      organization,
      is_org_admin: profile.is_org_admin,
      members,
      invites,
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
