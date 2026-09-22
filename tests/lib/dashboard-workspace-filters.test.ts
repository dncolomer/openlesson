import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_WORKSPACE_LIST_FILTERS,
  dashboardHasNoWorkspaces,
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

describe("dashboard empty workspace CTA", () => {
  it("treats an empty list as first-run, not a filter miss", () => {
    expect(dashboardHasNoWorkspaces([])).toBe(true);
    expect(dashboardHasNoWorkspaces(null)).toBe(true);
    expect(dashboardHasNoWorkspaces([{ id: "w1" }])).toBe(false);
  });

  it("renders a first-run create CTA instead of search/filter chrome", () => {
    const dashSrc = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
    expect(dashSrc).toContain("dashboardHasNoWorkspaces");
    expect(dashSrc).toContain("data-dashboard-empty-workspaces");
    expect(dashSrc).toContain("data-dashboard-empty-create");
    expect(dashSrc).toContain('href="/workspace/new"');
    expect(dashSrc).toContain("dashboard.emptyWorkspacesTitle");
    expect(dashSrc).toContain("dashboard.emptyWorkspacesCta");
    const emptyIdx = dashSrc.indexOf("data-dashboard-empty-workspaces");
    const filterIdx = dashSrc.indexOf("data-workspace-visibility-filter");
    expect(emptyIdx).toBeGreaterThan(0);
    expect(filterIdx).toBeGreaterThan(emptyIdx);
  });
});
