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
  knowledgeRegionIdentityLabel,
  knowledgeRegionIdentityOptions,
  knowledgeRegionPointKind,
  knowledgeRegionPolarGrid,
  knowledgeRegionSampleIdForIdentity,
  parseKnowledgeRegionFigureMode,
  parseKnowledgeRegionFigureSpace,
  parseKnowledgeRegionFigureTrack,
  knowledgeRegionFigureMode,
  knowledgeRegionFigureSpace,
  knowledgeRegionFigureTrack,
  knowledgeRegionFigureFocusOnPoints,
  knowledgeRegionFigureLabelOffset,
  knowledgeRegionFigureLabelScale,
  knowledgeRegionFigureLabelTransform,
  knowledgeRegionFigureOverviewLabels,
  knowledgeRegionFigureShowSegmentLabel,
  knowledgeRegionFigureStepLabelOffset,
  knowledgeRegionFigureViewBox,
  knowledgeRegionFigureZoomIn,
  knowledgeRegionFigureZoomOut,
  clampKnowledgeRegionFigureZoom,
  KNOWLEDGE_REGION_FIGURE_ZOOM_FIT,
  KNOWLEDGE_REGION_MAP_SIZE,
  knowledgeRegionUnsysDistance,
  placeKnowledgeRegionQuadrantPoints,
  presentKnowledgeRegionClusterDistances,
  presentKnowledgeRegionFigure,
  presentKnowledgeRegionIdentityPath,
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
      knowledgeRegionPointKind({
        origin: "human",
        identity: "K4M9Q2",
      }),
    ).toBe("analysis");
    expect(
      knowledgeRegionPointKind({
        origin: "human",
        identity: "K4M9Q2",
        linkLabel: "reference",
      }),
    ).toBe("cohort");
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
    expect(focused.path).toBeNull();
    expect(KNOWLEDGE_REGION_CLUSTER_COLORS.every((color) => /#(\d|[a-f]){3,8}/i.test(color))).toBe(
      true,
    );
    expect(KNOWLEDGE_REGION_CLUSTER_COLORS).toHaveLength(3);
  });

  it("follows a named identity as a time-ordered path instead of cluster rays", () => {
    expect(parseKnowledgeRegionFigureMode("path")).toBe("path");
    expect(parseKnowledgeRegionFigureMode("individual")).toBe("individual");
    expect(parseKnowledgeRegionFigureMode("quadrant")).toBe("quadrant");
    expect(parseKnowledgeRegionFigureMode("quadrant-path")).toBe("quadrant-path");
    expect(parseKnowledgeRegionFigureMode("nope")).toBe("individual");
    expect(parseKnowledgeRegionFigureSpace("quadrant")).toBe("quadrant");
    expect(parseKnowledgeRegionFigureSpace("full")).toBe("full");
    expect(parseKnowledgeRegionFigureTrack("path")).toBe("path");
    expect(parseKnowledgeRegionFigureTrack("individual")).toBe("individual");
    expect(knowledgeRegionFigureMode("full", "individual")).toBe("individual");
    expect(knowledgeRegionFigureMode("full", "path")).toBe("path");
    expect(knowledgeRegionFigureMode("quadrant", "individual")).toBe("quadrant");
    expect(knowledgeRegionFigureMode("quadrant", "path")).toBe("quadrant-path");
    expect(knowledgeRegionFigureSpace("quadrant-path")).toBe("quadrant");
    expect(knowledgeRegionFigureTrack("quadrant-path")).toBe("path");
    expect(clampKnowledgeRegionFigureZoom(0)).toBe(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT);
    expect(knowledgeRegionFigureZoomOut(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT)).toBe(
      KNOWLEDGE_REGION_FIGURE_ZOOM_FIT,
    );
    expect(knowledgeRegionFigureZoomIn(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT)).toBeGreaterThan(
      KNOWLEDGE_REGION_FIGURE_ZOOM_FIT,
    );
    const fitted = knowledgeRegionFigureViewBox({
      size: KNOWLEDGE_REGION_MAP_SIZE,
      zoom: KNOWLEDGE_REGION_FIGURE_ZOOM_FIT,
    });
    expect(fitted.value).toBe(`0 0 ${KNOWLEDGE_REGION_MAP_SIZE} ${KNOWLEDGE_REGION_MAP_SIZE}`);
    const zoomed = knowledgeRegionFigureViewBox({
      size: KNOWLEDGE_REGION_MAP_SIZE,
      zoom: 2,
    });
    expect(zoomed.width).toBe(KNOWLEDGE_REGION_MAP_SIZE / 2);
    expect(zoomed.height).toBe(KNOWLEDGE_REGION_MAP_SIZE / 2);
    expect(zoomed.x).toBe(KNOWLEDGE_REGION_MAP_SIZE / 4);
    expect(zoomed.y).toBe(KNOWLEDGE_REGION_MAP_SIZE / 4);
    const focused = knowledgeRegionFigureFocusOnPoints([
      { x: 300, y: 300 },
      { x: 308, y: 304 },
      { x: 302, y: 310 },
    ]);
    expect(focused.zoom).toBeGreaterThan(4);
    expect(focused.panX).toBeGreaterThan(0);
    expect(focused.panY).toBeGreaterThan(0);
    expect(knowledgeRegionFigureFocusOnPoints([])).toEqual({
      zoom: KNOWLEDGE_REGION_FIGURE_ZOOM_FIT,
      panX: 0,
      panY: 0,
    });
    expect(
      knowledgeRegionFigureFocusOnPoints([
        { x: 32, y: 32 },
        { x: 448, y: 448 },
      ]).zoom,
    ).toBe(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT);
    expect(knowledgeRegionFigureLabelScale(1)).toBe(1);
    expect(knowledgeRegionFigureLabelScale(4)).toBe(0.25);
    expect(knowledgeRegionFigureLabelTransform(120, 80, 2)).toBe("translate(120 80) scale(0.5)");
    expect(knowledgeRegionFigureOverviewLabels(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT)).toBe(true);
    expect(knowledgeRegionFigureOverviewLabels(4)).toBe(false);
    expect(knowledgeRegionFigureShowSegmentLabel(100, 100, 108, 104, 1)).toBe(false);
    expect(knowledgeRegionFigureShowSegmentLabel(100, 100, 108, 104, 8)).toBe(true);
    expect(knowledgeRegionFigureLabelOffset(1)).toBeCloseTo(12.2);
    expect(knowledgeRegionFigureLabelOffset(4)).toBeGreaterThan(knowledgeRegionFigureLabelOffset(1));
    const stepOffset = knowledgeRegionFigureStepLabelOffset(
      { x: 40, y: 40, index: 2 },
      [
        { x: 20, y: 40 },
        { x: 40, y: 40 },
        { x: 80, y: 40 },
      ],
      1,
    );
    expect(Math.abs(stepOffset.y)).toBeGreaterThan(Math.abs(stepOffset.x));
    expect(knowledgeRegionUnsysDistance({ projectedPolicy: { distance: 1.25 } })).toBe(1.25);
    expect(knowledgeRegionUnsysDistance(null)).toBeNull();

    const points = [
      {
        id: "sim-late",
        x: 24,
        y: 22,
        origin: "simulated" as const,
        clusterId: "c-exploit",
        identity: "Simulated · Exploit-heavy",
        createdAt: "2024-06-03T00:00:00Z",
        vector: [1, 0],
      },
      {
        id: "sim-early",
        x: 18,
        y: 20,
        origin: "simulated" as const,
        clusterId: "c-exploit",
        identity: "Simulated · Exploit-heavy",
        createdAt: "2024-06-01T00:00:00Z",
        vector: [0.9, 0.1],
      },
      {
        id: "sim-other",
        x: 80,
        y: 24,
        origin: "simulated" as const,
        clusterId: "c-balanced",
        identity: "Simulated · Balanced",
        createdAt: "2024-06-02T00:00:00Z",
        vector: [0, 1],
      },
      {
        id: "human-1",
        x: 50,
        y: 50,
        origin: "human" as const,
        clusterId: null,
        identity: "ada",
        createdAt: "2024-06-04T00:00:00Z",
        vector: [0.4, 0.4],
      },
    ];
    expect(knowledgeRegionIdentityOptions(points).map((row) => row.label)).toEqual([
      "ada",
      "Simulated · Balanced",
      "Simulated · Exploit-heavy",
    ]);
    expect(knowledgeRegionIdentityLabel("lti:https://school.brightspace.com:user-9", {
      "lti:https://school.brightspace.com:user-9": "Ada",
    })).toBe("Ada");
    expect(
      knowledgeRegionIdentityOptions(
        [{ id: "p1", identity: "lti:https://school.brightspace.com:user-9" }],
        { "lti:https://school.brightspace.com:user-9": "Ada" },
      ).map((row) => row.label),
    ).toEqual(["Ada"]);
    expect(
      knowledgeRegionSampleIdForIdentity({
        points,
        identityKey: "Simulated · Exploit-heavy",
      }),
    ).toBe("sim-late");
    expect(
      knowledgeRegionSampleIdForIdentity({
        points,
        identityKey: "Simulated · Exploit-heavy",
        currentId: "sim-early",
      }),
    ).toBe("sim-early");

    const path = presentKnowledgeRegionIdentityPath({
      points,
      identityKey: "Simulated · Exploit-heavy",
      clusters: [
        { id: "c-exploit", strategyName: "Exploit-heavy" },
        { id: "c-balanced", strategyName: "Balanced" },
      ],
    });
    expect(path?.steps.map((step) => step.id)).toEqual(["sim-early", "sim-late"]);
    expect(path?.steps.map((step) => step.clusterLabel)).toEqual([
      "Exploit-heavy",
      "Exploit-heavy",
    ]);
    expect(path?.segments).toHaveLength(1);
    expect(path?.segments[0]?.label.length).toBeGreaterThan(0);

    const followed = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters: [
        { id: "c-exploit", strategyName: "Exploit-heavy" },
        { id: "c-balanced", strategyName: "Balanced" },
      ],
      showReal: true,
      selectedPointId: "sim-early",
      mode: "path",
      points,
    });
    expect(followed.rays).toEqual([]);
    expect(followed.path?.label).toBe("Simulated · Exploit-heavy");
    expect(followed.path?.steps.map((step) => step.id)).toEqual(["sim-early", "sim-late"]);
    expect(followed.path?.segments).toHaveLength(1);
    expect(followed.focus?.id).toBe("sim-early");
  });

  it("places dots in the nearest simulation section, farther from center as unsys distance grows", () => {
    const clusters = [
      { id: "c-exploit", strategyName: "Exploit-heavy", vector: [1, 0] },
      { id: "c-balanced", strategyName: "Balanced", vector: [0, 1] },
    ];
    const points = [
      {
        id: "near-exploit",
        x: 999,
        y: 999,
        origin: "human" as const,
        clusterId: null,
        identity: "ada",
        vector: [1, 0],
        unsysDistance: 0.2,
      },
      {
        id: "far-exploit",
        x: 0,
        y: 0,
        origin: "human" as const,
        clusterId: null,
        identity: "bev",
        vector: [0.95, 0.05],
        unsysDistance: 2,
      },
      {
        id: "balanced-mid",
        x: 10,
        y: 10,
        origin: "simulated" as const,
        clusterId: "c-balanced",
        identity: "Simulated · Balanced",
        vector: [0, 1],
        unsysDistance: 1,
      },
    ];
    const map = { cx: 240, cy: 240, radius: 208 };
    const layout = placeKnowledgeRegionQuadrantPoints({ points, clusters, map });
    expect(layout.sections).toHaveLength(2);
    expect(layout.sections.map((section) => section.clusterId)).toEqual([
      "c-exploit",
      "c-balanced",
    ]);
    const exploit = layout.sections[0]!;
    const balanced = layout.sections[1]!;
    const near = layout.placed.get("near-exploit")!;
    const far = layout.placed.get("far-exploit")!;
    const other = layout.placed.get("balanced-mid")!;
    expect(near.clusterId).toBe("c-exploit");
    expect(far.clusterId).toBe("c-exploit");
    expect(other.clusterId).toBe("c-balanced");
    expect(near.angle).toBeGreaterThanOrEqual(exploit.startAngle);
    expect(near.angle).toBeLessThan(exploit.endAngle);
    expect(far.angle).toBeGreaterThanOrEqual(exploit.startAngle);
    expect(far.angle).toBeLessThan(exploit.endAngle);
    expect(other.angle).toBeGreaterThanOrEqual(balanced.startAngle);
    expect(other.angle).toBeLessThan(balanced.endAngle);
    expect(far.radius).toBeGreaterThan(near.radius);
    expect(other.radius).toBeGreaterThan(near.radius);
    expect(other.radius).toBeLessThan(far.radius);

    const figure = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters,
      showReal: true,
      mode: "quadrant",
      points,
    });
    expect(figure.sections).toHaveLength(2);
    expect(figure.contours).toEqual([]);
    expect(figure.rays).toEqual([]);
    expect(figure.path).toBeNull();
    expect(figure.centroids).toEqual([]);
    expect(figure.glyphs.find((glyph) => glyph.id === "near-exploit")?.clusterId).toBe("c-exploit");
    expect(figure.glyphs.find((glyph) => glyph.id === "balanced-mid")?.clusterId).toBe("c-balanced");
    const nearGlyph = figure.glyphs.find((glyph) => glyph.id === "near-exploit")!;
    const farGlyph = figure.glyphs.find((glyph) => glyph.id === "far-exploit")!;
    const nearR = Math.hypot(nearGlyph.x - figure.map.cx, nearGlyph.y - figure.map.cy);
    const farR = Math.hypot(farGlyph.x - figure.map.cx, farGlyph.y - figure.map.cy);
    expect(farR).toBeGreaterThan(nearR);
  });

  it("draws an identity path across quadrant sections", () => {
    const clusters = [
      { id: "c-exploit", strategyName: "Exploit-heavy", vector: [1, 0] },
      { id: "c-balanced", strategyName: "Balanced", vector: [0, 1] },
    ];
    const points = [
      {
        id: "ada-early",
        x: 10,
        y: 10,
        origin: "human" as const,
        clusterId: null,
        identity: "ada",
        createdAt: "2024-06-01T00:00:00Z",
        vector: [1, 0],
        unsysDistance: 0.4,
      },
      {
        id: "ada-late",
        x: 80,
        y: 80,
        origin: "human" as const,
        clusterId: null,
        identity: "ada",
        createdAt: "2024-06-04T00:00:00Z",
        vector: [0, 1],
        unsysDistance: 1.4,
      },
      {
        id: "other",
        x: 40,
        y: 40,
        origin: "simulated" as const,
        clusterId: "c-balanced",
        identity: "Simulated · Balanced",
        createdAt: "2024-06-02T00:00:00Z",
        vector: [0, 1],
        unsysDistance: 1,
      },
    ];
    const crossed = presentKnowledgeRegionFigure({
      parent: { id: "parent", name: "Limits styles" },
      clusters,
      showReal: true,
      selectedPointId: "ada-early",
      mode: "quadrant-path",
      points,
    });
    expect(crossed.sections).toHaveLength(2);
    expect(crossed.contours).toEqual([]);
    expect(crossed.centroids).toEqual([]);
    expect(crossed.rays).toEqual([]);
    expect(crossed.path?.label).toBe("ada");
    expect(crossed.path?.steps.map((step) => step.id)).toEqual(["ada-early", "ada-late"]);
    expect(crossed.path?.steps.map((step) => step.clusterId)).toEqual([
      "c-exploit",
      "c-balanced",
    ]);
    expect(crossed.path?.segments).toHaveLength(1);
    const early = crossed.glyphs.find((glyph) => glyph.id === "ada-early")!;
    const late = crossed.glyphs.find((glyph) => glyph.id === "ada-late")!;
    expect(early.clusterId).toBe("c-exploit");
    expect(late.clusterId).toBe("c-balanced");
    const earlyAngle = Math.atan2(early.y - crossed.map.cy, early.x - crossed.map.cx);
    const lateAngle = Math.atan2(late.y - crossed.map.cy, late.x - crossed.map.cx);
    expect(Math.abs(earlyAngle - lateAngle)).toBeGreaterThan(0.4);
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
    expect(page).toContain("data-knowledge-region-figure-frame");
    expect(page).toContain("data-knowledge-region-figure-zoom-controls");
    expect(page).toContain("data-knowledge-region-figure-zoom-in");
    expect(page).toContain("data-knowledge-region-figure-zoom-out");
    expect(page).toContain("data-knowledge-region-figure-zoom-fit");
    expect(page).toContain("aspect-square");
    expect(page).toContain("knowledgeRegionFigureViewBox");
    expect(page).toContain("data-knowledge-region-figure-mode");
    expect(page).toContain("data-knowledge-region-figure-mode-option");
    expect(page).toContain('data-knowledge-region-figure-mode-option="quadrant"');
    expect(page).toContain("data-knowledge-region-figure-space");
    expect(page).toContain('data-knowledge-region-figure-space-option="full"');
    expect(page).toContain('data-knowledge-region-figure-space-option="quadrant"');
    expect(page).toContain("data-knowledge-region-figure-track");
    expect(page).toContain('data-knowledge-region-figure-track-option="individual"');
    expect(page).toContain('data-knowledge-region-figure-track-option="path"');
    expect(page).toContain("knowledgeRegionFigureMode");
    expect(page).toContain("data-knowledge-region-section");
    expect(page).toContain("knowledgeRegionUnsysDistance");
    expect(page).toContain("data-knowledge-region-identity");
    expect(page).toContain("data-knowledge-region-identity-focus");
    expect(page).toContain("knowledgeRegionFigureFocusOnPoints");
    expect(page).toContain("knowledgeRegionFigureLabelTransform");
    expect(page).toContain("knowledgeRegionFigureOverviewLabels");
    expect(page).toContain("knowledgeRegionFigureShowSegmentLabel");
    expect(page).toContain("knowledgeRegionFigureStepLabelOffset");
    expect(page).toContain('data-knowledge-region-figure-label="step"');
    expect(page).toContain("data-knowledge-region-roster-name");
    expect(page).toContain("parseLtiRosterNames");
    expect(page).toContain("data-knowledge-region-path");
    expect(page).toContain("data-knowledge-region-path-segment");
    expect(page).toContain("data-knowledge-region-on-path");
    expect(page).toContain("createdAt");
    const inspect = readFileSync(
      join(ROOT, "components/product-flow/knowledge-region-inspect.tsx"),
      "utf8",
    );
    expect(inspect).toContain("data-knowledge-region-inspect-tab");
    expect(inspect).toContain("data-knowledge-region-distance-table");
    expect(inspect).toContain("data-knowledge-region-inspect-unsys");
    expect(inspect).toContain("data-knowledge-region-path-table");
    expect(inspect).toContain('data-knowledge-region-inspect-tab="path"');
    expect(inspect).toContain("DataStudioInspectFields");
    expect(inspect).toContain('data-knowledge-region-inspect-tab="record"');
    expect(inspect).toContain('data-knowledge-region-inspect-tab="unsys"');
    expect(inspect).toContain('data-knowledge-region-inspect-panel="unsys"');
    expect(inspect).toContain("data-knowledge-region-distance-table");
    expect(inspect).toContain("WorkspaceUnsysSeedGraph");
    expect(inspect).toContain("visitSequence={visitSequence}");
    expect(inspect).toContain("highlightId={highlightHid}");
    expect(inspect).toContain("onHover={setHoverHid}");
    expect(inspect).toContain("data-knowledge-region-unsys-walk");
    expect(inspect).toContain("data-knowledge-region-unsys-step-id");
    expect(inspect).toContain("data-knowledge-region-unsys-step-current");
    expect(inspect).toContain("onMouseEnter");
    expect(inspect).not.toContain("scrollIntoView");
    const inspectFields = readFileSync(
      join(ROOT, "components/data-studio/DataStudioInspect.tsx"),
      "utf8",
    );
    expect(inspectFields).toContain("data-stored-record");
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
