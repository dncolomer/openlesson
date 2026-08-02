import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  WORKSPACE_LOCAL_TABS,
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  isWorkspaceLocalTab,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";

const REPO_ROOT = path.resolve(__dirname, "../..");

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

  it("maps Simulation section after Context: author overview, no map chrome", () => {
    const layout = resolveWorkspaceSectionLayout("simulation");

    expect(layout.mainSurface).toBe("simulation");
    expect(layout.mountsSimulationPanel).toBe(true);
    expect(layout.mountsContextPanel).toBe(false);
    expect(layout.showBlockMapChrome).toBe(false);
    expect(layout.showSessionsColumn).toBe(false);
    expect(layout.mountsPerformancePanel).toBe(false);
    expect(layout.mountsIntegrationPanel).toBe(false);
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

  it("keeps knowledge and settings for owners", () => {
    expect(resolveActiveSection("settings", { isOwner: true })).toBe("settings");
    expect(resolveActiveSection("knowledge", { isOwner: true })).toBe("knowledge");
  });

  it("keeps knowledge and settings for org admins who are not owners", () => {
    expect(resolveActiveSection("settings", { isOwner: false, isOrgAdmin: true })).toBe("settings");
    expect(resolveActiveSection("knowledge", { isOwner: false, isOrgAdmin: true })).toBe("knowledge");
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
    expect(resolveActiveSection("simulation", { isOwner: false })).toBe("simulation");
    expect(resolveActiveSection("context", { isOwner: false })).toBe("context");
  });
});

describe("availableWorkspaceSections", () => {
  it("includes Context then Simulation for everyone; Knowledge/Settings for owners or org admins", () => {
    expect(availableWorkspaceSections({ isOwner: true })).toEqual([
      "workspace",
      "context",
      "simulation",
      "knowledge",
      "settings",
    ]);
    expect(availableWorkspaceSections({ isOrgAdmin: true })).toEqual([
      "workspace",
      "context",
      "simulation",
      "knowledge",
      "settings",
    ]);
    expect(availableWorkspaceSections({ isOwner: false, isOrgAdmin: false })).toEqual([
      "workspace",
      "context",
      "simulation",
    ]);
    expect(availableWorkspaceSections({})).toEqual([
      "workspace",
      "context",
      "simulation",
    ]);
    // Simulation sits immediately after Context
    const owner = availableWorkspaceSections({ isOwner: true });
    expect(owner.indexOf("simulation")).toBe(owner.indexOf("context") + 1);
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

describe("WorkspaceView section shell wiring", () => {
  const viewSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceView.tsx"),
    "utf8",
  );
  const sectionHelperSource = fs.readFileSync(
    path.join(REPO_ROOT, "lib/workspace-sections.ts"),
    "utf8",
  );
  const navSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceSectionNav.tsx"),
    "utf8",
  );
  const identitySource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceIdentityPanel.tsx"),
    "utf8",
  );
  const integrationSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceIntegrationPanel.tsx"),
    "utf8",
  );
  const accessSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceAccessSettings.tsx"),
    "utf8",
  );
  const identitySettingsSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceIdentitySettings.tsx"),
    "utf8",
  );
  const notesFilesSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceNotesFilesPanel.tsx"),
    "utf8",
  );

  it("uses the shipped section mapper and top-level nav component", () => {
    expect(viewSource).toContain('from "@/lib/workspace-sections"');
    expect(viewSource).toContain("resolveWorkspaceSectionLayout");
    expect(viewSource).toContain("resolveActiveSection");
    expect(viewSource).toContain("availableWorkspaceSections");
    expect(viewSource).toContain("canAccessPrivilegedWorkspaceSections");
    expect(viewSource).toContain("isOrgAdmin");
    expect(viewSource).toContain("WorkspaceSectionNav");
    expect(sectionHelperSource).toContain("export function resolveWorkspaceSectionLayout");
    expect(sectionHelperSource).toContain("canAccessPrivilegedWorkspaceSections");
    expect(navSource).toContain("WorkspaceSectionNav");
  });

  it("gates Knowledge and Settings nav + panel mounts to owners or org admins", () => {
    expect(viewSource).toContain('visibleSections.includes("knowledge")');
    expect(viewSource).toContain('visibleSections.includes("settings")');
    expect(viewSource).toContain("canAccessPrivilegedSections && sectionLayout.mountsPerformancePanel");
    expect(viewSource).toContain("canAccessPrivilegedSections && sectionLayout.mountsIntegrationPanel");
    expect(viewSource).toContain("is_org_admin");
    expect(viewSource).toContain("organization_id");
  });

  it("shows workspace name on the right of section tabs", () => {
    expect(viewSource).toContain("workspaceTitle={plan.title || plan.root_topic}");
    expect(navSource).toContain("workspaceTitle");
    expect(navSource).toContain("data-workspace-section-title");
  });

  it("wires Knowledge to WorkspacePerformancePanel without nesting it in local tab config", () => {
    expect(viewSource).toContain("sectionLayout.mountsPerformancePanel");
    expect(viewSource).toContain("<WorkspacePerformancePanel");
    expect(viewSource).not.toMatch(/key:\s*"performance"\s+as\s+const/);
    expect(viewSource).not.toMatch(/key:\s*"integration"\s+as\s+const/);
    expect(viewSource).not.toContain('activeTab === "performance"');
    expect(viewSource).not.toContain('activeTab === "integration"');
  });

  it("wires Setting to WorkspaceIntegrationPanel behind section layout flag", () => {
    expect(viewSource).toContain("sectionLayout.mountsIntegrationPanel");
    expect(viewSource).toContain("<WorkspaceIntegrationPanel");
    expect(viewSource).toContain('selectSection("settings")');
  });

  it("gates block-map chrome to the Workspace section only and does not mount builder chat", () => {
    expect(viewSource).toContain("sectionLayout.showBlockMapChrome");
    expect(viewSource).toContain("<SessionList");
    expect(viewSource).not.toContain("WorkspaceChat");
    expect(viewSource).not.toContain("<ChatPanel");
    expect(viewSource).not.toContain("WorkspaceTabBar");
    expect(viewSource).not.toContain("activeTab");
    const chromeBlocks = viewSource.split("sectionLayout.showBlockMapChrome");
    expect(chromeBlocks.length).toBeGreaterThanOrEqual(2);
  });

  it("hosts notes, files, and external sources under Context section", () => {
    expect(viewSource).toContain("WorkspaceContextPanel");
    expect(viewSource).toContain("mountsContextPanel");
    expect(viewSource).toContain("data-workspace-context-section");
    expect(notesFilesSource).toContain("data-workspace-notes-files-panel");
    expect(notesFilesSource).toContain("data-unified-resource-list");
    expect(notesFilesSource).toContain("data-resource-list");
    expect(notesFilesSource).toContain('data-resource-kind="notes"');
    expect(notesFilesSource).toContain('data-resource-kind="file"');
    expect(notesFilesSource).toContain('data-resource-kind="external"');
    expect(notesFilesSource).toContain("buildWorkspaceResourceList");
    // Not two peer section cards stacked as separate panels
    expect(notesFilesSource).not.toContain("WorkspaceFilesTab");
    expect(viewSource).not.toContain('activeTab === "notes"');
    expect(viewSource).not.toContain('activeTab === "files"');
    expect(viewSource).not.toContain('activeTab === "graph"');
    // Map section uses authoring tools, not notes/files as default right pane
    expect(viewSource).toContain("WorkspaceMapAuthoringPane");
    expect(viewSource).not.toContain("WorkspacePromptImpactPanel");
  });

  it("hosts workspace goal edit under Settings, not the builder surface", () => {
    expect(viewSource).not.toContain("WorkspaceGoalPanel");
    expect(integrationSource).toContain("WorkspaceIdentitySettings");
    expect(identitySettingsSource).toContain("data-workspace-goal-settings");
    expect(identitySettingsSource).toContain("workspace_goal");
    expect(identitySettingsSource).toContain("workspace-settings-goal");
    expect(identitySettingsSource).toContain(`/api/workspaces/`);
    expect(identitySource).not.toContain("saveConversionGoal");
    expect(identitySource).not.toContain("Workspace goal");
    expect(identitySource).not.toContain("Set workspace goal");
  });

  it("renders notes with the same attachment-row chrome as files", () => {
    expect(notesFilesSource).toContain('data-resource-row="attachment"');
    expect(notesFilesSource).toContain("NotesTypeIcon");
    // Shared compact list-item shell for notes + file rows (denser Context list)
    expect(notesFilesSource).toMatch(
      /data-resource-kind="notes"[\s\S]*?flex items-center gap-2/,
    );
    expect(notesFilesSource).toContain('data-resource-kind="file"');
    expect(notesFilesSource).toContain("data-resource-row-compact");
  });

  it("exposes a create new notes file action for owners via the bottom placeholder card", () => {
    expect(notesFilesSource).toContain("data-create-notes-file-row");
    expect(notesFilesSource).not.toContain("data-create-notes-file\"");
    expect(notesFilesSource).toContain("New notes file");
    expect(notesFilesSource).toContain("createNotesFile");
    expect(notesFilesSource).toContain("nextNotesFileName");
  });

  it("mounts title/description/goal edit under Settings and not on identity chrome", () => {
    expect(integrationSource).toContain("WorkspaceIdentitySettings");
    expect(identitySettingsSource).toContain("data-workspace-identity-settings");
    expect(identitySettingsSource).toContain("workspace-settings-title");
    expect(identitySettingsSource).toContain("workspace-settings-description");
    expect(identitySettingsSource).toContain("workspace-settings-goal");
    expect(identitySettingsSource).toContain("title:");
    expect(identitySettingsSource).toContain("description:");
    expect(identitySettingsSource).toContain("workspace_goal");
    expect(identitySettingsSource).toContain(`/api/workspaces/`);
    // Display-only identity chrome
    expect(identitySource).toContain("data-identity-display-only");
    expect(identitySource).not.toContain("isEditingTitle");
    expect(identitySource).not.toContain("isEditingDescription");
    expect(identitySource).not.toContain("saveTitle");
    expect(identitySource).not.toContain("saveDescription");
    expect(identitySource).not.toContain("Pencil");
    // Mobile plan column no longer hosts title/description editors
    expect(viewSource).not.toContain("isEditingTitle");
    expect(viewSource).not.toContain("isEditingDescription");
    expect(viewSource).not.toContain("setIsEditingTitle");
    expect(viewSource).not.toContain("addDescriptionBtn");
  });

  it("moves public / Paid(AYCL) access controls into Settings; group mode removed", () => {
    expect(viewSource).toContain("plan={plan}");
    expect(viewSource).toContain("onPlanUpdate={setPlan}");
    expect(integrationSource).toContain("WorkspaceAccessSettings");
    expect(accessSource).toContain("data-workspace-access-settings");
    expect(accessSource).toContain("makePublic");
    expect(accessSource).not.toContain("makeGroupPlan");
    expect(accessSource).not.toContain("is_group");
    expect(accessSource).not.toContain("/group");
    expect(accessSource).toContain("Enable Paid (AYCL)");
    expect(accessSource).toContain("/api/me/status");
    // Removed from identity overflow menu
    expect(identitySource).not.toContain("togglePublic");
    expect(identitySource).not.toContain("toggleGroup");
    expect(identitySource).not.toContain("toggleAycl");
    expect(identitySource).not.toContain("MoreHorizontal");
    expect(identitySource).not.toContain("makePublic");
    expect(identitySource).not.toContain("makeGroupPlan");
    expect(identitySource).not.toContain("Enable Paid (AYCL)");
  });

  it("exposes top-level section labels via i18n keys including Context", () => {
    expect(viewSource).toContain('t("planView.sectionWorkspace")');
    expect(viewSource).toContain('t("planView.sectionContext")');
    expect(viewSource).toContain('t("planView.sectionKnowledge")');
    expect(viewSource).toContain('t("planView.sectionSetting")');
  });
});
