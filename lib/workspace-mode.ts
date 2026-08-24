/**
 * Creator vs Learner workspace mode — pure shell/map/pane rules.
 * Creator = current authoring. Learner = practice map + Knowledge (LWM/embeddings).
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

/** Under-minimap 3-state control: Build / Play / Explore. */
export type WorkspaceMapToggleId = WorkspaceInteractionMode | "explore";

export const WORKSPACE_INTERACTION_MODES: readonly WorkspaceInteractionMode[] = [
  "creator",
  "learner",
] as const;

export const WORKSPACE_MAP_TOGGLE_IDS: readonly WorkspaceMapToggleId[] = [
  "creator",
  "learner",
  "explore",
] as const;

/**
 * Under-minimap segments to render.
 * Play is always present. Explore defaults on (AYCL clones keep it even when
 * Build is hidden). Build is omitted when allowCreator is false (play-only).
 */
export function visibleWorkspaceMapToggleIds(input?: {
  allowCreator?: boolean;
  allowExplore?: boolean;
}): WorkspaceMapToggleId[] {
  const allowCreator = input?.allowCreator !== false;
  const allowExplore = input?.allowExplore !== false;
  const ids: WorkspaceMapToggleId[] = [];
  if (allowCreator) ids.push("creator");
  ids.push("learner");
  if (allowExplore) ids.push("explore");
  return ids;
}

/**
 * User-visible labels for the workspace mode toggle (under minimap).
 * Wire/state ids stay `"creator"` | `"learner"` | `"explore"`; display is
 * Build / Play / Explore.
 */
export const WORKSPACE_MODE_DISPLAY_LABELS: Readonly<
  Record<WorkspaceMapToggleId, string>
> = {
  creator: "Build",
  learner: "Play",
  explore: "Explore",
} as const;

/** Display label for a toggle id (Build / Play / Explore). */
export function workspaceModeDisplayLabel(
  mode: WorkspaceMapToggleId,
): string {
  return WORKSPACE_MODE_DISPLAY_LABELS[mode];
}

export function isWorkspaceMapToggleId(
  value: unknown,
): value is WorkspaceMapToggleId {
  return value === "creator" || value === "learner" || value === "explore";
}

/** Which under-minimap segment is lit. Explore wins over Build/Play. */
export function resolveWorkspaceMapToggleId(input: {
  interactionMode: WorkspaceInteractionMode | null | undefined;
  exploreOpen?: boolean;
}): WorkspaceMapToggleId {
  if (input.exploreOpen) return "explore";
  return normalizeWorkspaceInteractionMode(input.interactionMode);
}

/**
 * Next Build / Play / Explore state after a toggle click.
 * Explore keeps the current Build/Play shell underneath; leaving Explore
 * closes the overlay without inventing a mode.
 */
export function nextWorkspaceMapToggle(input: {
  clicked: unknown;
  interactionMode: WorkspaceInteractionMode | null | undefined;
  exploreOpen?: boolean;
}): {
  interactionMode: WorkspaceInteractionMode;
  exploreOpen: boolean;
} {
  const current = normalizeWorkspaceInteractionMode(input.interactionMode);
  if (input.clicked === "explore") {
    return { interactionMode: current, exploreOpen: true };
  }
  if (input.clicked === "creator" || input.clicked === "learner") {
    return { interactionMode: input.clicked, exploreOpen: false };
  }
  return { interactionMode: current, exploreOpen: Boolean(input.exploreOpen) };
}

export function isWorkspaceInteractionMode(
  value: unknown,
): value is WorkspaceInteractionMode {
  return value === "creator" || value === "learner";
}

export function normalizeWorkspaceInteractionMode(
  value: unknown,
  fallback: WorkspaceInteractionMode = "creator",
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
 * Visible top-level sections for the active interaction mode.
 * Learner: Workspace + Knowledge only (logged-in Knowledge scope).
 * Creator: existing owner/consumer section lists.
 * Knowledge Region: never resurrects Workspace / Context / Simulation / DAGs.
 */
export function availableSectionsForMode(input: {
  mode: WorkspaceInteractionMode;
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  isLoggedIn?: boolean;
  workspaceKind?: unknown;
}): WorkspaceSectionKey[] {
  const mode = normalizeWorkspaceInteractionMode(input.mode);
  if (isKnowledgeRegionWorkspace(input.workspaceKind)) {
    const kr = availableWorkspaceSections({
      isOwner: input.isOwner,
      isOrgAdmin: input.isOrgAdmin,
      workspaceKind: input.workspaceKind,
    });
    if (mode === "learner") {
      // Learner KR: Knowledge only when logged in; no map tab.
      return kr.filter((s) => s === "knowledge");
    }
    return kr;
  }
  if (mode === "learner") {
    // Knowledge only when logged in (user-scoped LWM); guests get map only.
    // DAGs tab is Creator-only — never in Learner.
    if (input.isLoggedIn) return ["workspace", "knowledge"];
    return ["workspace"];
  }
  // Creator: full owner/consumer lists (includes dags for owners).
  return availableWorkspaceSections({
    isOwner: input.isOwner,
    isOrgAdmin: input.isOrgAdmin,
    workspaceKind: input.workspaceKind,
  });
}

/**
 * Resolve active section under mode constraints (drop privileged authoring
 * tabs when switching to Learner). Hidden sections on a Knowledge Region
 * fall back to Goals, never Workspace.
 */
export function resolveActiveSectionForMode(input: {
  mode: WorkspaceInteractionMode;
  requested: WorkspaceSectionKey;
  isOwner?: boolean;
  isOrgAdmin?: boolean;
  isLoggedIn?: boolean;
  workspaceKind?: unknown;
}): WorkspaceSectionKey {
  const mode = normalizeWorkspaceInteractionMode(input.mode);
  const allowed = availableSectionsForMode(input);
  if (allowed.includes(input.requested)) {
    if (mode === "creator") {
      return resolveActiveSection(input.requested, {
        isOwner: input.isOwner,
        isOrgAdmin: input.isOrgAdmin,
        workspaceKind: input.workspaceKind,
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
}): WorkspaceModeShell {
  const mode = normalizeWorkspaceInteractionMode(input.mode);
  const sections = availableSectionsForMode(input);
  if (mode === "learner") {
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
