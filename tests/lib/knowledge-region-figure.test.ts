import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  blobPathFromPoints,
  convexHull,
  densityContourPaths,
  densityContourRings,
  formatKnowledgeRegionTimestamp,
  KNOWLEDGE_REGION_CLUSTER_COLORS,
  knowledgeRegionAnalysisPointLabel,
  knowledgeRegionGlyphForPoint,
  knowledgeRegionPointKind,
  knowledgeRegionPolarGrid,
  presentKnowledgeRegionClusterDistances,
  presentKnowledgeRegionFigure,
  toggleKnowledgeRegionCluster,
} from "@/lib/knowledge-region-figure";

const ROOT = join(__dirname, "../..");

describe("knowledge region figure", () => {
  it("builds a polar disk, nested contours, and mixed glyphs", () => {
    const grid = knowledgeRegionPolarGrid({ rings: 5, spokes: 12 });
    expect(grid.rings).toHaveLength(5);
    expect(grid.spokes).toHaveLength(12);
    expect(grid.rings.at(-1)).toBe(grid.radius);

    const triangle = blobPathFromPoints([
      { x: 10, y: 10 },
      { x: 80, y: 12 },
      { x: 40, y: 70 },
    ]);
    expect(triangle).toContain(" C ");
    const sample = [
      { x: 20, y: 20 },
      { x: 28, y: 18 },
      { x: 24, y: 30 },
      { x: 40, y: 22 },
      { x: 18, y: 26 },
    ];
    const contours = densityContourPaths(sample, 3);
    expect(contours).toHaveLength(3);
    expect(new Set(contours).size).toBe(3);
    const rings = densityContourRings(sample, 3);
    const origin = {
      x: sample.reduce((sum, p) => sum + p.x, 0) / sample.length,
      y: sample.reduce((sum, p) => sum + p.y, 0) / sample.length,
    };
    const radii = rings.map((ring) =>
      Math.max(...ring.map((p) => Math.hypot(p.x - origin.x, p.y - origin.y))),
    );
    expect(radii[0]).toBeGreaterThan(radii[1]!);
    expect(radii[1]).toBeGreaterThan(radii[2]!);

    expect(knowledgeRegionGlyphForPoint({ id: "a", origin: "human", clusterId: null })).toBe(
      "diamond",
    );
    expect(
      knowledgeRegionGlyphForPoint({
        id: "c",
        origin: "human",
        clusterId: null,
        pointKind: "cohort",
      }),
    ).toBe("filled-circle");
    expect(
      knowledgeRegionGlyphForPoint({ id: "b", origin: "simulated", clusterId: null }, true),
    ).toBe("open-circle");
    expect(convexHull([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])).toHaveLength(4);
  });

  it("hides real points until toggled, labels clouds, and rays a selected point", () => {
    const hidden = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters: [
        { id: "c-exploit", strategyName: "Exploit-heavy" },
        { id: "c-balanced", strategyName: "Balanced" },
      ],
      showReal: false,
      points: [
        { id: "sim-1", x: 20, y: 20, origin: "simulated", clusterId: "c-exploit", identity: "Simulated · Exploit-heavy", vector: [1, 0] },
        { id: "sim-2", x: 22, y: 28, origin: "simulated", clusterId: "c-exploit", identity: "Simulated · Exploit-heavy", vector: [0.95, 0.1] },
        { id: "sim-3", x: 80, y: 24, origin: "simulated", clusterId: "c-balanced", identity: "Simulated · Balanced", vector: [0, 1] },
        { id: "sim-4", x: 86, y: 30, origin: "simulated", clusterId: "c-balanced", identity: "Simulated · Balanced", vector: [0.1, 0.9] },
        { id: "human-1", x: 50, y: 50, origin: "human", clusterId: null, identity: "ada", vector: [0.4, 0.4] },
      ],
    });
    expect(hidden.glyphs.map((point) => point.id)).toEqual(["sim-1", "sim-2", "sim-3", "sim-4"]);
    expect(hidden.glyphs.some((point) => point.origin === "human")).toBe(false);
    expect(hidden.contours.length).toBeGreaterThanOrEqual(4);
    expect(hidden.centroids.map((row) => row.label).sort()).toEqual(["Balanced", "Exploit-heavy"]);
    expect(hidden.badges.some((badge) => badge.kind === "cluster" && badge.label === "Exploit-heavy")).toBe(true);
    expect(hidden.legend.find((item) => item.kind === "cohort")?.on).toBe(false);
    expect(hidden.legend.find((item) => item.kind === "analysis")?.on).toBe(false);
    expect(hidden.legend.find((item) => item.kind === "simulated")?.on).toBe(true);

    const noSim = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters: [
        { id: "c-exploit", strategyName: "Exploit-heavy" },
        { id: "c-balanced", strategyName: "Balanced" },
      ],
      showReal: true,
      showSimulated: false,
      points: [
        { id: "sim-1", x: 20, y: 20, origin: "simulated", clusterId: "c-exploit", identity: "s" },
        { id: "human-1", x: 50, y: 50, origin: "human", clusterId: null, identity: "ada" },
      ],
    });
    expect(noSim.glyphs.map((point) => point.id)).toEqual(["human-1"]);
    expect(noSim.legend.find((item) => item.kind === "simulated")?.on).toBe(false);

    const none = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters: [{ id: "c-exploit", strategyName: "Exploit-heavy" }],
      visibleClusterIds: [],
      points: [
        { id: "sim-1", x: 20, y: 20, origin: "simulated", clusterId: "c-exploit", identity: "s" },
      ],
    });
    expect(none.glyphs).toEqual([]);
    expect(knowledgeRegionAnalysisPointLabel("verification")).toBe("Test");
    expect(knowledgeRegionAnalysisPointLabel("solve")).toBe("Students");
    expect(
      knowledgeRegionPointKind({
        origin: "human",
        identity: "ada",
        subjects: [{ label: "ada" }],
      }),
    ).toBe("cohort");
    expect(
      knowledgeRegionPointKind({
        origin: "human",
        identity: "bea",
        subjects: [{ label: "ada" }],
      }),
    ).toBe("analysis");
    expect(
      knowledgeRegionGlyphForPoint({
        id: "c1",
        origin: "human",
        clusterId: null,
        pointKind: "cohort",
      }),
    ).toBe("filled-circle");
    expect(hidden.grid.rings.length).toBeGreaterThan(2);
    expect(hidden.focus).toBeNull();
    expect(hidden.rays).toEqual([]);

    const focused = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters: [
        { id: "c-exploit", strategyName: "Exploit-heavy" },
        { id: "c-balanced", strategyName: "Balanced" },
      ],
      showReal: true,
      selectedPointId: "sim-1",
      points: [
        { id: "sim-1", x: 20, y: 20, origin: "simulated", clusterId: "c-exploit", identity: "Simulated · Exploit-heavy", vector: [1, 0] },
        { id: "sim-3", x: 80, y: 24, origin: "simulated", clusterId: "c-balanced", identity: "Simulated · Balanced", vector: [0, 1] },
        { id: "human-1", x: 50, y: 50, origin: "human", clusterId: null, identity: "ada", vector: [0.4, 0.4] },
      ],
    });
    expect(focused.glyphs.map((point) => point.id)).toEqual(["sim-1", "sim-3", "human-1"]);
    expect(focused.focus?.id).toBe("sim-1");
    expect(focused.badges.some((badge) => badge.kind === "focus")).toBe(true);
    expect(focused.rays.length).toBe(2);
    expect(focused.rays.every((ray) => ray.label.length > 0)).toBe(true);
    expect(focused.legend.find((item) => item.kind === "cohort")?.on).toBe(true);
    expect(focused.legend.find((item) => item.kind === "analysis")?.on).toBe(true);
    expect(focused.glyphs.find((point) => point.origin === "simulated")?.glyph).toBe("open-circle");
    expect(focused.glyphs.find((point) => point.origin === "human")?.glyph).toBe("diamond");
    expect(KNOWLEDGE_REGION_CLUSTER_COLORS.every((color) => /#(\d|[a-f]){3,8}/i.test(color))).toBe(
      true,
    );
    expect(KNOWLEDGE_REGION_CLUSTER_COLORS).toHaveLength(3);
  });

  it("renders the polar map chrome on the details page", () => {
    const page = readFileSync(
      join(ROOT, "components/product-flow/knowledge-region-page.tsx"),
      "utf8",
    );
    expect(page).toContain("data-knowledge-region-polar");
    expect(page).toContain("data-knowledge-region-contour");
    expect(page).toContain("data-knowledge-region-glyph");
    expect(page).toContain("data-knowledge-region-ray");
    expect(page).toContain("data-knowledge-region-badge");
    expect(page).toContain("data-knowledge-region-focus");
    expect(page).toContain("data-knowledge-region-legend");
    expect(page).toContain("data-knowledge-region-projection");
    expect(page).toContain("parseProjectionAlgorithmId");
    expect(page).toContain("PROJECTION_ALGORITHM_OPTIONS");
    expect(page).toContain("algorithm");
    expect(page).toContain("data-knowledge-region-show-real");
    expect(page).not.toContain("inspectWidth");
    expect(page).not.toContain("zoomStudioCamera");
    expect(page).not.toContain("scrollIntoView");
    expect(page).toContain("data-knowledge-region-controls");
    expect(page).toContain("StudioMultiSelect");
    expect(page).toContain("visibleClusterIds");
    expect(page).toContain("visiblePointKinds");
    expect(page).toContain("knowledgeRegionAnalysisPointLabel");
    expect(page).toContain("cohort");
    expect(page).toContain("lg:grid-cols-[7fr_3fr]");
    expect(page).toContain("<details");
    expect(page).toContain("KnowledgeRegionInspect");
    expect(page).toContain("presentKnowledgeRegionClusterDistances");
    const inspect = readFileSync(
      join(ROOT, "components/product-flow/knowledge-region-inspect.tsx"),
      "utf8",
    );
    expect(inspect).toContain("data-knowledge-region-inspect-tab");
    expect(inspect).toContain("data-knowledge-region-distance-table");
    expect(inspect).toContain("DataStudioInspectFields");
    expect(inspect).not.toContain("scrollIntoView");
  });

  it("ranks distances to every cluster and formats timestamps", () => {
    expect(formatKnowledgeRegionTimestamp(null)).toBe("—");
    expect(formatKnowledgeRegionTimestamp("2024-06-02T15:04:05.123Z")).toBe(
      "2024-06-02 15:04:05 UTC",
    );
    const rows = presentKnowledgeRegionClusterDistances({
      vector: [1, 0],
      clusters: [
        { id: "c-far", strategyName: "Far" },
        { id: "c-near", strategyName: "Near" },
      ],
      regions: [
        { id: "c-far", centroid: [0, 1], cosine_threshold: 0.9 },
        { id: "c-near", centroid: [1, 0], cosine_threshold: 0.5 },
      ],
    });
    expect(rows.map((row) => row.clusterId)).toEqual(["c-near", "c-far"]);
    expect(rows[0]?.nearest).toBe(true);
    expect(rows[0]?.inCluster).toBe(true);
    expect(rows[1]?.nearest).toBe(false);
    expect(rows[1]?.inCluster).toBe(false);
  });

  it("isolates one cluster then adds others back", () => {
    const all = ["c-exploit", "c-balanced", "c-guard"];
    const isolated = toggleKnowledgeRegionCluster(null, "c-exploit", all);
    expect(isolated).toEqual(["c-exploit"]);
    const added = toggleKnowledgeRegionCluster(isolated, "c-balanced", all);
    expect(added).toEqual(["c-exploit", "c-balanced"]);
    const restored = toggleKnowledgeRegionCluster(added, "c-guard", all);
    expect(restored).toBeNull();

    const points = [
      { id: "sim-1", x: 20, y: 20, origin: "simulated" as const, clusterId: "c-exploit", identity: "a" },
      { id: "sim-2", x: 80, y: 24, origin: "simulated" as const, clusterId: "c-balanced", identity: "b" },
      { id: "sim-3", x: 40, y: 70, origin: "simulated" as const, clusterId: "c-guard", identity: "c" },
    ];
    const clusters = [
      { id: "c-exploit", strategyName: "Exploit-heavy" },
      { id: "c-balanced", strategyName: "Balanced" },
      { id: "c-guard", strategyName: "Guard" },
    ];
    const one = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters,
      points,
      visibleClusterIds: isolated,
    });
    expect(one.glyphs.map((point) => point.id)).toEqual(["sim-1"]);
    expect(one.legend.filter((item) => item.kind === "cluster" && item.on).map((item) => item.id)).toEqual(
      ["c-exploit"],
    );

    const two = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters,
      points,
      visibleClusterIds: added,
    });
    expect(two.glyphs.map((point) => point.id).sort()).toEqual(["sim-1", "sim-2"]);
    expect(
      two.legend.filter((item) => item.kind === "cluster" && item.on).map((item) => item.id),
    ).toEqual(["c-exploit", "c-balanced"]);
  });
});
