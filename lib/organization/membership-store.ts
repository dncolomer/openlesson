import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canListAllOrganizations,
  isMissingOrganizationMembersTable,
  sortOrganizationMemberships,
  type OrganizationMembership,
} from "@/lib/organization/membership";

type OrgListRow = {
  id: string;
  name: string | null;
  slug: string | null;
  kind: string | null;
  archived_at?: string | null;
};

const ORG_MEMBERSHIP_SELECT = "id, name, slug, kind, archived_at";

function presentMembership(
  org: OrgListRow,
  options: { isOrgAdmin: boolean; isActive: boolean },
): OrganizationMembership {
  return {
    organizationId: org.id,
    name: org.name?.trim() || "Organization",
    slug: org.slug || "",
    kind: org.kind ?? null,
    isOrgAdmin: options.isOrgAdmin,
    isActive: options.isActive,
  };
}

export async function upsertOrganizationMembership(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
  isOrgAdmin: boolean,
): Promise<void> {
  const { error } = await admin.from("organization_members").upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      is_org_admin: isOrgAdmin,
    },
    { onConflict: "user_id,organization_id" },
  );
  if (error && !isMissingOrganizationMembersTable(error)) {
    throw new Error(error.message || "Failed to save organization membership");
  }
}

export async function listOrganizationMemberRows(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Array<{ userId: string; isOrgAdmin: boolean }>> {
  const { data, error } = await admin
    .from("organization_members")
    .select("user_id, is_org_admin")
    .eq("organization_id", organizationId);

  if (!error) {
    return (data || []).map((row) => ({
      userId: String(row.user_id),
      isOrgAdmin: row.is_org_admin === true,
    }));
  }

  if (!isMissingOrganizationMembersTable(error)) {
    console.error("[organization-members] list members failed:", error);
    return [];
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, is_org_admin")
    .eq("organization_id", organizationId);
  return (profiles || []).map((row) => ({
    userId: String(row.id),
    isOrgAdmin: row.is_org_admin === true,
  }));
}

export async function listOrganizationMemberIds(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const rows = await listOrganizationMemberRows(admin, organizationId);
  return rows.map((row) => row.userId);
}

async function loadMembershipRow(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<{ isOrgAdmin: boolean } | null> {
  const { data, error } = await admin
    .from("organization_members")
    .select("is_org_admin")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!error && data) return { isOrgAdmin: data.is_org_admin === true };
  if (error && !isMissingOrganizationMembersTable(error)) {
    console.error("[organization-members] load membership failed:", error);
  }
  return null;
}

export async function listOrganizationMemberships(
  admin: SupabaseClient,
  userId: string,
  options?: { email?: string | null },
): Promise<OrganizationMembership[]> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, is_org_admin, is_admin")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Profile not found");
  }

  const activeId = (profile.organization_id as string | null) || null;
  const listAll = canListAllOrganizations({
    isAdmin: profile.is_admin === true,
    email: options?.email,
  });

  if (listAll) {
    const { data: orgs, error } = await admin
      .from("organizations")
      .select(ORG_MEMBERSHIP_SELECT)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message || "Failed to list organizations");
    const memberships = (orgs || [])
      .filter((org) => !org.archived_at || org.id === activeId)
      .map((org) =>
        presentMembership(org as OrgListRow, {
          isOrgAdmin: true,
          isActive: org.id === activeId,
        }),
      );
    return sortOrganizationMemberships(memberships);
  }

  const { data: rows, error } = await admin
    .from("organization_members")
    .select("organization_id, is_org_admin, organizations(id, name, slug, kind, archived_at)")
    .eq("user_id", userId);

  if (error && isMissingOrganizationMembersTable(error)) {
    if (!activeId) return [];
    const { data: org } = await admin
      .from("organizations")
      .select(ORG_MEMBERSHIP_SELECT)
      .eq("id", activeId)
      .maybeSingle();
    if (!org) return [];
    return [
      presentMembership(org as OrgListRow, {
        isOrgAdmin: profile.is_org_admin === true,
        isActive: true,
      }),
    ];
  }

  if (error) throw new Error(error.message || "Failed to list organization memberships");

  const memberships: OrganizationMembership[] = [];
  for (const row of rows || []) {
    const nested = row.organizations as OrgListRow | OrgListRow[] | null;
    const org = Array.isArray(nested) ? nested[0] : nested;
    if (!org?.id) continue;
    if (org.archived_at && org.id !== activeId) continue;
    memberships.push(
      presentMembership(org, {
        isOrgAdmin: row.is_org_admin === true,
        isActive: org.id === activeId,
      }),
    );
  }

  if (activeId && !memberships.some((item) => item.organizationId === activeId)) {
    const { data: org } = await admin
      .from("organizations")
      .select(ORG_MEMBERSHIP_SELECT)
      .eq("id", activeId)
      .maybeSingle();
    if (org) {
      memberships.push(
        presentMembership(org as OrgListRow, {
          isOrgAdmin: profile.is_org_admin === true,
          isActive: true,
        }),
      );
    }
  }

  return sortOrganizationMemberships(memberships);
}

export async function switchActiveOrganization(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
  options?: { email?: string | null },
): Promise<{ organizationId: string; isOrgAdmin: boolean }> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, is_admin")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Profile not found");
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, archived_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError || !org) {
    const err = new Error("Organization not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const listAll = canListAllOrganizations({
    isAdmin: profile.is_admin === true,
    email: options?.email,
  });
  const membership = await loadMembershipRow(admin, userId, organizationId);

  if (!listAll && !membership) {
    if (profile.organization_id === organizationId) {
      const { data: current } = await admin
        .from("profiles")
        .select("is_org_admin")
        .eq("id", userId)
        .single();
      return {
        organizationId,
        isOrgAdmin: current?.is_org_admin === true,
      };
    }
    const err = new Error("You do not belong to that organization");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  const isOrgAdmin = listAll ? true : membership?.isOrgAdmin === true;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ organization_id: organizationId, is_org_admin: isOrgAdmin })
    .eq("id", userId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to switch organization");
  }

  return { organizationId, isOrgAdmin };
}

export async function removeOrganizationMembership(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  if (error && !isMissingOrganizationMembersTable(error)) {
    throw new Error(error.message || "Failed to remove organization membership");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.organization_id !== organizationId) return;

  const { data: remaining, error: remainingError } = await admin
    .from("organization_members")
    .select("organization_id, is_org_admin")
    .eq("user_id", userId)
    .limit(1);

  if (remainingError && isMissingOrganizationMembersTable(remainingError)) {
    await admin
      .from("profiles")
      .update({ organization_id: null, is_org_admin: false })
      .eq("id", userId);
    return;
  }

  const next = remaining?.[0];
  if (next?.organization_id) {
    await admin
      .from("profiles")
      .update({
        organization_id: next.organization_id,
        is_org_admin: next.is_org_admin === true,
      })
      .eq("id", userId);
    return;
  }

  await admin
    .from("profiles")
    .update({ organization_id: null, is_org_admin: false })
    .eq("id", userId);
}
