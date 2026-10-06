/**
 * Workspace shell rules.
 * Learning workspaces use one surface: the map, authoring sections for people
 * who can design, and explore content on the idle pane. There is no Play /
 * Build / Explore choice. Verification workspaces keep their own shell.
 */

import type { WorkspaceSectionKey } from "@/lib/workspace-sections";
import {
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  defaultWorkspaceSection,
  resolveActiveSection,
} from "@/lib/workspace-sections";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";

export type WorkspaceInteractionMode = "creator" | "learner";

/** Map workspaces open in the learner shell. Verification opens in the creator shell. */
export const DEFAULT_WORKSPACE_INTERACTION_MODE: WorkspaceInteractionMode =
  "learner";

/**
 * Verification workspaces have no map. They use the creator shell so Goals
 * and Settings stay reachable. Learning workspaces use the learner shell;
 * authoring is a separate capability, not a second mode.
 */
export function defaultInteractionModeForWorkspace(
  kind: unknown,
): WorkspaceInteractionMode {
  return isKnowledgeRegionWorkspace(kind)
    ? "creator"
    : DEFAULT_WORKSPACE_INTERACTION_MODE;
}

/**
 * The shell is fixed. Practice-only All-you-can-learn stays on the learner
 * shell, including verification workspaces.
 */
export function resolveFixedWorkspaceInteractionMode(input: {
  workspaceKind?: unknown;
  practiceOnly?: boolean;
}): WorkspaceInteractionMode {
  if (input.practiceOnly) return "learner";
  return defaultInteractionModeForWorkspace(input.workspaceKind);
}

/** Learning maps keep Calibrate, Learn, and Drill. Verification has no map. */
export function workspaceSurfaceShowsPracticeMenu(input?: {
  workspaceKind?: unknown;
}): boolean {
  return !isKnowledgeRegionWorkspace(input?.workspaceKind);
}

/**
 * Empty-cell clicks open add or generate only when this map can be authored.
 * Play-only access drops them. The stored Play/Build id does not decide this.
 */
export function workspaceEmptyCellOpensAuthoring(input: {
  authoring: boolean;
}): boolean {
  return input.authoring === true;
}

/**
 * Continue and Mark as Done need the learner pane on an authoring map.
 * Play-only maps always use that pane. A stored learner id is not enough
 * when authoring is also on.
 */
export function workspaceLearnerPaneMounted(input: {
  authoring: boolean;
  practiceDrawer: boolean;
  learnerActionRequested: boolean;
}): boolean {
  if (!input.practiceDrawer) return false;
  if (!input.authoring) return true;
  return input.learnerActionRequested;
}

/** Idle explore header. */
export function workspaceExpandMapTitle(): string {
  return "Expand Map";
}

/**
 * Authoring tools for people who can design the map.
 * Play-only access (`allowAuthoring: false`) stays on the map.
 * Verification workspaces do not use this map-authoring shell.
 */
export function workspaceSurfaceShowsAuthoring(input: {
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  allowAuthoring?: boolean;
  workspaceKind?: unknown;
}): boolean {
  if (isKnowledgeRegionWorkspace(input.workspaceKind)) return false;
  if (input.allowAuthoring === false) return false;
  return canAccessPrivilegedWorkspaceSections(input);
}

/**
 * Explore search, suggest, and overview sit on the idle map pane.
 * A selected block still opens its own pane.
 */
export function workspaceIdlePaneShowsExplore(input?: {
  allowExplore?: boolean;
}): boolean {
  return input?.allowExplore !== false;
}

export function isWorkspaceInteractionMode(
  value: unknown,
): value is WorkspaceInteractionMode {
  return value === "creator" || value === "learner";
}

export function normalizeWorkspaceInteractionMode(
  value: unknown,
  fallback: WorkspaceInteractionMode = DEFAULT_WORKSPACE_INTERACTION_MODE,
): WorkspaceInteractionMode {
  return isWorkspaceInteractionMode(value) ? value : fallback;
}

export type WorkspaceModeMapChrome = {
  /** Author tool strip (select/lasso/merge/…). */
  showAuthoringToolStrip: boolean;
  /** Empty cells show “+” and accept create. */
  showEmptyPlus: boolean;
  /** Multi-select / lasso / shift multi. */
  allowMultiSelect: boolean;
  /** Minimap always on for both modes. */
  showMinimap: boolean;
  /** Map ground authoring (lock/unusable). */
  allowMapGroundAuthoring: boolean;
  /** Stretch handles, drag-move, etc. */
  allowBlockManipulation: boolean;
  /** Learner content color cues (status/start tints). */
  learnerContentVisuals: boolean;
};

export type WorkspaceModeRightPaneKind =
  | "creator_default"
  | "learner_practice"
  | "none";

export type WorkspaceModeShell = {
  mode: WorkspaceInteractionMode;
  /** Sections shown in top nav. */
  sections: WorkspaceSectionKey[];
  map: WorkspaceModeMapChrome;
  /**
   * Right pane behavior on sole block select.
   * Creator: existing authoring drawers; Learner: Explore/Drill/Done only.
   */
  soleBlockPane: WorkspaceModeRightPaneKind;
  /** Knowledge panel limited to LWM + embeddings only. */
  knowledgeLwmEmbeddingsOnly: boolean;
  /** Hide Context / Simulation / Settings entirely. */
  authoringSectionsHidden: boolean;
};

/**
 * Visible top-level sections on the one workspace surface.
 * Privileged learning users get the map and the authoring sections.
 * Play-only (`allowAuthoring: false`) stays on the map.
 * Verification: one shell, independent of the old Play/Build split.
 */
export function availableSectionsForMode(input: {
  mode: WorkspaceInteractionMode;
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  isLoggedIn?: boolean;
  workspaceKind?: unknown;
  allowAuthoring?: boolean;
}): WorkspaceSectionKey[] {
  if (isKnowledgeRegionWorkspace(input.workspaceKind)) {
    return availableWorkspaceSections({
      isOwner: input.isOwner,
      isOrgAdmin: input.isOrgAdmin,
      workspaceKind: input.workspaceKind,
    });
  }
  if (input.allowAuthoring === false) {
    return ["workspace"];
  }
  return availableWorkspaceSections({
    isOwner: input.isOwner,
    isOrgAdmin: input.isOrgAdmin,
    workspaceKind: input.workspaceKind,
    isLoggedIn: input.isLoggedIn,
  });
}

/**
 * Resolve active section under mode constraints. Hidden sections on a
 * Verification workspace fall back to Goals, never the map.
 */
export function resolveActiveSectionForMode(input: {
  mode: WorkspaceInteractionMode;
  requested: WorkspaceSectionKey;
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  isLoggedIn?: boolean;
  workspaceKind?: unknown;
  allowAuthoring?: boolean;
}): WorkspaceSectionKey {
  const mode = normalizeWorkspaceInteractionMode(input.mode);
  const allowed = availableSectionsForMode(input);
  if (allowed.includes(input.requested)) {
    if (mode === "creator") {
      return resolveActiveSection(input.requested, {
        isOwner: input.isOwner,
        isOrgAdmin: input.isOrgAdmin,
        workspaceKind: input.workspaceKind,
        isLoggedIn: input.isLoggedIn,
      });
    }
    return input.requested;
  }
  return defaultWorkspaceSection(input.workspaceKind);
}

/** Full shell chrome for Creator or Learner. */
export function resolveWorkspaceModeShell(input: {
  mode: WorkspaceInteractionMode;
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  isLoggedIn?: boolean;
  workspaceKind?: unknown;
  allowAuthoring?: boolean;
}): WorkspaceModeShell {
  const mode = normalizeWorkspaceInteractionMode(input.mode);
  const sections = availableSectionsForMode(input);
  const authoring = workspaceSurfaceShowsAuthoring(input);
  if (mode === "learner" && !authoring) {
    return {
      mode: "learner",
      sections,
      map: {
        showAuthoringToolStrip: false,
        showEmptyPlus: false,
        allowMultiSelect: false,
        showMinimap: true,
        allowMapGroundAuthoring: false,
        allowBlockManipulation: false,
        learnerContentVisuals: true,
      },
      soleBlockPane: "learner_practice",
      knowledgeLwmEmbeddingsOnly: true,
      authoringSectionsHidden: true,
    };
  }
  return {
    mode: "creator",
    sections,
    map: {
      showAuthoringToolStrip: Boolean(
        input.isOwner || canAccessPrivilegedWorkspaceSections(input),
      ),
      showEmptyPlus: Boolean(input.isOwner),
      allowMultiSelect: Boolean(input.isOwner),
      showMinimap: true,
      allowMapGroundAuthoring: Boolean(input.isOwner),
      allowBlockManipulation: Boolean(input.isOwner),
      learnerContentVisuals: false,
    },
    soleBlockPane: "creator_default",
    knowledgeLwmEmbeddingsOnly: false,
    authoringSectionsHidden: false,
  };
}

/** Whether creator authoring drawers (combine/add/edit/…) should mount. */
export function mountsCreatorAuthoringDrawers(
  mode: WorkspaceInteractionMode,
): boolean {
  return normalizeWorkspaceInteractionMode(mode) === "creator";
}

/** Whether learner Explore/Drill/Done drawer should mount. */
export function mountsLearnerPracticeDrawer(
  mode: WorkspaceInteractionMode,
): boolean {
  return normalizeWorkspaceInteractionMode(mode) === "learner";
}

/**
 * DAG display: show when node has lock prereqs OR unlocks others (appears in
 * another block's lock_until or is a next-link target/source among graph).
 */
export function blockParticipatesInDag(input: {
  blockId: string;
  lockUntilIds?: readonly string[] | null;
  nextIds?: readonly string[] | null;
  /** Other blocks' lock lists / next lists for reverse edges. */
  peers?: readonly {
    id: string;
    lock_until_block_ids?: readonly string[] | null;
    next_block_ids?: readonly string[] | null;
  }[];
}): boolean {
  const id = String(input.blockId || "").trim();
  if (!id) return false;
  const locks = (input.lockUntilIds || []).filter(Boolean);
  const nexts = (input.nextIds || []).filter(Boolean);
  if (locks.length > 0 || nexts.length > 0) return true;
  for (const p of input.peers || []) {
    if (String(p.id) === id) continue;
    if ((p.lock_until_block_ids || []).map(String).includes(id)) return true;
    if ((p.next_block_ids || []).map(String).includes(id)) return true;
  }
  return false;
}

export type LearnerDagView = {
  prerequisites: Array<{ id: string; title: string; completed: boolean }>;
  unlocks: Array<{ id: string; title: string }>;
  participates: boolean;
};

/** Pure DAG view for learner right pane / map highlight. */
export function buildLearnerDagView(input: {
  blockId: string;
  blocks: readonly {
    id: string;
    title?: string | null;
    status?: string | null;
    lock_until_block_ids?: readonly string[] | null;
    next_block_ids?: readonly string[] | null;
  }[];
}): LearnerDagView {
  const id = String(input.blockId || "").trim();
  const byId = new Map(input.blocks.map((b) => [String(b.id), b]));
  const self = byId.get(id);
  const prereqIds = (self?.lock_until_block_ids || [])
    .map(String)
    .filter((x) => x && x !== id);
  const prerequisites = prereqIds.map((pid) => {
    const b = byId.get(pid);
    const st = String(b?.status || "").toLowerCase();
    return {
      id: pid,
      title: (b?.title || pid).trim() || pid,
      completed: st === "completed" || st === "done",
    };
  });
  const unlocks: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();
  for (const b of input.blocks) {
    const bid = String(b.id);
    if (bid === id) continue;
    const locks = (b.lock_until_block_ids || []).map(String);
    const nextsFromSelf = (self?.next_block_ids || []).map(String);
    if (locks.includes(id) || nextsFromSelf.includes(bid)) {
      if (seen.has(bid)) continue;
      seen.add(bid);
      unlocks.push({ id: bid, title: (b.title || bid).trim() || bid });
    }
  }
  const participates = blockParticipatesInDag({
    blockId: id,
    lockUntilIds: self?.lock_until_block_ids,
    nextIds: self?.next_block_ids,
    peers: input.blocks,
  });
  return { prerequisites, unlocks, participates };
}
