/**
 * Pure multi-select "Cluster blocks": assign selected blocks into K groups and
 * relocate their map anchors so clusters are physically separated.
 *
 * - Content (title, description, ids, shapes, spans) is never rewritten.
 * - Inter-cluster isolation reuses minimap rule: ≥3 empty cells
 *   (Chebyshev distance ≥ MINIMAP_ISOLATION_GAP_CELLS + 1).
 * - Collision-conservative: never returns placements that overlap each other,
 *   non-selected occupied cells, or unusable ground. Fails cleanly instead.
 */

import { getCellKey, type GridCell } from "@/lib/block-skill-grid";
import {
  MINIMAP_ISOLATION_GAP_CELLS,
  minChebyshevBetweenBlocks,
} from "@/lib/map-minimap-clusters";
import {
  buildOccupancyFromPlaced,
  canPlaceAbsoluteCells,
  normalizeSpan,
  parseShapeCells,
  placedBlockCells,
  type PlacedBlockRef,
  type ShapeOffset,
} from "@/lib/skill-grid-ops";

/** Empty-cell gap required between different clusters (matches minimap). */
export const CLUSTER_ISOLATION_GAP_CELLS = MINIMAP_ISOLATION_GAP_CELLS;

/**
 * Minimum Chebyshev distance between any cell of cluster A and cluster B.
 * gap empty ≈ d - 1; gap ≥ isolation ⇒ d ≥ isolation + 1.
 */
export const CLUSTER_MIN_INTER_CHEBYSHEV = CLUSTER_ISOLATION_GAP_CELLS + 1;

/**
 * Extra empty cells between clusters beyond the minimum isolation gap.
 * Slider range in the Cluster drawer (0 = tightest legal, 10 = very spread).
 */
export const CLUSTER_SEPARATION_MIN = 0;
export const CLUSTER_SEPARATION_MAX = 10;
/** Default: tightest legal packing (min isolation only). Raise to spread groups. */
export const CLUSTER_SEPARATION_DEFAULT = 0;

/** Normalize separation extra cells into [0, 10]. */
export function resolveClusterSeparation(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") {
    return CLUSTER_SEPARATION_DEFAULT;
  }
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return CLUSTER_SEPARATION_DEFAULT;
  return Math.max(CLUSTER_SEPARATION_MIN, Math.min(CLUSTER_SEPARATION_MAX, n));
}

/**
 * Min Chebyshev between clusters = hard isolation (+1) + optional extra cells.
 */
export function clusterMinInterChebyshev(separationExtra: unknown = 0): number {
  return CLUSTER_MIN_INTER_CHEBYSHEV + resolveClusterSeparation(separationExtra);
}

/**
 * Soft preferred ring radius for fallback simultaneous placement.
 * Uses regular-polygon geometry so separation matches requested center distance
 * without the old overly large maxDim+gap heuristic that flung clusters away.
 *
 * Primary placement is sequential tight-pack ({@link placeClusterAssignments});
 * this remains for tests and the ring fallback path.
 */
export function clusterRingBaseRadius(
  groupCount: number,
  maxDim: number,
  minChebyshev: number,
): number {
  const G = Math.max(1, Math.floor(groupCount));
  if (G <= 1) return 0;
  const dim = Math.max(1, Math.floor(maxDim));
  const gap = Math.max(CLUSTER_MIN_INTER_CHEBYSHEV, Math.floor(minChebyshev));
  // Desired distance between neighboring cluster centers.
  const side = dim + gap;
  // Circumradius of regular G-gon with side `side`.
  const R = side / (2 * Math.sin(Math.PI / G));
  return Math.max(gap, Math.ceil(R));
}

/**
 * Max search radius when packing the next cluster near already-placed ones.
 * Scales gently with separation so high slider values still find room.
 */
export function clusterPackSearchRadius(
  groupCount: number,
  maxDim: number,
  minChebyshev: number,
  separationExtra: number = 0,
): number {
  const G = Math.max(1, Math.floor(groupCount));
  const dim = Math.max(1, Math.floor(maxDim));
  const gap = Math.max(CLUSTER_MIN_INTER_CHEBYSHEV, Math.floor(minChebyshev));
  const sep = resolveClusterSeparation(separationExtra);
  // Enough room to walk around G-1 neighbors with isolation padding.
  return dim * G + gap * G + 8 + sep * 3;
}

export type ClusterBlockInput = {
  id: string;
  title?: string | null;
  description?: string | null;
  position_x: number;
  position_y: number;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: ShapeOffset[] | null;
};

export type ClusterCountSpec = number | "auto" | null | undefined;

export type ClusterBlocksParams = {
  /** Selected blocks to reassign and relocate (≥2). */
  selected: readonly ClusterBlockInput[];
  /**
   * Full map occupancy (all placed blocks). Selected ids are treated as moving
   * (their current cells free up during placement checks).
   */
  allPlaced?: readonly PlacedBlockRef[] | null;
  /** Unusable ground keys (`row:col`) if already keyed; or absolute cells. */
  unusableKeys?: ReadonlySet<string> | null;
  unusableCells?: readonly { row: number; col: number }[] | null;
  /** Desired cluster count, or "auto"/null to let the system decide. */
  clusterCount?: ClusterCountSpec;
  /**
   * Extra empty cells between clusters beyond the minimum isolation gap of 3.
   * 0 = tightest legal packing; 10 = very spread. Default
   * {@link CLUSTER_SEPARATION_DEFAULT}.
   */
  separation?: number | null;
  /** Optional free-text bias for grouping (local token overlap — no LLM). */
  prompt?: string | null;
};

export type ClusterBlocksSuccess = {
  ok: true;
  /** New anchors for selected blocks only (shapes/spans preserved). */
  placements: PlacedBlockRef[];
  /** Resolved K (1..N). */
  clusterCount: number;
  /** blockId → cluster index in 0..K-1 */
  assignment: Record<string, number>;
  /** Clusters as ordered id lists. */
  clusters: string[][];
};

export type ClusterBlocksFailure = {
  ok: false;
  error: string;
  /** Assignment attempted (if any) before placement failed. */
  assignment?: Record<string, number>;
  clusterCount?: number;
};

export type ClusterBlocksResult = ClusterBlocksSuccess | ClusterBlocksFailure;

function cleanText(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

function tokenize(text: string): string[] {
  return cleanText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 2);
}

function bagScore(tokens: readonly string[], bag: ReadonlySet<string>): number {
  if (!tokens.length || bag.size === 0) return 0;
  let hit = 0;
  for (const t of tokens) if (bag.has(t)) hit += 1;
  return hit / tokens.length;
}

/**
 * Auto cluster count: sqrt(N) rounded, clamped to [1, N].
 * For N ≥ 4 yields ≥2 so large selections actually split.
 */
export function resolveAutoClusterCount(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  const N = Math.floor(n);
  if (N === 1) return 1;
  if (N === 2) return 2;
  if (N === 3) return 2;
  const k = Math.round(Math.sqrt(N));
  return Math.max(1, Math.min(N, k));
}

/** Normalize user count / auto into 1..N. Invalid → auto. */
export function resolveClusterCount(
  n: number,
  spec: ClusterCountSpec,
): number {
  const N = Math.max(0, Math.floor(n));
  if (N < 1) return 0;
  if (spec === "auto" || spec === null || spec === undefined) {
    return resolveAutoClusterCount(N);
  }
  const k = Math.floor(Number(spec));
  if (!Number.isFinite(k) || k < 1) return resolveAutoClusterCount(N);
  return Math.max(1, Math.min(N, k));
}

/**
 * Assign selected blocks into K clusters using:
 * 1) spatial seeds (farthest-first on anchors)
 * 2) optional prompt/title text affinity reassignment
 * Deterministic — no RNG, no LLM.
 */
export function assignBlocksToClusters(
  blocks: readonly ClusterBlockInput[],
  clusterCount: number,
  prompt?: string | null,
): { assignment: Record<string, number>; clusters: string[][] } {
  const list = blocks.filter((b) => b?.id);
  const N = list.length;
  const K = resolveClusterCount(N, clusterCount);
  const assignment: Record<string, number> = {};
  const clusters: string[][] = Array.from({ length: K }, () => []);

  if (N === 0 || K === 0) return { assignment, clusters };

  if (K === 1) {
    for (const b of list) {
      assignment[b.id] = 0;
      clusters[0].push(b.id);
    }
    return { assignment, clusters };
  }

  // Feature: (x, y) + text affinity to prompt + pairwise-ready tokens
  const promptBag = new Set(tokenize(prompt || ""));
  type Feat = { id: string; x: number; y: number; text: number; tokens: string[] };
  const feats: Feat[] = list.map((b) => {
    const tokens = tokenize(`${b.title || ""} ${b.description || ""}`);
    return {
      id: b.id,
      x: Number(b.position_x) || 0,
      y: Number(b.position_y) || 0,
      text: bagScore(tokens, promptBag),
      tokens,
    };
  });

  // Farthest-first seed on (x,y) — deterministic by stable id order for ties
  const ordered = [...feats].sort((a, b) => a.id.localeCompare(b.id));
  const seedIdx: number[] = [];
  // First seed: leftmost-topmost (min y then min x), stable by id
  let first = 0;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i];
    const b = ordered[first];
    if (a.y < b.y || (a.y === b.y && a.x < b.x)) first = i;
  }
  seedIdx.push(first);

  while (seedIdx.length < K) {
    let bestI = -1;
    let bestDist = -1;
    for (let i = 0; i < ordered.length; i++) {
      if (seedIdx.includes(i)) continue;
      let minD = Infinity;
      for (const s of seedIdx) {
        const d =
          Math.abs(ordered[i].x - ordered[s].x) +
          Math.abs(ordered[i].y - ordered[s].y) +
          // slight text pull: prefer seeding diverse text affinity
          Math.abs(ordered[i].text - ordered[s].text) * 2;
        if (d < minD) minD = d;
      }
      if (
        minD > bestDist ||
        (minD === bestDist &&
          bestI >= 0 &&
          ordered[i].id.localeCompare(ordered[bestI].id) < 0)
      ) {
        bestDist = minD;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    seedIdx.push(bestI);
  }

  // Assign each block to nearest seed (Chebyshev on map + text weight)
  for (let i = 0; i < ordered.length; i++) {
    let bestC = 0;
    let bestScore = Infinity;
    for (let c = 0; c < seedIdx.length; c++) {
      const s = ordered[seedIdx[c]];
      const f = ordered[i];
      const spatial = Math.max(Math.abs(f.x - s.x), Math.abs(f.y - s.y));
      // When prompt present, pull high-affinity blocks toward seed with closest text
      const textDist = Math.abs(f.text - s.text) * (promptBag.size > 0 ? 4 : 0);
      const score = spatial + textDist;
      if (score < bestScore || (score === bestScore && c < bestC)) {
        bestScore = score;
        bestC = c;
      }
    }
    assignment[ordered[i].id] = bestC;
  }

  // Optional: if prompt tokens exist, re-bucket by prompt affinity into K bins
  // so "influence" is visible when spatial alone would clump everything.
  if (promptBag.size > 0 && N >= K) {
    const scored = ordered
      .map((f) => ({ id: f.id, text: f.text, x: f.x, y: f.y }))
      .sort((a, b) => {
        if (b.text !== a.text) return b.text - a.text;
        return a.id.localeCompare(b.id);
      });
    // Only reassign when at least one block has prompt hit
    if (scored.some((s) => s.text > 0)) {
      for (let i = 0; i < scored.length; i++) {
        // Distribute round-robin by rank for diversity, prefer high affinity to early clusters
        const bin = Math.min(K - 1, Math.floor((i * K) / scored.length));
        assignment[scored[i].id] = bin;
      }
    }
  }

  // Rebuild clusters; ensure no empty clusters by stealing from largest
  for (const id of Object.keys(assignment)) {
    const c = assignment[id];
    if (c >= 0 && c < K) clusters[c].push(id);
  }
  for (let c = 0; c < K; c++) {
    if (clusters[c].length > 0) continue;
    // steal last member of largest cluster
    let donor = 0;
    for (let d = 1; d < K; d++) {
      if (clusters[d].length > clusters[donor].length) donor = d;
    }
    if (clusters[donor].length <= 1) {
      // cannot fill — collapse empty by merging indices (shouldn't happen with K≤N)
      continue;
    }
    const stolen = clusters[donor].pop()!;
    clusters[c].push(stolen);
    assignment[stolen] = c;
  }

  return { assignment, clusters };
}

function blockToPlaced(b: ClusterBlockInput): PlacedBlockRef {
  const offsets = parseShapeCells(b.shape_cells ?? null);
  return {
    id: b.id,
    position_x: b.position_x,
    position_y: b.position_y,
    span_w: normalizeSpan(b.span_w),
    span_h: normalizeSpan(b.span_h),
    ...(offsets ? { shape_cells: offsets } : {}),
  };
}

function unusableKeySet(
  keys?: ReadonlySet<string> | null,
  cells?: readonly { row: number; col: number }[] | null,
): Set<string> {
  const out = new Set<string>();
  if (keys) for (const k of keys) out.add(k);
  if (cells) {
    for (const c of cells) {
      if (c && Number.isFinite(c.row) && Number.isFinite(c.col)) {
        out.add(getCellKey(c.row, c.col));
      }
    }
  }
  return out;
}

function cellsHitUnusable(
  cells: readonly GridCell[],
  unusable: ReadonlySet<string>,
): boolean {
  if (unusable.size === 0) return false;
  for (const c of cells) {
    if (unusable.has(getCellKey(c.row, c.col))) return true;
  }
  return false;
}

/**
 * Whether two cluster cell sets satisfy inter-cluster isolation
 * (min Chebyshev ≥ CLUSTER_MIN_INTER_CHEBYSHEV).
 */
export function clustersSatisfyIsolation(
  clusterCells: readonly (readonly GridCell[])[],
  minChebyshev: number = CLUSTER_MIN_INTER_CHEBYSHEV,
): boolean {
  for (let i = 0; i < clusterCells.length; i++) {
    for (let j = i + 1; j < clusterCells.length; j++) {
      const d = minChebyshevBetweenBlocks(clusterCells[i], clusterCells[j]);
      if (d < minChebyshev) return false;
    }
  }
  return true;
}

/**
 * Attempt to place assigned clusters with inter-cluster isolation and
 * no occupancy / unusable collisions. Preserves each block's shape and
 * relative layout within its cluster.
 */
export function placeClusterAssignments(
  selected: readonly ClusterBlockInput[],
  assignment: Record<string, number>,
  clusterCount: number,
  options: {
    allPlaced?: readonly PlacedBlockRef[] | null;
    unusableKeys?: ReadonlySet<string> | null;
    unusableCells?: readonly { row: number; col: number }[] | null;
    /** Extra empty cells beyond min isolation (0–10). */
    separation?: number | null;
  } = {},
): ClusterBlocksResult {
  const byId = new Map(selected.map((b) => [b.id, b]));
  const K = Math.max(1, clusterCount);
  const groups: ClusterBlockInput[][] = Array.from({ length: K }, () => []);
  for (const b of selected) {
    const c = assignment[b.id];
    if (c == null || c < 0 || c >= K) {
      return { ok: false, error: "Incomplete cluster assignment", assignment, clusterCount: K };
    }
    groups[c].push(b);
  }
  // Drop empty groups for placement geometry but keep K for reporting
  const nonEmpty = groups.filter((g) => g.length > 0);
  if (nonEmpty.length === 0) {
    return { ok: false, error: "No blocks to cluster", assignment, clusterCount: K };
  }

  const movingIds = new Set(selected.map((b) => b.id));
  const allPlaced = options.allPlaced || selected.map(blockToPlaced);
  const occupancy = buildOccupancyFromPlaced(
    allPlaced.filter((p) => p.position_x != null && p.position_y != null),
  );
  // Free cells currently held by moving blocks
  for (const key of [...occupancy.keys()]) {
    const occ = occupancy.get(key);
    if (occ && movingIds.has(occ)) occupancy.delete(key);
  }
  const unusable = unusableKeySet(options.unusableKeys, options.unusableCells);

  // Relative layout within each group (preserve relative anchors)
  type GroupLayout = {
    members: Array<{
      id: string;
      relCol: number;
      relRow: number;
      span_w: number;
      span_h: number;
      shape_cells?: ShapeOffset[] | null;
    }>;
    /** bbox size for radius estimation */
    width: number;
    height: number;
  };

  const layouts: GroupLayout[] = nonEmpty.map((group) => {
    const minX = Math.min(...group.map((b) => b.position_x));
    const minY = Math.min(...group.map((b) => b.position_y));
    const members = group.map((b) => {
      const placed = blockToPlaced(b);
      return {
        id: b.id,
        relCol: b.position_x - minX,
        relRow: b.position_y - minY,
        span_w: placed.span_w ?? 1,
        span_h: placed.span_h ?? 1,
        shape_cells: placed.shape_cells ?? null,
      };
    });
    let maxCol = 0;
    let maxRow = 0;
    for (const m of members) {
      const cells = placedBlockCells({
        id: m.id,
        position_x: m.relCol,
        position_y: m.relRow,
        span_w: m.span_w,
        span_h: m.span_h,
        shape_cells: m.shape_cells,
      });
      for (const c of cells) {
        if (c.col > maxCol) maxCol = c.col;
        if (c.row > maxRow) maxRow = c.row;
      }
    }
    return { members, width: maxCol + 1, height: maxRow + 1 };
  });

  // Selection centroid — keep the packed group near where the selection was.
  const cx =
    selected.reduce((s, b) => s + b.position_x, 0) / Math.max(1, selected.length);
  const cy =
    selected.reduce((s, b) => s + b.position_y, 0) / Math.max(1, selected.length);

  const maxDim = Math.max(
    1,
    ...layouts.map((l) => Math.max(l.width, l.height)),
  );
  const separationExtra = resolveClusterSeparation(options.separation);
  const minChebyshev = clusterMinInterChebyshev(separationExtra);
  const G = layouts.length;

  const successFrom = (placements: PlacedBlockRef[]): ClusterBlocksSuccess => {
    const clusters: string[][] = Array.from({ length: K }, () => []);
    for (const b of selected) {
      const c = assignment[b.id];
      if (c != null && c >= 0 && c < K) clusters[c].push(b.id);
    }
    return {
      ok: true,
      placements,
      clusterCount: K,
      assignment,
      clusters,
    };
  };

  /** Materialize a group at an absolute origin; null if self-overlap. */
  const materializeGroup = (
    layout: GroupLayout,
    originCol: number,
    originRow: number,
  ): { placements: PlacedBlockRef[]; cells: GridCell[] } | null => {
    const placements: PlacedBlockRef[] = [];
    const cells: GridCell[] = [];
    const localClaimed = new Set<string>();
    for (const m of layout.members) {
      const next: PlacedBlockRef = {
        id: m.id,
        position_x: originCol + m.relCol,
        position_y: originRow + m.relRow,
        span_w: m.span_w,
        span_h: m.span_h,
        ...(m.shape_cells ? { shape_cells: m.shape_cells } : {}),
      };
      const nextCells = placedBlockCells(next);
      for (const cell of nextCells) {
        const key = getCellKey(cell.row, cell.col);
        if (localClaimed.has(key)) return null;
        localClaimed.add(key);
      }
      cells.push(...nextCells);
      placements.push(next);
    }
    return { placements, cells };
  };

  const originOk = (
    cells: readonly GridCell[],
    claimed: ReadonlySet<string>,
    priorClusterCells: readonly (readonly GridCell[])[],
  ): boolean => {
    for (const cell of cells) {
      const key = getCellKey(cell.row, cell.col);
      if (claimed.has(key)) return false;
    }
    if (!canPlaceAbsoluteCells(cells, occupancy, movingIds)) return false;
    if (cellsHitUnusable(cells, unusable)) return false;
    for (const prior of priorClusterCells) {
      if (minChebyshevBetweenBlocks(cells, prior) < minChebyshev) return false;
    }
    return true;
  };

  // ── Primary: sequential tight pack ─────────────────────────────────────
  // Place largest groups first near the selection centroid, then park each
  // next group at the *nearest* valid origin. Separation only widens the
  // required gap — it does not force a huge simultaneous ring.
  {
    const order = layouts
      .map((layout, index) => ({ layout, index }))
      .sort((a, b) => {
        const areaA = a.layout.width * a.layout.height;
        const areaB = b.layout.width * b.layout.height;
        if (areaB !== areaA) return areaB - areaA;
        return a.index - b.index;
      });

    const placements: PlacedBlockRef[] = [];
    const clusterCells: GridCell[][] = Array.from({ length: G }, () => []);
    const claimed = new Set<string>();
    let packed = true;

    for (let step = 0; step < order.length; step++) {
      const { layout, index } = order[step];
      let found: { col: number; row: number; mat: NonNullable<ReturnType<typeof materializeGroup>> } | null =
        null;

      if (step === 0) {
        // Anchor first (largest) group on the selection centroid.
        const col = Math.round(cx - layout.width / 2);
        const row = Math.round(cy - layout.height / 2);
        const mat = materializeGroup(layout, col, row);
        if (mat && originOk(mat.cells, claimed, [])) {
          found = { col, row, mat };
        } else {
          // Nudge around centroid if the exact seat is blocked by non-selected blocks.
          const nudgeMax = 4 + separationExtra;
          outerNudge: for (let r = 1; r <= nudgeMax; r++) {
            for (let dcol = -r; dcol <= r; dcol++) {
              for (let drow = -r; drow <= r; drow++) {
                if (Math.max(Math.abs(dcol), Math.abs(drow)) !== r) continue;
                const mat2 = materializeGroup(layout, col + dcol, row + drow);
                if (mat2 && originOk(mat2.cells, claimed, [])) {
                  found = { col: col + dcol, row: row + drow, mat: mat2 };
                  break outerNudge;
                }
              }
            }
          }
        }
      } else {
        // Expanding Chebyshev ring of candidate origins; first hit wins → tight.
        // Isolation (minChebyshev, includes separation) is enforced in originOk —
        // do not also inflate the start radius or separation is double-counted.
        const maxR = clusterPackSearchRadius(
          G,
          maxDim,
          minChebyshev,
          separationExtra,
        );
        const priorCells = order
          .slice(0, step)
          .map((o) => clusterCells[o.index])
          .filter((c) => c.length > 0);

        // Seed search near the centroid of already-placed clusters.
        let seedCol = Math.round(cx - layout.width / 2);
        let seedRow = Math.round(cy - layout.height / 2);
        if (priorCells.length > 0) {
          let sumC = 0;
          let sumR = 0;
          let n = 0;
          for (const cells of priorCells) {
            for (const cell of cells) {
              sumC += cell.col;
              sumR += cell.row;
              n += 1;
            }
          }
          if (n > 0) {
            seedCol = Math.round(sumC / n - layout.width / 2);
            seedRow = Math.round(sumR / n - layout.height / 2);
          }
        }

        // Expanding rings; first valid origin is the nearest legal seat.
        outerSearch: for (let r = 0; r <= maxR; r++) {
          const samples =
            r === 0
              ? [{ dcol: 0, drow: 0 }]
              : (() => {
                  const pts: Array<{ dcol: number; drow: number }> = [];
                  // 8-connected ring at Chebyshev radius r
                  for (let dcol = -r; dcol <= r; dcol++) {
                    pts.push({ dcol, drow: -r });
                    pts.push({ dcol, drow: r });
                  }
                  for (let drow = -r + 1; drow <= r - 1; drow++) {
                    pts.push({ dcol: -r, drow });
                    pts.push({ dcol: r, drow });
                  }
                  return pts;
                })();
          for (const { dcol, drow } of samples) {
            const col = seedCol + dcol;
            const row = seedRow + drow;
            const mat = materializeGroup(layout, col, row);
            if (!mat) continue;
            if (!originOk(mat.cells, claimed, priorCells)) continue;
            found = { col, row, mat };
            break outerSearch;
          }
        }
      }

      if (!found) {
        packed = false;
        break;
      }
      for (const cell of found.mat.cells) {
        claimed.add(getCellKey(cell.row, cell.col));
      }
      clusterCells[index] = found.mat.cells;
      placements.push(...found.mat.placements);
    }

    if (packed && placements.length === selected.length) {
      const nonEmptyCells = clusterCells.filter((c) => c.length > 0);
      if (clustersSatisfyIsolation(nonEmptyCells, minChebyshev)) {
        return successFrom(placements);
      }
    }
  }

  // ── Fallback: simultaneous ring (previous strategy, less tight) ────────
  const baseRadius = clusterRingBaseRadius(G, maxDim, minChebyshev);
  const tryPlaceRing = (
    radius: number,
    angleOffset: number,
  ): PlacedBlockRef[] | null => {
    const origins: Array<{ col: number; row: number }> = [];
    for (let i = 0; i < G; i++) {
      if (G === 1) {
        origins.push({
          col: Math.round(cx - layouts[0].width / 2),
          row: Math.round(cy - layouts[0].height / 2),
        });
        break;
      }
      const angle = angleOffset + (2 * Math.PI * i) / G;
      origins.push({
        col: Math.round(cx + Math.cos(angle) * radius - layouts[i].width / 2),
        row: Math.round(cy + Math.sin(angle) * radius - layouts[i].height / 2),
      });
    }

    const placements: PlacedBlockRef[] = [];
    const clusterCells: GridCell[][] = Array.from({ length: G }, () => []);
    const claimed = new Set<string>();

    for (let i = 0; i < G; i++) {
      const origin = origins[i];
      const mat = materializeGroup(layouts[i], origin.col, origin.row);
      if (!mat) return null;
      for (const cell of mat.cells) {
        const key = getCellKey(cell.row, cell.col);
        if (claimed.has(key)) return null;
        claimed.add(key);
      }
      if (!canPlaceAbsoluteCells(mat.cells, occupancy, movingIds)) return null;
      if (cellsHitUnusable(mat.cells, unusable)) return null;
      clusterCells[i].push(...mat.cells);
      placements.push(...mat.placements);
    }

    if (!clustersSatisfyIsolation(clusterCells, minChebyshev)) return null;
    return placements;
  };

  const maxRadius = baseRadius + 6 + separationExtra * 2;
  for (let radius = baseRadius; radius <= maxRadius; radius += 1) {
    for (const angle of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
      const placed = tryPlaceRing(radius, angle);
      if (placed) return successFrom(placed);
    }
  }

  // Last resort: horizontal row with isolation padding
  {
    const pad = minChebyshev;
    let cursorCol = Math.round(cx);
    const placements: PlacedBlockRef[] = [];
    const clusterCells: GridCell[][] = Array.from({ length: G }, () => []);
    const claimed = new Set<string>();
    let ok = true;
    for (let i = 0; i < G; i++) {
      const originCol = cursorCol;
      const originRow = Math.round(cy - layouts[i].height / 2);
      const mat = materializeGroup(layouts[i], originCol, originRow);
      if (!mat) {
        ok = false;
        break;
      }
      for (const cell of mat.cells) {
        const key = getCellKey(cell.row, cell.col);
        if (claimed.has(key)) {
          ok = false;
          break;
        }
        claimed.add(key);
      }
      if (!ok) break;
      if (!canPlaceAbsoluteCells(mat.cells, occupancy, movingIds)) {
        ok = false;
        break;
      }
      if (cellsHitUnusable(mat.cells, unusable)) {
        ok = false;
        break;
      }
      clusterCells[i].push(...mat.cells);
      placements.push(...mat.placements);
      cursorCol += layouts[i].width + pad;
    }
    if (ok && clustersSatisfyIsolation(clusterCells, minChebyshev)) {
      return successFrom(placements);
    }
  }

  return {
    ok: false,
    error:
      "Could not place clusters without collisions or isolation violations. Free space, lower the cluster count, or reduce separation.",
    assignment,
    clusterCount: K,
  };
}

/**
 * Full cluster-blocks operation: assign + place.
 * Does not mutate input; only returns new positions for selected blocks.
 */
export function clusterBlocks(params: ClusterBlocksParams): ClusterBlocksResult {
  const selected = (params.selected || []).filter(
    (b) =>
      b &&
      typeof b.id === "string" &&
      b.id &&
      Number.isFinite(b.position_x) &&
      Number.isFinite(b.position_y),
  );
  if (selected.length < 2) {
    return {
      ok: false,
      error: "Select at least two placed blocks to cluster",
    };
  }

  // Guard: unique ids
  const seen = new Set<string>();
  for (const b of selected) {
    if (seen.has(b.id)) {
      return { ok: false, error: "Duplicate block id in selection" };
    }
    seen.add(b.id);
  }

  const K = resolveClusterCount(selected.length, params.clusterCount);
  const { assignment, clusters } = assignBlocksToClusters(
    selected,
    K,
    params.prompt,
  );

  // Content identity check input preserved (placement only touches anchors)
  const result = placeClusterAssignments(selected, assignment, K, {
    allPlaced: params.allPlaced,
    unusableKeys: params.unusableKeys,
    unusableCells: params.unusableCells,
    separation: params.separation,
  });

  if (result.ok) {
    // Ensure every placement preserves span/shape from input
    const byId = new Map(selected.map((b) => [b.id, b]));
    for (const p of result.placements) {
      const src = byId.get(p.id);
      if (!src) {
        return {
          ok: false,
          error: "Placement produced unknown block id",
        };
      }
      // spans must match input (content/geometry footprint not rewritten)
      if (normalizeSpan(p.span_w) !== normalizeSpan(src.span_w)) {
        return { ok: false, error: "Placement altered span_w" };
      }
      if (normalizeSpan(p.span_h) !== normalizeSpan(src.span_h)) {
        return { ok: false, error: "Placement altered span_h" };
      }
    }
    return {
      ...result,
      clusters: result.clusters.length ? result.clusters : clusters,
    };
  }
  return result;
}

/**
 * Validate absolute relocate targets against occupancy + unusable (shared with API).
 * Returns null when safe; error string when not.
 */
export function validateRelocatePlacements(
  placements: readonly PlacedBlockRef[],
  allPlaced: readonly PlacedBlockRef[],
  unusableCells?: readonly { row: number; col: number }[] | null,
): string | null {
  if (!placements.length) return "No placements";
  const movingIds = new Set(placements.map((p) => p.id));
  const occupancy = buildOccupancyFromPlaced([...allPlaced]);
  for (const key of [...occupancy.keys()]) {
    const occ = occupancy.get(key);
    if (occ && movingIds.has(occ)) occupancy.delete(key);
  }
  const unusable = unusableKeySet(null, unusableCells);
  const claimed = new Set<string>();
  for (const p of placements) {
    const cells = placedBlockCells(p);
    for (const cell of cells) {
      const key = getCellKey(cell.row, cell.col);
      if (claimed.has(key)) return "Placements overlap each other";
      claimed.add(key);
    }
    if (!canPlaceAbsoluteCells(cells, occupancy, movingIds)) {
      return "Placement collides with occupied cells";
    }
    if (cellsHitUnusable(cells, unusable)) {
      return "Placement lands on unusable ground";
    }
  }
  return null;
}
