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

export interface PlacedBlockRef {
  id: string;
  position_x: number;
  position_y: number;
  span_w?: number;
  span_h?: number;
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

/** All absolute cells covered by a rectangular footprint. */
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

export function cellsFromSelection(cells: GridCell[]): GridCell[] {
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

export function footprintFromBlock(block: PlacedBlockRef): BlockFootprint {
  return {
    position_x: block.position_x,
    position_y: block.position_y,
    span_w: normalizeSpan(block.span_w),
    span_h: normalizeSpan(block.span_h),
  };
}

/** Merge multiple block footprints into one bounding rectangle. */
export function mergeBlockFootprints(blocks: PlacedBlockRef[]): BlockFootprint | null {
  if (blocks.length === 0) return null;
  const cells: GridCell[] = [];
  for (const block of blocks) {
    cells.push(...footprintCells(footprintFromBlock(block)));
  }
  return footprintFromCells(cells);
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
    for (const cell of footprintCells(footprintFromBlock(block))) {
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
    const translated = translateFootprint(footprintFromBlock(block), dRow, dCol);
    for (const cell of footprintCells(translated)) {
      const key = getCellKey(cell.row, cell.col);
      if (claimed.has(key)) return null;
      const occupant = occupancy.get(key);
      if (occupant && !movingIds.has(occupant)) return null;
      claimed.add(key);
    }
    next.push({
      id: block.id,
      position_x: translated.position_x,
      position_y: translated.position_y,
      span_w: translated.span_w,
      span_h: translated.span_h,
    });
  }

  return next;
}

/** Whether a footprint can be placed without colliding with occupancy (except ignored ids). */
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

/** Build occupancy map: cellKey → blockId, honoring multi-cell spans. */
export function buildOccupancyFromPlaced(blocks: PlacedBlockRef[]): Map<string, string> {
  const occupancy = new Map<string, string>();
  for (const block of blocks) {
    if (block.position_x == null || block.position_y == null) continue;
    for (const cell of footprintCells(footprintFromBlock(block))) {
      const key = getCellKey(cell.row, cell.col);
      if (!occupancy.has(key)) occupancy.set(key, block.id);
    }
  }
  return occupancy;
}

export function placedFromSkillNodes(nodes: SkillGridNode[]): PlacedBlockRef[] {
  return nodes
    .filter((n) => n.position_x != null && n.position_y != null)
    .map((n) => ({
      id: n.id,
      position_x: n.position_x!,
      position_y: n.position_y!,
      span_w: normalizeSpan((n as SkillGridNode & { span_w?: number }).span_w),
      span_h: normalizeSpan((n as SkillGridNode & { span_h?: number }).span_h),
    }));
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
