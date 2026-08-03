/**
 * Pure helpers for multi-select "Bridge Blocks":
 * straight-line corridor between selected block anchors.
 * Independent **width** (half-width thickness) and **density** (fill of corridor).
 * Free of React so unit tests drive the real selection path.
 */

import type { AddExpandCell } from "@/lib/add-block-range-density";

export type BridgeCell = AddExpandCell;

/** Density 0..100 — fraction of placeable corridor cells to keep (after width). */
export const BRIDGE_DENSITY_MIN = 0;
export const BRIDGE_DENSITY_MAX = 100;
/**
 * Hard cap on corridor half-width in grid cells (thickness ≤ 2·max+1).
 * Prevents arbitrarily thick "bridges".
 */
export const BRIDGE_MAX_HALF_WIDTH = 2;
/** Width slider range (half-width in cells). */
export const BRIDGE_WIDTH_MIN = 0;
export const BRIDGE_WIDTH_MAX = BRIDGE_MAX_HALF_WIDTH;

function cellKey(c: BridgeCell): string {
  return `${c.row}:${c.col}`;
}

function toSet(
  keys?: ReadonlySet<string> | readonly string[] | null,
): Set<string> {
  if (keys instanceof Set) return keys;
  return new Set(keys || []);
}

/** Clamp density into 0..100. */
export function clampBridgeDensity(density: number): number {
  const d = Number(density);
  if (!Number.isFinite(d)) return BRIDGE_DENSITY_MIN;
  return Math.min(
    BRIDGE_DENSITY_MAX,
    Math.max(BRIDGE_DENSITY_MIN, Math.round(d)),
  );
}

/** Clamp corridor half-width into 0..BRIDGE_WIDTH_MAX. */
export function clampBridgeWidth(width: number): number {
  const w = Number(width);
  if (!Number.isFinite(w)) return BRIDGE_WIDTH_MIN;
  return Math.min(
    BRIDGE_WIDTH_MAX,
    Math.max(BRIDGE_WIDTH_MIN, Math.round(w)),
  );
}

/**
 * Legacy helper: map density → corridor half-width (when width not provided).
 * Prefer explicit `width` in resolveBridgeSelection for dual-slider UI.
 */
export function bridgeHalfWidthForDensity(density: number): number {
  const d = clampBridgeDensity(density);
  return Math.min(
    BRIDGE_MAX_HALF_WIDTH,
    Math.round((d / BRIDGE_DENSITY_MAX) * BRIDGE_MAX_HALF_WIDTH),
  );
}

/**
 * From a thickened placeable corridor, keep spine placeables + a density-based
 * sample of off-spine cells. Density 0 → spine only; 100 → all candidates.
 */
export function selectCorridorByDensity(
  candidates: readonly BridgeCell[],
  spine: readonly BridgeCell[],
  density: number,
): BridgeCell[] {
  const d = clampBridgeDensity(density);
  if (candidates.length === 0) return [];
  const candKeys = new Set(candidates.map(cellKey));
  const spinePlaceable = spine.filter((c) => candKeys.has(cellKey(c)));
  if (d <= 0) return spinePlaceable.map((c) => ({ row: c.row, col: c.col }));
  if (d >= 100) {
    return candidates.map((c) => ({ row: c.row, col: c.col }));
  }

  const spineKeySet = new Set(spinePlaceable.map(cellKey));
  const offSpine = candidates.filter((c) => !spineKeySet.has(cellKey(c)));
  // Target total count between spine-only and full candidates
  const minN = spinePlaceable.length;
  const maxN = candidates.length;
  const target = Math.max(
    minN,
    Math.min(maxN, Math.round(minN + ((maxN - minN) * d) / 100)),
  );
  const needOff = Math.max(0, target - minN);
  // Stride sample for stable, content-sensitive fill
  const pickedOff: BridgeCell[] = [];
  if (needOff > 0 && offSpine.length > 0) {
    if (needOff >= offSpine.length) {
      pickedOff.push(...offSpine);
    } else {
      const step = offSpine.length / needOff;
      for (let i = 0; i < needOff; i++) {
        const idx = Math.min(offSpine.length - 1, Math.floor(i * step));
        pickedOff.push(offSpine[idx]);
      }
    }
  }
  const out: BridgeCell[] = [];
  const seen = new Set<string>();
  for (const c of [...spinePlaceable, ...pickedOff]) {
    const k = cellKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ row: c.row, col: c.col });
  }
  return out;
}

/**
 * Integer line cells from a → b (inclusive), Bresenham-style.
 * Order is walk order along the segment.
 */
export function lineCellsBetween(
  a: BridgeCell,
  b: BridgeCell,
): BridgeCell[] {
  let r0 = Math.trunc(a.row);
  let c0 = Math.trunc(a.col);
  const r1 = Math.trunc(b.row);
  const c1 = Math.trunc(b.col);
  const dr = Math.abs(r1 - r0);
  const dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1;
  const sc = c0 < c1 ? 1 : -1;
  let err = dc - dr;
  const out: BridgeCell[] = [];
  const seen = new Set<string>();
  // Safety bound for pathological inputs
  const maxSteps = Math.max(1, dr + dc + 2) * 4;
  let steps = 0;
  for (;;) {
    const cell = { row: r0, col: c0 };
    const k = cellKey(cell);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(cell);
    }
    if (r0 === r1 && c0 === c1) break;
    if (++steps > maxSteps) break;
    const e2 = 2 * err;
    if (e2 > -dr) {
      err -= dr;
      c0 += sc;
    }
    if (e2 < dc) {
      err += dc;
      r0 += sr;
    }
  }
  return out;
}

/**
 * Polyline spine through anchors in order (selection order).
 * Adjacent duplicates collapsed.
 */
export function polylineCells(
  anchors: readonly BridgeCell[],
): BridgeCell[] {
  if (!anchors.length) return [];
  const out: BridgeCell[] = [];
  const seen = new Set<string>();
  const push = (c: BridgeCell) => {
    const k = cellKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ row: c.row, col: c.col });
  };
  const norm = anchors.map((a) => ({
    row: Math.trunc(a.row),
    col: Math.trunc(a.col),
  }));
  push(norm[0]);
  for (let i = 1; i < norm.length; i++) {
    const seg = lineCellsBetween(norm[i - 1], norm[i]);
    for (const c of seg) push(c);
  }
  return out;
}

/**
 * Expand a spine by Chebyshev half-width (square brush).
 * halfWidth 0 → spine only. Result order: spine first, then rings.
 */
export function thickenCorridor(
  spine: readonly BridgeCell[],
  halfWidth: number,
): BridgeCell[] {
  const w = Math.min(
    BRIDGE_MAX_HALF_WIDTH,
    Math.max(0, Math.floor(Number(halfWidth) || 0)),
  );
  const out: BridgeCell[] = [];
  const seen = new Set<string>();
  const push = (c: BridgeCell) => {
    const k = cellKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ row: c.row, col: c.col });
  };
  for (const s of spine) push(s);
  if (w <= 0) return out;
  for (const s of spine) {
    for (let dr = -w; dr <= w; dr++) {
      for (let dc = -w; dc <= w; dc++) {
        if (dr === 0 && dc === 0) continue;
        // Chebyshev ball for a compact "thick line"
        if (Math.max(Math.abs(dr), Math.abs(dc)) > w) continue;
        push({ row: s.row + dr, col: s.col + dc });
      }
    }
  }
  return out;
}

/**
 * Placeable cells in a corridor: drop occupied + unusable.
 * Prefer spine order (already front of thickened list).
 */
export function placeableCorridorCells(input: {
  corridor: readonly BridgeCell[];
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): BridgeCell[] {
  const occupied = toSet(input.occupiedKeys);
  const unusable = toSet(input.unusableKeys);
  const out: BridgeCell[] = [];
  for (const c of input.corridor || []) {
    const k = cellKey(c);
    if (occupied.has(k) || unusable.has(k)) continue;
    out.push({ row: c.row, col: c.col });
  }
  return out;
}

/**
 * Full bridge selection: multi-anchor polyline → thickness from **width** →
 * placeable filter → **density** fill sample.
 *
 * - `width` (preferred): corridor half-width in cells (0..BRIDGE_WIDTH_MAX).
 * - `density` (0..100): how many placeable corridor cells to keep
 *   (0 = placeable spine only; 100 = full thickened corridor).
 * - Legacy: when `width` is omitted, half-width is derived from density
 *   (old single-slider behavior) and all placeable cells are kept when density
 *   alone was used as thickness — if both are provided, they are independent.
 */
export function resolveBridgeSelection(input: {
  anchors: readonly BridgeCell[];
  density?: number;
  /** Explicit corridor half-width (independent of density). */
  width?: number;
  seed?: number;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): {
  halfWidth: number;
  width: number;
  density: number;
  spine: BridgeCell[];
  candidates: BridgeCell[];
  selected: BridgeCell[];
} {
  void input.seed;
  const anchors = (input.anchors || [])
    .map((a) => ({ row: Math.trunc(a.row), col: Math.trunc(a.col) }))
    .filter((a) => Number.isFinite(a.row) && Number.isFinite(a.col));
  // De-dupe consecutive identical anchors
  const uniqueAnchors: BridgeCell[] = [];
  for (const a of anchors) {
    const prev = uniqueAnchors[uniqueAnchors.length - 1];
    if (prev && prev.row === a.row && prev.col === a.col) continue;
    uniqueAnchors.push(a);
  }
  const density = clampBridgeDensity(
    input.density === undefined ? BRIDGE_DENSITY_MAX : input.density,
  );
  const widthExplicit = input.width !== undefined && input.width !== null;
  const width = widthExplicit
    ? clampBridgeWidth(Number(input.width))
    : bridgeHalfWidthForDensity(density);
  const halfWidth = width;
  if (uniqueAnchors.length < 2) {
    return {
      halfWidth,
      width,
      density,
      spine: [],
      candidates: [],
      selected: [],
    };
  }
  const spine = polylineCells(uniqueAnchors);
  const corridor = thickenCorridor(spine, halfWidth);
  const candidates = placeableCorridorCells({
    corridor,
    occupiedKeys: input.occupiedKeys,
    unusableKeys: input.unusableKeys,
  });
  // When width is explicit, density samples the thickened corridor.
  // Legacy density-only path (width omitted): keep full placeable corridor
  // (old "density = thickness" behavior).
  const selected = widthExplicit
    ? selectCorridorByDensity(candidates, spine, density)
    : candidates.map((c) => ({ row: c.row, col: c.col }));
  return {
    halfWidth,
    width,
    density,
    spine,
    candidates,
    selected,
  };
}

/**
 * Force knowledge-bridge framing between selected concepts + optional user guidance.
 * Used as the base prompt for every bridge slot create.
 */
export function buildBridgeKnowledgePrompt(input: {
  blockTitles: readonly string[];
  userGuidance?: string | null;
  slotIndex?: number;
  totalSlots?: number;
  cell?: BridgeCell | null;
}): string {
  const titles = (input.blockTitles || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  const label =
    titles.length >= 2
      ? titles.map((t) => `"${t}"`).join(" ↔ ")
      : titles[0]
        ? `"${titles[0]}"`
        : "the selected topics";
  const guidance = String(input.userGuidance || "").trim();
  const parts = [
    `Create a knowledge-bridge lesson that explicitly links these concepts: ${label}.`,
    "This block sits on a straight bridge path between those topics on the map.",
    "Frame the content as a bridge in knowledge: a connecting idea, transition, prerequisite link, shared foundation, or comparison that helps a learner move between the concepts — not an isolated unrelated topic.",
  ];
  if (guidance) {
    parts.push(`Author bridging guidance: ${guidance}`);
  }
  const i = Math.max(0, Math.floor(Number(input.slotIndex) || 0));
  const n = Math.max(1, Math.floor(Number(input.totalSlots) || 1));
  if (input.cell) {
    parts.push(
      `(Bridge slot ${i + 1} of ${n} at row ${input.cell.row}, col ${input.cell.col} — distinct facet of the same knowledge bridge.)`,
    );
  } else if (n > 1) {
    parts.push(`(Bridge slot ${i + 1} of ${n} — distinct facet of the same knowledge bridge.)`);
  }
  return parts.join("\n");
}

/**
 * Which multi-select drawer should open by default.
 * Contiguous edge-sharing groups → Combine; otherwise Bridge (cannot merge).
 */
export function defaultMultiSelectDrawer(
  contiguous: boolean,
): "combine" | "bridge" {
  return contiguous ? "combine" : "bridge";
}

/**
 * Normalize anchor cells from placed blocks (row=position_y, col=position_x).
 */
export function bridgeAnchorsFromPlacedBlocks(
  blocks: readonly {
    id?: string;
    position_x?: number | null;
    position_y?: number | null;
  }[],
): BridgeCell[] {
  const out: BridgeCell[] = [];
  for (const b of blocks || []) {
    if (b.position_x == null || b.position_y == null) continue;
    const row = Math.trunc(Number(b.position_y));
    const col = Math.trunc(Number(b.position_x));
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
    out.push({ row, col });
  }
  return out;
}
