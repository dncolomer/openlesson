/**
 * Fog of war for workspace / ILE skill-grid empty cells.
 *
 * Occupied ("full") cells illuminate nearby empties: a fixed Chebyshev radius,
 * bumped slightly where occupied concentration is high, with a one-ring fade
 * into the black map background. Extra-reveal cells (suggest-best-spot hits,
 * selected suggested empties) are fully visible even when occupancy would
 * hide them. Live-drag occupied cells illuminate from their offset position
 * with the same radius rule.
 *
 * Viewport generation, occupancy maps, and cell geometry are unchanged —
 * this is a visual/overlay transform plus a fully-visible gate for build/add.
 */

import { chebyshevDistance, getCellKey } from "@/lib/block-skill-grid";

export type MapFogCell = { row: number; col: number };

export type MapFogCellVisibility = {
  /** 0 = black / hidden empty chrome; 1 = fully shown. */
  opacity: number;
  /** True only at opacity 1 (occupied, extra-reveal, or inside full radius). */
  fullyVisible: boolean;
};

export type MapFogLookup = (row: number, col: number) => MapFogCellVisibility;

/** Chebyshev radius around an isolated occupied cell that is fully visible. */
export const MAP_FOG_BASE_RADIUS = 2;

/** Extra rings of partial opacity beyond the full-visible radius. */
export const MAP_FOG_FADE_BAND = 1;

/** Neighborhood used to measure occupied concentration (Chebyshev). */
export const MAP_FOG_DENSITY_WINDOW = 2;

/** Occupied cells in the density window (including self) that trigger a bump. */
export const MAP_FOG_DENSITY_THRESHOLD = 4;

/** Extra full-visible radius when local concentration meets the threshold. */
export const MAP_FOG_DENSITY_RADIUS_BUMP = 1;

/** Blank maps pretend this cell is occupied for fog only (it stays empty/placeable). */
export const MAP_FOG_EMPTY_ORIGIN: MapFogCell = { row: 0, col: 0 };

const HIDDEN: MapFogCellVisibility = { opacity: 0, fullyVisible: false };
const SHOWN: MapFogCellVisibility = { opacity: 1, fullyVisible: true };

export function parseMapFogCellKey(
  key: string,
): MapFogCell | null {
  const i = String(key).lastIndexOf(":");
  if (i <= 0) return null;
  const row = Number(key.slice(0, i));
  const col = Number(key.slice(i + 1));
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function addKey(set: Set<string>, key: unknown) {
  const k = String(key ?? "");
  if (k.includes(":")) set.add(k);
}

function keysFromCells(
  cells?: ReadonlyArray<MapFogCell> | null,
): Set<string> {
  const out = new Set<string>();
  for (const c of cells || []) {
    if (!Number.isFinite(c.row) || !Number.isFinite(c.col)) continue;
    out.add(getCellKey(Math.trunc(c.row), Math.trunc(c.col)));
  }
  return out;
}

function addIterableKeys(
  set: Set<string>,
  keys?: Iterable<string> | ReadonlySet<string> | null,
) {
  if (!keys) return;
  for (const k of keys) addKey(set, k);
}

/**
 * Occupied cells that illuminate fog, with live-drag members translated
 * by their current offset (origin cells of those members are dropped).
 */
export function resolveFogOccupiedKeys(input: {
  occupancy?: Map<string, string> | null;
  occupiedKeys?: Iterable<string> | ReadonlySet<string> | null;
  dragBlockIds?: readonly string[] | null;
  dragOffset?: { dRow: number; dCol: number } | null;
}): Set<string> {
  const dragIds = new Set(
    (input.dragBlockIds || []).map(String).filter(Boolean),
  );
  const offset = input.dragOffset;
  const dragging =
    dragIds.size > 0 &&
    offset &&
    Number.isFinite(offset.dRow) &&
    Number.isFinite(offset.dCol);

  const out = new Set<string>();
  const occupancy = input.occupancy;

  if (occupancy && occupancy.size > 0) {
    for (const [key, blockId] of occupancy) {
      const cell = parseMapFogCellKey(key);
      if (!cell) continue;
      if (dragging && dragIds.has(String(blockId))) {
        out.add(
          getCellKey(
            cell.row + Math.trunc(offset.dRow),
            cell.col + Math.trunc(offset.dCol),
          ),
        );
        continue;
      }
      out.add(getCellKey(cell.row, cell.col));
    }
    return out;
  }

  addIterableKeys(out, input.occupiedKeys);
  return out;
}

/** Occupied count in the density window around a cell (includes self). */
export function occupiedConcentrationAt(
  row: number,
  col: number,
  occupiedKeys: ReadonlySet<string>,
  window = MAP_FOG_DENSITY_WINDOW,
): number {
  const w = Math.max(0, Math.floor(Number(window) || 0));
  let n = 0;
  for (let dr = -w; dr <= w; dr++) {
    for (let dc = -w; dc <= w; dc++) {
      if (occupiedKeys.has(getCellKey(row + dr, col + dc))) n += 1;
    }
  }
  return n;
}

/** Full-visible Chebyshev radius for a source given local occupied count. */
export function occupiedFogRadius(localOccupiedCount: number): number {
  const n = Math.max(0, Math.floor(Number(localOccupiedCount) || 0));
  const bump = n >= MAP_FOG_DENSITY_THRESHOLD ? MAP_FOG_DENSITY_RADIUS_BUMP : 0;
  return MAP_FOG_BASE_RADIUS + bump;
}

/**
 * Opacity at Chebyshev `distance` from a source whose full-visible radius is
 * `radius`. Fade-band cells are strictly between 0 and 1.
 */
export function fogOpacityForDistance(distance: number, radius: number): number {
  const d = Number(distance);
  const r = Number(radius);
  if (!Number.isFinite(d) || !Number.isFinite(r) || d <= r) return 1;
  if (d > r + MAP_FOG_FADE_BAND) return 0;
  const t = (d - r) / (MAP_FOG_FADE_BAND + 1);
  return Math.max(0, Math.min(1, 1 - t));
}

/** Build/add is allowed only on fully visible empty cells. */
export function canBuildOnFogVisibleEmpty(
  visibility: MapFogCellVisibility | null | undefined,
): boolean {
  return Boolean(visibility?.fullyVisible);
}

type FogSource = MapFogCell & { radius: number };

function illuminateFromSources(
  row: number,
  col: number,
  sources: readonly FogSource[],
): MapFogCellVisibility {
  let bestOpacity = 0;
  let fullyVisible = false;
  const target = { row, col };
  for (const source of sources) {
    const d = chebyshevDistance(target, source);
    if (d <= source.radius) {
      return SHOWN;
    }
    const opacity = fogOpacityForDistance(d, source.radius);
    if (opacity > bestOpacity) bestOpacity = opacity;
    if (opacity >= 1) fullyVisible = true;
  }
  if (fullyVisible) return SHOWN;
  if (bestOpacity <= 0) return HIDDEN;
  return { opacity: bestOpacity, fullyVisible: false };
}

/**
 * Pure lookup: occupancy (+ live drag) + extra-reveal → empty-cell opacity.
 * Occupied cells and extra-reveal cells are always fully visible.
 * Blank maps (no occupied sources) pretend (0,0) is full for illumination
 * only — that cell stays empty/placeable in the real occupancy map.
 */
export function createMapFogLookup(input: {
  occupancy?: Map<string, string> | null;
  occupiedKeys?: Iterable<string> | ReadonlySet<string> | null;
  extraRevealCells?: ReadonlyArray<MapFogCell> | null;
  extraRevealKeys?: Iterable<string> | ReadonlySet<string> | null;
  dragBlockIds?: readonly string[] | null;
  dragOffset?: { dRow: number; dCol: number } | null;
}): MapFogLookup {
  const occupied = resolveFogOccupiedKeys(input);
  if (occupied.size === 0) {
    occupied.add(getCellKey(MAP_FOG_EMPTY_ORIGIN.row, MAP_FOG_EMPTY_ORIGIN.col));
  }
  const extra = keysFromCells(input.extraRevealCells);
  addIterableKeys(extra, input.extraRevealKeys);

  const sources: FogSource[] = [];
  for (const key of occupied) {
    const cell = parseMapFogCellKey(key);
    if (!cell) continue;
    sources.push({
      row: cell.row,
      col: cell.col,
      radius: occupiedFogRadius(
        occupiedConcentrationAt(cell.row, cell.col, occupied),
      ),
    });
  }

  return (row: number, col: number): MapFogCellVisibility => {
    const key = getCellKey(row, col);
    if (extra.has(key)) return SHOWN;
    if (occupied.has(key)) return SHOWN;
    return illuminateFromSources(row, col, sources);
  };
}
