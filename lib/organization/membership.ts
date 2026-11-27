export const PLATFORM_ORG_ADMIN_EMAIL = "uncertainsystems@gmail.com";

/** Dashboard tabs refetch Protocols and Knowledge Regions on this event. */
export const ORGANIZATION_SWITCHED_EVENT = "openlesson:organization-switched";

export type OrganizationMembership = {
  organizationId: string;
  name: string;
  slug: string;
  kind: string | null;
  isOrgAdmin: boolean;
  isActive: boolean;
};

export function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Platform admins and the Uncertain Systems operator can switch into every org. */
export function canListAllOrganizations(input: {
  isAdmin?: boolean | null;
  email?: string | null;
}): boolean {
  if (input.isAdmin === true) return true;
  return normalizeEmail(input.email) === PLATFORM_ORG_ADMIN_EMAIL;
}

/** True when demoting or removing `memberId` would leave zero org admins. */
export function wouldLeaveOrganizationWithoutAdmin(
  members: Array<{ userId: string; isOrgAdmin: boolean }>,
  memberId: string,
): boolean {
  const id = String(memberId || "").trim();
  if (!id) return true;
  return !members.some((row) => row.isOrgAdmin && row.userId !== id);
}

/** Parse PATCH body for org-admin vs member. */
export function parseOrganizationMemberAdminFlag(body: {
  is_org_admin?: unknown;
  isOrgAdmin?: unknown;
  role?: unknown;
}): boolean | null {
  if (typeof body.is_org_admin === "boolean") return body.is_org_admin;
  if (typeof body.isOrgAdmin === "boolean") return body.isOrgAdmin;
  const role = String(body.role ?? "").trim().toLowerCase();
  if (role === "admin") return true;
  if (role === "member") return false;
  return null;
}

export function isMissingOrganizationMembersTable(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    msg.includes("organization_members") &&
    (msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("could not find") ||
      msg.includes("relation"))
  );
}

export function isMissingOrganizationIdColumn(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  if (!msg.includes("organization_id")) return false;
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find") ||
    msg.includes("column")
  );
}

export function sortOrganizationMemberships(
  memberships: OrganizationMembership[],
): OrganizationMembership[] {
  return [...memberships].sort((a, b) => {
    const name = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (name !== 0) return name;
    return a.organizationId.localeCompare(b.organizationId);
  });
}

/** Max orgs shown in the dashboard switcher list at once. */
export const ORGANIZATION_SWITCHER_VISIBLE_LIMIT = 8;

export function organizationMembershipMatchesQuery(
  org: Pick<OrganizationMembership, "name" | "slug">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q);
}

export function visibleOrganizationMemberships(
  organizations: OrganizationMembership[],
  query: string,
  options?: { limit?: number; activeId?: string },
): { items: OrganizationMembership[]; total: number; truncated: boolean } {
  const limit = Math.max(1, options?.limit ?? ORGANIZATION_SWITCHER_VISIBLE_LIMIT);
  const matched = organizations.filter((org) =>
    organizationMembershipMatchesQuery(org, query),
  );
  const activeId = String(options?.activeId || "").trim();
  const ranked =
    !query.trim() && activeId
      ? [
          ...matched.filter((org) => org.organizationId === activeId),
          ...matched.filter((org) => org.organizationId !== activeId),
        ]
      : matched;
  return {
    items: ranked.slice(0, limit),
    total: matched.length,
    truncated: matched.length > limit,
  };
}
