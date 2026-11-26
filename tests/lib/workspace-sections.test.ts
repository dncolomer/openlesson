import { describe, expect, it } from "vitest";
import {
  WORKSPACE_LOCAL_TABS,
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  defaultWorkspaceSection,
  isWorkspaceLocalTab,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
  withLearningInsightsSection,
} from "@/lib/workspace-sections";

describe("resolveWorkspaceSectionLayout", () => {
  it("maps Workspace section without local tabs (map-first; notes under Context)", () => {
    const layout = resolveWorkspaceSectionLayout("workspace");

    expect(layout.mainSurface).toBe("workspace-local");
    expect(layout.showBlockMapChrome).toBe(true);
    expect(layout.showSessionsColumn).toBe(true);
    expect(layout.mountsContextPanel).toBe(false);
    expect(layout.localTabs).toEqual([]);
    expect(layout.localTabs).toEqual([...WORKSPACE_LOCAL_TABS]);
    expect(layout.localTabs).not.toContain("graph");
    expect(layout.localTabs).not.toContain("notes");
    expect(layout.localTabs).not.toContain("files");
    expect(layout.localTabs).not.toContain("performance");
    expect(layout.localTabs).not.toContain("integration");
    expect(layout.mountsPerformancePanel).toBe(false);
    expect(layout.mountsIntegrationPanel).toBe(false);
    expect(layout.mountsSimulationPanel).toBe(false);
  });

  it("maps Context section to notes/files surface without block-map chrome", () => {
    const layout = resolveWorkspaceSectionLayout("context");

    expect(layout.mainSurface).toBe("context");
    expect(layout.mountsContextPanel).toBe(true);
    expect(layout.mountsSimulationPanel).toBe(false);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.showSessionsColumn).toBe(false);
    expect(layout.mountsPerformancePanel).toBe(false);
    expect(layout.mountsIntegrationPanel).toBe(false);
  });

  it("does not offer a workspace Simulation section", () => {
    const layout = resolveWorkspaceSectionLayout("simulation");

    expect(layout.mountsSimulationPanel).toBe(false);
    expect(availableWorkspaceSections({ isOwner: true })).not.toContain("simulation");
    expect(availableWorkspaceSections({ isOwner: false })).not.toContain("simulation");
    expect(resolveActiveSection("simulation", { isOwner: true })).toBe("workspace");
    expect(resolveActiveSection("simulation", { isOwner: false })).toBe("workspace");
  });

  it("maps Knowledge section to the performance surface without block-map chrome", () => {
    const layout = resolveWorkspaceSectionLayout("knowledge");

    expect(layout.mainSurface).toBe("knowledge");
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.showSessionsColumn).toBe(false);
    expect(layout.mountsContextPanel).toBe(false);
    expect(layout.mountsSimulationPanel).toBe(false);
    expect(layout.localTabs).toEqual([]);
    expect(layout.mountsPerformancePanel).toBe(true);
    expect(layout.mountsIntegrationPanel).toBe(false);
  });

  it("does not expose a Data Studio workspace section", () => {
    expect(
      availableWorkspaceSections({ isOwner: true, workspaceKind: "knowledge_region" }),
    ).not.toContain("data_studio");
    expect(
      availableWorkspaceSections({ isOwner: true, workspaceKind: "calibration" }),
    ).not.toContain("data_studio");
    expect(availableWorkspaceSections({ isOwner: true })).not.toContain("data_studio");
  });

  it("maps Setting section to the integrations surface without block-map chrome", () => {
    const layout = resolveWorkspaceSectionLayout("settings");

    expect(layout.mainSurface).toBe("settings");
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.showSessionsColumn).toBe(false);
    expect(layout.localTabs).toEqual([]);
    expect(layout.mountsPerformancePanel).toBe(false);
    expect(layout.mountsIntegrationPanel).toBe(true);
    expect(layout.mountsSimulationPanel).toBe(false);
  });
});

describe("privileged Knowledge + Settings gating", () => {
  it("allows owners and org admins only", () => {
    expect(canAccessPrivilegedWorkspaceSections({ isOwner: true })).toBe(true);
    expect(canAccessPrivilegedWorkspaceSections({ isOrgAdmin: true })).toBe(true);
    expect(canAccessPrivilegedWorkspaceSections({ isOwner: true, isOrgAdmin: false })).toBe(true);
    expect(canAccessPrivilegedWorkspaceSections({ isOwner: false, isOrgAdmin: false })).toBe(false);
    expect(canAccessPrivilegedWorkspaceSections({})).toBe(false);
  });

  it("keeps settings for learning owners and drops knowledge", () => {
    expect(resolveActiveSection("settings", { isOwner: true })).toBe("settings");
    expect(resolveActiveSection("knowledge", { isOwner: true })).toBe("workspace");
  });

  it("keeps settings for org admins who are not owners", () => {
    expect(resolveActiveSection("settings", { isOwner: false, isOrgAdmin: true })).toBe("settings");
    expect(resolveActiveSection("knowledge", { isOwner: false, isOrgAdmin: true })).toBe("workspace");
  });

  it("falls back non-privileged callers from knowledge and settings to workspace", () => {
    expect(resolveActiveSection("settings", { isOwner: false })).toBe("workspace");
    expect(resolveActiveSection("knowledge", { isOwner: false })).toBe("workspace");
    expect(resolveActiveSection("settings", { isOwner: false, isOrgAdmin: false })).toBe("workspace");
    expect(resolveActiveSection("knowledge", { isOwner: false, isOrgAdmin: false })).toBe("workspace");
  });

  it("leaves workspace and simulation unchanged for all callers", () => {
    expect(resolveActiveSection("workspace", { isOwner: false })).toBe("workspace");
    expect(resolveActiveSection("workspace", { isOwner: true })).toBe("workspace");
    expect(resolveActiveSection("workspace", { isOrgAdmin: true })).toBe("workspace");
    expect(resolveActiveSection("simulation", { isOwner: false })).toBe("workspace");
    expect(resolveActiveSection("context", { isOwner: false })).toBe("workspace");
    expect(resolveActiveSection("context", { isOwner: true })).toBe("context");
  });
});

describe("availableWorkspaceSections", () => {
  it("includes Context then Simulation for everyone; Knowledge/Settings for owners or org admins; DAGs owner-only; Goals for privileged", () => {
    expect(availableWorkspaceSections({ isOwner: true })).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    expect(availableWorkspaceSections({ isOrgAdmin: true })).toEqual([
      "workspace",
      "context",
      "settings",
    ]);
    expect(availableWorkspaceSections({ isOwner: false, isOrgAdmin: false })).toEqual([
      "workspace",
    ]);
    expect(availableWorkspaceSections({})).toEqual(["workspace"]);
    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner.indexOf("dags")).toBe(owner.indexOf("workspace") + 1);
    expect(owner).not.toContain("simulation");
    expect(owner).toContain("dags");
    expect(availableWorkspaceSections({ isOrgAdmin: true })).not.toContain("dags");
    expect(
      availableWorkspaceSections({ isOwner: true, isLoggedIn: true }),
    ).toEqual([
      "workspace",
      "dags",
      "map_types",
      "unsys_models",
      "context",
      "settings",
    ]);
    expect(
      availableWorkspaceSections({ isOwner: false, isLoggedIn: true }),
    ).toEqual(["workspace"]);
    expect(resolveActiveSection("insights", { isLoggedIn: true })).toBe("workspace");
    expect(resolveActiveSection("insights", { isOwner: true })).toBe("workspace");
    expect(
      withLearningInsightsSection(["workspace", "settings"], { isLoggedIn: true }),
    ).toEqual(["workspace", "settings"]);
    expect(
      withLearningInsightsSection(["workspace", "insights"], {
        isLoggedIn: true,
      }),
    ).toEqual(["workspace"]);
  });

  it("leftover Knowledge Region kind uses the Learning workspace sections", () => {
    expect(
      availableWorkspaceSections({
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toEqual(["workspace", "dags", "map_types", "unsys_models", "context", "settings"]);
    expect(
      availableWorkspaceSections({
        isOwner: false,
        workspaceKind: "knowledge_region",
      }),
    ).toEqual(["workspace"]);
    expect(
      resolveActiveSection("workspace", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSection("goals", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSection("settings", {
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toBe("settings");
    expect(defaultWorkspaceSection("knowledge_region")).toBe("workspace");
  });

  it("leftover Calibration kind uses the Learning workspace sections", () => {
    expect(
      availableWorkspaceSections({
        isOwner: true,
        workspaceKind: "calibration",
      }),
    ).toEqual(["workspace", "dags", "map_types", "unsys_models", "context", "settings"]);
    expect(
      availableWorkspaceSections({
        isOwner: true,
        workspaceKind: "calibration",
      }),
    ).not.toContain("verification_flows");
    expect(
      availableWorkspaceSections({
        isOwner: false,
        workspaceKind: "calibration",
      }),
    ).toEqual(["workspace"]);
    expect(
      resolveActiveSection("workspace", {
        isOwner: true,
        workspaceKind: "calibration",
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSection("goals", {
        isOwner: true,
        workspaceKind: "calibration",
      }),
    ).toBe("workspace");
    expect(defaultWorkspaceSection("calibration")).toBe("workspace");
  });
});

describe("isWorkspaceLocalTab", () => {
  it("rejects all keys when local tabs are empty", () => {
    expect(isWorkspaceLocalTab("graph")).toBe(false);
    expect(isWorkspaceLocalTab("notes")).toBe(false);
    expect(isWorkspaceLocalTab("files")).toBe(false);
    expect(isWorkspaceLocalTab("performance")).toBe(false);
    expect(isWorkspaceLocalTab("integration")).toBe(false);
  });
});


