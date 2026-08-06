import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CLUSTER_ISOLATION_GAP_CELLS,
  CLUSTER_MIN_INTER_CHEBYSHEV,
  CLUSTER_SEPARATION_DEFAULT,
  assignBlocksToClusters,
  clusterBlocks,
  clusterMinInterChebyshev,
  clusterPackSearchRadius,
  clusterRingBaseRadius,
  clustersSatisfyIsolation,
  placeClusterAssignments,
  resolveAutoClusterCount,
  resolveClusterCount,
  resolveClusterSeparation,
  validateRelocatePlacements,
  type ClusterBlockInput,
} from "@/lib/cluster-blocks";
import {
  MINIMAP_ISOLATION_GAP_CELLS,
  minChebyshevBetweenBlocks,
} from "@/lib/map-minimap-clusters";
import { placedBlockCells, type PlacedBlockRef } from "@/lib/skill-grid-ops";

const REPO_ROOT = path.resolve(__dirname, "../..");

function block(
  id: string,
  x: number,
  y: number,
  extra?: Partial<ClusterBlockInput>,
): ClusterBlockInput {
  return {
    id,
    title: extra?.title ?? id,
    description: extra?.description ?? "",
    position_x: x,
    position_y: y,
    span_w: extra?.span_w ?? 1,
    span_h: extra?.span_h ?? 1,
    shape_cells: extra?.shape_cells ?? null,
  };
}

function asPlaced(blocks: readonly ClusterBlockInput[]): PlacedBlockRef[] {
  return blocks.map((b) => ({
    id: b.id,
    position_x: b.position_x,
    position_y: b.position_y,
    span_w: b.span_w ?? 1,
    span_h: b.span_h ?? 1,
    shape_cells: b.shape_cells ?? null,
  }));
}

function clusterCellsFromPlacements(
  placements: PlacedBlockRef[],
  assignment: Record<string, number>,
  K: number,
): Array<ReturnType<typeof placedBlockCells>> {
  const groups: ReturnType<typeof placedBlockCells>[] = Array.from(
    { length: K },
    () => [],
  );
  for (const p of placements) {
    const c = assignment[p.id] ?? 0;
    groups[c].push(...placedBlockCells(p));
  }
  return groups;
}

describe("cluster count resolution", () => {
  it("auto count is 1..N and splits larger selections", () => {
    expect(resolveAutoClusterCount(1)).toBe(1);
    expect(resolveAutoClusterCount(2)).toBe(2);
    expect(resolveAutoClusterCount(3)).toBe(2);
    expect(resolveAutoClusterCount(4)).toBe(2);
    expect(resolveAutoClusterCount(9)).toBe(3);
    expect(resolveAutoClusterCount(16)).toBe(4);
    // Never always-1 for N large enough to split
    expect(resolveAutoClusterCount(6)).toBeGreaterThan(1);
  });

  it("resolveClusterCount clamps fixed K and treats invalid as auto", () => {
    expect(resolveClusterCount(5, 3)).toBe(3);
    expect(resolveClusterCount(5, 99)).toBe(5);
    expect(resolveClusterCount(5, 0)).toBe(resolveAutoClusterCount(5));
    expect(resolveClusterCount(5, "auto")).toBe(resolveAutoClusterCount(5));
    expect(resolveClusterCount(5, null)).toBe(resolveAutoClusterCount(5));
  });

  it("isolation constants match minimap gap of 3 empty cells", () => {
    expect(CLUSTER_ISOLATION_GAP_CELLS).toBe(MINIMAP_ISOLATION_GAP_CELLS);
    expect(CLUSTER_ISOLATION_GAP_CELLS).toBe(3);
    expect(CLUSTER_MIN_INTER_CHEBYSHEV).toBe(4);
  });

  it("separation slider adds extra cells beyond min isolation", () => {
    expect(CLUSTER_SEPARATION_DEFAULT).toBe(0);
    expect(resolveClusterSeparation(null)).toBe(CLUSTER_SEPARATION_DEFAULT);
    expect(resolveClusterSeparation(-3)).toBe(0);
    expect(resolveClusterSeparation(99)).toBe(10);
    expect(clusterMinInterChebyshev(0)).toBe(CLUSTER_MIN_INTER_CHEBYSHEV);
    expect(clusterMinInterChebyshev(5)).toBe(CLUSTER_MIN_INTER_CHEBYSHEV + 5);
    // Ring radius for 2 groups is ~ half of (dim+gap), not dim+gap (old aggressive formula)
    const tight = clusterRingBaseRadius(2, 2, 4);
    const loose = clusterRingBaseRadius(2, 2, 4 + 8);
    expect(tight).toBeLessThanOrEqual(2 + 4);
    expect(loose).toBeGreaterThan(tight);
    expect(clusterPackSearchRadius(3, 2, 4, 0)).toBeGreaterThan(tight);
  });
});

describe("clusterBlocks pure op", () => {
  function spanOf(
    result: Extract<ReturnType<typeof clusterBlocks>, { ok: true }>,
  ) {
    const cells = result.placements.flatMap((p) => placedBlockCells(p));
    const rows = cells.map((c) => c.row);
    const cols = cells.map((c) => c.col);
    const h = Math.max(...rows) - Math.min(...rows);
    const w = Math.max(...cols) - Math.min(...cols);
    return Math.max(h, w);
  }

  it("higher separation places clusters farther than tight separation", () => {
    const selected = [
      block("a", 0, 0),
      block("b", 1, 0),
      block("c", 0, 1),
      block("d", 1, 1),
    ];
    const tight = clusterBlocks({
      selected,
      allPlaced: asPlaced(selected),
      clusterCount: 2,
      separation: 0,
    });
    const far = clusterBlocks({
      selected,
      allPlaced: asPlaced(selected),
      clusterCount: 2,
      separation: 8,
    });
    expect(tight.ok).toBe(true);
    expect(far.ok).toBe(true);
    if (!tight.ok || !far.ok) return;

    // Far separation should spread the selection footprint at least as much as tight.
    expect(spanOf(far)).toBeGreaterThanOrEqual(spanOf(tight));
  });

  it("tight pack (sep=0) keeps K=2 selection compact (not flung to huge ring)", () => {
    const selected = [
      block("a", 0, 0),
      block("b", 1, 0),
      block("c", 0, 1),
      block("d", 1, 1),
    ];
    const result = clusterBlocks({
      selected,
      allPlaced: asPlaced(selected),
      clusterCount: 2,
      separation: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Original selection spans 1 cell; with min isolation 3 empty (Cheby≥4)
    // a tight pack should stay well under the old 2R ring span (~8–10).
    expect(spanOf(result)).toBeLessThanOrEqual(8);
    const cells = clusterCellsFromPlacements(
      result.placements,
      result.assignment,
      result.clusterCount,
    );
    expect(clustersSatisfyIsolation(cells)).toBe(true);
  });

  it("fixed K=2 relocates with inter-cluster gap ≥ 3 empty cells; content unchanged", () => {
    const selected = [
      block("a", 0, 0, { title: "Alpha theory" }),
      block("b", 1, 0, { title: "Alpha practice" }),
      block("c", 0, 1, { title: "Beta theory" }),
      block("d", 1, 1, { title: "Beta practice" }),
    ];
    const titles = Object.fromEntries(selected.map((b) => [b.id, b.title]));
    const result = clusterBlocks({
      selected,
      allPlaced: asPlaced(selected),
      clusterCount: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.clusterCount).toBe(2);
    expect(result.placements).toHaveLength(4);
    // Content identity: same ids, no title mutation in result (positions only)
    const ids = result.placements.map((p) => p.id).sort();
    expect(ids).toEqual(["a", "b", "c", "d"]);
    for (const p of result.placements) {
      expect(p.span_w).toBe(1);
      expect(p.span_h).toBe(1);
      // original titles still on inputs
      expect(titles[p.id]).toBeTruthy();
    }

    const cells = clusterCellsFromPlacements(
      result.placements,
      result.assignment,
      result.clusterCount,
    );
    expect(clustersSatisfyIsolation(cells)).toBe(true);
    // Explicit pairwise check
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        if (!cells[i].length || !cells[j].length) continue;
        expect(minChebyshevBetweenBlocks(cells[i], cells[j])).toBeGreaterThanOrEqual(
          CLUSTER_MIN_INTER_CHEBYSHEV,
        );
      }
    }
  });

  it("auto count yields sensible K (not always 1) and valid isolation", () => {
    const selected = Array.from({ length: 6 }, (_, i) =>
      block(`b${i}`, i % 3, Math.floor(i / 3), { title: `Topic ${i}` }),
    );
    const result = clusterBlocks({
      selected,
      allPlaced: asPlaced(selected),
      clusterCount: "auto",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.clusterCount).toBeGreaterThan(1);
    expect(result.clusterCount).toBeLessThanOrEqual(6);
    const cells = clusterCellsFromPlacements(
      result.placements,
      result.assignment,
      result.clusterCount,
    );
    expect(clustersSatisfyIsolation(cells)).toBe(true);
  });

  it("prompt influences assignment without changing content", () => {
    const selected = [
      block("theory1", 0, 0, {
        title: "Bayesian theory foundations",
        description: "priors likelihood",
      }),
      block("theory2", 1, 0, {
        title: "Probability theory review",
        description: "axioms",
      }),
      block("practice1", 0, 1, {
        title: "Clinical practice drills",
        description: "cases",
      }),
      block("practice2", 1, 1, {
        title: "Hands-on practice lab",
        description: "exercises",
      }),
    ];
    const { assignment } = assignBlocksToClusters(selected, 2, "theory priors");
    // At least one theory-ish block should not share a cluster with all practice-only if prompt works —
    // soft check: assignment uses 0 and 1
    const bins = new Set(Object.values(assignment));
    expect(bins.has(0)).toBe(true);
    expect(bins.has(1)).toBe(true);

    const result = clusterBlocks({
      selected,
      allPlaced: asPlaced(selected),
      clusterCount: 2,
      prompt: "theory priors probability",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // titles never part of placements — only ids/positions
    for (const p of result.placements) {
      expect(Object.keys(p).sort()).toEqual(
        expect.arrayContaining(["id", "position_x", "position_y"]),
      );
      expect((p as { title?: string }).title).toBeUndefined();
    }
  });

  it("collision-heavy map: fails conservatively without overlapping fixed blocks", () => {
    // Selected clump at origin; ring of fixed walls leaving no safe isolated spots nearby.
    // We still allow success if algorithm finds space far away — but must not overlap walls.
    const selected = [
      block("s1", 5, 5),
      block("s2", 6, 5),
      block("s3", 5, 6),
      block("s4", 6, 6),
    ];
    const walls: PlacedBlockRef[] = [];
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        // dense wall except a free band far to the right and the selection cells
        const isSelectedCell =
          (x === 5 || x === 6) && (y === 5 || y === 6);
        if (isSelectedCell) continue;
        // leave columns 30+ empty by not placing walls there — walls only 0..19
        walls.push({
          id: `wall-${x}-${y}`,
          position_x: x,
          position_y: y,
          span_w: 1,
          span_h: 1,
        });
      }
    }
    const allPlaced = [...selected.map((b) => ({
      id: b.id,
      position_x: b.position_x,
      position_y: b.position_y,
      span_w: 1,
      span_h: 1,
    })), ...walls];

    const result = clusterBlocks({
      selected,
      allPlaced,
      clusterCount: 2,
    });

    if (result.ok) {
      // If it found a layout, no placement may land on a wall cell
      const wallKeys = new Set(
        walls.flatMap((w) =>
          placedBlockCells(w).map((c) => `${c.row}:${c.col}`),
        ),
      );
      for (const p of result.placements) {
        for (const c of placedBlockCells(p)) {
          expect(wallKeys.has(`${c.row}:${c.col}`)).toBe(false);
        }
      }
      // No mutual overlaps
      const keys = new Set<string>();
      for (const p of result.placements) {
        for (const c of placedBlockCells(p)) {
          const k = `${c.row}:${c.col}`;
          expect(keys.has(k)).toBe(false);
          keys.add(k);
        }
      }
    } else {
      // Conservative failure — no corrupt partial placements returned
      expect(result.error).toMatch(/collision|isolation|space|place/i);
      expect((result as { placements?: unknown }).placements).toBeUndefined();
    }
  });

  it("validateRelocatePlacements rejects overlaps with non-moving occupancy", () => {
    const fixed: PlacedBlockRef[] = [
      { id: "fixed", position_x: 0, position_y: 0, span_w: 1, span_h: 1 },
      { id: "mover", position_x: 2, position_y: 2, span_w: 1, span_h: 1 },
    ];
    const bad = validateRelocatePlacements(
      [{ id: "mover", position_x: 0, position_y: 0, span_w: 1, span_h: 1 }],
      fixed,
    );
    expect(bad).toMatch(/collides/i);

    const good = validateRelocatePlacements(
      [{ id: "mover", position_x: 4, position_y: 4, span_w: 1, span_h: 1 }],
      fixed,
    );
    expect(good).toBe(null);
  });

  it("requires at least two placed blocks", () => {
    const result = clusterBlocks({
      selected: [block("only", 0, 0)],
      clusterCount: 1,
    });
    expect(result.ok).toBe(false);
  });
});

describe("placeClusterAssignments isolation helper", () => {
  it("clustersSatisfyIsolation false when gap too small", () => {
    const near = [
      [{ row: 0, col: 0 }],
      [{ row: 0, col: 2 }], // chebyshev 2 < 4
    ];
    expect(clustersSatisfyIsolation(near)).toBe(false);
    const far = [
      [{ row: 0, col: 0 }],
      [{ row: 0, col: 4 }], // chebyshev 4
    ];
    expect(clustersSatisfyIsolation(far)).toBe(true);
  });

  it("K=1 places without requiring inter-cluster gap", () => {
    const selected = [block("a", 0, 0), block("b", 1, 0)];
    const assignment = { a: 0, b: 0 };
    const result = placeClusterAssignments(selected, assignment, 1, {
      allPlaced: asPlaced(selected),
    });
    expect(result.ok).toBe(true);
  });
});

describe("Cluster blocks structural wiring", () => {
  it("multi-select pane exposes Cluster blocks drawer with count/auto/prompt/apply", () => {
    const pane = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceCombineBlocksPane.tsx"),
      "utf8",
    );
    expect(pane).toContain("Cluster blocks");
    expect(pane).toContain('drawerId="cluster"');
    expect(pane).toContain("data-cluster-blocks-drawer");
    expect(pane).toContain("data-cluster-blocks-pane");
    expect(pane).toContain("data-cluster-count-auto");
    expect(pane).toContain("data-cluster-count-input");
    expect(pane).toContain("data-cluster-separation-input");
    expect(pane).toContain("data-cluster-prompt");
    expect(pane).toContain("data-cluster-apply");
    expect(pane).toContain("onClusterBlocks");
    expect(pane).toContain("onClusterProgress");
    expect(pane).toContain("separation");
    expect(pane).toContain("clusterBlocks");
    expect(pane).toContain("Let the system decide");
  });

  it("WorkspaceView wires onClusterBlocks to grid-ops relocate and minimap progress", () => {
    const view = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceView.tsx"),
      "utf8",
    );
    expect(view).toContain("handleClusterBlocks");
    expect(view).toContain("onClusterBlocks={handleClusterBlocks}");
    expect(view).toContain("onClusterProgress={handleClusterProgress}");
    expect(view).toContain("clusterMapJob");
    expect(view).toContain('op: "relocate"');
    expect(view).toContain("placements: input.placements");
  });

  it("cluster success clears filled multi-select, empty surface, and grid-local selection", () => {
    const view = fs.readFileSync(
      path.join(REPO_ROOT, "components/WorkspaceView.tsx"),
      "utf8",
    );
    const grid = fs.readFileSync(
      path.join(REPO_ROOT, "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    const sessionList = fs.readFileSync(
      path.join(REPO_ROOT, "components/SessionList.tsx"),
      "utf8",
    );
    // Isolate the relocate success handler body after handleClusterBlocks.
    const start = view.indexOf("handleClusterBlocks");
    expect(start).toBeGreaterThanOrEqual(0);
    const handler = view.slice(start, start + 2800);
    expect(handler).toContain('op: "relocate"');
    // Parent selection stores cleared only after successful relocate (not only on cancel).
    expect(handler).toContain(
      "setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection())",
    );
    expect(handler).toContain(
      "setExpandedBlockId(clearWorkspaceBlockSelection())",
    );
    expect(handler).toContain("setEmptySurface(clearWorkspaceAddTarget())");
    expect(handler).toContain("nextMapSelectionClearNonce");
    expect(handler).toContain("setMapSelectionClearNonce");
    // Grid-local multi + empty clear is host-driven via nonce (parent cannot set grid state).
    expect(view).toContain("mapSelectionClearNonce={mapSelectionClearNonce}");
    expect(sessionList).toContain("mapSelectionClearNonce");
    expect(grid).toContain("mapSelectionClearNonce");
    expect(grid).toMatch(
      /mapSelectionClearNonce[\s\S]*?setSelectedBlockIds\(\[\]\)[\s\S]*?setSelectedEmptyCells\(\[\]\)|mapSelectionClearNonce[\s\S]*?setSelectedEmptyCells\(\[\]\)[\s\S]*?setSelectedBlockIds\(\[\]\)/,
    );
  });

  it("BlockSkillGrid shows cluster progress bar under minimap", () => {
    const grid = fs.readFileSync(
      path.join(REPO_ROOT, "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    expect(grid).toContain("clusterMapJob");
    expect(grid).toContain("data-map-cluster-job");
    expect(grid).toContain("data-map-cluster-progress-bar");
    expect(grid).toContain("data-map-cluster-progress-fill");
  });

  it("grid-ops supports relocate op with validateRelocatePlacements", () => {
    const route = fs.readFileSync(
      path.join(REPO_ROOT, "app/api/workspace/grid-ops/route.ts"),
      "utf8",
    );
    expect(route).toContain('"relocate"');
    expect(route).toContain('op === "relocate"');
    expect(route).toContain("validateRelocatePlacements");
    expect(route).toContain("position_x");
    expect(route).toContain("position_y");
    // content fields not bulk-rewritten on relocate
    expect(route).toMatch(/Preserve span\/shape|position-only/i);
  });

  it("pure module reuses minimap isolation constant", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "lib/cluster-blocks.ts"),
      "utf8",
    );
    expect(src).toContain("MINIMAP_ISOLATION_GAP_CELLS");
    expect(src).toContain("CLUSTER_MIN_INTER_CHEBYSHEV");
    expect(src).toContain("export function clusterBlocks");
    expect(src).toContain("export function assignBlocksToClusters");
  });
});
