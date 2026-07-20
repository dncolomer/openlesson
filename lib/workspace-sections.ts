/**
 * Top-level workspace shell sections.
 * Workspace-local graph/notes/files tabs are retired — notes + files share one surface.
 */
export type WorkspaceSectionKey = "workspace" | "knowledge" | "settings";

/** @deprecated Local tab keys no longer drive the Workspace section UI. */
export type WorkspaceLocalTabKey = "graph" | "notes" | "files";

export type WorkspaceMainSurface = "workspace-local" | "knowledge" | "settings";

export const WORKSPACE_SECTION_KEYS: readonly WorkspaceSectionKey[] = [
  "workspace",
  "knowledge",
  "settings",
] as const;

/** Empty: Workspace section has no local tab bar (notes+files are combined). */
export const WORKSPACE_LOCAL_TABS: readonly WorkspaceLocalTabKey[] = [] as const;

export type WorkspaceSectionLayout = {
  section: WorkspaceSectionKey;
  mainSurface: WorkspaceMainSurface;
  /** Sessions list + builder multi-column chrome. */
  showBlockMapChrome: boolean;
  showSessionsColumn: boolean;
  /** Always empty — local tab bar removed from Workspace section. */
  localTabs: readonly WorkspaceLocalTabKey[];
  mountsPerformancePanel: boolean;
  mountsIntegrationPanel: boolean;
};

/**
 * Pure mapper from top-level section → which main surface / chrome to render.
 * Used by WorkspaceView and unit tests — do not re-implement in tests.
 */
export function resolveWorkspaceSectionLayout(
  section: WorkspaceSectionKey,
): WorkspaceSectionLayout {
  switch (section) {
    case "knowledge":
      return {
        section: "knowledge",
        mainSurface: "knowledge",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        localTabs: [],
        mountsPerformancePanel: true,
        mountsIntegrationPanel: false,
      };
    case "settings":
      return {
        section: "settings",
        mainSurface: "settings",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        localTabs: [],
        mountsPerformancePanel: false,
        mountsIntegrationPanel: true,
      };
    case "workspace":
    default:
      return {
        section: "workspace",
        mainSurface: "workspace-local",
        showBlockMapChrome: true,
        showSessionsColumn: true,
        localTabs: WORKSPACE_LOCAL_TABS,
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
  }
}

/**
 * Knowledge + Settings are privileged: workspace owners and org admins only.
 * Everyone else is limited to the Workspace section.
 */
export function canAccessPrivilegedWorkspaceSections(options: {
  isOwner?: boolean;
  isOrgAdmin?: boolean;
}): boolean {
  return Boolean(options.isOwner || options.isOrgAdmin);
}

/**
 * Privileged sections (Knowledge, Settings): non-privileged callers fall back to Workspace.
 */
export function resolveActiveSection(
  requested: WorkspaceSectionKey,
  options: { isOwner?: boolean; isOrgAdmin?: boolean },
): WorkspaceSectionKey {
  if (
    (requested === "settings" || requested === "knowledge") &&
    !canAccessPrivilegedWorkspaceSections(options)
  ) {
    return "workspace";
  }
  return requested;
}

/** Top-level sections visible in nav for the current user. */
export function availableWorkspaceSections(options: {
  isOwner?: boolean;
  isOrgAdmin?: boolean;
}): WorkspaceSectionKey[] {
  if (canAccessPrivilegedWorkspaceSections(options)) {
    return ["workspace", "knowledge", "settings"];
  }
  return ["workspace"];
}

/** Whether a local tab key is valid (always false — local tabs removed). */
export function isWorkspaceLocalTab(key: string): key is WorkspaceLocalTabKey {
  return (WORKSPACE_LOCAL_TABS as readonly string[]).includes(key);
}

/**
 * AYCL Workspace-local tabs. Empty — same combined surface as main shell
 * (files still require session cookie auth so AYCL notes-only content is composed without a files API).
 */
export const AYCL_WORKSPACE_LOCAL_TABS: readonly WorkspaceLocalTabKey[] = [] as const;

export function ayclWorkspaceLocalTabs(): readonly WorkspaceLocalTabKey[] {
  return AYCL_WORKSPACE_LOCAL_TABS;
}
