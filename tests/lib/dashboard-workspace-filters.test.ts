import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_WORKSPACE_LIST_FILTERS,
  isDashboardWorkspaceListFilter,
  workspaceMatchesDashboardListFilter,
} from "@/lib/dashboard-workspace-filters";

const root = join(__dirname, "../..");

describe("workspaceMatchesDashboardListFilter", () => {
  const publicAycl = { is_public: true, is_all_you_can_learn: true };
  const publicPlain = { is_public: true, is_all_you_can_learn: false };
  const privateAycl = { is_public: false, is_all_you_can_learn: true };
  const privatePlain = { is_public: false, is_all_you_can_learn: false };

  it("all keeps every workspace", () => {
    for (const row of [publicAycl, publicPlain, privateAycl, privatePlain]) {
      expect(workspaceMatchesDashboardListFilter(row, "all")).toBe(true);
    }
  });

  it("public keeps public workspaces including AYCL listings", () => {
    expect(workspaceMatchesDashboardListFilter(publicAycl, "public")).toBe(true);
    expect(workspaceMatchesDashboardListFilter(publicPlain, "public")).toBe(true);
    expect(workspaceMatchesDashboardListFilter(privateAycl, "public")).toBe(false);
    expect(workspaceMatchesDashboardListFilter(privatePlain, "public")).toBe(false);
  });

  it("private keeps non-public workspaces including private AYCL listings", () => {
    expect(workspaceMatchesDashboardListFilter(privateAycl, "private")).toBe(true);
    expect(workspaceMatchesDashboardListFilter(privatePlain, "private")).toBe(true);
    expect(workspaceMatchesDashboardListFilter(publicAycl, "private")).toBe(false);
  });

  it("aycl keeps listed workspaces regardless of public/private", () => {
    expect(workspaceMatchesDashboardListFilter(publicAycl, "aycl")).toBe(true);
    expect(workspaceMatchesDashboardListFilter(privateAycl, "aycl")).toBe(true);
    expect(workspaceMatchesDashboardListFilter(publicPlain, "aycl")).toBe(false);
    expect(workspaceMatchesDashboardListFilter(privatePlain, "aycl")).toBe(false);
  });

  it("treats missing AYCL flag as not listed", () => {
    expect(workspaceMatchesDashboardListFilter({ is_public: true }, "aycl")).toBe(false);
  });
});

describe("isDashboardWorkspaceListFilter", () => {
  it("accepts the dashboard list filter values", () => {
    expect(DASHBOARD_WORKSPACE_LIST_FILTERS).toEqual(["all", "public", "private", "aycl"]);
    expect(isDashboardWorkspaceListFilter("aycl")).toBe(true);
    expect(isDashboardWorkspaceListFilter("group")).toBe(false);
  });
});

describe("dashboard AYCL filter surface", () => {
  it("wires the AYCL option into the workspace list filter", () => {
    const dashSrc = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
    expect(dashSrc).toContain('value="aycl"');
    expect(dashSrc).toContain("workspaceMatchesDashboardListFilter");
    expect(dashSrc).toContain("isDashboardWorkspaceListFilter");
  });
});
