/**
 * Multi-algorithm 2D and 3D projection for knowledge-config embeddings.
 *
 * Algorithms (shared ids for Local 2D, Local 3D, and Global Map layout):
 * - random: fixed seeded JL-style linear map (stable global frame)
 * - pca: principal components of the current point set (top-2 / top-3)
 * - classical_mds: metric MDS via double-centering + top-k eigens
 * - smacof: iterative metric MDS (stress majorization) seeded by classical MDS
 *
 * Distance-based methods operate on L2 distances in the high-D input space.
 */

import { projectKnowledgeConfigTo2D } from "./encoder";
import { hashUnit, l2Distance } from "./math";
import { KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID } from "./types";

export type ProjectionAlgorithmId = "random" | "pca" | "classical_mds" | "smacof";

export const PROJECTION_ALGORITHM_IDS: readonly ProjectionAlgorithmId[] = [
  "random",
  "pca",
  "classical_mds",
  "smacof",
] as const;

export const PROJECTION_ALGORITHM_OPTIONS: ReadonlyArray<{
  id: ProjectionAlgorithmId;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "random",
    label: "Random (JL)",
    shortLabel: "Random",
    description:
      "Fixed seeded random linear map — stable global axes for 2D, Local 3D, and Global Map.",
  },
  {
    id: "pca",
    label: "PCA",
    shortLabel: "PCA",
    description:
      "Principal components of the current high-D point set (top-2 for 2D, top-3 for 3D/Global).",
  },
  {
    id: "classical_mds",
    label: "Classical MDS",
    shortLabel: "MDS",
    description:
      "Metric MDS: double-center squared distances, top-k eigens (k=2 plane / k=3 volume).",
  },
  {
    id: "smacof",
    label: "SMACOF",
    shortLabel: "SMACOF",
    description:
      "Iterative metric MDS minimizing stress in 2D or 3D (distance-preserving layout).",
  },
];

export function isProjectionAlgorithmId(value: unknown): value is ProjectionAlgorithmId {
  return (
    typeof value === "string" &&
    (PROJECTION_ALGORITHM_IDS as readonly string[]).includes(value)
  );
}

export function parseProjectionAlgorithmId(
  value: unknown,
  fallback: ProjectionAlgorithmId = "random",
): ProjectionAlgorithmId {
  return isProjectionAlgorithmId(value) ? value : fallback;
}

export function projectionFrameId(algorithm: ProjectionAlgorithmId): string {
  return `${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}:ui2d:${algorithm}`;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Stable frame id for 3D / Global Map layouts under a named algorithm. */
export function projectionFrameId3d(algorithm: ProjectionAlgorithmId): string {
  return `${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}:ui3d:${algorithm}`;
}

// ---------------------------------------------------------------------------
// Linear algebra helpers (n ≲ 120)
// ---------------------------------------------------------------------------

function zeros(n: number, m = n): number[][] {
  return Array.from({ length: n }, () => new Array(m).fill(0));
}

function cloneMatrix(a: number[][]): number[][] {
  return a.map((row) => row.slice());
}

/** Pairwise L2 distance matrix (symmetric, zero diagonal). */
export function pairwiseL2Distances(vectors: number[][]): number[][] {
  const n = vectors.length;
  const d = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = l2Distance(vectors[i], vectors[j]);
      const v = Number.isFinite(dist) ? dist : 0;
      d[i][j] = v;
      d[j][i] = v;
    }
  }
  return d;
}

/**
 * Jacobi eigenvalue decomposition for real symmetric matrices.
 * Cyclic sweeps over all off-diagonal pairs. Returns eigenvalues (descending)
 * and orthonormal eigenvectors as columns of V.
 */
export function jacobiEigendecomposition(
  matrix: number[][],
  maxSweeps = 48,
): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  if (n === 0) return { values: [], vectors: [] };
  if (n === 1) return { values: [matrix[0][0]], vectors: [[1]] };

  const a = cloneMatrix(matrix);
  // V starts as identity; columns become eigenvectors
  const v = zeros(n);
  for (let i = 0; i < n; i++) v[i][i] = 1;

  const rotate = (p: number, q: number) => {
    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    if (Math.abs(apq) < 1e-18) return;

    const tau = (aqq - app) / (2 * apq);
    const sign = tau >= 0 ? 1 : -1;
    const t = sign / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = 0;
    a[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i === p || i === q) continue;
      const aip = a[i][p];
      const aiq = a[i][q];
      a[i][p] = c * aip - s * aiq;
      a[p][i] = a[i][p];
      a[i][q] = s * aip + c * aiq;
      a[q][i] = a[i][q];
    }

    for (let i = 0; i < n; i++) {
      const vip = v[i][p];
      const viq = v[i][q];
      v[i][p] = c * vip - s * viq;
      v[i][q] = s * vip + c * viq;
    }
  };

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let maxOff = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        maxOff = Math.max(maxOff, Math.abs(a[p][q]));
        rotate(p, q);
      }
    }
    if (maxOff < 1e-12) break;
  }

  const values = a.map((row, i) => row[i]);
  const order = values
    .map((val, i) => ({ val, i }))
    .sort((x, y) => y.val - x.val);
  const sortedValues = order.map((o) => o.val);
  const sortedVectors = zeros(n);
  for (let col = 0; col < n; col++) {
    const src = order[col].i;
    for (let row = 0; row < n; row++) {
      sortedVectors[row][col] = v[row][src];
    }
  }
  return { values: sortedValues, vectors: sortedVectors };
}

// ---------------------------------------------------------------------------
// Algorithms
// ---------------------------------------------------------------------------

function projectRandom(vectors: number[][]): Point2D[] {
  return vectors.map((v) => {
    if (!v.length || !v.every((x) => Number.isFinite(x))) return { x: 0, y: 0 };
    try {
      return projectKnowledgeConfigTo2D(v);
    } catch {
      return { x: 0, y: 0 };
    }
  });
}

/**
 * PCA: center rows, eigen-decompose covariance (d×d), project onto top-2 PCs.
 * Falls back to zeros when fewer than 2 non-degenerate points.
 */
export function projectPca(vectors: number[][]): Point2D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const d = vectors[0]?.length ?? 0;
  if (d === 0) return vectors.map(() => ({ x: 0, y: 0 }));

  // Mean
  const mean = new Array(d).fill(0);
  for (const v of vectors) {
    for (let j = 0; j < d; j++) mean[j] += v[j] ?? 0;
  }
  for (let j = 0; j < d; j++) mean[j] /= n;

  // Centered matrix
  const centered = vectors.map((v) => v.map((x, j) => (x ?? 0) - mean[j]));

  // Covariance d×d (unnormalized X^T X is fine for directions)
  const cov = zeros(d);
  for (let i = 0; i < n; i++) {
    const row = centered[i];
    for (let a = 0; a < d; a++) {
      const ra = row[a];
      if (ra === 0) continue;
      for (let b = a; b < d; b++) {
        cov[a][b] += ra * row[b];
      }
    }
  }
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      cov[a][b] /= Math.max(1, n - 1);
      cov[b][a] = cov[a][b];
    }
  }

  const { values, vectors: evecs } = jacobiEigendecomposition(cov);
  const pc0 = values[0] > 1e-12 ? 0 : -1;
  const pc1 = values[1] > 1e-12 ? 1 : -1;

  return centered.map((row) => {
    let x = 0;
    let y = 0;
    if (pc0 >= 0) {
      for (let j = 0; j < d; j++) x += row[j] * evecs[j][pc0];
    }
    if (pc1 >= 0) {
      for (let j = 0; j < d; j++) y += row[j] * evecs[j][pc1];
    }
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    };
  });
}

/**
 * Classical metric MDS:
 *   D²_ij = ||z_i - z_j||²
 *   B = -½ J D² J
 *   X = V₂ √Λ₂
 */
export function projectClassicalMds(vectors: number[][]): Point2D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const dist = pairwiseL2Distances(vectors);
  const d2 = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      d2[i][j] = dist[i][j] * dist[i][j];
    }
  }

  // Double centering: B = -0.5 * J * D² * J
  const rowMean = new Array(n).fill(0);
  const colMean = new Array(n).fill(0);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      rowMean[i] += d2[i][j];
      colMean[j] += d2[i][j];
      grand += d2[i][j];
    }
  }
  for (let i = 0; i < n; i++) {
    rowMean[i] /= n;
    colMean[i] /= n;
  }
  grand /= n * n;

  const b = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      b[i][j] = -0.5 * (d2[i][j] - rowMean[i] - colMean[j] + grand);
    }
  }

  const { values, vectors: evecs } = jacobiEigendecomposition(b);
  const lam0 = Math.max(0, values[0] ?? 0);
  const lam1 = Math.max(0, values[1] ?? 0);
  const s0 = Math.sqrt(lam0);
  const s1 = Math.sqrt(lam1);

  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const x = (evecs[i][0] ?? 0) * s0;
    const y = (evecs[i][1] ?? 0) * s1;
    out.push({
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    });
  }
  return out;
}

/**
 * SMACOF (Scaling by Majorizing a Complicated Function): iterative metric MDS.
 * Initializes from classical MDS, then applies Guttman transforms.
 */
export function projectSmacof(
  vectors: number[][],
  options: { maxIter?: number; epsilon?: number } = {},
): Point2D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const maxIter = options.maxIter ?? 40;
  const epsilon = options.epsilon ?? 1e-7;
  const delta = pairwiseL2Distances(vectors); // high-D dissimilarities

  let coords = projectClassicalMds(vectors);
  // Ensure non-zero start if classical MDS collapsed
  if (coords.every((p) => Math.abs(p.x) < 1e-15 && Math.abs(p.y) < 1e-15)) {
    coords = coords.map((_, i) => ({
      x: Math.cos((2 * Math.PI * i) / n) * 0.1,
      y: Math.sin((2 * Math.PI * i) / n) * 0.1,
    }));
  }

  const stress = (pts: Point2D[]): number => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dij = Math.hypot(dx, dy);
        const e = delta[i][j] - dij;
        s += e * e;
      }
    }
    return s;
  };

  let prevStress = stress(coords);

  for (let iter = 0; iter < maxIter; iter++) {
    // Guttman transform: B matrix (n×n)
    const b = zeros(n);
    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = coords[i].x - coords[j].x;
        const dy = coords[i].y - coords[j].y;
        const dij = Math.hypot(dx, dy);
        if (dij < 1e-12) continue;
        const bij = -delta[i][j] / dij;
        b[i][j] = bij;
        rowSum += bij;
      }
      b[i][i] = -rowSum;
    }

    // X_new = (1/n) B X  (weights all 1 → V^+ is 1/n * centering handled by B row-sum 0)
    const next: Point2D[] = [];
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      for (let j = 0; j < n; j++) {
        x += b[i][j] * coords[j].x;
        y += b[i][j] * coords[j].y;
      }
      next.push({ x: x / n, y: y / n });
    }

    // Re-center
    let mx = 0;
    let my = 0;
    for (const p of next) {
      mx += p.x;
      my += p.y;
    }
    mx /= n;
    my /= n;
    for (const p of next) {
      p.x -= mx;
      p.y -= my;
    }

    const s = stress(next);
    coords = next;
    if (Math.abs(prevStress - s) < epsilon * (1 + prevStress)) break;
    prevStress = s;
  }

  return coords.map((p) => ({
    x: Number.isFinite(p.x) ? p.x : 0,
    y: Number.isFinite(p.y) ? p.y : 0,
  }));
}

/**
 * Project a list of high-D vectors to 2D with the named algorithm.
 * All returned coordinates are finite.
 */
export function projectVectors2D(
  vectors: number[][],
  algorithm: ProjectionAlgorithmId = "random",
): Point2D[] {
  if (!vectors.length) return [];
  let coords: Point2D[];
  switch (algorithm) {
    case "pca":
      coords = projectPca(vectors);
      break;
    case "classical_mds":
      coords = projectClassicalMds(vectors);
      break;
    case "smacof":
      coords = projectSmacof(vectors);
      break;
    case "random":
    default:
      coords = projectRandom(vectors);
      break;
  }
  return coords.map((p) => ({
    x: Number.isFinite(p.x) ? p.x : 0,
    y: Number.isFinite(p.y) ? p.y : 0,
  }));
}

// ---------------------------------------------------------------------------
// 3D algorithms (Local 3D + Global Map region-dot layout)
// ---------------------------------------------------------------------------

function finitePoint3D(x: number, y: number, z: number): Point3D {
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    z: Number.isFinite(z) ? z : 0,
  };
}

/**
 * Fixed seeded JL-style map to 3D (stable global frame across views).
 * Uses the shipped 2D random projector for x/y plus a third Rademacher axis for z.
 */
export function projectRandom3D(vectors: number[][]): Point3D[] {
  return vectors.map((v) => {
    if (!v.length || !v.every((x) => Number.isFinite(x))) return finitePoint3D(0, 0, 0);
    try {
      const xy = projectKnowledgeConfigTo2D(v);
      // Third axis: independent fixed Rademacher combo (not residual of x/y).
      let z = 0;
      for (let i = 0; i < v.length; i++) {
        const u = hashUnit(`${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}:ui3d:z:${i}`);
        z += v[i] * ((u < 0.5 ? -1 : 1) / Math.SQRT2);
      }
      return finitePoint3D(xy.x, xy.y, z);
    } catch {
      return finitePoint3D(0, 0, 0);
    }
  });
}

/**
 * PCA to 3D: center rows, eigen-decompose covariance, project onto top-3 PCs.
 */
export function projectPca3D(vectors: number[][]): Point3D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [finitePoint3D(0, 0, 0)];

  const d = vectors[0]?.length ?? 0;
  if (d === 0) return vectors.map(() => finitePoint3D(0, 0, 0));

  const mean = new Array(d).fill(0);
  for (const v of vectors) {
    for (let j = 0; j < d; j++) mean[j] += v[j] ?? 0;
  }
  for (let j = 0; j < d; j++) mean[j] /= n;

  const centered = vectors.map((v) => v.map((x, j) => (x ?? 0) - mean[j]));

  const cov = zeros(d);
  for (let i = 0; i < n; i++) {
    const row = centered[i];
    for (let a = 0; a < d; a++) {
      const ra = row[a];
      if (ra === 0) continue;
      for (let b = a; b < d; b++) {
        cov[a][b] += ra * row[b];
      }
    }
  }
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      cov[a][b] /= Math.max(1, n - 1);
      cov[b][a] = cov[a][b];
    }
  }

  const { values, vectors: evecs } = jacobiEigendecomposition(cov);
  const pc0 = values[0] > 1e-12 ? 0 : -1;
  const pc1 = values[1] > 1e-12 ? 1 : -1;
  const pc2 = values[2] > 1e-12 ? 2 : -1;

  return centered.map((row) => {
    let x = 0;
    let y = 0;
    let z = 0;
    if (pc0 >= 0) for (let j = 0; j < d; j++) x += row[j] * evecs[j][pc0];
    if (pc1 >= 0) for (let j = 0; j < d; j++) y += row[j] * evecs[j][pc1];
    if (pc2 >= 0) for (let j = 0; j < d; j++) z += row[j] * evecs[j][pc2];
    return finitePoint3D(x, y, z);
  });
}

/**
 * Classical metric MDS to 3D (top-3 positive eigenvalues of double-centered B).
 */
export function projectClassicalMds3D(vectors: number[][]): Point3D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [finitePoint3D(0, 0, 0)];

  const dist = pairwiseL2Distances(vectors);
  const d2 = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      d2[i][j] = dist[i][j] * dist[i][j];
    }
  }

  const rowMean = new Array(n).fill(0);
  const colMean = new Array(n).fill(0);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      rowMean[i] += d2[i][j];
      colMean[j] += d2[i][j];
      grand += d2[i][j];
    }
  }
  for (let i = 0; i < n; i++) {
    rowMean[i] /= n;
    colMean[i] /= n;
  }
  grand /= n * n;

  const b = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      b[i][j] = -0.5 * (d2[i][j] - rowMean[i] - colMean[j] + grand);
    }
  }

  const { values, vectors: evecs } = jacobiEigendecomposition(b);
  const s0 = Math.sqrt(Math.max(0, values[0] ?? 0));
  const s1 = Math.sqrt(Math.max(0, values[1] ?? 0));
  const s2 = Math.sqrt(Math.max(0, values[2] ?? 0));

  const out: Point3D[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      finitePoint3D(
        (evecs[i][0] ?? 0) * s0,
        (evecs[i][1] ?? 0) * s1,
        (evecs[i][2] ?? 0) * s2,
      ),
    );
  }
  return out;
}

/**
 * SMACOF in 3D: iterative metric MDS seeded by classical MDS 3D.
 */
export function projectSmacof3D(
  vectors: number[][],
  options: { maxIter?: number; epsilon?: number } = {},
): Point3D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [finitePoint3D(0, 0, 0)];

  const maxIter = options.maxIter ?? 40;
  const epsilon = options.epsilon ?? 1e-7;
  const delta = pairwiseL2Distances(vectors);

  let coords = projectClassicalMds3D(vectors);
  if (
    coords.every(
      (p) => Math.abs(p.x) < 1e-15 && Math.abs(p.y) < 1e-15 && Math.abs(p.z) < 1e-15,
    )
  ) {
    coords = coords.map((_, i) => {
      const t = (2 * Math.PI * i) / n;
      return finitePoint3D(Math.cos(t) * 0.1, Math.sin(t) * 0.1, Math.sin(2 * t) * 0.05);
    });
  }

  const stress = (pts: Point3D[]): number => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dz = pts[i].z - pts[j].z;
        const dij = Math.hypot(dx, dy, dz);
        const e = delta[i][j] - dij;
        s += e * e;
      }
    }
    return s;
  };

  let prevStress = stress(coords);

  for (let iter = 0; iter < maxIter; iter++) {
    const b = zeros(n);
    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = coords[i].x - coords[j].x;
        const dy = coords[i].y - coords[j].y;
        const dz = coords[i].z - coords[j].z;
        const dij = Math.hypot(dx, dy, dz);
        if (dij < 1e-12) continue;
        const bij = -delta[i][j] / dij;
        b[i][j] = bij;
        rowSum += bij;
      }
      b[i][i] = -rowSum;
    }

    const next: Point3D[] = [];
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (let j = 0; j < n; j++) {
        x += b[i][j] * coords[j].x;
        y += b[i][j] * coords[j].y;
        z += b[i][j] * coords[j].z;
      }
      next.push({ x: x / n, y: y / n, z: z / n });
    }

    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const p of next) {
      mx += p.x;
      my += p.y;
      mz += p.z;
    }
    mx /= n;
    my /= n;
    mz /= n;
    for (const p of next) {
      p.x -= mx;
      p.y -= my;
      p.z -= mz;
    }

    const s = stress(next);
    coords = next;
    if (Math.abs(prevStress - s) < epsilon * (1 + prevStress)) break;
    prevStress = s;
  }

  return coords.map((p) => finitePoint3D(p.x, p.y, p.z));
}

/**
 * Project high-D vectors to 3D with the named algorithm.
 * Used by Local Map 3D, Global Map region layout, and joint reproject.
 * All returned coordinates are finite.
 */
export function projectVectors3D(
  vectors: number[][],
  algorithm: ProjectionAlgorithmId = "pca",
): Point3D[] {
  if (!vectors.length) return [];
  let coords: Point3D[];
  switch (algorithm) {
    case "random":
      coords = projectRandom3D(vectors);
      break;
    case "classical_mds":
      coords = projectClassicalMds3D(vectors);
      break;
    case "smacof":
      coords = projectSmacof3D(vectors);
      break;
    case "pca":
    default:
      coords = projectPca3D(vectors);
      break;
  }
  return coords.map((p) => finitePoint3D(p.x, p.y, p.z));
}

// ---------------------------------------------------------------------------
// Joint trajectory + region layout
// ---------------------------------------------------------------------------

export interface TrajectoryPointInput {
  t: string;
  as_of_ms: number;
  vector: number[];
  confidence: number;
}

export interface RegionCentroidInput {
  id: string;
  name: string;
  centroid: number[];
  mean_radius?: number;
  cosine_threshold?: number;
  source?: string | null;
}

export interface RegionOverlayProjected {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  cosine_threshold: number;
  source?: string | null;
}

export interface JointProjectionResult {
  algorithm: ProjectionAlgorithmId;
  frame_id: string;
  coords: Array<{
    t: string;
    as_of_ms: number;
    x: number;
    y: number;
    confidence: number;
  }>;
  regionOverlays: RegionOverlayProjected[];
}

function regionRadius2D(
  meanRadius: number,
  threshold: number,
  algorithm: ProjectionAlgorithmId,
  scale: number,
): number {
  if (algorithm === "random") {
    return Math.max(0.04, Math.min(0.55, meanRadius * 0.42 + (1 - threshold) * 0.12));
  }
  // Distance-preserving: map high-D radius through empirical 2D/high-D scale
  const r = Math.max(0, meanRadius) * Math.max(scale, 1e-6);
  return Math.max(0.02, Math.min(1.2, r * 0.85 + (1 - threshold) * 0.05 * Math.max(scale, 0.1)));
}

/** Median of 2D/high-D distance ratios for pairs with high-D distance > eps. */
export function estimateDistanceScale(highD: number[][], coords2d: Point2D[]): number {
  const n = highD.length;
  const ratios: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const hd = l2Distance(highD[i], highD[j]);
      if (!(hd > 1e-9)) continue;
      const dx = coords2d[i].x - coords2d[j].x;
      const dy = coords2d[i].y - coords2d[j].y;
      const td = Math.hypot(dx, dy);
      if (!Number.isFinite(td)) continue;
      ratios.push(td / hd);
    }
  }
  if (!ratios.length) return 1;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)] || 1;
}

/**
 * Jointly project trajectory points and optional region centroids so overlays
 * share the same layout as the path under distance-based algorithms.
 */
export function projectTrajectoryAndRegions(input: {
  points: TrajectoryPointInput[];
  regions?: RegionCentroidInput[];
  algorithm?: ProjectionAlgorithmId;
}): JointProjectionResult {
  const algorithm = parseProjectionAlgorithmId(input.algorithm, "random");
  const points = input.points ?? [];
  const regions = input.regions ?? [];

  const vectors: number[][] = [
    ...points.map((p) => p.vector),
    ...regions.map((r) => r.centroid),
  ];

  // Empty layout
  if (vectors.length === 0) {
    return {
      algorithm,
      frame_id: projectionFrameId(algorithm),
      coords: [],
      regionOverlays: [],
    };
  }

  // For random, keep independent fixed-frame projection (and legacy radius map)
  let coords2d: Point2D[];
  if (algorithm === "random") {
    coords2d = projectRandom(vectors);
  } else {
    coords2d = projectVectors2D(vectors, algorithm);
  }

  const scale = estimateDistanceScale(vectors, coords2d);
  const coords = points.map((p, i) => ({
    t: p.t,
    as_of_ms: p.as_of_ms,
    x: coords2d[i].x,
    y: coords2d[i].y,
    confidence: p.confidence,
  }));

  const regionOverlays: RegionOverlayProjected[] = regions.map((r, ri) => {
    const idx = points.length + ri;
    const meanRadius =
      typeof r.mean_radius === "number" && Number.isFinite(r.mean_radius)
        ? Math.max(0, r.mean_radius)
        : 0.4;
    const threshold =
      typeof r.cosine_threshold === "number" && Number.isFinite(r.cosine_threshold)
        ? r.cosine_threshold
        : 0.5;
    return {
      id: r.id,
      name: r.name,
      x: coords2d[idx]?.x ?? 0,
      y: coords2d[idx]?.y ?? 0,
      radius: regionRadius2D(meanRadius, threshold, algorithm, scale),
      cosine_threshold: threshold,
      source: r.source ?? null,
    };
  });

  return {
    algorithm,
    frame_id: projectionFrameId(algorithm),
    coords,
    regionOverlays,
  };
}

/**
 * Convenience: project trajectory points only (no regions) under an algorithm.
 * Used by API `projectTrajectory2D` and tests.
 */
export function projectTrajectoryPoints2D(
  points: TrajectoryPointInput[],
  algorithm: ProjectionAlgorithmId = "random",
): JointProjectionResult["coords"] {
  return projectTrajectoryAndRegions({ points, algorithm }).coords;
}
