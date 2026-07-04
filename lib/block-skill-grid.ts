export interface SkillGridNode {
  id: string;
  title: string;
  status: string;
  is_start: boolean;
  next_node_ids: string[];
  /** Grid column in world coordinates */
  position_x?: number;
  /** Grid row in world coordinates */
  position_y?: number;
}

export interface GridCell {
  row: number;
  col: number;
}

export const SKILL_GRID_CELL_SIZE = 92;
export const SKILL_GRID_GAP = 10;
export const SKILL_GRID_PITCH = SKILL_GRID_CELL_SIZE + SKILL_GRID_GAP;

export const SKILL_GRID_MIN_ZOOM = 0.35;
export const SKILL_GRID_MAX_ZOOM = 2.5;
/** sqrt(viewport area) calibrated to a ~500×400 panel. */
export const SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE = 447.2;
export const SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE = 0.75;

export function clampSkillGridZoom(zoom: number) {
  return Math.min(SKILL_GRID_MAX_ZOOM, Math.max(SKILL_GRID_MIN_ZOOM, zoom));
}

/** Default zoom scales with viewport area — larger displays zoom in, smaller zoom out. */
export function getDefaultSkillGridZoom(viewportWidth: number, viewportHeight: number) {
  if (viewportWidth <= 0 || viewportHeight <= 0) return SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE;
  const displayScale = Math.sqrt(viewportWidth * viewportHeight);
  const zoom =
    SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE * (displayScale / SKILL_GRID_DEFAULT_ZOOM_REFERENCE_SCALE);
  return clampSkillGridZoom(zoom);
}

/** @deprecated Use SKILL_GRID_MIN_COLS */
export const SKILL_GRID_COLS = 5;

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

    for (const nextId of node.next_node_ids || []) {
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

/** World-space layout: honors saved grid cells, then fills gaps radially from origin. */
export function buildSkillGridLayout(nodes: SkillGridNode[]) {
  const ordered = getOrderedSkillGridNodes(nodes);
  const placements = new Map<string, GridCell>();
  const occupancy = new Map<string, string>();

  for (const node of nodes) {
    if (!hasGridPosition(node)) continue;
    const cell = { row: node.position_y!, col: node.position_x! };
    const key = cellKey(cell);
    if (occupancy.has(key)) continue;
    placements.set(node.id, cell);
    occupancy.set(key, node.id);
  }

  const unplaced = ordered.filter((node) => !placements.has(node.id));
  if (unplaced.length > 0) {
    const radialSlots = getRadialCells(Math.max(unplaced.length + occupancy.size, nodes.length + 4));
    let slotIndex = 0;

    for (const node of unplaced) {
      while (slotIndex < radialSlots.length) {
        const cell = radialSlots[slotIndex++];
        const key = cellKey(cell);
        if (occupancy.has(key)) continue;
        placements.set(node.id, cell);
        occupancy.set(key, node.id);
        break;
      }
    }
  }

  const startNode = ordered.find((node) => node.is_start) ?? ordered[0];
  const startCell = startNode ? (placements.get(startNode.id) ?? { row: 0, col: 0 }) : { row: 0, col: 0 };

  return { ordered, placements, occupancy, startCell };
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
): GridCell[] {
  if (viewportWidth <= 0 || viewportHeight <= 0) return [];

  const pitch = SKILL_GRID_PITCH;
  const minCol = Math.floor((-panX) / zoom / pitch) - padding;
  const maxCol = Math.ceil((viewportWidth - panX) / zoom / pitch) + padding;
  const minRow = Math.floor((-panY) / zoom / pitch) - padding;
  const maxRow = Math.ceil((viewportHeight - panY) / zoom / pitch) + padding;

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
) {
  const centerX = cell.col * SKILL_GRID_PITCH + SKILL_GRID_CELL_SIZE / 2;
  const centerY = cell.row * SKILL_GRID_PITCH + SKILL_GRID_CELL_SIZE / 2;

  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
  };
}