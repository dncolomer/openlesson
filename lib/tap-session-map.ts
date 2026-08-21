/**
 * Ephemeral TAP live map: Play-mode occupied tiles in memory only.
 * Dialog: one adjacent block per Helios turn. Solo: per-problem stash/solution.
 */
import {
  chebyshevDistance,
  getCellKey,
  type GridCell,
} from "@/lib/block-skill-grid";
import {
  emptyExerciseDualLists,
  type ExerciseDualLists,
} from "@/lib/exercise-tap";
import { MAP_FOG_BASE_RADIUS, MAP_FOG_FADE_BAND } from "@/lib/map-fog-of-war";
import type { TapStartingTopic } from "@/lib/tap-score";

export type TapSessionMapKind = "convo" | "exercise";

export type TapSessionMapBlock = {
  id: string;
  row: number;
  col: number;
  title: string;
  prompt: string;
  kind: TapSessionMapKind;
  done?: boolean;
};

export type TapSoloProblem = TapSessionMapBlock & {
  kind: "exercise";
  lists: ExerciseDualLists;
  solutionSubmitted: boolean;
  sourceId?: string | null;
};

export const TAP_SESSION_MAP_VIEW_PADDING = MAP_FOG_BASE_RADIUS + MAP_FOG_FADE_BAND;

/** Origin-centered half-span so the TAP window is a full 2D fog grid, not a stripe. */
export const TAP_SESSION_MAP_MIN_HALF_SPAN = MAP_FOG_BASE_RADIUS + MAP_FOG_FADE_BAND + 2;

const ORIGIN: GridCell = { row: 0, col: 0 };

function occupiedKeySet(cells: ReadonlyArray<GridCell>): Set<string> {
  const keys = new Set<string>();
  for (const cell of cells) {
    keys.add(getCellKey(cell.row, cell.col));
  }
  return keys;
}

function minChebyshevToOccupied(
  cell: GridCell,
  occupied: ReadonlyArray<GridCell>,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const other of occupied) {
    const d = chebyshevDistance(cell, other);
    if (d < best) best = d;
  }
  return best;
}

function compareClusterCandidates(a: GridCell, b: GridCell): number {
  const da = chebyshevDistance(a, ORIGIN);
  const db = chebyshevDistance(b, ORIGIN);
  if (da !== db) return da - db;
  const aa = Math.atan2(-a.row, a.col);
  const ab = Math.atan2(-b.row, b.col);
  if (aa !== ab) return aa - ab;
  if (a.col !== b.col) return a.col - b.col;
  return a.row - b.row;
}

/** Empty cells Chebyshev-adjacent to at least one occupied cell. */
export function adjacentEmptyTapCells(
  occupied: ReadonlyArray<GridCell>,
): GridCell[] {
  const keys = occupiedKeySet(occupied);
  const seen = new Set<string>();
  const candidates: GridCell[] = [];
  for (const cell of occupied) {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const next = { row: cell.row + dr, col: cell.col + dc };
        const key = getCellKey(next.row, next.col);
        if (keys.has(key) || seen.has(key)) continue;
        seen.add(key);
        candidates.push(next);
      }
    }
  }
  return candidates;
}

/** Closest empty square to `anchor` (Chebyshev). Fallback when the cluster has no neighbor. */
export function findClosestEmptyTapCell(
  anchor: GridCell,
  occupiedKeys: ReadonlySet<string>,
): GridCell {
  const maxRing = 48;
  for (let dist = 1; dist <= maxRing; dist += 1) {
    const ring: GridCell[] = [];
    for (let dr = -dist; dr <= dist; dr += 1) {
      for (let dc = -dist; dc <= dist; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== dist) continue;
        ring.push({ row: anchor.row + dr, col: anchor.col + dc });
      }
    }
    ring.sort(compareClusterCandidates);
    for (const next of ring) {
      if (!occupiedKeys.has(getCellKey(next.row, next.col))) return next;
    }
  }
  return { row: anchor.row, col: anchor.col + occupiedKeys.size + 1 };
}

/**
 * Next occupied cell: (0,0), then an empty neighbor of the existing cluster,
 * packed around origin/geometry (not an eastward stripe from the last tile).
 */
export function nextTapMapCell(occupied: ReadonlyArray<GridCell>): GridCell {
  if (occupied.length === 0) return { row: 0, col: 0 };
  const candidates = adjacentEmptyTapCells(occupied);
  if (candidates.length === 0) {
    return findClosestEmptyTapCell(ORIGIN, occupiedKeySet(occupied));
  }
  const ranked = candidates.slice().sort((a, b) => {
    const ga = minChebyshevToOccupied(a, occupied);
    const gb = minChebyshevToOccupied(b, occupied);
    if (ga !== gb) return ga - gb;
    return compareClusterCandidates(a, b);
  });
  return ranked[0];
}

export function tapBlockTitleFromPrompt(prompt: string, fallback = "Block"): string {
  const line = String(prompt || "")
    .trim()
    .split(/\n/)[0]
    ?.replace(/^#+\s*/, "")
    .trim();
  if (!line) return fallback;
  return line.length > 36 ? `${line.slice(0, 35).trim()}…` : line;
}

export function tapConvoBlocksFromAssistantTurns(
  turns: ReadonlyArray<{ id: string; content: string }>,
): TapSessionMapBlock[] {
  const occupied: GridCell[] = [];
  const blocks: TapSessionMapBlock[] = [];
  for (const turn of turns) {
    const cell = nextTapMapCell(occupied);
    occupied.push(cell);
    const prompt = String(turn.content || "");
    blocks.push({
      id: turn.id,
      row: cell.row,
      col: cell.col,
      title: tapBlockTitleFromPrompt(prompt, "Question"),
      prompt,
      kind: "convo",
    });
  }
  return blocks;
}

export function cloneTapSoloLists(lists: ExerciseDualLists): ExerciseDualLists {
  return {
    stash: lists.stash.slice(),
    submitted: lists.submitted.slice(),
  };
}

function promptKey(text: string): string {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function seedTapSoloProblems(input: {
  exerciseText: string;
  topics?: TapStartingTopic[] | null;
  startedTopicId?: string | null;
}): { placed: TapSoloProblem[]; pool: TapStartingTopic[] } {
  const prompt = String(input.exerciseText || "").trim();
  const first: TapSoloProblem = {
    id: input.startedTopicId || "tap-solo-start",
    row: 0,
    col: 0,
    title: tapBlockTitleFromPrompt(prompt, "Exercise"),
    prompt,
    kind: "exercise",
    lists: emptyExerciseDualLists(),
    solutionSubmitted: false,
    sourceId: input.startedTopicId || null,
  };
  const usedIds = new Set<string>([first.id]);
  if (first.sourceId) usedIds.add(first.sourceId);
  const usedPrompts = new Set<string>([promptKey(prompt)]);
  const pool = (input.topics || []).filter((topic) => {
    if (usedIds.has(topic.id)) return false;
    const opening = String(topic.openingQuestion || "").trim();
    if (opening && usedPrompts.has(promptKey(opening))) return false;
    return true;
  });
  return placeTapSoloProblemsFromPool([first], pool);
}

export function appendTapSoloProblem(
  placed: TapSoloProblem[],
  input: {
    id: string;
    title: string;
    prompt: string;
    sourceId?: string | null;
  },
): TapSoloProblem[] {
  if (placed.some((block) => block.id === input.id)) return placed;
  const cell = nextTapMapCell(placed);
  return [
    ...placed,
    {
      id: input.id,
      row: cell.row,
      col: cell.col,
      title: input.title || tapBlockTitleFromPrompt(input.prompt, "Exercise"),
      prompt: String(input.prompt || "").trim(),
      kind: "exercise",
      lists: emptyExerciseDualLists(),
      solutionSubmitted: false,
      done: false,
      sourceId: input.sourceId ?? null,
    },
  ];
}

export function placeTapSoloProblemsFromPool(
  placed: TapSoloProblem[],
  pool: TapStartingTopic[],
  count = pool.length,
): { placed: TapSoloProblem[]; pool: TapStartingTopic[] } {
  const takeCount = Math.max(0, Math.min(pool.length, Math.floor(count)));
  const take = pool.slice(0, takeCount);
  const rest = pool.slice(takeCount);
  let next = placed;
  for (const topic of take) {
    next = appendTapSoloProblem(next, {
      id: topic.id,
      title: topic.title,
      prompt: topic.openingQuestion,
      sourceId: topic.id,
    });
  }
  return { placed: next, pool: rest };
}

export function setTapSoloProblemLists(
  problems: TapSoloProblem[],
  id: string,
  lists: ExerciseDualLists,
): TapSoloProblem[] {
  return problems.map((problem) =>
    problem.id === id ? { ...problem, lists: cloneTapSoloLists(lists) } : problem,
  );
}

/** Marks the problem submitted. Does not change which problem is active. */
export function markTapSoloProblemSubmitted(
  problems: TapSoloProblem[],
  id: string,
): TapSoloProblem[] {
  return problems.map((problem) =>
    problem.id === id
      ? { ...problem, solutionSubmitted: true, done: true }
      : problem,
  );
}

/**
 * Fixed origin-centered square window. Occupied clusters never shrink this
 * to a stripe — fog hides far empties; the grid stays 2D around (0,0).
 */
export function tapSessionMapViewport(
  cells: ReadonlyArray<GridCell>,
  padding = TAP_SESSION_MAP_VIEW_PADDING,
): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
  const pad = Math.max(0, Math.floor(Number(padding) || 0));
  let extent = Math.max(1, TAP_SESSION_MAP_MIN_HALF_SPAN);
  for (const cell of cells) {
    extent = Math.max(extent, Math.abs(cell.row) + pad, Math.abs(cell.col) + pad);
  }
  return {
    minRow: -extent,
    maxRow: extent,
    minCol: -extent,
    maxCol: extent,
  };
}

export function tapSessionMapBlocksAreAdjacent(
  a: GridCell,
  b: GridCell,
): boolean {
  return chebyshevDistance(a, b) === 1;
}

/** Inner padding around the TAP map CSS grid (matches `p-4`). */
export const TAP_SESSION_MAP_PAD_PX = 16;

export type TapSessionMapCenterLayout = {
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  scrollLeft: number;
  scrollTop: number;
  originCenterX: number;
  originCenterY: number;
};

/**
 * Scroll + extra padding so cell (0,0) sits at the visual center of the
 * *visible* map pane (viewport minus overlay insets).
 */
export function tapSessionMapCenterOnOrigin(input: {
  viewport: { minRow: number; maxRow: number; minCol: number; maxCol: number };
  cellSize: number;
  gap: number;
  padding?: number;
  viewportWidth: number;
  viewportHeight: number;
  origin?: GridCell;
  insetTop?: number;
  insetRight?: number;
  insetBottom?: number;
  insetLeft?: number;
}): TapSessionMapCenterLayout {
  const padding = Math.max(0, Math.floor(Number(input.padding) || TAP_SESSION_MAP_PAD_PX));
  const cellSize = Math.max(1, Number(input.cellSize) || 1);
  const gap = Math.max(0, Number(input.gap) || 0);
  const pitch = cellSize + gap;
  const origin = input.origin ?? { row: 0, col: 0 };
  const cols = input.viewport.maxCol - input.viewport.minCol + 1;
  const rows = input.viewport.maxRow - input.viewport.minRow + 1;
  const contentW = padding * 2 + cols * cellSize + Math.max(0, cols - 1) * gap;
  const contentH = padding * 2 + rows * cellSize + Math.max(0, rows - 1) * gap;
  const centerX =
    padding + (origin.col - input.viewport.minCol) * pitch + cellSize / 2;
  const centerY =
    padding + (origin.row - input.viewport.minRow) * pitch + cellSize / 2;
  const vw = Math.max(0, Number(input.viewportWidth) || 0);
  const vh = Math.max(0, Number(input.viewportHeight) || 0);
  const insetTop = Math.max(0, Number(input.insetTop) || 0);
  const insetRight = Math.max(0, Number(input.insetRight) || 0);
  const insetBottom = Math.max(0, Number(input.insetBottom) || 0);
  const insetLeft = Math.max(0, Number(input.insetLeft) || 0);
  const visibleW = Math.max(0, vw - insetLeft - insetRight);
  const visibleH = Math.max(0, vh - insetTop - insetBottom);
  const visibleCenterX = insetLeft + visibleW / 2;
  const visibleCenterY = insetTop + visibleH / 2;
  const padLeft = Math.max(0, visibleCenterX - centerX);
  const padTop = Math.max(0, visibleCenterY - centerY);
  const padRight = Math.max(0, vw - visibleCenterX - (contentW - centerX));
  const padBottom = Math.max(0, vh - visibleCenterY - (contentH - centerY));
  const originCenterX = centerX + padLeft;
  const originCenterY = centerY + padTop;
  return {
    padLeft,
    padRight,
    padTop,
    padBottom,
    scrollLeft: Math.max(0, originCenterX - visibleCenterX),
    scrollTop: Math.max(0, originCenterY - visibleCenterY),
    originCenterX,
    originCenterY,
  };
}
