/**
 * ILE altitude bands. The chapter DAG sets elevation: a chapter with no
 * prerequisites is the high ground, and each step down (lock-until or
 * leads-to) is lower. Chapter squares at the same elevation that touch by a
 * full side share one contour. The line runs along the shared edge between
 * squares, so neighboring regions meet. Where two regions touch, only the
 * higher one keeps that edge. Empty
 * ground sits under every chapter and blocked ground sits under empty ground.
 * Fog and the viewport are not inputs to chapter altitude. Order never
 * invents an edge.
 */
import {
  ILE_BOARD_CELL_SIZE,
  ILE_BOARD_PITCH,
  SKILL_GRID_GAP,
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";

export type IleAltitudeChapter = {
  id: string;
  row?: number | null;
  col?: number | null;
  lockUntilIds?: readonly string[] | null;
  nextIds?: readonly string[] | null;
};

export type IleAltitudeCell = { row: number; col: number };

export type IleAltitudeLoop = {
  d: string;
  labelX: number;
  labelY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type IleAltitudeGroup = {
  id: string;
  /** Higher number is higher ground. Roots share the peak. */
  altitude: number;
  chapterIds: string[];
  cells: IleAltitudeCell[];
  loops: IleAltitudeLoop[];
};

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function finiteCell(row: unknown, col: unknown): IleAltitudeCell | null {
  if (typeof row !== "number" || typeof col !== "number") return null;
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row: Math.trunc(row), col: Math.trunc(col) };
}

function uniq(ids: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids || []) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** World pixel for a unit-grid vertex, centered on the cell through the gap. */
export function ileAltitudeVertexPx(x: number, y: number): { x: number; y: number } {
  const pad = SKILL_GRID_GAP / 2;
  return { x: x * SKILL_GRID_PITCH - pad, y: y * SKILL_GRID_PITCH - pad };
}

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

type PixelSeg = { x1: number; y1: number; x2: number; y2: number };

function ptKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Contour on the line shared by neighboring squares (the middle of the gutter).
 * Cells in the set drop the edge they share, and the outer corners meet, so
 * the region is one line. When `knownCells` is set, edges that face a cell
 * outside that set are omitted (the camera fringe is not a region border).
 * When `omitHigher` is set, an edge that faces a strictly higher neighbor is
 * omitted so the lower region does not double the higher region's line.
 * A neighbor with no elevation is not higher.
 */
export function ileAltitudeContourLoops(
  cells: readonly IleAltitudeCell[],
  knownCells?: readonly IleAltitudeCell[] | null,
  omitHigher?: {
    elevation: ReadonlyMap<string, number>;
    level: number;
  } | null,
): IleAltitudeLoop[] {
  const inGroup = new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
  const known = knownCells ? new Set(knownCells.map((cell) => `${cell.row}:${cell.col}`)) : null;
  const boundary = (row: number, col: number, dr: number, dc: number) => {
    const key = `${row + dr}:${col + dc}`;
    if (inGroup.has(key)) return false;
    if (known && !known.has(key)) return false;
    if (omitHigher) {
      const neighbor = omitHigher.elevation.get(key);
      if (neighbor != null && neighbor > omitHigher.level) return false;
    }
    return true;
  };
  const segs: PixelSeg[] = [];
  for (const cell of cells) {
    const origin = ileAltitudeVertexPx(cell.col, cell.row);
    const far = ileAltitudeVertexPx(cell.col + 1, cell.row + 1);
    const x = origin.x;
    const y = origin.y;
    const right = far.x;
    const bottom = far.y;
    if (boundary(cell.row, cell.col, -1, 0)) segs.push({ x1: x, y1: y, x2: right, y2: y });
    if (boundary(cell.row, cell.col, 0, 1)) segs.push({ x1: right, y1: y, x2: right, y2: bottom });
    if (boundary(cell.row, cell.col, 1, 0)) segs.push({ x1: right, y1: bottom, x2: x, y2: bottom });
    if (boundary(cell.row, cell.col, 0, -1)) segs.push({ x1: x, y1: bottom, x2: x, y2: y });
  }
  const byStart = new Map<string, number[]>();
  segs.forEach((seg, index) => {
    const key = ptKey(seg.x1, seg.y1);
    const list = byStart.get(key);
    if (list) list.push(index);
    else byStart.set(key, [index]);
  });
  const unused = new Set(segs.map((_, index) => index));
  const loops: IleAltitudeLoop[] = [];
  for (let index = 0; index < segs.length; index += 1) {
    if (!unused.has(index)) continue;
    const first = segs[index];
    if (!first) continue;
    unused.delete(index);
    const points = [
      { x: first.x1, y: first.y1 },
      { x: first.x2, y: first.y2 },
    ];
    let current = first;
    let closed = false;
    for (let guard = 0; guard < segs.length + 2; guard += 1) {
      if (current.x2 === first.x1 && current.y2 === first.y1) {
        closed = true;
        break;
      }
      const nextIndex = (byStart.get(ptKey(current.x2, current.y2)) ?? []).find((candidate) =>
        unused.has(candidate),
      );
      if (nextIndex == null) break;
      unused.delete(nextIndex);
      const next = segs[nextIndex];
      if (!next) break;
      current = next;
      points.push({ x: current.x2, y: current.y2 });
    }
    if (points.length < 2) continue;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const labelX = Math.min(...xs);
    const labelY = Math.min(...ys);
    const [start, ...rest] = points;
    if (!start) continue;
    const d = `M ${start.x} ${start.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")}${closed ? " Z" : ""}`;
    loops.push({
      d,
      labelX,
      labelY,
      minX: labelX,
      minY: labelY,
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    });
  }
  return loops;
}

/** Open ground is under every chapter. Blocked ground is under open ground. */
export const ILE_OPEN_ELEVATION = -1;
export const ILE_BLOCKED_ELEVATION = -2;

/**
 * The contour is the map. No fill, so a chapter does not read as a larger slab.
 * Higher ground gets a thicker, brighter line. `shadowDy` is a cast downward
 * onto lower ground; higher altitudes throw it farther and darker.
 */
export function ileAltitudePaint(
  altitude: number,
  peak: number,
): {
  stroke: string;
  fill: string;
  strokeWidth: number;
  casing: string;
  casingWidth: number;
  shadowDy: number;
  shadowBlur: number;
  shadowOpacity: number;
} {
  const span = Math.max(1, peak - ILE_BLOCKED_ELEVATION);
  const t = Math.max(0, Math.min(1, (altitude - ILE_BLOCKED_ELEVATION) / span));
  const strokeAlpha = (0.86 + t * 0.14).toFixed(2);
  const strokeWidth = Number((2 + t * 1.5).toFixed(2));
  return {
    stroke: `rgba(255,255,255,${strokeAlpha})`,
    fill: "none",
    strokeWidth,
    casing: "rgba(0,0,0,0.82)",
    casingWidth: Number((strokeWidth + 2).toFixed(2)),
    shadowDy: Number((18 + t * 20).toFixed(2)),
    shadowBlur: Number((2.5 + t * 2.5).toFixed(2)),
    shadowOpacity: Number((0.4 + t * 0.28).toFixed(2)),
  };
}

/**
 * Opaque square fill. Blocked ground is the dark floor. Empty ground and
 * chapters step up to a light gray at the peak. One color per altitude, so a
 * cast sitting behind the square cannot grade the face.
 */
export function ileAltitudeSurface(altitude: number, peak: number): string {
  if (altitude <= ILE_BLOCKED_ELEVATION) return "rgb(22, 22, 22)";
  const span = Math.max(1, peak - ILE_OPEN_ELEVATION);
  const t = Math.max(0, Math.min(1, (altitude - ILE_OPEN_ELEVATION) / span));
  const channel = Math.round(48 + t * 128);
  return `rgb(${channel}, ${channel}, ${channel})`;
}

export type IleGroundKind = "open" | "blocked";

export type IleGroundCell = IleAltitudeCell & { blocked: boolean };

export type IleGroundGroup = {
  id: string;
  kind: IleGroundKind;
  cells: IleAltitudeCell[];
  loops: IleAltitudeLoop[];
};

/** 4-connected open ground, and 4-connected blocked ground, each with its own border. */
export function ileGroundGroups(
  cells: readonly IleGroundCell[],
  knownCells: readonly IleAltitudeCell[] = [],
): IleGroundGroup[] {
  const known = knownCells.map((cell) => ({ row: cell.row, col: cell.col }));
  const groups: IleGroundGroup[] = [];
  for (const kind of ["open", "blocked"] as const) {
    const members = cells.filter((cell) => (kind === "blocked" ? cell.blocked : !cell.blocked));
    const byKey = new Map<string, IleAltitudeCell>();
    for (const cell of members) {
      const key = `${cell.row}:${cell.col}`;
      if (!byKey.has(key)) byKey.set(key, { row: cell.row, col: cell.col });
    }
    const seen = new Set<string>();
    for (const start of byKey.values()) {
      const startKey = `${start.row}:${start.col}`;
      if (seen.has(startKey)) continue;
      const part: IleAltitudeCell[] = [];
      const queue = [start];
      seen.add(startKey);
      while (queue.length) {
        const cur = queue.pop()!;
        part.push(cur);
        for (const [dr, dc] of ORTHO) {
          const nextKey = `${cur.row + dr}:${cur.col + dc}`;
          if (seen.has(nextKey)) continue;
          const next = byKey.get(nextKey);
          if (!next) continue;
          seen.add(nextKey);
          queue.push(next);
        }
      }
      part.sort((a, b) => a.row - b.row || a.col - b.col);
      const id = `ground-${kind}-${part.map((cell) => `${cell.row}:${cell.col}`).join(".")}`;
      groups.push({
        id,
        kind,
        cells: part,
        // Open ground only keeps borders that meet another cell. Blocked ground
        // keeps a closed border so an adjacent cluster reads as one region.
        loops: ileAltitudeContourLoops(part, kind === "open" ? known : undefined),
      });
    }
  }
  return groups;
}

/** Cell key `row:col` → elevation. Ground is written first so a chapter on the same square wins. */
export function ileCellElevations(
  chapterGroups: readonly Pick<IleAltitudeGroup, "altitude" | "cells">[],
  groundGroups: readonly Pick<IleGroundGroup, "kind" | "cells">[],
): Map<string, number> {
  const elevation = new Map<string, number>();
  for (const group of groundGroups) {
    const level = group.kind === "blocked" ? ILE_BLOCKED_ELEVATION : ILE_OPEN_ELEVATION;
    for (const cell of group.cells) elevation.set(`${cell.row}:${cell.col}`, level);
  }
  for (const group of chapterGroups) {
    for (const cell of group.cells) elevation.set(`${cell.row}:${cell.col}`, group.altitude);
  }
  return elevation;
}

/** Chapter face stays clickable. The contour is the line; the square itself has no border. */
export const ILE_ALTITUDE_TILE_CLASS = "border-transparent bg-transparent shadow-none";

/** SVG frame that contains every contour, including the half-gap past the origin. */
export function ileAltitudeMapFrame(groups: readonly { loops: readonly IleAltitudeLoop[] }[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const loops = groups.flatMap((group) => group.loops);
  if (loops.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 };
  const minX = Math.min(0, ...loops.map((loop) => loop.minX));
  const minY = Math.min(0, ...loops.map((loop) => loop.minY));
  const maxX = Math.max(1, ...loops.map((loop) => loop.maxX));
  const maxY = Math.max(1, ...loops.map((loop) => loop.maxY));
  const shadowPad = 72;
  return { minX, minY, width: maxX - minX, height: maxY - minY + shadowPad };
}

/** Gap between the outermost squares and the board frame. */
export const ILE_MAP_BOARD_MARGIN_PX = 28;

/** Extra board rows and columns beyond the occupied and blocked squares, split across both sides. */
export const ILE_MAP_BOARD_EXTRA_ROWS = 2;
export const ILE_MAP_BOARD_EXTRA_COLS = 2;

/** Flat field inside the frame. */
export const ILE_MAP_BOARD_FILL = "#303030";

/** Off-white double rule. The gap between the rules shows the field. */
export const ILE_MAP_BOARD_FRAME = "#f4f1ea";
export const ILE_MAP_BOARD_FRAME_OUTER_PX = 3;
export const ILE_MAP_BOARD_FRAME_INNER_PX = 2;
/** Distance from the board edge to the inner rule. Wider than the outer stroke. */
export const ILE_MAP_BOARD_FRAME_INSET_PX = 10;
/**
 * Corner blocks, centered on each corner. Half the size reaches through the
 * inner rule, and stays inside the board margin so tiles stay clear.
 */
export const ILE_MAP_BOARD_CORNER_PX =
  (ILE_MAP_BOARD_FRAME_INSET_PX + ILE_MAP_BOARD_FRAME_INNER_PX) * 2;

export type IleMapBoard = {
  minRow: number;
  minCol: number;
  maxRow: number;
  maxCol: number;
  minX: number;
  minY: number;
  width: number;
  height: number;
};

/** Axis-aligned board around the map's squares. Empty viewport cells outside it are not on the board. */
export function ileMapBoardBounds(
  cells: readonly IleAltitudeCell[],
): IleMapBoard | null {
  if (cells.length === 0) return null;
  let minRow = cells[0]!.row;
  let maxRow = cells[0]!.row;
  let minCol = cells[0]!.col;
  let maxCol = cells[0]!.col;
  for (const cell of cells) {
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxCol = Math.max(maxCol, cell.col);
  }
  const rowBefore = Math.floor(ILE_MAP_BOARD_EXTRA_ROWS / 2);
  const colBefore = Math.floor(ILE_MAP_BOARD_EXTRA_COLS / 2);
  minRow -= rowBefore;
  maxRow += ILE_MAP_BOARD_EXTRA_ROWS - rowBefore;
  minCol -= colBefore;
  maxCol += ILE_MAP_BOARD_EXTRA_COLS - colBefore;
  const minX = minCol * ILE_BOARD_PITCH - ILE_MAP_BOARD_MARGIN_PX;
  const minY = minRow * ILE_BOARD_PITCH - ILE_MAP_BOARD_MARGIN_PX;
  const maxX = maxCol * ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE + ILE_MAP_BOARD_MARGIN_PX;
  const maxY = maxRow * ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE + ILE_MAP_BOARD_MARGIN_PX;
  return {
    minRow,
    minCol,
    maxRow,
    maxCol,
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function ileAltitudeGroups(
  chapters: readonly IleAltitudeChapter[],
): IleAltitudeGroup[] {
  const placed: Array<IleAltitudeChapter & { cell: IleAltitudeCell }> = [];
  const ids = new Set<string>();
  for (const chapter of chapters) {
    const id = cleanId(chapter.id);
    const cell = finiteCell(chapter.row, chapter.col);
    if (!id || !cell || ids.has(id)) continue;
    ids.add(id);
    placed.push({ ...chapter, id, cell });
  }
  if (placed.length === 0) return [];

  const incoming = new Map<string, Set<string>>();
  const addEdge = (higher: string, lower: string) => {
    if (!ids.has(higher) || !ids.has(lower) || higher === lower) return;
    const set = incoming.get(lower) ?? new Set<string>();
    set.add(higher);
    incoming.set(lower, set);
  };
  for (const chapter of placed) {
    for (const prereq of uniq(chapter.lockUntilIds)) addEdge(prereq, chapter.id);
    for (const next of uniq(chapter.nextIds)) addEdge(chapter.id, next);
  }

  const depthMemo = new Map<string, number>();
  const depthOf = (id: string, stack: Set<string>): number => {
    const cached = depthMemo.get(id);
    if (cached != null) return cached;
    if (stack.has(id)) return 0;
    const ups = incoming.get(id);
    if (!ups || ups.size === 0) {
      depthMemo.set(id, 0);
      return 0;
    }
    stack.add(id);
    let best = 0;
    for (const up of ups) best = Math.max(best, depthOf(up, stack) + 1);
    stack.delete(id);
    depthMemo.set(id, best);
    return best;
  };
  const depth = new Map<string, number>();
  let maxDepth = 0;
  for (const chapter of placed) {
    const value = depthOf(chapter.id, new Set());
    depth.set(chapter.id, value);
    maxDepth = Math.max(maxDepth, value);
  }

  const byAltitude = new Map<number, Array<{ id: string; cell: IleAltitudeCell }>>();
  for (const chapter of placed) {
    const altitude = maxDepth - (depth.get(chapter.id) ?? 0);
    const list = byAltitude.get(altitude) ?? [];
    list.push({ id: chapter.id, cell: chapter.cell });
    byAltitude.set(altitude, list);
  }

  const groups: IleAltitudeGroup[] = [];
  const altitudes = [...byAltitude.keys()].sort((a, b) => a - b);
  for (const altitude of altitudes) {
    const members = byAltitude.get(altitude) ?? [];
    const byKey = new Map<string, { cell: IleAltitudeCell; ids: string[] }>();
    for (const member of members) {
      const key = `${member.cell.row}:${member.cell.col}`;
      const existing = byKey.get(key);
      if (existing) existing.ids.push(member.id);
      else byKey.set(key, { cell: member.cell, ids: [member.id] });
    }
    const seen = new Set<string>();
    for (const start of byKey.values()) {
      const startKey = `${start.cell.row}:${start.cell.col}`;
      if (seen.has(startKey)) continue;
      const cells: IleAltitudeCell[] = [];
      const chapterIds: string[] = [];
      const queue = [start];
      seen.add(startKey);
      while (queue.length) {
        const cur = queue.pop()!;
        cells.push(cur.cell);
        chapterIds.push(...cur.ids);
        for (const [dr, dc] of ORTHO) {
          const nextKey = `${cur.cell.row + dr}:${cur.cell.col + dc}`;
          if (seen.has(nextKey)) continue;
          const next = byKey.get(nextKey);
          if (!next) continue;
          seen.add(nextKey);
          queue.push(next);
        }
      }
      cells.sort((a, b) => a.row - b.row || a.col - b.col);
      const id = `alt-${altitude}-${cells.map((cell) => `${cell.row}:${cell.col}`).join(".")}`;
      groups.push({
        id,
        altitude,
        chapterIds,
        cells,
        loops: ileAltitudeContourLoops(cells),
      });
    }
  }
  return groups;
}
