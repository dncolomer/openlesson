/**
 * Pure skill-grid multi-select geometry: footprints, merge, split, multi-move,
 * collision checks. No React / no DB — unit-tested entry point for grid ops.
 */

import {
  getCellKey,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";

export interface BlockFootprint {
  /** Anchor column (min col of occupied cells). */
  position_x: number;
  /** Anchor row (min row of occupied cells). */
  position_y: number;
  /** Inclusive width in cells (≥1). */
  span_w: number;
  /** Inclusive height in cells (≥1). */
  span_h: number;
}

/** Relative cell offset from block anchor (position_y, position_x). */
export interface ShapeOffset {
  dr: number;
  dc: number;
}

export interface PlacedBlockRef {
  id: string;
  position_x: number;
  position_y: number;
  span_w?: number;
  span_h?: number;
  /**
   * Freeform mask relative to anchor. When null/empty, occupancy is the full
   * solid rectangle span_w×span_h.
   */
  shape_cells?: ShapeOffset[] | null;
}

export function normalizeSpan(value: unknown, fallback = 1): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return Math.min(value, 24);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n >= 1) return Math.min(n, 24);
  }
  return fallback;
}

/** All absolute cells covered by a solid rectangular footprint. */
export function footprintCells(fp: BlockFootprint): GridCell[] {
  const spanW = Math.max(1, fp.span_w);
  const spanH = Math.max(1, fp.span_h);
  const cells: GridCell[] = [];
  for (let dr = 0; dr < spanH; dr++) {
    for (let dc = 0; dc < spanW; dc++) {
      cells.push({ row: fp.position_y + dr, col: fp.position_x + dc });
    }
  }
  return cells;
}

/** Parse shape_cells from DB/JSON into normalized offsets. */
export function parseShapeCells(raw: unknown): ShapeOffset[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ShapeOffset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const dr = Number(rec.dr ?? rec.dRow ?? rec.row);
    const dc = Number(rec.dc ?? rec.dCol ?? rec.col);
    if (!Number.isInteger(dr) || !Number.isInteger(dc)) continue;
    const key = `${dr}:${dc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ dr, dc });
  }
  return out.length > 0 ? out : null;
}

/**
 * Absolute cells occupied by a placed block (freeform mask or solid rectangle).
 */
export function placedBlockCells(block: PlacedBlockRef): GridCell[] {
  const offsets = parseShapeCells(block.shape_cells ?? null);
  if (offsets && offsets.length > 0) {
    return offsets.map((o) => ({
      row: block.position_y + o.dr,
      col: block.position_x + o.dc,
    }));
  }
  return footprintCells({
    position_x: block.position_x,
    position_y: block.position_y,
    span_w: normalizeSpan(block.span_w),
    span_h: normalizeSpan(block.span_h),
  });
}

/**
 * Build freeform placement from any cell selection (anchor = top-left of bbox,
 * shape_cells = relative offsets). Caller must ensure contiguity if required.
 */
export function freeformShapeFromCells(cells: GridCell[]): {
  footprint: BlockFootprint;
  shape_cells: ShapeOffset[];
  absoluteCells: GridCell[];
  isSolidRectangle: boolean;
} | null {
  const unique = cellsFromSelection(cells);
  if (unique.length === 0) return null;
  const footprint = footprintFromCells(unique)!;
  const shape_cells: ShapeOffset[] = unique.map((c) => ({
    dr: c.row - footprint.position_y,
    dc: c.col - footprint.position_x,
  }));
  const required = footprint.span_w * footprint.span_h;
  const isSolidRectangle = shape_cells.length === required;
  // Omit shape_cells storage for pure rectangles (legacy-compatible null).
  return {
    footprint,
    shape_cells: isSolidRectangle ? shape_cells : shape_cells,
    absoluteCells: unique,
    isSolidRectangle,
  };
}

/** 4-connected contiguity of absolute cells (any freeform lecture shape). */
export function cellsAreContiguous(cells: GridCell[]): boolean {
  const unique = cellsFromSelection(cells);
  if (unique.length === 0) return false;
  if (unique.length === 1) return true;
  const ortho: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  const keys = new Set(unique.map((c) => getCellKey(c.row, c.col)));
  const start = unique[0];
  const seen = new Set<string>([getCellKey(start.row, start.col)]);
  const queue: GridCell[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dr, dc] of ortho) {
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      const k = getCellKey(nr, nc);
      if (!keys.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push({ row: nr, col: nc });
    }
  }
  return seen.size === unique.length;
}

/** Whether selected empty cells form a freeform lecture region. */
export function selectionIsFreeformLectureShape(cells: GridCell[]): {
  ok: boolean;
  footprint: BlockFootprint | null;
  shape_cells: ShapeOffset[] | null;
  selectedCount: number;
  reason: "empty" | "not_contiguous" | "ok";
} {
  const unique = cellsFromSelection(cells);
  if (unique.length === 0) {
    return {
      ok: false,
      footprint: null,
      shape_cells: null,
      selectedCount: 0,
      reason: "empty",
    };
  }
  const freeform = freeformShapeFromCells(unique)!;
  if (!cellsAreContiguous(unique)) {
    return {
      ok: false,
      footprint: freeform.footprint,
      shape_cells: freeform.shape_cells,
      selectedCount: unique.length,
      reason: "not_contiguous",
    };
  }
  return {
    ok: true,
    footprint: freeform.footprint,
    shape_cells: freeform.isSolidRectangle ? null : freeform.shape_cells,
    selectedCount: unique.length,
    reason: "ok",
  };
}

/** Cells occupied by a selection (only the selected cells — not the full bbox). */
export function canPlaceAbsoluteCells(
  cells: readonly GridCell[],
  occupancy: Map<string, string>,
  ignoreIds: Iterable<string> = [],
): boolean {
  const ignore = new Set(ignoreIds);
  for (const cell of cellsFromSelection(cells)) {
    const occupant = occupancy.get(getCellKey(cell.row, cell.col));
    if (occupant && !ignore.has(occupant)) return false;
  }
  return true;
}

/** External edges of a cell within a freeform shape (true = draw border). */
export function freeformCellExternalEdges(
  cell: GridCell,
  shapeKeys: Set<string>,
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  return {
    top: !shapeKeys.has(getCellKey(cell.row - 1, cell.col)),
    right: !shapeKeys.has(getCellKey(cell.row, cell.col + 1)),
    bottom: !shapeKeys.has(getCellKey(cell.row + 1, cell.col)),
    left: !shapeKeys.has(getCellKey(cell.row, cell.col - 1)),
  };
}

/**
 * Tile size so adjacent freeform cells fill the grid gap and read as one solid shape.
 * Extends into the pitch gap toward neighbors that belong to the same shape.
 */
export function freeformTilePixelSize(
  cell: GridCell,
  shapeKeys: Set<string>,
  cellSize: number,
  gap: number,
): { width: number; height: number } {
  const extendRight = shapeKeys.has(getCellKey(cell.row, cell.col + 1));
  const extendBottom = shapeKeys.has(getCellKey(cell.row + 1, cell.col));
  return {
    width: cellSize + (extendRight ? gap : 0),
    height: cellSize + (extendBottom ? gap : 0),
  };
}

/** Best cell to place the block title (closest to centroid of the freeform). */
export function freeformLabelCell(cells: GridCell[]): GridCell {
  const unique = cellsFromSelection(cells);
  if (unique.length === 0) return { row: 0, col: 0 };
  if (unique.length === 1) return unique[0];
  const avgRow = unique.reduce((s, c) => s + c.row, 0) / unique.length;
  const avgCol = unique.reduce((s, c) => s + c.col, 0) / unique.length;
  let best = unique[0];
  let bestDist = Infinity;
  for (const cell of unique) {
    const d = Math.abs(cell.row - avgRow) + Math.abs(cell.col - avgCol);
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  return best;
}

export function freeformShapeKeySet(cells: GridCell[]): Set<string> {
  return new Set(cellsFromSelection(cells).map((c) => getCellKey(c.row, c.col)));
}

export function cellsFromSelection(cells: readonly GridCell[]): GridCell[] {
  const seen = new Set<string>();
  const unique: GridCell[] = [];
  for (const cell of cells) {
    if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) continue;
    const key = getCellKey(cell.row, cell.col);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ row: cell.row, col: cell.col });
  }
  return unique.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Bounding rectangular footprint covering every selected cell. */
export function footprintFromCells(cells: GridCell[]): BlockFootprint | null {
  const unique = cellsFromSelection(cells);
  if (unique.length === 0) return null;
  let minRow = unique[0].row;
  let maxRow = unique[0].row;
  let minCol = unique[0].col;
  let maxCol = unique[0].col;
  for (const cell of unique) {
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
    minCol = Math.min(minCol, cell.col);
    maxCol = Math.max(maxCol, cell.col);
  }
  return {
    position_x: minCol,
    position_y: minRow,
    span_w: maxCol - minCol + 1,
    span_h: maxRow - minRow + 1,
  };
}

/**
 * Whether selected empty cells form a filled rectangle (required for generate-in-shape).
 * A sparse/L-shaped selection still has a bounding box; without this check the
 * bounding box can include occupied cells the user never selected.
 */
export function selectionIsSolidRectangle(cells: GridCell[]): {
  ok: boolean;
  footprint: BlockFootprint | null;
  selectedCount: number;
  requiredCount: number;
  reason: "empty" | "not_solid" | "ok";
} {
  const unique = cellsFromSelection(cells);
  const footprint = footprintFromCells(unique);
  if (!footprint) {
    return { ok: false, footprint: null, selectedCount: 0, requiredCount: 0, reason: "empty" };
  }
  const required = footprintCells(footprint);
  const selectedKeys = new Set(unique.map((c) => getCellKey(c.row, c.col)));
  if (selectedKeys.size !== required.length) {
    return {
      ok: false,
      footprint,
      selectedCount: selectedKeys.size,
      requiredCount: required.length,
      reason: "not_solid",
    };
  }
  for (const cell of required) {
    if (!selectedKeys.has(getCellKey(cell.row, cell.col))) {
      return {
        ok: false,
        footprint,
        selectedCount: selectedKeys.size,
        requiredCount: required.length,
        reason: "not_solid",
      };
    }
  }
  return {
    ok: true,
    footprint,
    selectedCount: selectedKeys.size,
    requiredCount: required.length,
    reason: "ok",
  };
}

/** Occupied cells inside a footprint (excluding ignoreIds). */
export function occupiedCellsInFootprint(
  fp: BlockFootprint,
  occupancy: Map<string, string>,
  ignoreIds: Iterable<string> = [],
): GridCell[] {
  const ignore = new Set(ignoreIds);
  const hits: GridCell[] = [];
  for (const cell of footprintCells(fp)) {
    const occupant = occupancy.get(getCellKey(cell.row, cell.col));
    if (occupant && !ignore.has(occupant)) hits.push(cell);
  }
  return hits;
}

export function footprintFromBlock(block: PlacedBlockRef): BlockFootprint {
  const offsets = parseShapeCells(block.shape_cells ?? null);
  if (offsets && offsets.length > 0) {
    const abs = offsets.map((o) => ({
      row: block.position_y + o.dr,
      col: block.position_x + o.dc,
    }));
    return footprintFromCells(abs)!;
  }
  return {
    position_x: block.position_x,
    position_y: block.position_y,
    span_w: normalizeSpan(block.span_w),
    span_h: normalizeSpan(block.span_h),
  };
}

/** Merge multiple block footprints into one bounding rectangle (legacy helper). */
export function mergeBlockFootprints(blocks: PlacedBlockRef[]): BlockFootprint | null {
  return mergeBlocksToFreeform(blocks)?.footprint ?? null;
}

/** Union of placed blocks as freeform lecture shape (any contiguous multi-block region). */
export function mergeBlocksToFreeform(blocks: PlacedBlockRef[]): {
  footprint: BlockFootprint;
  shape_cells: ShapeOffset[] | null;
  absoluteCells: GridCell[];
  isSolidRectangle: boolean;
} | null {
  if (blocks.length === 0) return null;
  const cells: GridCell[] = [];
  for (const block of blocks) {
    cells.push(...placedBlockCells(block));
  }
  const freeform = freeformShapeFromCells(cells);
  if (!freeform) return null;
  return {
    footprint: freeform.footprint,
    shape_cells: freeform.isSolidRectangle ? null : freeform.shape_cells,
    absoluteCells: freeform.absoluteCells,
    isSolidRectangle: freeform.isSolidRectangle,
  };
}

const ORTHO_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/** True when two blocks share an orthogonal (edge) neighbor cell — not diagonal-only. */
export function blocksShareEdge(a: PlacedBlockRef, b: PlacedBlockRef): boolean {
  const cellsA = placedBlockCells(a);
  const keysB = new Set(placedBlockCells(b).map((c) => getCellKey(c.row, c.col)));
  for (const cell of cellsA) {
    for (const [dr, dc] of ORTHO_NEIGHBORS) {
      if (keysB.has(getCellKey(cell.row + dr, cell.col + dc))) return true;
    }
  }
  return false;
}

/**
 * Whether selected blocks form a single contiguous region (4-connected dual graph).
 * Empty selection → false. One block → true. Multiple → every block reachable via edge adjacency.
 */
export function areBlocksContiguous(blocks: PlacedBlockRef[]): boolean {
  if (blocks.length === 0) return false;
  if (blocks.length === 1) return true;

  const n = blocks.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (blocksShareEdge(blocks[i], blocks[j])) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (const j of adj[i]) {
      if (seen.has(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return seen.size === n;
}

/** Split a footprint into one 1×1 cell per occupied square. */
export function splitFootprintToSingles(fp: BlockFootprint): BlockFootprint[] {
  return footprintCells(fp).map((cell) => ({
    position_x: cell.col,
    position_y: cell.row,
    span_w: 1,
    span_h: 1,
  }));
}

/** Split several blocks into single-square footprints (preserves source id order). */
export function splitBlocksToSingles(blocks: PlacedBlockRef[]): Array<BlockFootprint & { sourceId: string }> {
  const result: Array<BlockFootprint & { sourceId: string }> = [];
  for (const block of blocks) {
    for (const cell of placedBlockCells(block)) {
      result.push({
        sourceId: block.id,
        position_x: cell.col,
        position_y: cell.row,
        span_w: 1,
        span_h: 1,
      });
    }
  }
  return result;
}

export function translateFootprint(fp: BlockFootprint, dRow: number, dCol: number): BlockFootprint {
  return {
    position_x: fp.position_x + dCol,
    position_y: fp.position_y + dRow,
    span_w: fp.span_w,
    span_h: fp.span_h,
  };
}

/**
 * Translate multiple blocks by the same delta while preserving relative shape.
 * Returns null if any target cell collides with a non-moving occupied cell
 * or if two moving blocks would overlap each other after translation.
 */
export function translateBlocksPreservingShape(
  moving: PlacedBlockRef[],
  dRow: number,
  dCol: number,
  occupancy: Map<string, string>,
): PlacedBlockRef[] | null {
  if (moving.length === 0) return [];
  if (dRow === 0 && dCol === 0) {
    return moving.map((b) => ({
      ...b,
      span_w: normalizeSpan(b.span_w),
      span_h: normalizeSpan(b.span_h),
    }));
  }

  const movingIds = new Set(moving.map((b) => b.id));
  const next: PlacedBlockRef[] = [];
  const claimed = new Set<string>();

  for (const block of moving) {
    const offsets = parseShapeCells(block.shape_cells ?? null);
    const nextPos = {
      position_x: block.position_x + dCol,
      position_y: block.position_y + dRow,
      span_w: normalizeSpan(block.span_w),
      span_h: normalizeSpan(block.span_h),
      shape_cells: offsets,
    };
    for (const cell of placedBlockCells({ id: block.id, ...nextPos })) {
      const key = getCellKey(cell.row, cell.col);
      if (claimed.has(key)) return null;
      const occupant = occupancy.get(key);
      if (occupant && !movingIds.has(occupant)) return null;
      claimed.add(key);
    }
    next.push({
      id: block.id,
      position_x: nextPos.position_x,
      position_y: nextPos.position_y,
      span_w: nextPos.span_w,
      span_h: nextPos.span_h,
      ...(offsets ? { shape_cells: offsets } : {}),
    });
  }

  return next;
}

/** Whether a rectangular footprint can be placed without colliding (except ignored ids). */
export function canPlaceFootprint(
  fp: BlockFootprint,
  occupancy: Map<string, string>,
  ignoreIds: Iterable<string> = [],
): boolean {
  const ignore = new Set(ignoreIds);
  for (const cell of footprintCells(fp)) {
    const occupant = occupancy.get(getCellKey(cell.row, cell.col));
    if (occupant && !ignore.has(occupant)) return false;
  }
  return true;
}

/** Build occupancy map: cellKey → blockId, honoring freeform masks and solid spans. */
export function buildOccupancyFromPlaced(blocks: PlacedBlockRef[]): Map<string, string> {
  const occupancy = new Map<string, string>();
  for (const block of blocks) {
    if (block.position_x == null || block.position_y == null) continue;
    for (const cell of placedBlockCells(block)) {
      const key = getCellKey(cell.row, cell.col);
      if (!occupancy.has(key)) occupancy.set(key, block.id);
    }
  }
  return occupancy;
}

export function placedFromSkillNodes(nodes: SkillGridNode[]): PlacedBlockRef[] {
  return nodes
    .filter((n) => n.position_x != null && n.position_y != null)
    .map((n) => {
      const withShape = n as SkillGridNode & {
        span_w?: number;
        span_h?: number;
        shape_cells?: unknown;
      };
      return {
        id: n.id,
        position_x: n.position_x!,
        position_y: n.position_y!,
        span_w: normalizeSpan(withShape.span_w),
        span_h: normalizeSpan(withShape.span_h),
        shape_cells: parseShapeCells(withShape.shape_cells ?? null),
      };
    });
}

/** Relative offsets of each moving block from the group's top-left anchor. */
export function relativeOffsets(blocks: PlacedBlockRef[]): Map<string, { dRow: number; dCol: number }> {
  if (blocks.length === 0) return new Map();
  let minRow = Infinity;
  let minCol = Infinity;
  for (const b of blocks) {
    minRow = Math.min(minRow, b.position_y);
    minCol = Math.min(minCol, b.position_x);
  }
  const map = new Map<string, { dRow: number; dCol: number }>();
  for (const b of blocks) {
    map.set(b.id, { dRow: b.position_y - minRow, dCol: b.position_x - minCol });
  }
  return map;
}

/**
 * Edge and corner stretch handles for sole-selected block resize on the map.
 * Cardinal edges + four corners; product treats stretch as solid-rect bbox expand.
 */
export type StretchHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const STRETCH_HANDLES: readonly StretchHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
] as const;

export function isStretchHandle(value: unknown): value is StretchHandle {
  return (
    typeof value === "string" &&
    (STRETCH_HANDLES as readonly string[]).includes(value)
  );
}

/**
 * Compute a candidate solid-rectangle footprint by stretching the block's
 * bounding box from a handle by cell deltas. Does not check occupancy.
 * Returns null if the result would be invalid (empty / beyond span limits).
 *
 * Handle semantics (dRow positive = south, dCol positive = east):
 * - n/s move the north/south edge; e/w move east/west; corners move both.
 * - Opposite edge stays fixed; min size is 1×1; max span via normalizeSpan (24).
 * - Freeform masks are expanded toward a filled solid rectangle of the new bbox.
 */
export function stretchFootprintFromHandle(
  block: PlacedBlockRef,
  handle: StretchHandle,
  dRow: number,
  dCol: number,
): BlockFootprint | null {
  const bbox = footprintFromBlock(block);
  let minRow = bbox.position_y;
  let maxRow = bbox.position_y + bbox.span_h - 1;
  let minCol = bbox.position_x;
  let maxCol = bbox.position_x + bbox.span_w - 1;

  const movesN = handle === "n" || handle === "ne" || handle === "nw";
  const movesS = handle === "s" || handle === "se" || handle === "sw";
  const movesE = handle === "e" || handle === "ne" || handle === "se";
  const movesW = handle === "w" || handle === "nw" || handle === "sw";

  if (movesN) minRow = minRow + dRow;
  if (movesS) maxRow = maxRow + dRow;
  if (movesW) minCol = minCol + dCol;
  if (movesE) maxCol = maxCol + dCol;

  // Collapse inverted edges to min 1×1 (keep the fixed opposite side).
  if (minRow > maxRow) {
    if (movesN && !movesS) minRow = maxRow;
    else if (movesS && !movesN) maxRow = minRow;
    else {
      // Corner / both: pin to smaller range
      const mid = Math.floor((minRow + maxRow) / 2);
      minRow = mid;
      maxRow = mid;
    }
  }
  if (minCol > maxCol) {
    if (movesW && !movesE) minCol = maxCol;
    else if (movesE && !movesW) maxCol = minCol;
    else {
      const mid = Math.floor((minCol + maxCol) / 2);
      minCol = mid;
      maxCol = mid;
    }
  }

  const span_w = maxCol - minCol + 1;
  const span_h = maxRow - minRow + 1;
  if (span_w < 1 || span_h < 1) return null;
  // Cap via normalizeSpan (product max 24).
  const cappedW = normalizeSpan(span_w);
  const cappedH = normalizeSpan(span_h);
  // If capped, keep the fixed edge: shrink from the moving side(s).
  let outMinRow = minRow;
  let outMinCol = minCol;
  let outMaxRow = minRow + cappedH - 1;
  let outMaxCol = minCol + cappedW - 1;
  if (cappedH < span_h) {
    if (movesN && !movesS) {
      outMinRow = maxRow - cappedH + 1;
      outMaxRow = maxRow;
    } else if (movesS && !movesN) {
      outMinRow = minRow;
      outMaxRow = minRow + cappedH - 1;
    } else {
      outMinRow = minRow;
      outMaxRow = minRow + cappedH - 1;
    }
  }
  if (cappedW < span_w) {
    if (movesW && !movesE) {
      outMinCol = maxCol - cappedW + 1;
      outMaxCol = maxCol;
    } else if (movesE && !movesW) {
      outMinCol = minCol;
      outMaxCol = minCol + cappedW - 1;
    } else {
      outMinCol = minCol;
      outMaxCol = minCol + cappedW - 1;
    }
  }

  return {
    position_x: outMinCol,
    position_y: outMinRow,
    span_w: cappedW,
    span_h: cappedH,
  };
}

/**
 * Stretch a sole block from an edge/corner handle by cell deltas.
 * Settled shape is always a solid rectangle of the stretched bbox
 * (fills freeform holes; geometry-only expand of the same block).
 *
 * Returns null when:
 * - delta is a no-op (same placement as current solid bbox)
 * - new footprint collides with another block's occupancy
 *
 * Caller should commit only on pointer-up; use this for both preview and settle.
 */
export function stretchBlockFromHandle(
  block: PlacedBlockRef,
  handle: StretchHandle,
  dRow: number,
  dCol: number,
  occupancy: Map<string, string>,
): PlacedBlockRef | null {
  // No pointer movement → nothing to settle (preview may still re-show current).
  if (dRow === 0 && dCol === 0) return null;

  const nextFp = stretchFootprintFromHandle(block, handle, dRow, dCol);
  if (!nextFp) return null;

  const current = footprintFromBlock(block);
  const sameBBox =
    current.position_x === nextFp.position_x &&
    current.position_y === nextFp.position_y &&
    current.span_w === nextFp.span_w &&
    current.span_h === nextFp.span_h;
  if (sameBBox) {
    // Already a solid rect of this bbox — pure no-op (e.g. shrink then re-expand).
    const cells = placedBlockCells(block);
    if (cells.length === current.span_w * current.span_h) return null;
    // Freeform with unchanged bbox: filling holes is a real geometry change — allow.
  }

  if (!canPlaceFootprint(nextFp, occupancy, [block.id])) return null;

  return {
    id: block.id,
    position_x: nextFp.position_x,
    position_y: nextFp.position_y,
    span_w: nextFp.span_w,
    span_h: nextFp.span_h,
    // Solid rectangle storage — drop freeform mask.
    shape_cells: null,
  };
}

/**
 * Preview helper: same geometry as settle, but returns current block when
 * stretch is invalid/noop so the UI can keep showing the live footprint.
 */
export function previewStretchBlockFromHandle(
  block: PlacedBlockRef,
  handle: StretchHandle,
  dRow: number,
  dCol: number,
  occupancy: Map<string, string>,
): PlacedBlockRef {
  return (
    stretchBlockFromHandle(block, handle, dRow, dCol, occupancy) ?? {
      id: block.id,
      position_x: block.position_x,
      position_y: block.position_y,
      span_w: normalizeSpan(block.span_w),
      span_h: normalizeSpan(block.span_h),
      shape_cells: parseShapeCells(block.shape_cells ?? null),
    }
  );
}
