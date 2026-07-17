import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { buildTierUpdate, isAdminTier, type AdminTierId } from "@/lib/admin/tiers";
import {
  ensureOrgXaiApiKey,
  ensureOrgXaiCollection,
} from "@/lib/organization/ensure-xai-resources";

export const runtime = "nodejs";

// GET /api/admin/organizations - List all organizations
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data: organizations, error } = await adminClient
      .from("organizations")
      .select(
        "id, name, slug, kind, billing_mode, plan, subscription_status, current_period_end, extra_lessons, billing_email, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status, xai_collection_id, xai_collection_status, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching organizations:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    const orgIds = (organizations || []).map((o) => o.id);

    const { data: members } =
      orgIds.length > 0
        ? await adminClient.from("profiles").select("organization_id").in("organization_id", orgIds)
        : { data: [] };

    const memberCounts: Record<string, number> = {};
    (members || []).forEach((m) => {
      if (m.organization_id) {
        memberCounts[m.organization_id] = (memberCounts[m.organization_id] || 0) + 1;
      }
    });

    const { data: invites } =
      orgIds.length > 0
        ? await adminClient
            .from("organization_invites")
            .select("organization_id")
            .in("organization_id", orgIds)
            .is("used_by", null)
        : { data: [] };

    const inviteCounts: Record<string, number> = {};
    (invites || []).forEach((i) => {
      if (i.organization_id) {
        inviteCounts[i.organization_id] = (inviteCounts[i.organization_id] || 0) + 1;
      }
    });

    const enrichedOrganizations = (organizations || []).map((org) => ({
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

// POST /api/admin/organizations - Create a new organization (optionally partner + tier)
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const {
      name,
      slug,
      kind = "team",
      billing_mode = "subscription",
      plan: planInput,
      extra_lessons,
      billing_email,
      admin_email,
      admin_user_id,
      provision_xai = true,
    } = body as {
      name?: string;
      slug?: string;
      kind?: string;
      billing_mode?: string;
      plan?: string;
      extra_lessons?: number;
      billing_email?: string;
      admin_email?: string;
      admin_user_id?: string;
      provision_xai?: boolean;
    };

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        error: "Slug must be lowercase and contain only letters, numbers, and hyphens",
      }, { status: 400 });
    }

    if (!["personal", "team", "partner"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    if (!["subscription", "partner"].includes(billing_mode)) {
      return NextResponse.json({ error: "Invalid billing_mode" }, { status: 400 });
    }

    const { data: existing } = await adminClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 400 }
      );
    }

    const tier: AdminTierId =
      planInput && isAdminTier(planInput) ? planInput : "inactive";
    const tierPatch = buildTierUpdate(tier);

    // Partner mode: keep plan from tier but force active-like product grant without Stripe
    const insertRow: Record<string, unknown> = {
      name,
      slug,
      kind,
      billing_mode,
      plan: tierPatch.plan,
      subscription_status:
        billing_mode === "partner" && tier !== "inactive"
          ? "active"
          : tierPatch.subscription_status,
      current_period_end:
        billing_mode === "partner" && tier !== "inactive"
          ? null
          : tierPatch.current_period_end,
      extra_lessons:
        typeof extra_lessons === "number" && extra_lessons >= 0
          ? extra_lessons
          : tierPatch.extra_lessons,
      billing_email: billing_email || null,
    };

    const { data: organization, error } = await adminClient
      .from("organizations")
      .insert(insertRow)
      .select()
      .single();

    if (error || !organization) {
      console.error("Error creating organization:", error);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    // Optional: attach org admin by user id or email
    let attachedAdminUserId: string | null = null;
    if (admin_user_id) {
      attachedAdminUserId = admin_user_id;
    } else if (admin_email) {
      const { data: authUsers } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const match = authUsers?.users?.find(
        (u) => u.email?.toLowerCase() === admin_email.toLowerCase()
      );
      if (match) {
        attachedAdminUserId = match.id;
      }
    }

    if (attachedAdminUserId) {
      // Ensure they leave any previous org cleanly is handled by overwrite
      await adminClient
        .from("profiles")
        .update({ organization_id: organization.id, is_org_admin: true })
        .eq("id", attachedAdminUserId);
    }

    if (provision_xai) {
      // Eager provision for partner/team orgs (best-effort)
      await ensureOrgXaiApiKey(adminClient, organization.id).catch((err) => {
        console.error("Eager xAI key provision failed:", err);
      });
      await ensureOrgXaiCollection(adminClient, organization.id).catch((err) => {
        console.error("Eager xAI collection provision failed:", err);
      });
    }

    const { data: refreshed } = await adminClient
      .from("organizations")
      .select(
        "id, name, slug, metadata, kind, billing_mode, plan, subscription_status, current_period_end, extra_lessons, stripe_customer_id, stripe_subscription_id, billing_email, archived_at, xai_api_key_id, xai_api_key_name, xai_api_key_status, xai_api_key_error, xai_collection_id, xai_collection_name, xai_collection_status, xai_collection_error, created_at, updated_at"
      )
      .eq("id", organization.id)
      .single();

    return NextResponse.json({ organization: refreshed || organization });
  } catch (error) {
    console.error("Admin create organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
