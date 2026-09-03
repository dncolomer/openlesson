/**
 * Top-level workspace shell sections.
 * Context hosts notes + files; Workspace is map-first with authoring tools.
 * Simulation is an author-facing learner-journey overview (not the map).
 * Knowledge Region workspaces expose Goals / Knowledge / Settings only.
 */

import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";

export type WorkspaceSectionKey =
  | "workspace"
  | "context"
  | "simulation"
  | "dags"
  | "map_types"
  | "goals"
  | "knowledge"
  | "settings";

/** @deprecated Local tab keys no longer drive the Workspace section UI. */
export type WorkspaceLocalTabKey = "graph" | "notes" | "files";

export type WorkspaceMainSurface =
  | "workspace-local"
  | "context"
  | "simulation"
  | "dags"
  | "map_types"
  | "goals"
  | "knowledge"
  | "settings";

export const WORKSPACE_SECTION_KEYS: readonly WorkspaceSectionKey[] = [
  "workspace",
  "dags",
  "map_types",
  "goals",
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
  /** Creator Map Types tab — custom chapter-map types + built-in enable/disable. */
  mountsMapTypesPanel: boolean;
  /** Goals tab — multi workspace goals CRUD. */
  mountsGoalsPanel: boolean;
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
        mountsMapTypesPanel: false,
        mountsGoalsPanel: false,
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
        mountsMapTypesPanel: false,
        mountsGoalsPanel: false,
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
        mountsMapTypesPanel: false,
        mountsGoalsPanel: false,
        localTabs: [],
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
    case "map_types":
      return {
        section: "map_types",
        mainSurface: "map_types",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        mountsContextPanel: false,
        mountsSimulationPanel: false,
        mountsDagsPanel: false,
        mountsMapTypesPanel: true,
        mountsGoalsPanel: false,
        localTabs: [],
        mountsPerformancePanel: false,
        mountsIntegrationPanel: false,
      };
    case "goals":
      return {
        section: "goals",
        mainSurface: "goals",
        showBlockMapChrome: false,
        showSessionsColumn: false,
        mountsContextPanel: false,
        mountsSimulationPanel: false,
        mountsDagsPanel: false,
        mountsMapTypesPanel: false,
        mountsGoalsPanel: true,
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
        mountsMapTypesPanel: false,
        mountsGoalsPanel: false,
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
        mountsMapTypesPanel: false,
        mountsGoalsPanel: false,
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
        mountsMapTypesPanel: false,
        mountsGoalsPanel: false,
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

export type WorkspaceSectionAuth = {
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  workspaceKind?: unknown;
};

/** Default open tab when none is requested (or a hidden section is requested). */
export function defaultWorkspaceSection(kind?: unknown): WorkspaceSectionKey {
  return isKnowledgeRegionWorkspace(kind) ? "goals" : "workspace";
}

/**
 * Privileged sections (Knowledge, Settings, Goals): non-privileged callers fall
 * back to the kind default (Workspace, or Goals on a Knowledge Region).
 * Context and Simulation are open to all standard-workspace viewers.
 * DAGs and Map Types are owner-only.
 */
export function resolveActiveSection(
  requested: WorkspaceSectionKey,
  options: WorkspaceSectionAuth,
): WorkspaceSectionKey {
  const allowed = availableWorkspaceSections(options);
  if (allowed.includes(requested)) return requested;
  return defaultWorkspaceSection(options.workspaceKind);
}

/** Top-level sections visible in nav for the current user. */
export function availableWorkspaceSections(options: WorkspaceSectionAuth): WorkspaceSectionKey[] {
  if (isKnowledgeRegionWorkspace(options.workspaceKind)) {
    if (canAccessPrivilegedWorkspaceSections(options)) {
      return ["goals", "knowledge", "settings"];
    }
    // KR is owner-facing; consumers have no remaining public tabs.
    return [];
  }
  if (canAccessPrivilegedWorkspaceSections(options)) {
    // Nav order: Workspace, DAGs (owner), Map Types (owner), Goals, Context, Simulation, Knowledge, Settings.
    const sections: WorkspaceSectionKey[] = ["workspace"];
    if (options.isOwner) sections.push("dags", "map_types");
    sections.push("goals", "context", "simulation", "knowledge", "settings");
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
