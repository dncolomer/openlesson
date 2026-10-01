/**
 * ILE altitude bands. The chapter DAG sets elevation: a chapter with no
 * prerequisites is the high ground, and each step down (lock-until or
 * leads-to) is lower. Adjacent squares at the same elevation share one
 * rectilinear outline. Order never invents an edge.
 */
import { SKILL_GRID_GAP, SKILL_GRID_PITCH } from "@/lib/block-skill-grid";

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

type UnitEdge = { x: number; y: number; dx: number; dy: number };

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

/** World pixel for a contour vertex. Adjacent cells share this edge through the gap. */
export function ileAltitudeVertexPx(x: number, y: number): { x: number; y: number } {
  const pad = SKILL_GRID_GAP / 2;
  return { x: x * SKILL_GRID_PITCH - pad, y: y * SKILL_GRID_PITCH - pad };
}

function edgeKey(edge: UnitEdge): string {
  return `${edge.x},${edge.y},${edge.dx},${edge.dy}`;
}

function toggleEdge(edges: Map<string, UnitEdge>, edge: UnitEdge) {
  const reverse: UnitEdge = {
    x: edge.x + edge.dx,
    y: edge.y + edge.dy,
    dx: -edge.dx,
    dy: -edge.dy,
  };
  const revKey = edgeKey(reverse);
  if (edges.has(revKey)) {
    edges.delete(revKey);
    return;
  }
  edges.set(edgeKey(edge), edge);
}

/** Closed rectilinear loops around a set of unit cells, in world pixels. */
export function ileAltitudeContourLoops(cells: readonly IleAltitudeCell[]): IleAltitudeLoop[] {
  const edges = new Map<string, UnitEdge>();
  for (const cell of cells) {
    toggleEdge(edges, { x: cell.col, y: cell.row, dx: 1, dy: 0 });
    toggleEdge(edges, { x: cell.col + 1, y: cell.row, dx: 0, dy: 1 });
    toggleEdge(edges, { x: cell.col + 1, y: cell.row + 1, dx: -1, dy: 0 });
    toggleEdge(edges, { x: cell.col, y: cell.row + 1, dx: 0, dy: -1 });
  }
  const byStart = new Map<string, UnitEdge[]>();
  for (const edge of edges.values()) {
    const key = `${edge.x},${edge.y}`;
    const list = byStart.get(key);
    if (list) list.push(edge);
    else byStart.set(key, [edge]);
  }
  const unused = new Set(edges.keys());
  const loops: IleAltitudeLoop[] = [];
  for (const key of edges.keys()) {
    if (!unused.has(key)) continue;
    const first = edges.get(key);
    if (!first) continue;
    const points: { x: number; y: number }[] = [ileAltitudeVertexPx(first.x, first.y)];
    let current = first;
    unused.delete(key);
    for (let guard = 0; guard < edges.size + 2; guard += 1) {
      const nx = current.x + current.dx;
      const ny = current.y + current.dy;
      points.push(ileAltitudeVertexPx(nx, ny));
      if (nx === first.x && ny === first.y) break;
      const next = (byStart.get(`${nx},${ny}`) || []).find((edge) => unused.has(edgeKey(edge)));
      if (!next) break;
      unused.delete(edgeKey(next));
      current = next;
    }
    if (points.length < 4) continue;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const labelX = Math.min(...xs);
    const labelY = Math.min(...ys);
    const [start, ...rest] = points;
    const d = `M ${start.x} ${start.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")} Z`;
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

/**
 * A quiet hairline around each terrace. Height is a short soft shadow under
 * that line, not a second outline. `peak` is the highest altitude on the map.
 */
export function ileAltitudePaint(
  altitude: number,
  peak: number,
): {
  stroke: string;
  fill: string;
  strokeWidth: number;
  shadowDy: number;
  shadowBlur: number;
  shadowOpacity: number;
} {
  const t = peak <= 0 ? 1 : Math.max(0, Math.min(1, altitude / peak));
  const strokeAlpha = (0.22 + t * 0.36).toFixed(2);
  const fillAlpha = (0.012 + t * 0.028).toFixed(3);
  return {
    stroke: `rgba(255,255,255,${strokeAlpha})`,
    fill: `rgba(255,255,255,${fillAlpha})`,
    strokeWidth: 1,
    shadowDy: Number((0.8 + t * 2.4).toFixed(2)),
    shadowBlur: Number((0.5 + t * 1.1).toFixed(2)),
    shadowOpacity: Number((0.16 + t * 0.28).toFixed(2)),
  };
}

/** Chapter face sits inside the contour. The square stays clickable and unboxed. */
export const ILE_ALTITUDE_TILE_CLASS = "border-transparent bg-transparent shadow-none";

/** SVG frame that contains every contour, including the half-gap past the origin. */
export function ileAltitudeMapFrame(groups: readonly IleAltitudeGroup[]): {
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
  const shadowPad = 8;
  return { minX, minY, width: maxX - minX, height: maxY - minY + shadowPad };
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
        for (const [dr, dc] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
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
