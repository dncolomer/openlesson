import { describe, expect, it } from "vitest";
import { readRepo } from "../helpers/surface-source";
import {
  ORGANIZATION_SWITCHED_EVENT,
  PLATFORM_ORG_ADMIN_EMAIL,
  canListAllOrganizations,
  isMissingOrganizationIdColumn,
  isMissingOrganizationMembersTable,
  sortOrganizationMemberships,
} from "@/lib/organization/membership";

describe("organization membership", () => {
  it("gives uncertainsystems@gmail.com and platform admins every organization", () => {
    expect(PLATFORM_ORG_ADMIN_EMAIL).toBe("uncertainsystems@gmail.com");
    expect(
      canListAllOrganizations({ email: "uncertainsystems@gmail.com" }),
    ).toBe(true);
    expect(
      canListAllOrganizations({ email: "  UncertainSystems@gmail.com " }),
    ).toBe(true);
    expect(canListAllOrganizations({ isAdmin: true, email: "other@example.com" })).toBe(
      true,
    );
    expect(canListAllOrganizations({ email: "member@example.com" })).toBe(false);
    expect(canListAllOrganizations({ isAdmin: false, email: null })).toBe(false);
  });

  it("detects a missing organization_members relation", () => {
    expect(isMissingOrganizationMembersTable(null)).toBe(false);
    expect(isMissingOrganizationMembersTable({ code: "42P01" })).toBe(true);
    expect(isMissingOrganizationMembersTable({ code: "PGRST205" })).toBe(true);
    expect(
      isMissingOrganizationMembersTable({
        message: "Could not find the table 'public.organization_members' in the schema cache",
      }),
    ).toBe(true);
  });

  it("sorts memberships by name then id", () => {
    const sorted = sortOrganizationMemberships([
      {
        organizationId: "b",
        name: "Zeta",
        slug: "zeta",
        kind: "team",
        isOrgAdmin: false,
        isActive: false,
      },
      {
        organizationId: "a",
        name: "Alpha",
        slug: "alpha",
        kind: "personal",
        isOrgAdmin: true,
        isActive: true,
      },
    ]);
    expect(sorted.map((item) => item.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("keeps prior orgs when accepting an invite and lists members from memberships", () => {
    const accept = readRepo("lib/organization/accept-invite.ts");
    expect(accept).toContain("upsertOrganizationMembership");
    expect(accept).not.toContain("archived_at");
    expect(accept).not.toContain("organization_id: null");

    const rpc = readRepo("supabase/migrations/20261126140000_organization_members.sql");
    expect(rpc).toContain("CREATE TABLE IF NOT EXISTS public.organization_members");
    expect(rpc).toContain("ON CONFLICT (user_id, organization_id) DO NOTHING");
    expect(rpc).toContain("already_member");
    expect(rpc).not.toContain("AND kind = 'personal'");

    const orgRoute = readRepo("app/api/organization/route.ts");
    expect(orgRoute).toContain("listOrganizationMemberRows");
    expect(orgRoute).not.toContain(
      "You already belong to a multi-member organization. Leave it before creating another.",
    );

    const members = readRepo("app/api/organization/members/route.ts");
    expect(members).toContain("removeOrganizationMembership");
    expect(members).toContain("listOrganizationMemberRows");

    const membershipsApi = readRepo("app/api/organization/memberships/route.ts");
    expect(membershipsApi).toContain("listOrganizationMemberships");
    expect(membershipsApi).toContain("canListAllOrganizations");

    const switchApi = readRepo("app/api/organization/switch/route.ts");
    expect(switchApi).toContain("switchActiveOrganization");

    const sidebar = readRepo("components/dashboard/dashboard-sidebar.tsx");
    expect(sidebar).toContain("ORGANIZATION_SWITCHED_EVENT");
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).toContain(
      "ORGANIZATION_SWITCHED_EVENT",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "ORGANIZATION_SWITCHED_EVENT",
    );
    expect(readRepo("components/OrganizationDashboardTab.tsx")).toContain(
      "ORGANIZATION_SWITCHED_EVENT",
    );
    expect(ORGANIZATION_SWITCHED_EVENT).toBe("openlesson:organization-switched");

    const protocolOrg = readRepo(
      "supabase/migrations/20261126150000_protocol_organization.sql",
    );
    expect(protocolOrg).toContain("verify_flows");
    expect(protocolOrg).toContain("knowledge_regions");
    expect(protocolOrg).toContain("ADD COLUMN IF NOT EXISTS organization_id");

    expect(isMissingOrganizationIdColumn({ message: "column organization_id does not exist" })).toBe(
      true,
    );
    expect(isMissingOrganizationIdColumn({ message: "owner_user_id missing" })).toBe(false);

    const protocols = readRepo("app/api/dashboard/protocols/route.ts");
    expect(protocols).toContain("listVerificationFlowsForDashboard");
    expect(protocols).toContain("loadActiveOrganizationId");
    expect(readRepo("app/api/dashboard/knowledge-regions/route.ts")).toContain(
      "loadActiveOrganizationId",
    );
    expect(readRepo("lib/region-simulation-run.ts")).toContain("organization_id");
  });
});
