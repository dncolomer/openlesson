/**
 * Non-interactive chapter mini maps: dummy density samples (new session)
 * and occupancy from a stored plan (continue).
 */
import {
  buildSkillGridLayout,
  getCellKey,
} from "@/lib/block-skill-grid";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import {
  INITIAL_CHAPTERS_LEVELS,
  getInitialChaptersOption,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import type { SessionPlanStep } from "@/lib/domain/types";

export type MiniMapCellKind = "occupied" | "blocked" | "no_spawn" | "dag_hint";

export type MiniMapCell = {
  row: number;
  col: number;
  status?: string;
  kind?: MiniMapCellKind;
};

function isOccupiedCell(cell: MiniMapCell): boolean {
  return cell.kind !== "blocked";
}

/** Dummy occupancy — not loaded from session_plans. Includes blocked corridor cells. */
export function dummyPatternCells(
  level: InitialChaptersLevel | unknown,
): MiniMapCell[] {
  const option = getInitialChaptersOption(level);
  return [
    ...option.occupied.map((cell) => ({
      row: cell.row,
      col: cell.col,
      kind: "occupied" as const,
    })),
    ...option.blocked.map((cell) => ({
      row: cell.row,
      col: cell.col,
      kind: "blocked" as const,
    })),
  ];
}

/** @deprecated Prefer dummyPatternCells — includes blocked corridor cells. */
export const DUMMY_DENSITY_CELLS: Record<InitialChaptersLevel, MiniMapCell[]> = (() => {
  const out = {} as Record<InitialChaptersLevel, MiniMapCell[]>;
  for (const id of INITIAL_CHAPTERS_LEVELS) {
    out[id] = dummyPatternCells(id);
  }
  return out;
})();

export function dummyDensityCells(
  level: InitialChaptersLevel | unknown,
): MiniMapCell[] {
  return dummyPatternCells(level);
}

export function dummyDensityOccupiedCount(level: InitialChaptersLevel | unknown): number {
  return dummyPatternCells(level).filter(isOccupiedCell).length;
}

export function dummyDensityBlockedCount(level: InitialChaptersLevel | unknown): number {
  return dummyPatternCells(level).filter((cell) => cell.kind === "blocked").length;
}

/**
 * 4-connected occupied clusters (blocked/empty cells split groups).
 * Used to assert Islands has ≥3 separated cores.
 */
export function occupiedClusters(cells: MiniMapCell[]): MiniMapCell[][] {
  const occupied = cells.filter(isOccupiedCell);
  const keyOf = (cell: MiniMapCell) => getCellKey(cell.row, cell.col);
  const byKey = new Map(occupied.map((cell) => [keyOf(cell), cell]));
  const seen = new Set<string>();
  const clusters: MiniMapCell[][] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (const start of occupied) {
    const startKey = keyOf(start);
    if (seen.has(startKey)) continue;
    const cluster: MiniMapCell[] = [];
    const queue = [start];
    seen.add(startKey);
    while (queue.length) {
      const cur = queue.pop()!;
      cluster.push(cur);
      for (const [dr, dc] of dirs) {
        const nextKey = getCellKey(cur.row + dr, cur.col + dc);
        if (seen.has(nextKey)) continue;
        const next = byKey.get(nextKey);
        if (!next) continue;
        seen.add(nextKey);
        queue.push(next);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function dummyOccupiedClusterCount(level: InitialChaptersLevel | unknown): number {
  return occupiedClusters(dummyPatternCells(level)).length;
}

/** Continue mini: occupancy of the stored plan steps (read-only). */
export function continueMiniCellsFromPlanSteps(
  steps: SessionPlanStep[] | null | undefined,
): MiniMapCell[] {
  if (!Array.isArray(steps) || steps.length === 0) return [];
  const nodes = sessionStepsToSkillGridNodes(steps);
  const statusById = new Map(nodes.map((node) => [node.id, node.status]));
  const { occupancy } = buildSkillGridLayout(nodes);
  const cells: MiniMapCell[] = [];
  for (const [key, id] of occupancy) {
    const [rowRaw, colRaw] = String(key).split(":");
    const row = Number(rowRaw);
    const col = Number(colRaw);
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
    cells.push({
      row,
      col,
      status: statusById.get(String(id)),
      kind: "occupied",
    });
  }
  return cells;
}

export function miniMapInteractive(): false {
  return false;
}

/** Fill the continue column so the preview bottom matches the aesthetic tiles. */
export const ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS =
  "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border border-neutral-800 bg-neutral-950/90 max-lg:min-h-[min(14rem,28vh)]";

export const ILE_CONTINUE_MAP_PREVIEW_LABELS = {
  emptyCell: "",
  addTitle: "",
  addPlaceholder: "",
  addSubmit: "",
  addCancel: "",
  suggestTopics: "",
  suggesting: "",
  suggestError: "",
  recenter: "Recenter",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
} as const;

/** Shared dummy schematic frame so catalog cards keep one size. */
export const DUMMY_PATTERN_FRAME = {
  minRow: 0,
  maxRow: 6,
  minCol: 0,
  maxCol: 6,
} as const;

export function miniMapDummyFrame(): {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
} {
  return DUMMY_PATTERN_FRAME;
}

export function miniMapBounds(cells: MiniMapCell[]): {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
} {
  if (cells.length === 0) {
    return { minRow: 0, maxRow: 3, minCol: 0, maxCol: 3 };
  }
  let minRow = cells[0].row;
  let maxRow = cells[0].row;
  let minCol = cells[0].col;
  let maxCol = cells[0].col;
  for (const cell of cells) {
    if (cell.row < minRow) minRow = cell.row;
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.col < minCol) minCol = cell.col;
    if (cell.col > maxCol) maxCol = cell.col;
  }
  return { minRow, maxRow, minCol, maxCol };
}

export function miniMapHasCell(
  cells: MiniMapCell[],
  row: number,
  col: number,
): MiniMapCell | undefined {
  const key = getCellKey(row, col);
  return cells.find((cell) => getCellKey(cell.row, cell.col) === key);
}


