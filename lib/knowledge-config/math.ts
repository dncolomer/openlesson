/** Vector helpers for knowledge config space. */

export function l2Norm(v: number[]): number {
  let sum = 0;
  for (const x of v) sum += x * x;
  return Math.sqrt(sum);
}

export function l2Normalize(v: number[], eps = 1e-12): number[] {
  const n = l2Norm(v);
  if (n < eps) return v.map(() => 0);
  return v.map((x) => x / n);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-12) return 0;
  return Math.max(-1, Math.min(1, dot / denom));
}

export function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function clip01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function scoreToUnit(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  return clip01(score / 100);
}

/** Deterministic string → unit float in [0,1) via FNV-1a. */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Fixed pseudo-random projection matrix for semantic residual (JL-style).
 * Seeded so knowledgecfg-v1-d64 is stable across processes.
 */
export function seededRandomProjection(rows: number, cols: number, seed: string): number[][] {
  const matrix: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const u = hashUnit(`${seed}:${r}:${c}`);
      // Rademacher ±1 / sqrt(rows) for unit-ish columns after project
      row.push((u < 0.5 ? -1 : 1) / Math.sqrt(rows));
    }
    matrix.push(row);
  }
  return matrix;
}

export function projectWithMatrix(input: number[], matrix: number[][]): number[] {
  const out = new Array(matrix.length).fill(0);
  for (let r = 0; r < matrix.length; r++) {
    let sum = 0;
    const row = matrix[r];
    for (let c = 0; c < input.length && c < row.length; c++) {
      sum += row[c] * input[c];
    }
    out[r] = sum;
  }
  return out;
}
