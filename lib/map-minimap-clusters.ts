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
 * cluster counts stay readable; BlockSkillGrid consumes these constants.
 */
export const MINIMAP_FRAME_WIDTH = 220;
export const MINIMAP_FRAME_HEIGHT = 168;
/** Prior frame size — tests assert the new frame is strictly larger. */
export const MINIMAP_FRAME_WIDTH_LEGACY = 148;
export const MINIMAP_FRAME_HEIGHT_LEGACY = 108;
/** Default inset so dots stay inside the rounded frame. */
export const MINIMAP_FRAME_PADDING = 22;

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
