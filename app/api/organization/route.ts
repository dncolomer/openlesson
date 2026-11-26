import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseLogoPayload,
  uploadOrganizationLogo,
} from "@/lib/organization/upload-logo";
import { presentOrganizationRow } from "@/lib/organization/org-backends";
import {
  listOrganizationMemberIds,
  listOrganizationMemberRows,
  upsertOrganizationMembership,
} from "@/lib/organization/membership-store";

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
      const memberRows = await listOrganizationMemberRows(
        adminClient,
        profile.organization_id,
      );
      const memberIds = memberRows.map((row) => row.userId);
      const adminByUserId = new Map(
        memberRows.map((row) => [row.userId, row.isOrgAdmin]),
      );

      const { data: membersData } =
        memberIds.length > 0
          ? await adminClient
              .from("profiles")
              .select("id, username, created_at, plan, subscription_status")
              .in("id", memberIds)
          : { data: [] as Array<{
              id: string;
              username: string | null;
              created_at: string;
              plan: string;
              subscription_status: string;
            }> };

      const { data: authUsers } = await adminClient.auth.admin.listUsers();

      members = (membersData || [])
        .map((m) => {
          const authUser = authUsers?.users?.find((a) => a.id === m.id);
          return {
            ...m,
            is_org_admin: adminByUserId.get(m.id) === true,
            email: authUser?.email || null,
          };
        })
        .sort((a, b) => {
          if (a.is_org_admin !== b.is_org_admin) return a.is_org_admin ? -1 : 1;
          return String(a.created_at).localeCompare(String(b.created_at));
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

    const publicOrganization = presentOrganizationRow(
      organization as Record<string, unknown>,
    );

    return NextResponse.json({
      organization: publicOrganization,
      backends: publicOrganization.backends,
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
    async function uniqueSlug(allowId?: string | null) {
      let next = baseSlug;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const { data: existing } = await adminClient
          .from("organizations")
          .select("id")
          .eq("slug", next)
          .maybeSingle();
        if (!existing || (allowId && existing.id === allowId)) return next;
        next = `${baseSlug}-${attempt + 1}`;
      }
      return `${baseSlug}-${Date.now().toString(36)}`;
    }

    // Promote existing personal org (sole member) to named team org
    if (profile.organization_id) {
      const { data: currentOrg } = await adminClient
        .from("organizations")
        .select("id, kind")
        .eq("id", profile.organization_id)
        .single();
      const memberIds = await listOrganizationMemberIds(
        adminClient,
        profile.organization_id,
      );
      const memberCount = memberIds.length;

      if (
        currentOrg &&
        (currentOrg.kind === "personal" || memberCount <= 1) &&
        profile.is_org_admin
      ) {
        const slug = await uniqueSlug(profile.organization_id);
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

        await upsertOrganizationMembership(adminClient, user.id, organization.id, true);

        await adminClient
          .from("agent_api_keys")
          .update({ organization_id: organization.id })
          .eq("user_id", user.id)
          .is("organization_id", null);

        return NextResponse.json({ organization: presentOrganizationRow(finalOrg as Record<string, unknown>), is_org_admin: true, promoted: true }, { status: 200 });
      }
    }

    // Create another team org (or the first, if the user has none yet)
    const billing = await resolveUserBilling(adminClient, user.id);
    const orgPlan =
      !("error" in billing) && billing.entity.source === "organization"
        ? billing.entity.plan
        : "inactive";

    const slug = await uniqueSlug();
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

    await upsertOrganizationMembership(adminClient, user.id, organization.id, true);

    await adminClient
      .from("agent_api_keys")
      .update({ organization_id: organization.id })
      .eq("user_id", user.id)
      .is("organization_id", null);

    return NextResponse.json({ organization: presentOrganizationRow(finalOrg as Record<string, unknown>), is_org_admin: true }, { status: 201 });
  } catch (error) {
    console.error("Create organization error:", error);
    return jsonError(500, "Internal server error");
  }
}
