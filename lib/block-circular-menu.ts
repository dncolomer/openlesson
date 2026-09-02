/**
 * Occupied-block circular menu (ILE + Workspace learner). TAP is excluded.
 * Pure — tests drive catalog, progress, unseen-dot, and resource scoping.
 */
import { PREVIOUS_SESSIONS_DRAWER_ID } from "@/lib/block-previous-sessions";
import {
  ileGatherResourceBlockId,
  isIleGatherResource,
  type IleGatherJob,
} from "@/lib/ile-gather-resources";
import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";

export type BlockCircularMenuSurface = "ile" | "workspace-learner" | "none";

export type IleCircularMenuActionId =
  | "work"
  | "mark_completed"
  | "edit"
  | "gather_resources"
  | "see_resources"
  | "add_chapter"
  | "accept_chapter"
  | "reject_chapter";

export type WorkspaceCircularMenuActionId =
  | "start_session"
  | "continue_session"
  | "mark_done";

export type BlockCircularMenuActionId =
  | IleCircularMenuActionId
  | WorkspaceCircularMenuActionId;

export type BlockCircularMenuAction = {
  id: BlockCircularMenuActionId;
  label: string;
};

export const ILE_CIRCULAR_MENU_ACTIONS: readonly BlockCircularMenuAction[] = [
  { id: "work", label: "Work" },
  { id: "mark_completed", label: "Mark as completed" },
  { id: "edit", label: "Edit" },
  { id: "gather_resources", label: "Gather resources" },
  { id: "see_resources", label: "See resources" },
] as const;

export const ILE_EMPTY_CIRCULAR_MENU_ACTIONS: readonly BlockCircularMenuAction[] = [
  { id: "add_chapter", label: "Add chapter" },
] as const;

/** TIM-proposed chapters: accept keeps the 3×3 logos, reject clears the tile. */
export const ILE_TIM_CIRCULAR_MENU_ACTIONS: readonly BlockCircularMenuAction[] = [
  { id: "accept_chapter", label: "Accept" },
  { id: "reject_chapter", label: "Reject" },
] as const;

export const WORKSPACE_CIRCULAR_MENU_ACTIONS: readonly BlockCircularMenuAction[] = [
  { id: "start_session", label: "Start a new Session" },
  { id: "continue_session", label: "Continue prev Session" },
  { id: "mark_done", label: "Mark as Done" },
] as const;

export const WORKSPACE_CIRCULAR_MENU_DRAWER_IDS = {
  start_session: "practice",
  continue_session: PREVIOUS_SESSIONS_DRAWER_ID,
  mark_done: "progress",
} as const;

export function resolveBlockCircularMenuSurface(input: {
  suggestMode?: string | null;
  learnerMode?: boolean | null;
  tap?: boolean | null;
}): BlockCircularMenuSurface {
  if (input.tap) return "none";
  if (input.suggestMode === "chapter") return "ile";
  if (input.learnerMode) return "workspace-learner";
  return "none";
}

export function blockCircularMenuActions(
  surface: BlockCircularMenuSurface | null | undefined,
  opts?: { empty?: boolean | null; timUnopened?: boolean | null },
): readonly BlockCircularMenuAction[] {
  if (opts?.empty) {
    if (surface === "ile") return ILE_EMPTY_CIRCULAR_MENU_ACTIONS;
    return [];
  }
  if (opts?.timUnopened) {
    if (surface === "ile") return ILE_TIM_CIRCULAR_MENU_ACTIONS;
    return [];
  }
  if (surface === "ile") return ILE_CIRCULAR_MENU_ACTIONS;
  if (surface === "workspace-learner") return WORKSPACE_CIRCULAR_MENU_ACTIONS;
  return [];
}

export function blockCircularMenuDoubleClickIsNoop(
  surface: BlockCircularMenuSurface | null | undefined,
): boolean {
  return surface === "workspace-learner";
}

/** Single-click opens the circular menu on ILE and Workspace learner (not TAP). */
export function blockCircularMenuOpensOnSelect(
  surface: BlockCircularMenuSurface | null | undefined,
  opts?: { exploreOpen?: boolean | null },
): boolean {
  if (opts?.exploreOpen) return false;
  return surface === "ile" || surface === "workspace-learner";
}

/** Empty ILE cells get a one-action Add chapter ring instead of opening the modal. */
export function blockCircularMenuOpensOnEmpty(
  surface: BlockCircularMenuSurface | null | undefined,
): boolean {
  return surface === "ile";
}

export function emptyCircularMenuCellKey(cell: {
  row: number;
  col: number;
} | null | undefined): string {
  if (!cell || !Number.isFinite(cell.row) || !Number.isFinite(cell.col)) return "";
  return `${Math.trunc(cell.row)}:${Math.trunc(cell.col)}`;
}

/** Click the same empty cell again to close the add ring. */
export function nextCircularMenuEmptyCellOnClick(input: {
  surface?: BlockCircularMenuSurface | null;
  clicked: { row: number; col: number };
  current?: { row: number; col: number } | null;
}): { row: number; col: number } | null {
  if (!blockCircularMenuOpensOnEmpty(input.surface)) return null;
  const clicked = {
    row: Math.trunc(input.clicked.row),
    col: Math.trunc(input.clicked.col),
  };
  if (
    emptyCircularMenuCellKey(input.current) === emptyCircularMenuCellKey(clicked)
  ) {
    return null;
  }
  return clicked;
}

/**
 * Click a selected ILE/workspace-learner block again to close the menu
 * (unselect). Clicking a different block moves the menu there.
 */
export function nextCircularMenuBlockIdOnClick(input: {
  surface?: BlockCircularMenuSurface | null;
  clickedId: string | null | undefined;
  currentMenuId?: string | null;
  exploreOpen?: boolean | null;
}): string | null {
  if (!blockCircularMenuOpensOnSelect(input.surface, { exploreOpen: input.exploreOpen })) {
    return null;
  }
  const clicked = typeof input.clickedId === "string" ? input.clickedId.trim() : "";
  if (!clicked) return null;
  const current =
    typeof input.currentMenuId === "string" ? input.currentMenuId.trim() : "";
  if (current && current === clicked) return null;
  return clicked;
}

const EMPTY_DISABLED_ACTIONS: ReadonlySet<IleCircularMenuActionId> = new Set();
const ILE_COMPLETED_DISABLED_ACTIONS: ReadonlySet<IleCircularMenuActionId> = new Set([
  "mark_completed",
  "edit",
  "gather_resources",
  "see_resources",
]);

/** Completed ILE chapters keep Work enabled; every other circular action is off. */
export function ileCircularMenuDisabledActionIds(input: {
  completed?: boolean | null;
}): ReadonlySet<IleCircularMenuActionId> {
  return input.completed ? ILE_COMPLETED_DISABLED_ACTIONS : EMPTY_DISABLED_ACTIONS;
}

export function ileWorkOnCompletedRequiresConfirm(completed?: boolean | null): boolean {
  return completed === true;
}

export function workspaceCircularMenuDrawerId(
  action: WorkspaceCircularMenuActionId | string,
): string | null {
  if (action === "start_session") return WORKSPACE_CIRCULAR_MENU_DRAWER_IDS.start_session;
  if (action === "continue_session") return WORKSPACE_CIRCULAR_MENU_DRAWER_IDS.continue_session;
  if (action === "mark_done") return WORKSPACE_CIRCULAR_MENU_DRAWER_IDS.mark_done;
  return null;
}

export type LearnerDrawerRequest = {
  id: string;
  nonce: number;
};

export function nextLearnerDrawerRequest(
  action: WorkspaceCircularMenuActionId | string,
  nonce = Date.now(),
): LearnerDrawerRequest | null {
  const id = workspaceCircularMenuDrawerId(action);
  if (!id) return null;
  return { id, nonce };
}

/** Requested circular-menu drawer wins over the pane default (including repeats). */
export function applyLearnerDrawerRequest(input: {
  defaultOpenId: string;
  requestedId?: string | null;
  requestedNonce?: number | null;
}): string {
  const requested = typeof input.requestedId === "string" ? input.requestedId.trim() : "";
  if (requested) return requested;
  return input.defaultOpenId;
}

export type BlockCircularMenuProgress = {
  actionId?: BlockCircularMenuActionId | string | null;
  running?: boolean | null;
  completed?: number | null;
  total?: number | null;
};

/**
 * Running ILE actions yield a fraction in (0, 1]. Idle / missing → 0.
 */
export function blockCircularMenuProgressFraction(
  progress: BlockCircularMenuProgress | null | undefined,
): number {
  if (!progress || progress.running === false) return 0;
  const totalRaw = Number(progress.total);
  const completedRaw = Number(progress.completed);
  const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : 1;
  const completed = Number.isFinite(completedRaw) ? Math.max(0, completedRaw) : 0;
  const running =
    progress.running === true ||
    (progress.running == null && (completed > 0 || Boolean(progress.actionId)));
  if (!running) return 0;
  const frac = completed / total;
  if (frac <= 0) return 0.08;
  return Math.min(1, frac);
}

export function gatherJobToBlockProgress(
  job: Pick<IleGatherJob, "status" | "completed" | "total"> | null | undefined,
): BlockCircularMenuProgress | null {
  if (!job) return null;
  if (job.status !== "running") return null;
  return {
    actionId: "gather_resources",
    running: true,
    completed: job.completed,
    total: job.total,
  };
}

export function ileGatherJobTileId(job: {
  blockId?: string | null;
  chapterId?: string | null;
}): string {
  const chapter = typeof job.chapterId === "string" ? job.chapterId.trim() : "";
  if (chapter) return chapter;
  return typeof job.blockId === "string" ? job.blockId.trim() : "";
}

/** Ready-unseen gather results → notification true; seen or empty → false. */
export function blockHasUnseenGatherNotification(input: {
  readyCount?: number | null;
  seen?: boolean | null;
}): boolean {
  const ready = Number(input.readyCount);
  if (!Number.isFinite(ready) || ready <= 0) return false;
  return input.seen !== true;
}

export function parseGatherSeenBlockIds(raw: unknown): string[] {
  if (raw == null) return [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    try {
      value = JSON.parse(text);
    } catch {
      return text ? [text] : [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (typeof row !== "string") continue;
    const id = row.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function markGatherResourcesSeen(
  seenIds: readonly string[] | null | undefined,
  blockId: string | null | undefined,
): string[] {
  const current = parseGatherSeenBlockIds(seenIds ?? []);
  const id = typeof blockId === "string" ? blockId.trim() : "";
  if (!id) return current;
  if (current.includes(id)) return current;
  return [...current, id];
}

export const ILE_GATHER_META_CHAPTER_KEY = "chapter_id";

export function ileGatherResourceChapterId(resource: {
  meta?: Record<string, unknown> | null;
}): string | null {
  const raw = resource.meta?.[ILE_GATHER_META_CHAPTER_KEY];
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

/**
 * Scope planned resources by chapter and/or block.
 * Missing/blank ids → unscoped copy (never throws). Mismatched ids drop only
 * the tagged gather rows; untagged rows stay so other resource UIs do not empty.
 */
export function filterPlannedResourcesByScope(
  resources: readonly WorkspaceExternalResource[] | null | undefined,
  scope?: { chapterId?: string | null; blockId?: string | null } | null,
): WorkspaceExternalResource[] {
  if (!resources || !Array.isArray(resources)) return [];
  const blockId = typeof scope?.blockId === "string" ? scope.blockId.trim() : "";
  const chapterId = typeof scope?.chapterId === "string" ? scope.chapterId.trim() : "";
  if (!blockId && !chapterId) return [...resources];
  return resources.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const bid = ileGatherResourceBlockId(row);
    const cid = ileGatherResourceChapterId(row);
    if (blockId) {
      if (bid && bid !== blockId) return false;
      if (!bid && isIleGatherResource(row)) return false;
    }
    if (chapterId) {
      if (cid && cid !== chapterId) return false;
    }
    return true;
  });
}

/** Visual ring radius (px). Action-button centers sit on this circumference. */
export const BLOCK_CIRCULAR_MENU_RING_RADIUS_PX = 52;
/** Drawn stroke thickness of the menu circle. */
export const BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX = 4;
/** Idle icon-button diameter. */
export const BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX = 40;
/** Stroke thickness of each action circle. */
export const BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX = 3;

export function circularMenuActionPosition(
  index: number,
  count: number,
  radiusPx = BLOCK_CIRCULAR_MENU_RING_RADIUS_PX,
): { x: number; y: number } {
  const n = Math.max(1, count);
  const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
  return {
    x: Math.cos(angle) * radiusPx,
    y: Math.sin(angle) * radiusPx,
  };
}
