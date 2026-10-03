/**
 * TAP Learning route overlay. The main path is the longest chain in the stored
 * chapter DAG (high ground toward lower ground). Other links are detours.
 * Step order never invents an edge.
 */
import { ILE_BOARD_CELL_SIZE, ILE_BOARD_PITCH } from "@/lib/block-skill-grid";
import type { IleAltitudeChapter } from "@/lib/ile-altitude-map";

/** Yellow route drawn under the chapter squares. */
export const ILE_PATH_YELLOW = "#ffe14a";
/**
 * Chapter squares are almost solid. A faint fraction of the route still shows through.
 * 1 is opaque. The tile fill and open-work still use the same fraction.
 */
export const ILE_CHAPTER_BLOCK_ALPHA = 0.94;
export const ILE_PATH_SPINE_WIDTH = 6;
export const ILE_PATH_SPINE_CASING_WIDTH = 10;
export const ILE_PATH_DETOUR_WIDTH = 3;

export type IlePathPoint = {
  chapterId: string;
  x: number;
  y: number;
};

export type IlePathRoute = {
  id: string;
  kind: "spine" | "detour";
  chapterIds: string[];
  points: IlePathPoint[];
};

export type IlePathOverlay = {
  spine: IlePathRoute | null;
  detours: IlePathRoute[];
};

type Placed = {
  id: string;
  row: number;
  col: number;
};

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
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

/** Center of a chapter square in world pixels. */
export function ilePathCellCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: col * ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE / 2,
    y: row * ILE_BOARD_PITCH + ILE_BOARD_CELL_SIZE / 2,
  };
}

function edgeKey(from: string, to: string): string {
  return `${from}>${to}`;
}

function betterRoute(candidate: readonly string[], best: readonly string[]): boolean {
  if (candidate.length !== best.length) return candidate.length > best.length;
  return candidate.join("\0") < best.join("\0");
}

function placedChapters(chapters: readonly IleAltitudeChapter[]): Placed[] {
  const byId = new Map<string, Placed>();
  for (const chapter of chapters) {
    const id = cleanId(chapter.id);
    if (!id || byId.has(id)) continue;
    if (typeof chapter.row !== "number" || typeof chapter.col !== "number") continue;
    if (!Number.isFinite(chapter.row) || !Number.isFinite(chapter.col)) continue;
    byId.set(id, { id, row: Math.trunc(chapter.row), col: Math.trunc(chapter.col) });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function adjacency(
  chapters: readonly IleAltitudeChapter[],
  placed: readonly Placed[],
): Map<string, string[]> {
  const ids = new Set(placed.map((chapter) => chapter.id));
  const out = new Map<string, Set<string>>();
  for (const id of ids) out.set(id, new Set());
  const add = (from: string, to: string) => {
    if (!from || !to || from === to) return;
    if (!ids.has(from) || !ids.has(to)) return;
    out.get(from)?.add(to);
  };
  for (const chapter of chapters) {
    const id = cleanId(chapter.id);
    if (!ids.has(id)) continue;
    for (const prereq of uniq(chapter.lockUntilIds)) add(prereq, id);
    for (const next of uniq(chapter.nextIds)) add(id, next);
  }
  const lists = new Map<string, string[]>();
  for (const [id, nexts] of out) lists.set(id, [...nexts].sort());
  return lists;
}

/** Longest simple chain. Ties keep the smallest end id and the earliest predecessor. */
function longestChain(ids: readonly string[], out: Map<string, string[]>): string[] {
  if (ids.length === 0) return [];
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  for (const id of ids) dist.set(id, 0);
  const limit = ids.length;
  for (let pass = 0; pass < limit; pass += 1) {
    let changed = false;
    for (const from of ids) {
      const base = dist.get(from) ?? 0;
      for (const to of out.get(from) || []) {
        const next = base + 1;
        if (next >= limit) continue;
        const current = dist.get(to) ?? 0;
        if (next > current) {
          dist.set(to, next);
          prev.set(to, from);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  let end = "";
  let best = 0;
  for (const id of ids) {
    const value = dist.get(id) ?? 0;
    if (value > best) {
      best = value;
      end = id;
    }
  }
  if (best <= 0 || !end) return [];
  const path: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = end;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    path.push(cursor);
    cursor = prev.get(cursor);
  }
  path.reverse();
  return path.length >= 2 ? path : [];
}

function residualDetours(
  ids: readonly string[],
  out: Map<string, string[]>,
  spine: readonly string[],
): string[][] {
  const spineSet = new Set(spine);
  const blocked = new Set<string>();
  for (let index = 0; index < spine.length - 1; index += 1) {
    blocked.add(edgeKey(spine[index], spine[index + 1]));
  }
  const routes: string[][] = [];
  const seen = new Set<string>();
  const guard = ids.length * Math.max(1, ids.length) + 1;

  const starts = (): string[] => {
    const rank = new Map(spine.map((id, index) => [id, index]));
    const found: string[] = [];
    for (const id of ids) {
      const open = (out.get(id) || []).some((next) => !blocked.has(edgeKey(id, next)));
      if (!open) continue;
      const incoming = ids.some((from) =>
        (out.get(from) || []).some((to) => to === id && !blocked.has(edgeKey(from, to))),
      );
      if (spineSet.has(id) || !incoming) found.push(id);
    }
    found.sort(
      (a, b) => (rank.get(a) ?? 1000) - (rank.get(b) ?? 1000) || a.localeCompare(b),
    );
    return found;
  };

  for (let step = 0; step < guard; step += 1) {
    const start = starts()[0];
    if (!start) break;
    const memo = new Map<string, string[]>();
    const longestFrom = (origin: string, stack: Set<string>): string[] => {
      if (stack.size > 0 && spineSet.has(origin)) return [origin];
      if (stack.has(origin)) return [origin];
      const cached = memo.get(origin);
      if (cached) return cached;
      stack.add(origin);
      let best = [origin];
      let cyclic = false;
      for (const next of out.get(origin) || []) {
        if (blocked.has(edgeKey(origin, next))) continue;
        if (stack.has(next)) {
          cyclic = true;
          continue;
        }
        const tail = longestFrom(next, stack);
        const candidate = [origin, ...tail];
        if (betterRoute(candidate, best)) best = candidate;
      }
      stack.delete(origin);
      if (!cyclic) memo.set(origin, best);
      return best;
    };
    const route = longestFrom(start, new Set());
    if (route.length < 2) {
      for (const next of out.get(start) || []) blocked.add(edgeKey(start, next));
      continue;
    }
    const key = route.join(">");
    if (!seen.has(key)) {
      seen.add(key);
      routes.push(route);
    }
    for (let index = 0; index < route.length - 1; index += 1) {
      blocked.add(edgeKey(route[index], route[index + 1]));
    }
  }
  return routes;
}

function toRoute(
  id: string,
  kind: IlePathRoute["kind"],
  chapterIds: readonly string[],
  cells: ReadonlyMap<string, Placed>,
): IlePathRoute {
  return {
    id,
    kind,
    chapterIds: [...chapterIds],
    points: chapterIds.map((chapterId) => {
      const cell = cells.get(chapterId)!;
      const center = ilePathCellCenter(cell.row, cell.col);
      return { chapterId, x: center.x, y: center.y };
    }),
  };
}

export function ilePathOverlay(chapters: readonly IleAltitudeChapter[]): IlePathOverlay {
  const placed = placedChapters(chapters);
  const cells = new Map(placed.map((chapter) => [chapter.id, chapter]));
  const ids = placed.map((chapter) => chapter.id);
  const out = adjacency(chapters, placed);
  const spineIds = longestChain(ids, out);
  if (spineIds.length < 2) return { spine: null, detours: [] };
  const detourIds = residualDetours(ids, out, spineIds);
  return {
    spine: toRoute("spine", "spine", spineIds, cells),
    detours: detourIds.map((route, index) =>
      toRoute(`detour-${index}-${route.join(".")}`, "detour", route, cells),
    ),
  };
}

export function ilePathMapFrame(overlay: IlePathOverlay): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} | null {
  const points = [
    ...(overlay.spine?.points ?? []),
    ...overlay.detours.flatMap((route) => route.points),
  ];
  if (points.length === 0) return null;
  const pad = 8;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: Math.max(1, maxX - minX + pad * 2),
    height: Math.max(1, maxY - minY + pad * 2),
  };
}

export function ilePathRouteD(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}
