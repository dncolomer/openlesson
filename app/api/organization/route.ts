import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseLogoPayload,
  uploadOrganizationLogo,
} from "@/lib/organization/upload-logo";

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
      return jsonError(404, "Profile not found");
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
      return jsonError(404, "Organization not found");
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
    return jsonError(500, "Internal server error");
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

// POST /api/organization - Create a team org, or promote personal org to team (org-billing gate).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError(400, "Organization name is required");
    const logo = parseLogoPayload(body);

    const adminClient = getAdminClient();
    const { resolveUserBilling, userHasOrgApiAccess } = await import(
      "@/lib/organization/resolve-user-billing"
    );

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, organization_id, is_admin, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonError(404, "Profile not found");
    }

    const isAdmin = profile.is_admin === true;
    const hasApi = isAdmin || (await userHasOrgApiAccess(adminClient, user.id));
    if (!hasApi) {
      return jsonError(403, "Teams or API Metered org entitlement is required to create a team organization");
    }

    const baseSlug = slugify(typeof body.slug === "string" ? body.slug : name);
    let slug = baseSlug;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const { data: existing } = await adminClient
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      // Allow keeping same slug when updating own personal org
      if (profile.organization_id && existing.id === profile.organization_id) break;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    // Promote existing personal org (sole member) to named team org
    if (profile.organization_id) {
      const { data: currentOrg } = await adminClient
        .from("organizations")
        .select("id, kind")
        .eq("id", profile.organization_id)
        .single();
      const { count: memberCount } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id);

      if (
        currentOrg &&
        (currentOrg.kind === "personal" || (memberCount ?? 0) <= 1) &&
        profile.is_org_admin
      ) {
        const { data: organization, error: orgError } = await adminClient
          .from("organizations")
          .update({
            name,
            slug,
            kind: "team",
            updated_at: new Date().toISOString(),
            metadata: { created_by: user.id, source: "user_promoted_personal" },
          })
          .eq("id", profile.organization_id)
          .select("*")
          .single();

        if (orgError || !organization) {
          console.error("Promote organization error:", orgError);
          return jsonError(500, "Failed to update organization");
        }

        let finalOrg = organization;
        if (logo) {
          const logoResult = await uploadOrganizationLogo(adminClient, organization.id, logo);
          if (logoResult.ok) {
            finalOrg = { ...organization, logo_url: logoResult.logoUrl };
          } else {
            console.error("Promote org logo upload failed:", logoResult.error);
          }
        }

        await adminClient
          .from("agent_api_keys")
          .update({ organization_id: organization.id })
          .eq("user_id", user.id)
          .is("organization_id", null);

        return NextResponse.json({ organization: finalOrg, is_org_admin: true, promoted: true }, { status: 200 });
      }

      return jsonError(409, "You already belong to a multi-member organization. Leave it before creating another.",);
    }

    // No organization_id (should be rare post-migrate): create team org
    const billing = await resolveUserBilling(adminClient, user.id);
    const orgPlan =
      !("error" in billing) && billing.entity.source === "organization"
        ? billing.entity.plan
        : "inactive";

    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name,
        slug,
        kind: "team",
        billing_mode: "subscription",
        plan: orgPlan !== "inactive" ? orgPlan : "inactive",
        subscription_status:
          !("error" in billing) && billing.entity.entitled ? "active" : "inactive",
        metadata: { created_by: user.id, source: "user" },
      })
      .select("*")
      .single();

    if (orgError || !organization) {
      console.error("Create organization error:", orgError);
      return jsonError(500, "Failed to create organization");
    }

    let finalOrg = organization;
    if (logo) {
      const logoResult = await uploadOrganizationLogo(adminClient, organization.id, logo);
      if (logoResult.ok) {
        finalOrg = { ...organization, logo_url: logoResult.logoUrl };
      } else {
        console.error("Create org logo upload failed:", logoResult.error);
      }
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ organization_id: organization.id, is_org_admin: true })
      .eq("id", user.id);

    if (updateError) {
      console.error("Assign organization admin error:", updateError);
      return jsonError(500, "Failed to assign organization admin");
    }

    await adminClient
      .from("agent_api_keys")
      .update({ organization_id: organization.id })
      .eq("user_id", user.id)
      .is("organization_id", null);

    return NextResponse.json({ organization: finalOrg, is_org_admin: true }, { status: 201 });
  } catch (error) {
    console.error("Create organization error:", error);
    return jsonError(500, "Internal server error");
  }
}
