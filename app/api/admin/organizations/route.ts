import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAdminClient() {
  return createAdminClient();
}

// GET /api/admin/organizations - List all organizations
export async function GET() {
  try {
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

    // Get all organizations
    const { data: organizations, error } = await adminClient
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching organizations:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    // Get member counts for each organization
    const orgIds = (organizations || []).map(o => o.id);
    
    const { data: members } = orgIds.length > 0 
      ? await adminClient
          .from("profiles")
          .select("organization_id")
          .in("organization_id", orgIds)
      : { data: [] };

    const memberCounts: Record<string, number> = {};
    (members || []).forEach(m => {
      if (m.organization_id) {
        memberCounts[m.organization_id] = (memberCounts[m.organization_id] || 0) + 1;
      }
    });

    // Get unused invite counts
    const { data: invites } = orgIds.length > 0 
      ? await adminClient
          .from("organization_invites")
          .select("organization_id")
          .in("organization_id", orgIds)
          .is("used_by", null)
      : { data: [] };

    const inviteCounts: Record<string, number> = {};
    (invites || []).forEach(i => {
      if (i.organization_id) {
        inviteCounts[i.organization_id] = (inviteCounts[i.organization_id] || 0) + 1;
      }
    });

    const enrichedOrganizations = (organizations || []).map(org => ({
      ...org,
      member_count: memberCounts[org.id] || 0,
      pending_invites: inviteCounts[org.id] || 0,
    }));

    return NextResponse.json({ organizations: enrichedOrganizations });
  } catch (error) {
    console.error("Admin organizations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/organizations - Create a new organization
export async function POST(request: Request) {
  try {
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

    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ 
        error: "Slug must be lowercase and contain only letters, numbers, and hyphens" 
      }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Check if slug already exists
    const { data: existing } = await adminClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: "An organization with this slug already exists" }, { status: 400 });
    }

    const { data: organization, error } = await adminClient
      .from("organizations")
      .insert({ name, slug })
      .select()
      .single();

    if (error) {
      console.error("Error creating organization:", error);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Admin create organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
