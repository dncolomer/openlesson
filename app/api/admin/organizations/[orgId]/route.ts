import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// GET /api/admin/organizations/[orgId] - Get organization details with members
export async function GET(
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

    const adminClient = getAdminClient();

    // Get organization
    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get members
    const { data: members } = await adminClient
      .from("profiles")
      .select("id, username, is_org_admin, created_at, plan, subscription_status")
      .eq("organization_id", orgId)
      .order("is_org_admin", { ascending: false })
      .order("created_at", { ascending: true });

    // Get auth users for email info
    const memberIds = (members || []).map(m => m.id);
    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    
    const enrichedMembers = (members || []).map(m => {
      const authUser = authUsers.users.find(a => a.id === m.id);
      return {
        ...m,
        email: authUser?.email || null,
      };
    });

    // Get invites
    const { data: invites } = await adminClient
      .from("organization_invites")
      .select("id, token, created_by, used_by, used_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    // Enrich invites with creator/user info
    const inviteUserIds = [
      ...new Set([
        ...(invites || []).map(i => i.created_by).filter(Boolean),
        ...(invites || []).map(i => i.used_by).filter(Boolean),
      ])
    ];

    const { data: inviteUsers } = inviteUserIds.length > 0
      ? await adminClient.from("profiles").select("id, username").in("id", inviteUserIds)
      : { data: [] };

    const userMap: Record<string, string> = {};
    (inviteUsers || []).forEach(u => {
      userMap[u.id] = u.username || "Unknown";
    });

    const enrichedInvites = (invites || []).map(i => ({
      ...i,
      created_by_username: i.created_by ? userMap[i.created_by] : null,
      used_by_username: i.used_by ? userMap[i.used_by] : null,
    }));

    return NextResponse.json({ 
      organization,
      members: enrichedMembers,
      invites: enrichedInvites,
    });
  } catch (error) {
    console.error("Admin organization detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/organizations/[orgId] - Update organization
export async function PUT(
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

    const body = await request.json();
    const { name, slug, metadata } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) {
      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug)) {
        return NextResponse.json({ 
          error: "Slug must be lowercase and contain only letters, numbers, and hyphens" 
        }, { status: 400 });
      }
      updateData.slug = slug;
    }
    if (metadata !== undefined) updateData.metadata = metadata;

    const adminClient = getAdminClient();

    // If changing slug, check it's not taken
    if (slug) {
      const { data: existing } = await adminClient
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .neq("id", orgId)
        .single();

      if (existing) {
        return NextResponse.json({ error: "An organization with this slug already exists" }, { status: 400 });
      }
    }

    const { data: organization, error } = await adminClient
      .from("organizations")
      .update(updateData)
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      console.error("Error updating organization:", error);
      return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Admin update organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/organizations/[orgId] - Delete organization
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

    const adminClient = getAdminClient();

    // First, remove all members from the organization (set their org_id to null)
    await adminClient
      .from("profiles")
      .update({ organization_id: null, is_org_admin: false })
      .eq("organization_id", orgId);

    // Delete the organization (invites will cascade delete)
    const { error } = await adminClient
      .from("organizations")
      .delete()
      .eq("id", orgId);

    if (error) {
      console.error("Error deleting organization:", error);
      return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
