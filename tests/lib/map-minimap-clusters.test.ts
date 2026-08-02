/**
 * Minimap cluster derivation: isolation gap ≥3 empty cells, counts, center, edges.
 * Drives shipped helpers in lib/map-minimap-clusters.ts.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_HEIGHT_LEGACY,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
  MINIMAP_FRAME_WIDTH_LEGACY,
  MINIMAP_ISOLATION_GAP_CELLS,
  blocksAreClusterNeighbors,
  buildClusterMstEdges,
  buildMinimapClusterGraph,
  minChebyshevBetweenBlocks,
  placementsFromOccupiedCells,
  projectMinimapClusters,
} from "@/lib/map-minimap-clusters";
import { getPanToCenterCell, SKILL_GRID_PITCH } from "@/lib/block-skill-grid";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.MINIMAP_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-67274cc1339a/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

function cell(row: number, col: number) {
  return { row, col };
}

describe("isolation gap rules (Chebyshev)", () => {
  it("defaults isolation gap to 3 empty cells", () => {
    expect(MINIMAP_ISOLATION_GAP_CELLS).toBe(3);
  });

  it("dist ≤3 same cluster; dist ≥4 (gap ≥3 empty) separates", () => {
    // minChebyshev ≤ isolation (3) → same
    expect(
      blocksAreClusterNeighbors([cell(0, 0)], [cell(0, 3)], MINIMAP_ISOLATION_GAP_CELLS),
    ).toBe(true); // dist 3 → gap 2 empty
    // Exactly isolation boundary: dist 4 → gap 3 empty → separate
    expect(
      blocksAreClusterNeighbors([cell(0, 0)], [cell(0, 4)], MINIMAP_ISOLATION_GAP_CELLS),
    ).toBe(false);
    expect(minChebyshevBetweenBlocks([cell(0, 0)], [cell(0, 4)])).toBe(4);

    writeEvidence(
      "minimap-isolation-3.log",
      [
        "default=" + MINIMAP_ISOLATION_GAP_CELLS,
        "dist3_same=" +
          blocksAreClusterNeighbors([cell(0, 0)], [cell(0, 3)], MINIMAP_ISOLATION_GAP_CELLS),
        "dist4_separate=" +
          !blocksAreClusterNeighbors([cell(0, 0)], [cell(0, 4)], MINIMAP_ISOLATION_GAP_CELLS),
      ].join("\n"),
    );
  });
});

describe("buildMinimapClusterGraph", () => {
  it("two groups separated by ≥3 empty cells become two clusters with correct counts", () => {
    // Cluster A: three blocks near origin (cols 0–1)
    // Cluster B: must be ≥ dist 4 from every A cell (a2 at col1 → B at col≥5)
    const blocks = [
      { id: "a1", cells: [cell(0, 0)] },
      { id: "a2", cells: [cell(0, 1)] },
      { id: "a3", cells: [cell(1, 0)] },
      { id: "b1", cells: [cell(0, 5)] },
      { id: "b2", cells: [cell(1, 6)] },
    ];
    const graph = buildMinimapClusterGraph(blocks);
    expect(graph.isolationGap).toBe(3);
    expect(graph.clusters).toHaveLength(2);
    const counts = graph.clusters.map((c) => c.count).sort();
    expect(counts).toEqual([2, 3]);
    // Each cluster has a real center block id present in its members
    for (const c of graph.clusters) {
      expect(c.blockIds).toContain(c.centerBlockId);
      expect(c.centerCell).toEqual(
        expect.objectContaining({ row: expect.any(Number), col: expect.any(Number) }),
      );
      expect(c.count).toBe(c.blockIds.length);
    }
    // MST connects the two clusters
    expect(graph.edges).toHaveLength(1);

    writeEvidence(
      "minimap-cluster-rules.log",
      [
        "isolation=" + graph.isolationGap,
        "clusters=" + graph.clusters.length,
        "counts=" + counts.join(","),
        "centers=" +
          graph.clusters.map((c) => `${c.centerBlockId}@${c.centerCell.row},${c.centerCell.col}`).join("|"),
        "edges=" + graph.edges.length,
        "panPath=getPanToCenterCell",
        "pitch=" + SKILL_GRID_PITCH,
      ].join("\n"),
    );
  });

  it("dense region stays one cluster", () => {
    const blocks = [
      { id: "d1", cells: [cell(5, 5)] },
      { id: "d2", cells: [cell(5, 7)] }, // dist 2
      { id: "d3", cells: [cell(7, 6)] },
      { id: "d4", cells: [cell(6, 8)] },
    ];
    const graph = buildMinimapClusterGraph(blocks);
    expect(graph.clusters).toHaveLength(1);
    expect(graph.clusters[0].count).toBe(4);
    expect(graph.edges).toHaveLength(0);
  });

  it("chain within gap merges across intermediate blocks", () => {
    // A --dist3-- B --dist3-- C → one cluster (each hop ≤3)
    const blocks = [
      { id: "x", cells: [cell(0, 0)] },
      { id: "y", cells: [cell(0, 3)] },
      { id: "z", cells: [cell(0, 6)] },
    ];
    const graph = buildMinimapClusterGraph(blocks);
    expect(graph.clusters).toHaveLength(1);
    expect(graph.clusters[0].count).toBe(3);
  });

  it("center block is pan-targetable via getPanToCenterCell", () => {
    const blocks = [
      { id: "c1", cells: [cell(2, 2)] },
      { id: "c2", cells: [cell(2, 3)] },
      { id: "far", cells: [cell(20, 20)] },
    ];
    const graph = buildMinimapClusterGraph(blocks);
    expect(graph.clusters.length).toBeGreaterThanOrEqual(2);
    for (const c of graph.clusters) {
      const pan = getPanToCenterCell(800, 600, c.centerCell, 1);
      expect(Number.isFinite(pan.x)).toBe(true);
      expect(Number.isFinite(pan.y)).toBe(true);
    }
  });

  it("frame size is strictly larger than legacy 148×108", () => {
    expect(MINIMAP_FRAME_WIDTH).toBeGreaterThan(MINIMAP_FRAME_WIDTH_LEGACY);
    expect(MINIMAP_FRAME_HEIGHT).toBeGreaterThan(MINIMAP_FRAME_HEIGHT_LEGACY);
    expect(MINIMAP_FRAME_WIDTH_LEGACY).toBe(148);
    expect(MINIMAP_FRAME_HEIGHT_LEGACY).toBe(108);

    writeEvidence(
      "minimap-size.log",
      [
        "width=" + MINIMAP_FRAME_WIDTH,
        "height=" + MINIMAP_FRAME_HEIGHT,
        "legacyW=" + MINIMAP_FRAME_WIDTH_LEGACY,
        "legacyH=" + MINIMAP_FRAME_HEIGHT_LEGACY,
        "padding=" + MINIMAP_FRAME_PADDING,
      ].join("\n"),
    );
  });

  it("projectMinimapClusters centers the set and preserves relative order", () => {
    const W = MINIMAP_FRAME_WIDTH;
    const H = MINIMAP_FRAME_HEIGHT;
    const pad = MINIMAP_FRAME_PADDING;
    const cx = W / 2;
    const cy = H / 2;
    const tol = 0.75;

    // Single cluster → frame center
    const one = buildMinimapClusterGraph([{ id: "solo", cells: [cell(5, 5)] }]);
    const onePts = projectMinimapClusters(one.clusters, W, H, pad);
    expect(onePts.size).toBe(1);
    const solo = [...onePts.values()][0];
    expect(Math.abs(solo.x - cx)).toBeLessThan(tol);
    expect(Math.abs(solo.y - cy)).toBeLessThan(tol);

    // Two clusters horizontal — midpoint near center; left stays left of right
    const two = buildMinimapClusterGraph([
      { id: "left", cells: [cell(0, 0)] },
      { id: "right", cells: [cell(0, 20)] },
    ]);
    const twoPts = projectMinimapClusters(two.clusters, W, H, pad);
    expect(twoPts.size).toBe(2);
    const byId = new Map(
      two.clusters.map((c) => [c.id, twoPts.get(c.id)!] as const),
    );
    // Sort clusters by center col to identify left/right
    const sorted = [...two.clusters].sort((a, b) => a.center.col - b.center.col);
    const leftPt = byId.get(sorted[0].id)!;
    const rightPt = byId.get(sorted[1].id)!;
    expect(leftPt.x).toBeLessThan(rightPt.x);
    const midX = (leftPt.x + rightPt.x) / 2;
    const midY = (leftPt.y + rightPt.y) / 2;
    expect(Math.abs(midX - cx)).toBeLessThan(tol);
    expect(Math.abs(midY - cy)).toBeLessThan(tol);
    // Stay inside padded frame
    for (const p of twoPts.values()) {
      expect(p.x).toBeGreaterThanOrEqual(pad - 0.01);
      expect(p.x).toBeLessThanOrEqual(W - pad + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(pad - 0.01);
      expect(p.y).toBeLessThanOrEqual(H - pad + 0.01);
    }

    writeEvidence(
      "minimap-center-layout.log",
      [
        "solo=(" + solo.x.toFixed(2) + "," + solo.y.toFixed(2) + ")",
        "frameCenter=(" + cx + "," + cy + ")",
        "leftX=" + leftPt.x.toFixed(2),
        "rightX=" + rightPt.x.toFixed(2),
        "mid=(" + midX.toFixed(2) + "," + midY.toFixed(2) + ")",
      ].join("\n"),
    );
  });

  it("placementsFromOccupiedCells + MST helper", () => {
    const map = new Map([
      ["a", [cell(0, 0)]],
      ["b", [cell(0, 1)]],
    ]);
    const placements = placementsFromOccupiedCells(map);
    expect(placements).toHaveLength(2);
    const clusters = buildMinimapClusterGraph(placements).clusters;
    expect(buildClusterMstEdges(clusters).length).toBeLessThan(clusters.length);
  });
});

describe("structural: minimap on BlockSkillGrid", () => {
  it("mounts rectangular top-right overlay; click centers via getPanToCenterCell", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("data-block-minimap");
    expect(grid).toContain("buildMinimapClusterGraph");
    expect(grid).toContain("getPanToCenterCell");
    expect(grid).toContain("data-minimap-cluster");
    expect(grid).toContain("centerCell");
    expect(grid).toContain("MINIMAP_FRAME_WIDTH");
    expect(grid).toContain("MINIMAP_FRAME_HEIGHT");
    expect(grid).not.toMatch(/const MINIMAP_WIDTH = 148/);
    // Always mounted — empty workspace shows a create-cluster hint
    expect(grid).toContain("data-minimap-empty");
    expect(grid).toContain("data-minimap-empty-message");
    expect(grid).toMatch(/Create a cluster to see it in the minimap/i);
    // Not gated only on clusters.length > 0 (empty state still renders the frame)
    expect(grid).not.toMatch(
      /minimapGraph\.clusters\.length > 0 \? \(\s*<div\s+data-block-minimap/,
    );
    // Top-right placement
    expect(grid).toMatch(/top-2|top-3/);
    expect(grid).toMatch(/right-2|right-3/);

    writeEvidence(
      "minimap-ui-wire.log",
      [
        "hasOverlay=" + grid.includes("data-block-minimap"),
        "hasClusterAttr=" + grid.includes("data-minimap-cluster"),
        "hasEmptyHint=" + grid.includes("data-minimap-empty-message"),
        "usesPanHelper=" + grid.includes("getPanToCenterCell"),
        "usesClusterGraph=" + grid.includes("buildMinimapClusterGraph"),
      ].join("\n"),
    );
  });
});
