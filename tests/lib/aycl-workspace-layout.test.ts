import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  AYCL_WORKSPACE_LOCAL_TABS,
  ayclWorkspaceLocalTabs,
  availableWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";

const REPO_ROOT = path.resolve(__dirname, "../..");

/**
 * AYCL token holders are owner-equivalent for their purchased workspace.
 * Section visibility and layout mapping must match the main shell mapper.
 */
describe("AYCL section layout mapping (shared helper)", () => {
  it("Workspace section keeps block-map chrome and has no local tabs", () => {
    const layout = resolveWorkspaceSectionLayout("workspace");
    expect(layout.showBlockMapChrome).toBe(true);
    expect(layout.showSessionsColumn).toBe(true);
    expect(layout.mountsPerformancePanel).toBe(false);
    expect(layout.localTabs).toEqual([]);
    expect(layout.localTabs).not.toContain("performance");
    expect(layout.localTabs).not.toContain("integration");
  });

  it("Knowledge section mounts performance panel without block-map chrome", () => {
    const layout = resolveWorkspaceSectionLayout("knowledge");
    expect(layout.mountsPerformancePanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.showSessionsColumn).toBe(false);
    expect(layout.mountsIntegrationPanel).toBe(false);
  });

  it("Knowledge and Settings are available for AYCL owner-equivalent sessions", () => {
    expect(availableWorkspaceSections({ isOwner: true })).toEqual([
      "workspace",
      "context",
      "knowledge",
      "settings",
    ]);
    expect(resolveActiveSection("settings", { isOwner: true })).toBe("settings");
    expect(resolveActiveSection("knowledge", { isOwner: true })).toBe("knowledge");
    // Non-owners keep Context; lose privileged Knowledge/Settings
    expect(availableWorkspaceSections({ isOwner: false })).toEqual(["workspace", "context"]);
    expect(resolveActiveSection("knowledge", { isOwner: false })).toBe("workspace");
    const layout = resolveWorkspaceSectionLayout("settings");
    expect(layout.mountsIntegrationPanel).toBe(true);
    expect(layout.showBlockMapChrome).toBe(false);
  });

  it("AYCL local tabs are empty (combined notes surface, no tab bar)", () => {
    expect(ayclWorkspaceLocalTabs()).toEqual([]);
    expect(AYCL_WORKSPACE_LOCAL_TABS).toEqual([]);
    expect(AYCL_WORKSPACE_LOCAL_TABS).not.toContain("performance");
    expect(AYCL_WORKSPACE_LOCAL_TABS).not.toContain("files");
    expect(AYCL_WORKSPACE_LOCAL_TABS).not.toContain("graph");
  });
});

describe("AyclWorkspaceView section shell wiring", () => {
  const ayclSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/AyclWorkspaceView.tsx"),
    "utf8",
  );

  it("uses shared section mapper and top-level section nav", () => {
    expect(ayclSource).toContain('from "@/lib/workspace-sections"');
    expect(ayclSource).toContain("resolveWorkspaceSectionLayout");
    expect(ayclSource).toContain("resolveActiveSection");
    expect(ayclSource).toContain("availableWorkspaceSections");
    expect(ayclSource).toContain("WorkspaceSectionNav");
    expect(ayclSource).toContain('t("planView.sectionWorkspace")');
    expect(ayclSource).toContain('t("planView.sectionKnowledge")');
    expect(ayclSource).toContain('t("planView.sectionSetting")');
    expect(ayclSource).toContain('visibleSections.includes("knowledge")');
    expect(ayclSource).toContain('visibleSections.includes("settings")');
  });

  it("does not mount builder chat or local tab bar", () => {
    expect(ayclSource).not.toContain("WorkspaceChat");
    expect(ayclSource).not.toContain("WorkspaceTabBar");
    expect(ayclSource).not.toContain("activeTab");
    expect(ayclSource).not.toMatch(/key:\s*"performance"\s+as\s+const/);
    expect(ayclSource).not.toMatch(/key:\s*"graph"\s+as\s+const/);
    expect(ayclSource).not.toMatch(/key:\s*"notes"\s+as\s+const/);
  });

  it("mounts Knowledge performance panel without SessionList/WorkspaceChat in that branch", () => {
    expect(ayclSource).toContain("sectionLayout.mountsPerformancePanel");
    expect(ayclSource).toContain("<WorkspacePerformancePanel");
    expect(ayclSource).toContain("hideTap");
    expect(ayclSource).toContain("ayclToken={accessToken}");
    expect(ayclSource).toContain("sectionLayout.showBlockMapChrome");
    expect(ayclSource).toContain("<SessionList");
    expect(ayclSource).toContain("WorkspaceContextPanel");
    expect(ayclSource.indexOf("sectionLayout.mountsPerformancePanel")).toBeLessThan(
      ayclSource.indexOf("sectionLayout.showBlockMapChrome"),
    );
  });

  it("mounts Setting integration panel for owner-parity and preserves AYCL header", () => {
    expect(ayclSource).toContain("sectionLayout.mountsIntegrationPanel");
    expect(ayclSource).toContain("<WorkspaceIntegrationPanel");
    expect(ayclSource).toContain("Copy access link");
    expect(ayclSource).toContain("All-You-Can-Learn");
    expect(ayclSource).toContain("Lifetime access");
    expect(ayclSource).toContain("Open-ended only");
  });
});
