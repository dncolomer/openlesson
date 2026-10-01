export interface SkillGridNode {
  id: string;
  title: string;
  status: string;
  is_start: boolean;
  next_block_ids: string[];
  /** Optional body text for hand-edit surfaces */
  description?: string;
  /** Grid column in world coordinates (anchor / top-left of multi-cell span) */
  position_x?: number | null;
  /** Grid row in world coordinates (anchor / top-left of multi-cell span) */
  position_y?: number | null;
  /** Width in cells (≥1). Default 1. */
  span_w?: number | null;
  /** Height in cells (≥1). Default 1. */
  span_h?: number | null;
  /**
   * Freeform mask: relative {dr,dc} from anchor. Null/empty = solid span_w×span_h.
   */
  shape_cells?: Array<{ dr: number; dc: number }> | null;
  /** Prerequisite block ids that must be completed before this block unlocks. */
  lock_until_block_ids?: string[] | null;
  /**
   * Attached block-local materials (notes / files / external links).
   * Present when the block has local context for generation.
   */
  local_context?: {
    notes?: string | null;
    local_files?: Array<{ name?: string; excerpt?: string | null }> | null;
    global_file_refs?: string[] | null;
    external_resource_ids?: string[] | null;
  } | null;
  /** Author practice launch limits (Explore/Drill × open/timed). */
  practice_options?: unknown;
  /**
   * Combinable creator effects (Dynamic / Generator).
   * Raw JSON or parsed BlockCreatorEffects.
   */
  creator_effects?: unknown;
  /** Two-word map-tile label (shown instead of the truncated title). */
  map_keyword?: string | null;
  /** Lucide icon name from the workspace map catalog. */
  map_icon?: string | null;
}

/**
 * True when a block has non-empty attached local context materials.
 * Pure so map chrome / tests can decide without React.
 */
export function blockHasAttachedLocalContext(
  block:
    | {
        local_context?: {
          notes?: string | null;
          local_files?: unknown[] | null;
          global_file_refs?: unknown[] | null;
          external_resource_ids?: unknown[] | null;
        } | null;
      }
    | null
    | undefined,
): boolean {
  const lc = block?.local_context;
  if (!lc || typeof lc !== "object") return false;
  if (typeof lc.notes === "string" && lc.notes.trim().length > 0) return true;
  if (Array.isArray(lc.local_files) && lc.local_files.length > 0) return true;
  if (Array.isArray(lc.global_file_refs) && lc.global_file_refs.length > 0) return true;
  if (Array.isArray(lc.external_resource_ids) && lc.external_resource_ids.length > 0) {
    return true;
  }
  return false;
}

export interface GridCell {
  row: number;
  col: number;
}

export const SKILL_GRID_CELL_SIZE = 92;
export const SKILL_GRID_GAP = 10;
export const SKILL_GRID_PITCH = SKILL_GRID_CELL_SIZE + SKILL_GRID_GAP;

/** ILE chapter board uses larger tiles than the workspace skill grid. */
export const ILE_BOARD_CELL_SIZE = 128;
export const ILE_BOARD_GAP = 16;
export const ILE_BOARD_PITCH = ILE_BOARD_CELL_SIZE + ILE_BOARD_GAP;

export function skillGridMetrics(surface: "chapter" | "workspace"): {
  cellSize: number;
  gap: number;
  pitch: number;
} {
  if (surface === "chapter") {
    return { cellSize: ILE_BOARD_CELL_SIZE, gap: ILE_BOARD_GAP, pitch: ILE_BOARD_PITCH };
  }
  return { cellSize: SKILL_GRID_CELL_SIZE, gap: SKILL_GRID_GAP, pitch: SKILL_GRID_PITCH };
}

export const SKILL_GRID_MIN_ZOOM = 0.25;
/** 6× the previous max (2.5) so a 6× default still has zoom-in headroom. */
export const SKILL_GRID_MAX_ZOOM = 15;
/** sqrt(viewport area) calibrated to a ~500×400 panel. */
export const SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE = 447.2;
/** Shared default for workspace maps. */
export const SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE = 0.7;
/**
 * Fallback scale before an ILE board can be measured.
 * The live chapter board replaces this with a fit of the whole frame.
 */
export const SKILL_GRID_ILE_DEFAULT_ZOOM_AT_REFERENCE = 0.7;

export function clampSkillGridZoom(zoom: number) {
  return Math.min(SKILL_GRID_MAX_ZOOM, Math.max(SKILL_GRID_MIN_ZOOM, zoom));
}

/** Zoom-out floor. A fitted board below the grid minimum stays reachable. */
export function skillGridZoomFloor(fittedZoom?: number | null): number {
  if (fittedZoom != null && Number.isFinite(fittedZoom) && fittedZoom > 0) {
    return Math.min(SKILL_GRID_MIN_ZOOM, fittedZoom);
  }
  return SKILL_GRID_MIN_ZOOM;
}

/** Default zoom scales with viewport area — larger displays zoom in, smaller zoom out. */
export function getDefaultSkillGridZoom(
  viewportWidth: number,
  viewportHeight: number,
  atReference: number = SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
) {
  const reference = clampSkillGridZoom(atReference);
  if (viewportWidth <= 0 || viewportHeight <= 0) return reference;
  const displayScale = Math.sqrt(viewportWidth * viewportHeight);
  const zoom = reference * (displayScale / SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE);
  return clampSkillGridZoom(zoom);
}

export function getOrderedSkillGridNodes(nodes: SkillGridNode[]): SkillGridNode[] {
  if (nodes.length === 0) return [];

  const visited = new Set<string>();
  const ordered: SkillGridNode[] = [];
  const queue = nodes.filter((node) => node.is_start);
  if (queue.length === 0 && nodes[0]) queue.push(nodes[0]);

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    ordered.push(node);

    for (const nextId of node.next_block_ids || []) {
      const child = nodes.find((entry) => entry.id === nextId);
      if (child && !visited.has(child.id)) queue.push(child);
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) ordered.push(node);
  }

  return ordered;
}

/** Cells sorted by Chebyshev ring from origin, then angle within each ring. */
export function getRadialCells(count: number): GridCell[] {
  if (count <= 0) return [];
  if (count === 1) return [{ row: 0, col: 0 }];

  const cells: Array<GridCell & { ring: number; angle: number }> = [{ row: 0, col: 0, ring: 0, angle: 0 }];
  let ring = 1;

  while (cells.length < count) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        cells.push({ row: dr, col: dc, ring, angle: Math.atan2(-dr, dc) });
      }
    }
    ring++;
  }

  cells.sort((a, b) => {
    if (a.ring !== b.ring) return a.ring - b.ring;
    return a.angle - b.angle;
  });

  return cells.slice(0, count).map(({ row, col }) => ({ row, col }));
}

function hasGridPosition(node: SkillGridNode) {
  return node.position_x != null && node.position_y != null;
}

export function getCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function cellKey(cell: GridCell) {
  return getCellKey(cell.row, cell.col);
}

export function formatGridCoordinate(row: number, col: number) {
  return `${row},${col}`;
}

export function chebyshevDistance(a: GridCell, b: GridCell) {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

export function isCellOccupied(occupancy: Map<string, string>, row: number, col: number) {
  return occupancy.has(getCellKey(row, col));
}

export interface WeightedGridNeighbor {
  id: string;
  title: string;
  distance: number;
  weight: number;
  row: number;
  col: number;
}

/** Nearby blocks/chapters weighted by inverse distance (Chebyshev). */
export function getWeightedNeighborhood(
  target: GridCell,
  placements: Map<string, GridCell>,
  nodesById: Map<string, SkillGridNode>,
  options?: { maxDistance?: number; limit?: number },
): WeightedGridNeighbor[] {
  const maxDistance = options?.maxDistance ?? 6;
  const limit = options?.limit ?? 12;
  const neighbors: WeightedGridNeighbor[] = [];

  for (const [id, cell] of placements) {
    const distance = chebyshevDistance(target, cell);
    if (distance === 0 || distance > maxDistance) continue;
    const node = nodesById.get(id);
    if (!node) continue;
    neighbors.push({
      id,
      title: node.title,
      distance,
      weight: 1 / (distance + 1),
      row: cell.row,
      col: cell.col,
    });
  }

  return neighbors
    .sort((a, b) => a.distance - b.distance || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function formatWeightedNeighborhoodSummary(neighbors: WeightedGridNeighbor[]) {
  if (neighbors.length === 0) return "none";
  return neighbors
    .map((entry) => `"${entry.title}" at (${entry.row},${entry.col}), distance ${entry.distance}, weight ${entry.weight.toFixed(2)}`)
    .join("\n");
}

function nodeSpanW(node: SkillGridNode) {
  return typeof node.span_w === "number" && node.span_w >= 1 ? Math.min(node.span_w, 24) : 1;
}

function nodeSpanH(node: SkillGridNode) {
  return typeof node.span_h === "number" && node.span_h >= 1 ? Math.min(node.span_h, 24) : 1;
}

/** Absolute occupied cells for a node (freeform mask or solid rectangle). */
export function skillNodeOccupiedCells(node: SkillGridNode): GridCell[] {
  if (!hasGridPosition(node)) return [];
  const shape = Array.isArray(node.shape_cells) ? node.shape_cells : null;
  if (shape && shape.length > 0) {
    return shape
      .filter((o) => Number.isInteger(o?.dr) && Number.isInteger(o?.dc))
      .map((o) => ({
        row: node.position_y! + o.dr,
        col: node.position_x! + o.dc,
      }));
  }
  const spanW = nodeSpanW(node);
  const spanH = nodeSpanH(node);
  const cells: GridCell[] = [];
  for (let dr = 0; dr < spanH; dr++) {
    for (let dc = 0; dc < spanW; dc++) {
      cells.push({ row: node.position_y! + dr, col: node.position_x! + dc });
    }
  }
  return cells;
}

/** Claim absolute cells for blockId. Returns false if any cell taken. */
function claimCells(
  occupancy: Map<string, string>,
  blockId: string,
  cells: GridCell[],
): boolean {
  const keys: string[] = [];
  for (const cell of cells) {
    const key = getCellKey(cell.row, cell.col);
    if (occupancy.has(key)) return false;
    keys.push(key);
  }
  for (const key of keys) occupancy.set(key, blockId);
  return true;
}

/** Mark every cell in a rectangular footprint as occupied by blockId. */
function claimFootprint(
  occupancy: Map<string, string>,
  blockId: string,
  row: number,
  col: number,
  spanW: number,
  spanH: number,
): boolean {
  const cells: GridCell[] = [];
  for (let dr = 0; dr < spanH; dr++) {
    for (let dc = 0; dc < spanW; dc++) {
      cells.push({ row: row + dr, col: col + dc });
    }
  }
  return claimCells(occupancy, blockId, cells);
}

/** World-space layout: honors freeform masks and multi-cell spans, then radial fill. */
export function buildSkillGridLayout(nodes: SkillGridNode[]) {
  const ordered = getOrderedSkillGridNodes(nodes);
  const placements = new Map<string, GridCell>();
  const spans = new Map<string, { span_w: number; span_h: number }>();
  const shapes = new Map<string, Array<{ dr: number; dc: number }>>();
  const occupancy = new Map<string, string>();

  for (const node of nodes) {
    if (!hasGridPosition(node)) continue;
    const spanW = nodeSpanW(node);
    const spanH = nodeSpanH(node);
    const cell = { row: node.position_y!, col: node.position_x! };
    const occupied = skillNodeOccupiedCells(node);
    if (occupied.length === 0) continue;
    if (!claimCells(occupancy, node.id, occupied)) continue;
    placements.set(node.id, cell);
    spans.set(node.id, { span_w: spanW, span_h: spanH });
    if (Array.isArray(node.shape_cells) && node.shape_cells.length > 0) {
      shapes.set(node.id, node.shape_cells);
    }
  }

  const unplaced = ordered.filter((node) => !placements.has(node.id));
  if (unplaced.length > 0) {
    const radialSlots = getRadialCells(Math.max(unplaced.length + occupancy.size, nodes.length + 4));
    let slotIndex = 0;

    for (const node of unplaced) {
      const spanW = nodeSpanW(node);
      const spanH = nodeSpanH(node);
      while (slotIndex < radialSlots.length) {
        const cell = radialSlots[slotIndex++];
        if (!claimFootprint(occupancy, node.id, cell.row, cell.col, spanW, spanH)) continue;
        placements.set(node.id, cell);
        spans.set(node.id, { span_w: spanW, span_h: spanH });
        break;
      }
    }
  }

  const startNode = ordered.find((node) => node.is_start) ?? ordered[0];
  const startCell = startNode ? (placements.get(startNode.id) ?? { row: 0, col: 0 }) : { row: 0, col: 0 };

  return { ordered, placements, occupancy, spans, shapes, startCell };
}

export function getNeighborTitles(
  row: number,
  col: number,
  occupancy: Map<string, string>,
  nodesById: Map<string, SkillGridNode>,
) {
  const neighbors: string[] = [];
  const checks: GridCell[] = [
    { row: row - 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row + 1, col },
  ];

  for (const cell of checks) {
    const id = occupancy.get(`${cell.row}:${cell.col}`);
    if (!id) continue;
    const node = nodesById.get(id);
    if (node) neighbors.push(node.title);
  }

  return neighbors;
}

export function getVisibleGridCells(
  viewportWidth: number,
  viewportHeight: number,
  panX: number,
  panY: number,
  zoom: number,
  padding = 2,
  pitch = SKILL_GRID_PITCH,
): GridCell[] {
  if (viewportWidth <= 0 || viewportHeight <= 0) return [];

  const cellPitch = pitch > 0 ? pitch : SKILL_GRID_PITCH;
  const minCol = Math.floor((-panX) / zoom / cellPitch) - padding;
  const maxCol = Math.ceil((viewportWidth - panX) / zoom / cellPitch) + padding;
  const minRow = Math.floor((-panY) / zoom / cellPitch) - padding;
  const maxRow = Math.ceil((viewportHeight - panY) / zoom / cellPitch) + padding;

  const cells: GridCell[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push({ row, col });
    }
  }

  return cells;
}

export function getPanToCenterCell(
  viewportWidth: number,
  viewportHeight: number,
  cell: GridCell,
  zoom: number,
  pitch = SKILL_GRID_PITCH,
  cellSize = SKILL_GRID_CELL_SIZE,
) {
  const centerX = cell.col * pitch + cellSize / 2;
  const centerY = cell.row * pitch + cellSize / 2;

  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
  };
}

export type SkillGridCameraInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

/**
 * Largest zoom that keeps a world rectangle inside the viewport.
 * Screen position is `pan + world * zoom` with the origin at the top left.
 * Insets reserve chrome (voice bar, side stack). They shrink if they would
 * eat more than half the viewport. Zoom may go below the grid minimum so a
 * large board still fits, and it never exceeds `maxZoom`.
 */
export function fitWorldRectCamera(input: {
  viewportWidth: number;
  viewportHeight: number;
  minX: number;
  minY: number;
  width: number;
  height: number;
  insets?: SkillGridCameraInsets;
  maxZoom?: number;
}): { zoom: number; pan: { x: number; y: number } } | null {
  const vw = input.viewportWidth;
  const vh = input.viewportHeight;
  const rectW = input.width;
  const rectH = input.height;
  if (!(vw > 0) || !(vh > 0) || !(rectW > 0) || !(rectH > 0)) return null;
  if (!Number.isFinite(input.minX) || !Number.isFinite(input.minY)) return null;

  let top = Math.max(0, input.insets?.top ?? 0);
  let right = Math.max(0, input.insets?.right ?? 0);
  let bottom = Math.max(0, input.insets?.bottom ?? 0);
  let left = Math.max(0, input.insets?.left ?? 0);
  const maxInsetX = vw * 0.5;
  const maxInsetY = vh * 0.5;
  if (left + right > maxInsetX && left + right > 0) {
    const scale = maxInsetX / (left + right);
    left *= scale;
    right *= scale;
  }
  if (top + bottom > maxInsetY && top + bottom > 0) {
    const scale = maxInsetY / (top + bottom);
    top *= scale;
    bottom *= scale;
  }

  const availW = vw - left - right;
  const availH = vh - top - bottom;
  if (!(availW > 1) || !(availH > 1)) return null;

  let zoom = Math.min(availW / rectW, availH / rectH);
  const maxZoom = input.maxZoom ?? SKILL_GRID_MAX_ZOOM;
  if (Number.isFinite(maxZoom) && maxZoom > 0) zoom = Math.min(zoom, maxZoom);
  if (!(zoom > 0) || !Number.isFinite(zoom)) return null;

  const centerX = input.minX + rectW / 2;
  const centerY = input.minY + rectH / 2;
  return {
    zoom,
    pan: {
      x: left + availW / 2 - centerX * zoom,
      y: top + availH / 2 - centerY * zoom,
    },
  };
}