import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// GET /api/organization - Get current user's organization details
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

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
    let guests: Array<{
      id: string;
      email: string;
      status: string;
      claimed_by_user_id: string | null;
      claimed_at: string | null;
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

      const { data: guestData } = await adminClient
        .from("organization_guest_users")
        .select("id, email, status, claimed_by_user_id, claimed_at, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      guests = guestData || [];
    }

    return NextResponse.json({
      organization,
      is_org_admin: profile.is_org_admin,
      members,
      invites,
      guests,
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || `org-${Date.now()}`;
}

// POST /api/organization - Create an organization and make current user its admin.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Organization name is required" }, { status: 400 });

    const adminClient = getAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, organization_id, plan, subscription_status, is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (profile.organization_id) return NextResponse.json({ error: "User already belongs to an organization" }, { status: 409 });

    const isTeams = profile.is_admin || (profile.plan === "pro_teams" && profile.subscription_status === "active");
    if (!isTeams) {
      return NextResponse.json({ error: "Teams tier is required to create an organization" }, { status: 403 });
    }

    const baseSlug = slugify(typeof body.slug === "string" ? body.slug : name);
    let slug = baseSlug;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const { data: existing } = await adminClient.from("organizations").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .insert({ name, slug, metadata: { created_by: user.id, source: "user" } })
      .select("*")
      .single();

    if (orgError || !organization) {
      console.error("Create organization error:", orgError);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ organization_id: organization.id, is_org_admin: true })
      .eq("id", user.id);

    if (updateError) {
      console.error("Assign organization admin error:", updateError);
      return NextResponse.json({ error: "Failed to assign organization admin" }, { status: 500 });
    }

    await adminClient
      .from("agent_api_keys")
      .update({ organization_id: organization.id })
      .eq("user_id", user.id)
      .is("organization_id", null);

    return NextResponse.json({ organization, is_org_admin: true }, { status: 201 });
  } catch (error) {
    console.error("Create organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
