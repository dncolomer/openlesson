import { describe, expect, it } from "vitest";
import { readRepo } from "../helpers/surface-source";
import {
  ORGANIZATION_ID_HEADER,
  ORGANIZATION_ID_REQUIRED_MESSAGE,
  parseOrganizationIdFromRecord,
  parseOrganizationIdFromSearchParams,
  parseOrganizationIdValue,
} from "@/lib/organization/request-organization";
import { ACTIVE_ORGANIZATION_STORAGE_KEY } from "@/lib/organization/active-organization-client";
import { jobMatchesOrganization } from "@/lib/region-simulation-jobs";
import type { RegionSimulationJobRow } from "@/lib/region-simulation-jobs";

describe("organization request targeting", () => {
  it("parses organization_id aliases", () => {
    expect(parseOrganizationIdValue(" org-1 ")).toBe("org-1");
    expect(parseOrganizationIdValue("")).toBeNull();
    expect(
      parseOrganizationIdFromRecord({ organizationId: "org-a", organization_id: "org-b" }),
    ).toBe("org-b");
    expect(parseOrganizationIdFromRecord({ organizationId: "org-a" })).toBe("org-a");
    const params = new URLSearchParams("organizationId=org-q");
    expect(parseOrganizationIdFromSearchParams(params)).toBe("org-q");
    expect(ORGANIZATION_ID_HEADER).toBe("x-organization-id");
    expect(ORGANIZATION_ID_REQUIRED_MESSAGE).toBe("organization_id is required");
  });

  it("requires organization_id on public protocol and knowledge-region APIs", () => {
    const protocolList = readRepo("app/api/v3/protocols/route.ts");
    expect(protocolList).toContain("requireAgentRequestOrganization");
    expect(readRepo("app/api/v3/protocols/[protocolId]/route.ts")).toContain(
      "requireAgentRequestOrganization",
    );
    expect(readRepo("app/api/v3/knowledge-regions/route.ts")).toContain(
      "requireAgentRequestOrganization",
    );
    expect(readRepo("app/api/v3/protocol-settings/route.ts")).toContain(
      "requireAgentRequestOrganization",
    );
    expect(readRepo("app/api/v3/knowledge-regions/options/route.ts")).toContain(
      "requireAgentRequestOrganization",
    );
    expect(readRepo("app/api/v3/knowledge-regions/jobs/[jobId]/route.ts")).toContain(
      "requireAgentRequestOrganization",
    );
    expect(readRepo("app/api/v3/knowledge-regions/[id]/simulation/route.ts")).toContain(
      "requireAgentRequestOrganization",
    );
    expect(readRepo("lib/pow-api/mcp-tools/dispatch.ts")).toContain("requireToolOrganizationId");
    expect(readRepo("lib/pow-api/mcp-tools/evidence-tools.ts")).toContain(
      "withOrganizationIdSchema",
    );
    expect(readRepo("lib/api/error-codes.ts")).toContain("organization_id_required");
  });

  it("dashboard protocol and region lists honor request org then active org", () => {
    expect(readRepo("app/api/dashboard/protocols/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/knowledge-regions/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/region-simulation/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/recent-protocols/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(
      readRepo("app/api/dashboard/knowledge-regions/[id]/simulation/route.ts"),
    ).toContain("resolveDashboardOrganizationId");
    expect(
      readRepo("app/api/dashboard/knowledge-regions/[id]/uncertainty-model/route.ts"),
    ).toContain("resolveDashboardOrganizationId");
    expect(readRepo("app/api/dashboard/knowledge-regions/run/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/region-simulation/jobs/[id]/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/api-keys/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/protocols/files/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("app/api/dashboard/protocols/unsys-seed/route.ts")).toContain(
      "resolveDashboardOrganizationId",
    );
    expect(readRepo("lib/region-simulation-jobs.ts")).toContain("jobMatchesOrganization");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "dispatchOrganizationSwitched",
    );
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).toContain(
      "withOrganizationId",
    );
    expect(ACTIVE_ORGANIZATION_STORAGE_KEY).toBe("openlesson.activeOrganizationId");
  });

  it("matches simulation jobs to the requested organization", () => {
    const job = {
      owner_user_id: "owner-1",
      plan: { organizationId: "org-a" },
    } as RegionSimulationJobRow;
    expect(jobMatchesOrganization(job, { userId: "other", organizationId: "org-a" })).toBe(
      true,
    );
    expect(jobMatchesOrganization(job, { userId: "other", organizationId: "org-b" })).toBe(
      false,
    );
    expect(jobMatchesOrganization(job, { userId: "owner-1", organizationId: null })).toBe(
      true,
    );
  });
});
