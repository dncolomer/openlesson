/**
 * Pure minimap cluster graph for the block skill grid.
 *
 * Isolation rule (Chebyshev): two blocks belong to the same cluster when the
 * minimum Chebyshev distance between any of their occupied cells is ≤ isolationGap
 * (default 3). A gap of ≥3 empty cells (Chebyshev distance ≥ isolationGap+1)
 * splits groups into distinct clusters.
 *
 * No React — unit-tested entry point for BlockSkillGrid minimap.
 */

import {
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";

export type MinimapGridCell = { row: number; col: number };

export type MinimapBlockPlacement = {
  id: string;
  /** All absolute cells this block occupies (solid span or freeform). */
  cells: readonly MinimapGridCell[];
};

export type MinimapCluster = {
  id: string;
  blockIds: string[];
  /** Number of blocks in the cluster (label on the dot). */
  count: number;
  /** Geometric mean of block anchors (row/col), for plotting. */
  center: MinimapGridCell;
  /** Real block nearest the geometric center — pan target. */
  centerBlockId: string;
  /** Placement cell of centerBlockId (anchor or first occupied cell). */
  centerCell: MinimapGridCell;
};

export type MinimapClusterEdge = {
  fromClusterId: string;
  toClusterId: string;
};

export type MinimapClusterGraph = {
  clusters: MinimapCluster[];
  edges: MinimapClusterEdge[];
  /** Isolation gap used (empty cells required to separate). */
  isolationGap: number;
};

/** Default: ≥3 empty cells (Chebyshev dist ≥ 4) separates clusters. */
export const MINIMAP_ISOLATION_GAP_CELLS = 3;

/**
 * Default minimap overlay frame (px). Larger than the original 148×108 so
 * cluster counts stay readable, smaller than the prior 220×168 overlay.
 * BlockSkillGrid consumes these for the minimap and the notes/layers stack.
 */
export const MINIMAP_FRAME_WIDTH = 184;
export const MINIMAP_FRAME_HEIGHT = 140;
/** Prior frame size — tests assert the new frame is strictly larger. */
export const MINIMAP_FRAME_WIDTH_LEGACY = 148;
export const MINIMAP_FRAME_HEIGHT_LEGACY = 108;
/** Prior large overlay (2026) — tests assert the current frame is smaller. */
export const MINIMAP_FRAME_WIDTH_PREV = 220;
export const MINIMAP_FRAME_HEIGHT_PREV = 168;
/** Default inset so dots stay inside the rounded frame. */
export const MINIMAP_FRAME_PADDING = 18;

function chebyshev(a: MinimapGridCell, b: MinimapGridCell): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

/** Min Chebyshev distance between any cell of A and any cell of B. */
export function minChebyshevBetweenBlocks(
  a: readonly MinimapGridCell[],
  b: readonly MinimapGridCell[],
): number {
  if (!a.length || !b.length) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const ca of a) {
    for (const cb of b) {
      const d = chebyshev(ca, cb);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Whether two blocks are in the same cluster under the isolation-gap rule.
 * Same cluster when gap empty cells &lt; isolationGap, i.e. minChebyshev ≤ isolationGap.
 */
export function blocksAreClusterNeighbors(
  a: readonly MinimapGridCell[],
  b: readonly MinimapGridCell[],
  isolationGap: number = MINIMAP_ISOLATION_GAP_CELLS,
): boolean {
  const d = minChebyshevBetweenBlocks(a, b);
  // gap empty ≈ d - 1; same cluster when gap < isolationGap → d ≤ isolationGap
  return d <= isolationGap;
}

function unionFind(n: number) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const unite = (a: number, b: number) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra] += 1;
  };
  return { find, unite };
}

function blockAnchor(cells: readonly MinimapGridCell[]): MinimapGridCell {
  if (!cells.length) return { row: 0, col: 0 };
  let minR = cells[0].row;
  let minC = cells[0].col;
  for (const c of cells) {
    if (c.row < minR) minR = c.row;
    if (c.col < minC) minC = c.col;
  }
  return { row: minR, col: minC };
}

/**
 * Derive cluster graph from block placements.
 * isolationGap defaults to 3 empty cells between groups.
 */
export function buildMinimapClusterGraph(
  blocks: readonly MinimapBlockPlacement[],
  isolationGap: number = MINIMAP_ISOLATION_GAP_CELLS,
): MinimapClusterGraph {
  const valid = blocks.filter((b) => b.id && Array.isArray(b.cells) && b.cells.length > 0);
  if (valid.length === 0) {
    return { clusters: [], edges: [], isolationGap };
  }

  const n = valid.length;
  const uf = unionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (blocksAreClusterNeighbors(valid[i].cells, valid[j].cells, isolationGap)) {
        uf.unite(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const list = groups.get(root) || [];
    list.push(i);
    groups.set(root, list);
  }

  const clusters: MinimapCluster[] = [];
  let clusterSeq = 0;
  for (const indices of groups.values()) {
    const memberBlocks = indices.map((i) => valid[i]);
    const blockIds = memberBlocks.map((b) => b.id);

    // Geometric center from all occupied cells
    let sumR = 0;
    let sumC = 0;
    let cellCount = 0;
    for (const b of memberBlocks) {
      for (const c of b.cells) {
        sumR += c.row;
        sumC += c.col;
        cellCount += 1;
      }
    }
    const center: MinimapGridCell = {
      row: Math.round(sumR / Math.max(1, cellCount)),
      col: Math.round(sumC / Math.max(1, cellCount)),
    };

    // Nearest block anchor to geometric center
    let bestId = memberBlocks[0].id;
    let bestCell = blockAnchor(memberBlocks[0].cells);
    let bestDist = chebyshev(bestCell, center);
    for (const b of memberBlocks) {
      const anchor = blockAnchor(b.cells);
      const d = chebyshev(anchor, center);
      if (d < bestDist) {
        bestDist = d;
        bestId = b.id;
        bestCell = anchor;
      }
    }

    clusters.push({
      id: `cluster-${clusterSeq++}`,
      blockIds,
      count: blockIds.length,
      center,
      centerBlockId: bestId,
      centerCell: bestCell,
    });
  }

  // Stable order: by center position then id
  clusters.sort((a, b) => {
    if (a.center.row !== b.center.row) return a.center.row - b.center.row;
    if (a.center.col !== b.center.col) return a.center.col - b.center.col;
    return a.id.localeCompare(b.id);
  });
  // Re-id after sort for stable display
  clusters.forEach((c, i) => {
    c.id = `cluster-${i}`;
  });

  // MST edges between cluster centers (readable connected graph)
  const edges = buildClusterMstEdges(clusters);

  return { clusters, edges, isolationGap };
}

/** Kruskal MST on cluster centers (Chebyshev weight). */
export function buildClusterMstEdges(clusters: readonly MinimapCluster[]): MinimapClusterEdge[] {
  if (clusters.length < 2) return [];
  type E = { i: number; j: number; w: number };
  const pairs: E[] = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      pairs.push({
        i,
        j,
        w: chebyshev(clusters[i].center, clusters[j].center),
      });
    }
  }
  pairs.sort((a, b) => a.w - b.w);
  const uf = unionFind(clusters.length);
  const edges: MinimapClusterEdge[] = [];
  for (const p of pairs) {
    if (uf.find(p.i) === uf.find(p.j)) continue;
    uf.unite(p.i, p.j);
    edges.push({
      fromClusterId: clusters[p.i].id,
      toClusterId: clusters[p.j].id,
    });
    if (edges.length === clusters.length - 1) break;
  }
  return edges;
}

/**
 * Project cluster centers into a rectangular plot area.
 *
 * The geometric center of the cluster-set bbox maps to the **center of the
 * frame**. Relative left/right and above/below order is preserved. A single
 * cluster sits at the frame center (not top-left).
 */
export function projectMinimapClusters(
  clusters: readonly MinimapCluster[],
  width: number,
  height: number,
  padding = MINIMAP_FRAME_PADDING,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (!clusters.length || width <= 0 || height <= 0) return out;

  const frameCx = width / 2;
  const frameCy = height / 2;
  const pad = Math.max(0, Math.min(padding, Math.floor(Math.min(width, height) / 2) - 1));
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  let minR = clusters[0].center.row;
  let maxR = clusters[0].center.row;
  let minC = clusters[0].center.col;
  let maxC = clusters[0].center.col;
  for (const c of clusters) {
    minR = Math.min(minR, c.center.row);
    maxR = Math.max(maxR, c.center.row);
    minC = Math.min(minC, c.center.col);
    maxC = Math.max(maxC, c.center.col);
  }

  // Bbox center in grid space → frame center. span ≥ 1 keeps single-cluster
  // (col-mid)=0 so it lands on the frame center.
  const midC = (minC + maxC) / 2;
  const midR = (minR + maxR) / 2;
  const spanC = Math.max(1, maxC - minC);
  const spanR = Math.max(1, maxR - minR);

  for (const c of clusters) {
    // Normalize so extremes sit at ±inner/2 around frame center.
    const x = frameCx + ((c.center.col - midC) / spanC) * innerW;
    const y = frameCy + ((c.center.row - midR) / spanR) * innerH;
    out.set(c.id, { x, y });
  }
  return out;
}

/**
 * Build placements input from skill-grid layout maps.
 * cellsByBlockId: id → occupied absolute cells.
 */
export function placementsFromOccupiedCells(
  cellsByBlockId: ReadonlyMap<string, readonly MinimapGridCell[]>,
): MinimapBlockPlacement[] {
  const out: MinimapBlockPlacement[] = [];
  for (const [id, cells] of cellsByBlockId) {
    if (!id || !cells?.length) continue;
    out.push({ id, cells: cells.map((c) => ({ row: c.row, col: c.col })) });
  }
  return out;
}

// ── Mini-map tiles + fog of war (no cluster link graph) ───────────────────

/** One occupied grid cell projected into minimap frame pixels. */
export type MinimapTile = {
  blockId: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Unoccupied cell in the map bbox — rendered as fog of war. */
export type MinimapFogCell = {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Cluster block-count badge on the mini map (no edges between clusters). */
export type MinimapCountLabel = {
  clusterId: string;
  count: number;
  x: number;
  y: number;
  centerBlockId: string;
  centerCell: MinimapGridCell;
};

export type MinimapTileView = {
  tiles: MinimapTile[];
  fogCells: MinimapFogCell[];
  labels: MinimapCountLabel[];
  totalBlocks: number;
  /** Grid bbox used for projection (includes fog margin). */
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  /** Pixel size of one grid cell in the frame. */
  cellSize: number;
  width: number;
  height: number;
};

/**
 * Project map occupancy into mini square tiles + fog for empty cells.
 * Does **not** produce inter-cluster edges — tile view is a miniature map.
 */
export function projectMinimapTiles(input: {
  placements: readonly MinimapBlockPlacement[];
  width: number;
  height: number;
  padding?: number;
  /**
   * Optional cluster graph for count badges only (not for link lines).
   * When omitted, a single total-blocks label is not auto-built — caller may
   * pass buildMinimapClusterGraph(...).clusters.
   */
  clusters?: readonly MinimapCluster[] | null;
  /** Extra empty cells around occupied bbox for fog padding (default 1). */
  fogMargin?: number;
  /**
   * Cap fog cells for pathological huge maps (default 2500).
   * Occupied tiles are never capped.
   */
  maxFogCells?: number;
}): MinimapTileView {
  const width = Math.max(1, Math.floor(Number(input.width) || 0));
  const height = Math.max(1, Math.floor(Number(input.height) || 0));
  const padRaw = input.padding ?? MINIMAP_FRAME_PADDING;
  const pad = Math.max(
    0,
    Math.min(padRaw, Math.floor(Math.min(width, height) / 2) - 1),
  );
  const fogMargin = Math.max(
    0,
    Math.min(4, Math.floor(Number(input.fogMargin) || 1)),
  );
  const maxFog = Math.max(
    64,
    Math.min(10_000, Math.floor(Number(input.maxFogCells) || 2500)),
  );

  const occupied = new Map<string, string>(); // "r:c" → blockId
  const placements = input.placements || [];
  for (const p of placements) {
    const id = String(p.id || "").trim();
    if (!id || !p.cells?.length) continue;
    for (const c of p.cells) {
      if (!Number.isFinite(c.row) || !Number.isFinite(c.col)) continue;
      const row = Math.trunc(c.row);
      const col = Math.trunc(c.col);
      const k = `${row}:${col}`;
      if (!occupied.has(k)) occupied.set(k, id);
    }
  }

  const empty: MinimapTileView = {
    tiles: [],
    fogCells: [],
    labels: [],
    totalBlocks: 0,
    bounds: { minRow: 0, maxRow: -1, minCol: 0, maxCol: -1 },
    cellSize: 0,
    width,
    height,
  };

  if (occupied.size === 0 || width <= 0 || height <= 0) {
    return empty;
  }

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const k of occupied.keys()) {
    const [rs, cs] = k.split(":");
    const row = Number(rs);
    const col = Number(cs);
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  }
  minRow -= fogMargin;
  maxRow += fogMargin;
  minCol -= fogMargin;
  maxCol += fogMargin;

  const spanR = Math.max(1, maxRow - minRow + 1);
  const spanC = Math.max(1, maxCol - minCol + 1);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  // Fit entire bbox into padded frame; square-ish cells
  const cellSize = Math.max(
    2,
    Math.min(innerW / spanC, innerH / spanR),
  );
  const usedW = cellSize * spanC;
  const usedH = cellSize * spanR;
  const originX = pad + (innerW - usedW) / 2;
  const originY = pad + (innerH - usedH) / 2;

  const toXY = (row: number, col: number) => ({
    x: originX + (col - minCol) * cellSize,
    y: originY + (row - minRow) * cellSize,
  });

  // Gap between tiles so squares read as distinct map cells
  const gap = Math.min(1.25, Math.max(0.35, cellSize * 0.12));
  const tileSize = Math.max(1.5, cellSize - gap);

  const tiles: MinimapTile[] = [];
  for (const [k, blockId] of occupied) {
    const [rs, cs] = k.split(":");
    const row = Number(rs);
    const col = Number(cs);
    const { x, y } = toXY(row, col);
    tiles.push({
      blockId,
      row,
      col,
      x: x + gap / 2,
      y: y + gap / 2,
      w: tileSize,
      h: tileSize,
    });
  }
  // Stable paint order
  tiles.sort((a, b) => a.row - b.row || a.col - b.col || a.blockId.localeCompare(b.blockId));

  const fogCells: MinimapFogCell[] = [];
  const totalCells = spanR * spanC;
  const step =
    totalCells <= maxFog
      ? 1
      : Math.max(1, Math.ceil(Math.sqrt(totalCells / maxFog)));
  for (let row = minRow; row <= maxRow; row += step) {
    for (let col = minCol; col <= maxCol; col += step) {
      const k = `${row}:${col}`;
      if (occupied.has(k)) continue;
      // Skip occupied when step>1: still skip if any cell in the step window occupied
      if (step > 1) {
        let hit = false;
        for (let dr = 0; dr < step && !hit; dr++) {
          for (let dc = 0; dc < step && !hit; dc++) {
            if (occupied.has(`${row + dr}:${col + dc}`)) hit = true;
          }
        }
        if (hit) continue;
      }
      const { x, y } = toXY(row, col);
      const w = tileSize * step + gap * (step - 1);
      const h = tileSize * step + gap * (step - 1);
      fogCells.push({
        row,
        col,
        x: x + gap / 2,
        y: y + gap / 2,
        w,
        h,
      });
      if (fogCells.length >= maxFog) break;
    }
    if (fogCells.length >= maxFog) break;
  }

  const blockIds = new Set(placements.map((p) => String(p.id || "").trim()).filter(Boolean));
  const totalBlocks = blockIds.size;

  const labels: MinimapCountLabel[] = [];
  const clusters = input.clusters || [];
  for (const c of clusters) {
    if (!c?.id || !c.count) continue;
    const cc = c.centerCell || c.center;
    if (!cc || !Number.isFinite(cc.row) || !Number.isFinite(cc.col)) continue;
    const { x, y } = toXY(Math.trunc(cc.row), Math.trunc(cc.col));
    labels.push({
      clusterId: c.id,
      count: c.count,
      x: x + cellSize / 2,
      y: y + cellSize / 2,
      centerBlockId: c.centerBlockId,
      centerCell: {
        row: Math.trunc(cc.row),
        col: Math.trunc(cc.col),
      },
    });
  }

  return {
    tiles,
    fogCells,
    labels,
    totalBlocks,
    bounds: { minRow, maxRow, minCol, maxCol },
    cellSize,
    width,
    height,
  };
}

/** True when a minimap view has no occupied tiles (empty map). */
export function isMinimapTileViewEmpty(
  view: MinimapTileView | null | undefined,
): boolean {
  return !view || view.tiles.length === 0;
}

/**
 * Collect occupied cells for a cluster (union of member block footprints).
 * Falls back to centerCell when placements lack members.
 */
export function cellsForMinimapCluster(
  placements: readonly MinimapBlockPlacement[],
  cluster: {
    blockIds?: readonly string[] | null;
    centerCell?: MinimapGridCell | null;
    centerBlockId?: string | null;
  },
): MinimapGridCell[] {
  const idSet = new Set(
    (cluster.blockIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  if (cluster.centerBlockId) {
    idSet.add(String(cluster.centerBlockId).trim());
  }
  const out: MinimapGridCell[] = [];
  const seen = new Set<string>();
  for (const p of placements || []) {
    const id = String(p.id || "").trim();
    if (!id || !idSet.has(id)) continue;
    for (const c of p.cells || []) {
      if (!Number.isFinite(c.row) || !Number.isFinite(c.col)) continue;
      const row = Math.trunc(c.row);
      const col = Math.trunc(c.col);
      const k = `${row}:${col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ row, col });
    }
  }
  if (out.length === 0 && cluster.centerCell) {
    const row = Math.trunc(Number(cluster.centerCell.row) || 0);
    const col = Math.trunc(Number(cluster.centerCell.col) || 0);
    out.push({ row, col });
  }
  return out;
}

/**
 * Pan + zoom for a **1:1** view of a cluster (zoom = 1) centered on its cells.
 * Pure so minimap click + unit tests share the same camera math.
 *
 * World coords: cell (row,col) top-left at (col * pitch, row * pitch).
 */
export function getPanZoomToOneToOneClusterView(input: {
  viewportWidth: number;
  viewportHeight: number;
  cells: readonly MinimapGridCell[];
  /** 1:1 scale (default 1). Clamped by min/max when provided. */
  oneToOneZoom?: number;
  pitch?: number;
  cellSize?: number;
  minZoom?: number;
  maxZoom?: number;
}): { pan: { x: number; y: number }; zoom: number } {
  const vw = Math.max(1, Number(input.viewportWidth) || 1);
  const vh = Math.max(1, Number(input.viewportHeight) || 1);
  const pitch =
    Number.isFinite(input.pitch) && (input.pitch as number) > 0
      ? (input.pitch as number)
      : SKILL_GRID_PITCH;
  const cellSize =
    Number.isFinite(input.cellSize) && (input.cellSize as number) > 0
      ? (input.cellSize as number)
      : SKILL_GRID_CELL_SIZE;
  let zoom =
    Number.isFinite(input.oneToOneZoom) && (input.oneToOneZoom as number) > 0
      ? (input.oneToOneZoom as number)
      : 1;
  if (Number.isFinite(input.minZoom)) {
    zoom = Math.max(input.minZoom as number, zoom);
  }
  if (Number.isFinite(input.maxZoom)) {
    zoom = Math.min(input.maxZoom as number, zoom);
  }

  const cells = (input.cells || []).filter(
    (c) => Number.isFinite(c.row) && Number.isFinite(c.col),
  );
  let centerX: number;
  let centerY: number;
  if (cells.length === 0) {
    centerX = cellSize / 2;
    centerY = cellSize / 2;
  } else {
    let sumX = 0;
    let sumY = 0;
    for (const c of cells) {
      // Cell center in world pixels
      sumX += Math.trunc(c.col) * pitch + cellSize / 2;
      sumY += Math.trunc(c.row) * pitch + cellSize / 2;
    }
    centerX = sumX / cells.length;
    centerY = sumY / cells.length;
  }

  return {
    zoom,
    pan: {
      x: vw / 2 - centerX * zoom,
      y: vh / 2 - centerY * zoom,
    },
  };
}

// ── Main-viewport rectangle on the mini map ───────────────────────────────

/** Axis-aligned viewport indicator in minimap frame pixels. */
export type MinimapViewportRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Reconstruct the cell→frame origin used by `projectMinimapTiles` so the
 * viewport rect shares the same coordinate system as tiles/fog.
 */
export function getMinimapFrameOrigin(input: {
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  cellSize: number;
  width: number;
  height: number;
  padding?: number;
}): { originX: number; originY: number; cellSize: number } | null {
  const b = input.bounds;
  if (
    !b ||
    !Number.isFinite(b.minRow) ||
    !Number.isFinite(b.maxRow) ||
    !Number.isFinite(b.minCol) ||
    !Number.isFinite(b.maxCol) ||
    b.maxRow < b.minRow ||
    b.maxCol < b.minCol
  ) {
    return null;
  }
  const cellSize = Number(input.cellSize);
  if (!(cellSize > 0) || !Number.isFinite(cellSize)) return null;
  const width = Math.max(1, Math.floor(Number(input.width) || 0));
  const height = Math.max(1, Math.floor(Number(input.height) || 0));
  if (width <= 0 || height <= 0) return null;
  const padRaw = input.padding ?? MINIMAP_FRAME_PADDING;
  const pad = Math.max(
    0,
    Math.min(padRaw, Math.floor(Math.min(width, height) / 2) - 1),
  );
  const spanR = Math.max(1, b.maxRow - b.minRow + 1);
  const spanC = Math.max(1, b.maxCol - b.minCol + 1);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const usedW = cellSize * spanC;
  const usedH = cellSize * spanR;
  return {
    originX: pad + (innerW - usedW) / 2,
    originY: pad + (innerH - usedH) / 2,
    cellSize,
  };
}

/**
 * Project the main map camera (pan/zoom + viewport size) onto the minimap as
 * an axis-aligned rect in frame pixels. Continuous cell coords so the rect
 * tracks pan smoothly (no integer snap).
 *
 * World: cell (row,col) top-left at `(col * pitch, row * pitch)`.
 * Screen: `world * zoom + pan`.
 */
export function projectMainViewportToMinimapRect(input: {
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  cellSize: number;
  width: number;
  height: number;
  padding?: number;
  pitch?: number;
}): MinimapViewportRect | null {
  const origin = getMinimapFrameOrigin(input);
  if (!origin) return null;
  const zoom = Number(input.zoom);
  if (!(zoom > 0) || !Number.isFinite(zoom)) return null;
  const vw = Number(input.viewportWidth);
  const vh = Number(input.viewportHeight);
  if (!(vw > 0) || !(vh > 0) || !Number.isFinite(vw) || !Number.isFinite(vh)) {
    return null;
  }
  const pitch =
    Number.isFinite(input.pitch) && (input.pitch as number) > 0
      ? (input.pitch as number)
      : SKILL_GRID_PITCH;
  const panX = Number(input.pan?.x) || 0;
  const panY = Number(input.pan?.y) || 0;

  // Visible continuous cell range of the main viewport
  const minColView = -panX / zoom / pitch;
  const maxColView = (vw - panX) / zoom / pitch;
  const minRowView = -panY / zoom / pitch;
  const maxRowView = (vh - panY) / zoom / pitch;

  const { originX, originY, cellSize } = origin;
  const { minCol, minRow } = input.bounds;
  const x = originX + (minColView - minCol) * cellSize;
  const y = originY + (minRowView - minRow) * cellSize;
  const w = (maxColView - minColView) * cellSize;
  const h = (maxRowView - minRowView) * cellSize;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0
  ) {
    return null;
  }
  return { x, y, w, h };
}

/**
 * Viewport-window for a map snapshot (workspace minimap + AYCL view-only preview).
 * Empty tiles / invalid camera → no window (do not invent a frame).
 * Otherwise delegates to projectMainViewportToMinimapRect so pan/zoom stay live.
 */
export function resolveMinimapViewportWindow(input: {
  tileCount: number;
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  cellSize: number;
  width?: number;
  height?: number;
  padding?: number;
  pitch?: number;
}): MinimapViewportRect | null {
  const tileCount = Math.floor(Number(input.tileCount) || 0);
  const cellSize = Number(input.cellSize);
  if (tileCount <= 0 || !(cellSize > 0) || !Number.isFinite(cellSize)) {
    return null;
  }
  return projectMainViewportToMinimapRect({
    pan: input.pan,
    zoom: input.zoom,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    bounds: input.bounds,
    cellSize,
    width: input.width ?? MINIMAP_FRAME_WIDTH,
    height: input.height ?? MINIMAP_FRAME_HEIGHT,
    padding: input.padding ?? MINIMAP_FRAME_PADDING,
    pitch: input.pitch,
  });
}

/**
 * Convert a minimap-space drag of the viewport rect into an updated main-map pan.
 * Dragging the rect right/down shows further right/down of the map (pan decreases).
 *
 * Pure so unit tests share the same path as the pointer handler.
 */
export function panFromMinimapViewportDrag(input: {
  pan: { x: number; y: number };
  zoom: number;
  /** Minimap-frame delta of the rect (px). */
  deltaX: number;
  deltaY: number;
  cellSize: number;
  pitch?: number;
}): { x: number; y: number } {
  const zoom = Number(input.zoom);
  const cellSize = Number(input.cellSize);
  const panX = Number(input.pan?.x) || 0;
  const panY = Number(input.pan?.y) || 0;
  if (
    !(zoom > 0) ||
    !Number.isFinite(zoom) ||
    !(cellSize > 0) ||
    !Number.isFinite(cellSize)
  ) {
    return { x: panX, y: panY };
  }
  const pitch =
    Number.isFinite(input.pitch) && (input.pitch as number) > 0
      ? (input.pitch as number)
      : SKILL_GRID_PITCH;
  const dx = Number(input.deltaX) || 0;
  const dy = Number(input.deltaY) || 0;
  // dCol = dx / cellSize; dWorld = dCol * pitch; newPan = pan - dWorld * zoom
  const scale = (pitch * zoom) / cellSize;
  return {
    x: panX - dx * scale,
    y: panY - dy * scale,
  };
}
