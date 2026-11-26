export const PLATFORM_ORG_ADMIN_EMAIL = "uncertainsystems@gmail.com";

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

export function sortOrganizationMemberships(
  memberships: OrganizationMembership[],
): OrganizationMembership[] {
  return [...memberships].sort((a, b) => {
    const name = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (name !== 0) return name;
    return a.organizationId.localeCompare(b.organizationId);
  });
}
