/**
 * Top-level workspace shell sections.
 * Context hosts notes + files; Workspace is map-first with authoring tools.
 * Simulation is an author-facing learner-journey overview (not the map).
 */
export type WorkspaceSectionKey =
  | "workspace"
  | "context"
  | "simulation"
  | "dags"
  | "knowledge"
  | "settings";

/** @deprecated Local tab keys no longer drive the Workspace section UI. */
export type WorkspaceLocalTabKey = "graph" | "notes" | "files";

export type WorkspaceMainSurface =
  | "workspace-local"
  | "context"
  | "simulation"
  | "dags"
  | "knowledge"
  | "settings";

export const WORKSPACE_SECTION_KEYS: readonly WorkspaceSectionKey[] = [
  "workspace",
  "dags",
  "context",
  "simulation",
  "knowledge",
  "settings",
] as const;

/** Empty: Workspace section has no local tab bar (notes+files live under Context). */
export const WORKSPACE_LOCAL_TABS: readonly WorkspaceLocalTabKey[] = [] as const;

export type WorkspaceSectionLayout = {
  section: WorkspaceSectionKey;
  mainSurface: WorkspaceMainSurface;
  /** Sessions list + builder multi-column chrome (map). */
  showBlockMapChrome: boolean;
  showSessionsColumn: boolean;
  /** Context surface hosts notes + files (global materials). */
  mountsContextPanel: boolean;
  /** Workspace-level Simulation tab (author learner-journey overview). */
  mountsSimulationPanel: boolean;
  /** Creator DAGs tab — list/edit/delete created multi-block DAGs. */
  mountsDagsPanel: boolean;
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
    case "context":
      return {
        section: "context",
        mainSurface: "context",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        mountsContextPanel: true,
        mountsSimulationPanel: false,
        mountsDagsPanel: false,
        localTabs: [],
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
    case "simulation":
      return {
        section: "simulation",
        mainSurface: "simulation",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        mountsContextPanel: false,
        mountsSimulationPanel: true,
        mountsDagsPanel: false,
        localTabs: [],
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
    case "dags":
      return {
        section: "dags",
        mainSurface: "dags",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        mountsContextPanel: false,
        mountsSimulationPanel: false,
        mountsDagsPanel: true,
        localTabs: [],
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
    case "knowledge":
      return {
        section: "knowledge",
        mainSurface: "knowledge",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        mountsContextPanel: false,
        mountsSimulationPanel: false,
        mountsDagsPanel: false,
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
        mountsContextPanel: false,
        mountsSimulationPanel: false,
        mountsDagsPanel: false,
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
        mountsContextPanel: false,
        mountsSimulationPanel: false,
        mountsDagsPanel: false,
        localTabs: WORKSPACE_LOCAL_TABS,
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
  }
}

/**
 * Knowledge + Settings are privileged: workspace owners and org admins only.
 * Context + Simulation + Workspace are available to everyone who can open the
 * workspace (builders and buyers/consumers).
 */
export function canAccessPrivilegedWorkspaceSections(options: {
  isOwner?: boolean;
  isOrgAdmin?: boolean;
}): boolean {
  return Boolean(options.isOwner || options.isOrgAdmin);
}

/**
 * Privileged sections (Knowledge, Settings): non-privileged callers fall back to Workspace.
 * Context and Simulation are open to all workspace viewers.
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
    // Nav order: Workspace, DAGs (owner only), Context, Simulation, Knowledge, Settings.
    const sections: WorkspaceSectionKey[] = ["workspace"];
    if (options.isOwner) sections.push("dags");
    sections.push("context", "simulation", "knowledge", "settings");
    return sections;
  }
  // Buyers / consumers: Context + Simulation (author/learner insight) + Workspace.
  return ["workspace", "context", "simulation"];
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
