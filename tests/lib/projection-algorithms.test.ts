import { describe, expect, it } from "vitest";
import {
  PROJECTION_ALGORITHM_IDS,
  PROJECTION_ALGORITHM_OPTIONS,
  estimateDistanceScale,
  isProjectionAlgorithmId,
  l2Distance,
  parseProjectionAlgorithmId,
  projectClassicalMds,
  projectPca,
  projectSmacof,
  projectTrajectoryAndRegions,
  projectTrajectoryPoints2D,
  projectVectors2D,
  projectionFrameId,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import { projectTrajectory2D } from "@/lib/agent-v2/knowledge-config-store";
import type { KnowledgeConfigTrajectoryPoint } from "@/lib/knowledge-config";

/** Build a dim-d vector with a few non-zero entries. */
function vec(dim: number, entries: Record<number, number>): number[] {
  const v = new Array(dim).fill(0);
  for (const [k, val] of Object.entries(entries)) {
    v[Number(k)] = val;
  }
  return v;
}

/** Euclidean 2D distance. */
function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("projection algorithm registry", () => {
  it("exposes all selectable algorithms including random, pca, classical_mds, smacof", () => {
    expect(PROJECTION_ALGORITHM_IDS).toEqual(
      expect.arrayContaining(["random", "pca", "classical_mds", "smacof"]),
    );
    expect(PROJECTION_ALGORITHM_OPTIONS.map((o) => o.id).sort()).toEqual(
      [...PROJECTION_ALGORITHM_IDS].sort(),
    );
    for (const id of ["random", "pca", "classical_mds", "smacof"] as const) {
      expect(isProjectionAlgorithmId(id)).toBe(true);
      expect(parseProjectionAlgorithmId(id)).toBe(id);
    }
    expect(parseProjectionAlgorithmId("nope", "pca")).toBe("pca");
  });
});

describe("projectVectors2D — shipped multi-algo entry", () => {
  const highD = [
    vec(8, { 0: 0, 1: 0 }),
    vec(8, { 0: 0.1, 1: 0 }), // close to first
    vec(8, { 0: 3, 1: 0 }), // far from first
    vec(8, { 0: 0, 1: 2.5 }),
  ];

  it("every selectable algorithm yields finite 2D coords for every input", () => {
    for (const algorithm of PROJECTION_ALGORITHM_IDS) {
      const coords = projectVectors2D(highD, algorithm);
      expect(coords).toHaveLength(highD.length);
      for (const p of coords) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it("at least two algorithms produce non-identical layouts on a non-degenerate set", () => {
    const random = projectVectors2D(highD, "random");
    const mds = projectVectors2D(highD, "classical_mds");
    const pca = projectVectors2D(highD, "pca");
    const sameAs = (
      a: Array<{ x: number; y: number }>,
      b: Array<{ x: number; y: number }>,
    ) =>
      a.every(
        (p, i) => Math.abs(p.x - b[i].x) < 1e-9 && Math.abs(p.y - b[i].y) < 1e-9,
      );
    // Random linear map vs MDS should differ on this set.
    expect(sameAs(random, mds)).toBe(false);
    // PCA and MDS both valid finite layouts; at least one pair differs.
    expect(sameAs(random, pca) && sameAs(pca, mds)).toBe(false);
  });
});

describe("classical MDS distance-order preservation", () => {
  it("keeps shorter high-D pairs shorter in 2D on a small synthetic set", () => {
    // A--close--B          C far away
    const A = vec(6, { 0: 0 });
    const B = vec(6, { 0: 0.2 });
    const C = vec(6, { 0: 4 });
    const vectors = [A, B, C];

    const dAB = l2Distance(A, B);
    const dAC = l2Distance(A, C);
    const dBC = l2Distance(B, C);
    expect(dAB).toBeLessThan(dAC);
    expect(dAB).toBeLessThan(dBC);

    const coords = projectClassicalMds(vectors);
    expect(coords).toHaveLength(3);
    const eAB = dist2(coords[0], coords[1]);
    const eAC = dist2(coords[0], coords[2]);
    const eBC = dist2(coords[1], coords[2]);

    // Closest high-D pair remains the closest (or tied-closest) in 2D.
    expect(eAB).toBeLessThan(eAC);
    expect(eAB).toBeLessThan(eBC);
  });

  it("is the real double-centering method (not a rebrand of random linear map)", () => {
    // Unique pairwise distances: A—B short, A—C medium, B—C long
    const vectors = [
      vec(4, { 0: 0 }),
      vec(4, { 0: 0.5 }),
      vec(4, { 0: 0, 1: 2 }),
    ];
    const mds = projectClassicalMds(vectors);
    const random = projectVectors2D(vectors, "random");
    // MDS places points from the distance matrix; random is an independent linear map.
    const identical = mds.every(
      (p, i) => Math.abs(p.x - random[i].x) < 1e-12 && Math.abs(p.y - random[i].y) < 1e-12,
    );
    expect(identical).toBe(false);

    const hd = [
      l2Distance(vectors[0], vectors[1]),
      l2Distance(vectors[0], vectors[2]),
      l2Distance(vectors[1], vectors[2]),
    ];
    const td = [
      dist2(mds[0], mds[1]),
      dist2(mds[0], mds[2]),
      dist2(mds[1], mds[2]),
    ];
    // All high-D distances distinct.
    expect(new Set(hd.map((x) => x.toFixed(8))).size).toBe(3);
    const hdOrder = [0, 1, 2].sort((i, j) => hd[i] - hd[j]);
    const tdOrder = [0, 1, 2].sort((i, j) => td[i] - td[j]);
    // Rank correlation: shortest high-D pair remains shortest in 2D.
    expect(tdOrder[0]).toBe(hdOrder[0]);
  });
});

describe("SMACOF distance-order preservation", () => {
  it("preserves short high-D distances after stress iteration", () => {
    const A = vec(5, { 0: 0, 1: 0 });
    const B = vec(5, { 0: 0.15, 1: 0.05 });
    const C = vec(5, { 0: 5, 1: 0 });
    const D = vec(5, { 0: 0, 1: 4.5 });
    const vectors = [A, B, C, D];

    const coords = projectSmacof(vectors, { maxIter: 50 });
    expect(coords).toHaveLength(4);
    for (const p of coords) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }

    const dAB = l2Distance(A, B);
    const dAC = l2Distance(A, C);
    expect(dAB).toBeLessThan(dAC);

    const eAB = dist2(coords[0], coords[1]);
    const eAC = dist2(coords[0], coords[2]);
    expect(eAB).toBeLessThan(eAC);
  });
});

describe("projectTrajectoryAndRegions joint layout", () => {
  it("embeds trajectory + region centroids under each algorithm", () => {
    const points = [
      {
        t: "2020-01-01T00:00:00.000Z",
        as_of_ms: 1,
        vector: vec(8, { 0: 0 }),
        confidence: 0.5,
      },
      {
        t: "2020-01-02T00:00:00.000Z",
        as_of_ms: 2,
        vector: vec(8, { 0: 1 }),
        confidence: 0.7,
      },
    ];
    const regions = [
      {
        id: "r1",
        name: "Region",
        centroid: vec(8, { 0: 0.5 }),
        mean_radius: 0.3,
        cosine_threshold: 0.6,
      },
    ];

    for (const algorithm of PROJECTION_ALGORITHM_IDS) {
      const layout = projectTrajectoryAndRegions({ points, regions, algorithm });
      expect(layout.algorithm).toBe(algorithm);
      expect(layout.frame_id).toBe(projectionFrameId(algorithm));
      expect(layout.coords).toHaveLength(2);
      expect(layout.regionOverlays).toHaveLength(1);
      expect(Number.isFinite(layout.regionOverlays[0].x)).toBe(true);
      expect(Number.isFinite(layout.regionOverlays[0].y)).toBe(true);
      expect(layout.regionOverlays[0].radius).toBeGreaterThan(0);
    }
  });

  it("projectTrajectoryPoints2D matches joint path without regions", () => {
    const points = [
      { t: "t0", as_of_ms: 0, vector: vec(4, { 0: 0 }), confidence: 1 },
      { t: "t1", as_of_ms: 1, vector: vec(4, { 0: 2 }), confidence: 1 },
    ];
    for (const algorithm of PROJECTION_ALGORITHM_IDS) {
      const a = projectTrajectoryPoints2D(points, algorithm);
      const b = projectTrajectoryAndRegions({ points, algorithm }).coords;
      expect(a).toHaveLength(b.length);
      for (let i = 0; i < a.length; i++) {
        expect(a[i].x).toBeCloseTo(b[i].x, 10);
        expect(a[i].y).toBeCloseTo(b[i].y, 10);
      }
    }
  });
});

describe("projectTrajectory2D store entry (algorithm-aware)", () => {
  it("accepts algorithm id and returns finite coords for all algos", () => {
    const points: KnowledgeConfigTrajectoryPoint[] = [
      {
        t: "t0",
        as_of_ms: 0,
        vector: vec(64, { 0: 0.1, 3: -0.2 }),
        confidence: 0.4,
        trigger: "score",
        pow_event_count: 2,
      },
      {
        t: "t1",
        as_of_ms: 1000,
        vector: vec(64, { 0: 0.5, 3: 0.1, 10: 0.3 }),
        confidence: 0.6,
        trigger: "score",
        pow_event_count: 4,
      },
      {
        t: "t2",
        as_of_ms: 2000,
        vector: vec(64, { 1: 0.8, 5: -0.4 }),
        confidence: 0.8,
        trigger: "score",
        pow_event_count: 6,
      },
    ];

    for (const algorithm of PROJECTION_ALGORITHM_IDS) {
      const coords = projectTrajectory2D(points, algorithm);
      expect(coords).toHaveLength(3);
      for (const c of coords) {
        expect(Number.isFinite(c.x)).toBe(true);
        expect(Number.isFinite(c.y)).toBe(true);
        expect(typeof c.t).toBe("string");
      }
    }
  });
});

describe("estimateDistanceScale", () => {
  it("returns positive finite scale for non-degenerate layouts", () => {
    const highD = [vec(3, { 0: 0 }), vec(3, { 0: 2 }), vec(3, { 1: 2 })];
    const coords = projectPca(highD);
    const scale = estimateDistanceScale(highD, coords);
    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
  });
});

describe("PCA", () => {
  it("places variance-dominant axis primarily along x for elongated data", () => {
    const vectors = Array.from({ length: 6 }, (_, i) =>
      vec(4, { 0: i * 1.0, 1: (i % 2) * 0.05 }),
    );
    const coords = projectPca(vectors);
    const xs = coords.map((p) => p.x);
    const ys = coords.map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    expect(spanX).toBeGreaterThan(spanY);
  });
});

describe("UI algorithm option completeness (static)", () => {
  it("PROJECTION_ALGORITHM_OPTIONS covers every id the UI can select", () => {
    const required: ProjectionAlgorithmId[] = [
      "random",
      "pca",
      "classical_mds",
      "smacof",
    ];
    for (const id of required) {
      expect(PROJECTION_ALGORITHM_OPTIONS.some((o) => o.id === id)).toBe(true);
    }
  });
});
