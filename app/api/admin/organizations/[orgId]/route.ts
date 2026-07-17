import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  ORG_DETAIL_SELECT,
  ORG_DETAIL_SELECT_NO_LOGO,
  isMissingLogoUrlColumn,
} from "@/lib/organization/org-select";

export const runtime = "nodejs";


// GET /api/admin/organizations/[orgId] - Get organization details with members
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    // Get organization (never expose xai_api_key_ciphertext)
    let organization: Record<string, unknown> | null = null;
    {
      const first = await adminClient
        .from("organizations")
        .select(ORG_DETAIL_SELECT)
        .eq("id", orgId)
        .single();
      if (first.error && isMissingLogoUrlColumn(first.error)) {
        const fallback = await adminClient
          .from("organizations")
          .select(ORG_DETAIL_SELECT_NO_LOGO)
          .eq("id", orgId)
          .single();
        organization = (fallback.data as Record<string, unknown> | null) ?? null;
        if (fallback.error || !organization) {
          return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }
      } else if (first.error || !first.data) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      } else {
        organization = first.data as Record<string, unknown>;
      }
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
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

    const body = await request.json();
    const {
      name,
      slug,
      metadata,
      plan,
      billing_mode,
      extra_lessons,
      billing_email,
      kind,
      subscription_status,
      current_period_end,
    } = body;

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
    if (billing_email !== undefined) updateData.billing_email = billing_email;
    if (kind !== undefined) {
      if (!["personal", "team", "partner"].includes(kind)) {
        return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
      }
      updateData.kind = kind;
    }
    if (billing_mode !== undefined) {
      if (!["subscription", "partner"].includes(billing_mode)) {
        return NextResponse.json({ error: "Invalid billing_mode" }, { status: 400 });
      }
      updateData.billing_mode = billing_mode;
    }
    if (typeof extra_lessons === "number" && extra_lessons >= 0) {
      updateData.extra_lessons = extra_lessons;
    }
    if (subscription_status !== undefined) {
      updateData.subscription_status = subscription_status;
    }
    if (current_period_end !== undefined) {
      updateData.current_period_end = current_period_end;
    }

    // Assign tier using same semantics as user admin tiers
    if (plan !== undefined) {
      const { buildTierUpdate, isAdminTier } = await import("@/lib/admin/tiers");
      if (!isAdminTier(plan)) {
        return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
      }
      const tierPatch = buildTierUpdate(plan);
      updateData.plan = tierPatch.plan;
      const mode =
        billing_mode ??
        (
          await adminClient
            .from("organizations")
            .select("billing_mode")
            .eq("id", orgId)
            .single()
        ).data?.billing_mode;

      if (mode === "partner" && plan !== "inactive") {
        updateData.subscription_status = "active";
        updateData.current_period_end = null;
        updateData.extra_lessons =
          typeof extra_lessons === "number" ? extra_lessons : tierPatch.extra_lessons;
      } else {
        updateData.subscription_status = tierPatch.subscription_status;
        updateData.current_period_end = tierPatch.current_period_end;
        if (typeof extra_lessons !== "number") {
          updateData.extra_lessons = tierPatch.extra_lessons;
        }
      }
    }

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

    const updated = await adminClient
      .from("organizations")
      .update(updateData)
      .eq("id", orgId)
      .select(ORG_DETAIL_SELECT)
      .single();

    let organization = updated.data;
    let error = updated.error;

    if (error && isMissingLogoUrlColumn(error)) {
      const fallback = await adminClient
        .from("organizations")
        .update(updateData)
        .eq("id", orgId)
        .select(ORG_DETAIL_SELECT_NO_LOGO)
        .single();
      organization = fallback.data as typeof organization;
      error = fallback.error;
    }

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
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient, user } = auth;

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
