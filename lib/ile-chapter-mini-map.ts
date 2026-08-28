/**
 * Non-interactive chapter mini maps: dummy density samples (new session)
 * and occupancy from a stored plan (continue).
 */
import {
  buildSkillGridLayout,
  getCellKey,
} from "@/lib/block-skill-grid";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import type { InitialChaptersLevel } from "@/lib/initial-chapters";
import type { SessionPlanStep } from "@/lib/domain/types";

export type MiniMapCell = {
  row: number;
  col: number;
  status?: string;
};

/** Dummy occupancy — not loaded from session_plans. Narrow < mid < broad. */
export const DUMMY_DENSITY_CELLS: Record<
  InitialChaptersLevel,
  MiniMapCell[]
> = {
  narrow: [
    { row: 1, col: 1 },
    { row: 1, col: 4 },
    { row: 3, col: 2 },
    { row: 5, col: 1 },
    { row: 5, col: 5 },
  ],
  mid: [
    { row: 0, col: 2 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 1, col: 3 },
    { row: 2, col: 0 },
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 3, col: 1 },
    { row: 3, col: 2 },
    { row: 3, col: 3 },
    { row: 4, col: 2 },
  ],
  broad: [
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 1, col: 3 },
    { row: 1, col: 4 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
    { row: 2, col: 3 },
    { row: 2, col: 4 },
    { row: 3, col: 0 },
    { row: 3, col: 1 },
    { row: 3, col: 2 },
    { row: 3, col: 3 },
    { row: 4, col: 1 },
    { row: 4, col: 2 },
    { row: 4, col: 3 },
  ],
};

export function dummyDensityCells(
  level: InitialChaptersLevel,
): MiniMapCell[] {
  return DUMMY_DENSITY_CELLS[level].map((cell) => ({ ...cell }));
}

export function dummyDensityOccupiedCount(level: InitialChaptersLevel): number {
  return DUMMY_DENSITY_CELLS[level].length;
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
