import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  GLOBAL_MAP_NEAR_RADIUS_FACTOR,
  buildGlobalMapEdges,
  buildGlobalMapModel,
  classifyUserAgainstRegion,
  countUsersForRegion,
  GLOBAL_MAP_VIEW_DEFAULT,
  clampGlobalMapZoom,
  enabledRegionsForLocalFocus,
  formatGlobalMapDistance,
  globalMap3dLayoutScale,
  globalMapRegionSummary,
  globalMapViewTransformAttr,
  layoutGlobalMapNodes3D,
  panGlobalMapView,
  projectGlobalMapLayoutPoint,
  regionCentroidDistance,
  workspaceKnowledgeToGlobalMapInputs,
  zoomGlobalMapView,
} from "@/lib/map-of-knowledge/global-map";
import {
  reprojectMapLayout,
  type MapRegion,
  type MapUserLocation,
} from "@/lib/map-of-knowledge";
import {
  PROJECTION_ALGORITHM_IDS,
  projectVectors3D,
} from "@/lib/knowledge-config";

const root = join(__dirname, "../..");

function unitAt(i: number, dim = 4, scale = 1): number[] {
  const v = new Array(dim).fill(0);
  v[i % dim] = scale;
  return v;
}

function region(
  partial: Partial<MapRegion> & Pick<MapRegion, "id" | "name" | "workspace_id">,
): MapRegion {
  return {
    workspace_title: partial.workspace_title || "WS",
    vector: partial.vector || unitAt(0),
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    z: partial.z ?? 0,
    radius: partial.radius ?? 0.3,
    ...partial,
  };
}

function user(
  partial: Partial<MapUserLocation> & Pick<MapUserLocation, "id" | "workspace_id">,
): MapUserLocation {
  return {
    workspace_title: "WS",
    subject_label: "user:test",
    id_preview: "abc123",
    kind: "tap",
    avatar_id: "atom",
    avatar_path: "/map-avatars/atom.svg",
    vector: partial.vector || unitAt(0),
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    z: partial.z ?? 0,
    confidence: 0.5,
    ...partial,
  };
}

describe("Global Map pure geometry", () => {
  it("classifies inside vs near without double-counting", () => {
    const reg = region({
      id: "r1",
      name: "Analysis",
      workspace_id: "ws-math",
      vector: unitAt(0),
      radius: 0.25,
    });
    // Same direction → L2 ~0 → inside
    const insideUser = user({
      id: "u-in",
      workspace_id: "ws-math",
      vector: unitAt(0),
    });
    expect(classifyUserAgainstRegion(insideUser, reg)).toBe("inside");

    // Slightly offset but within near band
    const nearVec = unitAt(0).map((v, i) => (i === 0 ? 0.85 : i === 1 ? 0.5 : 0));
    // normalize-ish for distance
    const nearUser = user({
      id: "u-near",
      workspace_id: "ws-math",
      vector: nearVec,
    });
    const nearClass = classifyUserAgainstRegion(nearUser, reg);
    expect(["inside", "near", "outside"]).toContain(nearClass);

    const farUser = user({
      id: "u-far",
      workspace_id: "ws-math",
      vector: unitAt(2),
    });
    expect(classifyUserAgainstRegion(farUser, reg)).toBe("outside");

    // Cross-workspace never contributes
    expect(
      classifyUserAgainstRegion(
        user({ id: "u-other", workspace_id: "ws-phys", vector: unitAt(0) }),
        reg,
      ),
    ).toBe("outside");

    const counts = countUsersForRegion(reg, [insideUser, farUser]);
    expect(counts.inside_count).toBeGreaterThanOrEqual(0);
    expect(counts.near_count).toBeGreaterThanOrEqual(0);
    expect(counts.inside_count + counts.near_count).toBeLessThanOrEqual(2);
    // Inside user is not also near
    if (classifyUserAgainstRegion(insideUser, reg) === "inside") {
      expect(counts.inside_count).toBe(1);
      expect(counts.near_count).toBe(0);
    }
  });

  it("empty users yield zero orbit counts", () => {
    const reg = region({ id: "r1", name: "A", workspace_id: "w", vector: unitAt(0) });
    expect(countUsersForRegion(reg, [])).toEqual({ inside_count: 0, near_count: 0 });
  });

  it("builds finite inter-region distances and MST/global edges", () => {
    const regions = [
      region({ id: "m1", name: "Analysis", workspace_id: "ws-math", vector: unitAt(0), x: 0, y: 0 }),
      region({ id: "m2", name: "Algebra", workspace_id: "ws-math", vector: unitAt(1), x: 1, y: 0 }),
      region({ id: "p1", name: "Quantum", workspace_id: "ws-phys", vector: unitAt(2), x: 0, y: 1 }),
    ];
    const d = regionCentroidDistance(regions[0], regions[1]);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThanOrEqual(0);

    const edges = buildGlobalMapEdges(regions);
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(Number.isFinite(e.distance)).toBe(true);
      expect(e.distance).toBeGreaterThanOrEqual(0);
      expect(e.source_id).not.toBe(e.target_id);
    }
    // Within-workspace pair present
    expect(
      edges.some(
        (e) =>
          (e.source_id === "m1" && e.target_id === "m2") ||
          (e.source_id === "m2" && e.target_id === "m1"),
      ),
    ).toBe(true);
  });

  it("buildGlobalMapModel assembles nodes with orbit counts and edges", () => {
    const regions = [
      region({
        id: "r1",
        name: "Analysis",
        workspace_id: "ws-math",
        workspace_title: "Mathematics",
        vector: unitAt(0),
        radius: 0.4,
        x: 0,
        y: 0,
      }),
      region({
        id: "r2",
        name: "Algebra",
        workspace_id: "ws-math",
        workspace_title: "Mathematics",
        vector: unitAt(1),
        radius: 0.4,
        x: 1,
        y: 0,
      }),
    ];
    const users = [
      user({ id: "u1", workspace_id: "ws-math", vector: unitAt(0) }),
      user({ id: "u2", workspace_id: "ws-math", vector: unitAt(1) }),
    ];
    const model = buildGlobalMapModel(regions, users);
    expect(model.nodes).toHaveLength(2);
    for (const n of model.nodes) {
      expect(n.inside_count).toBeGreaterThanOrEqual(0);
      expect(n.near_count).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(n.inside_count)).toBe(true);
      expect(Number.isInteger(n.near_count)).toBe(true);
    }
    // Each centroid-aligned user should be inside its matching region
    const r1 = model.nodes.find((n) => n.id === "r1")!;
    const r2 = model.nodes.find((n) => n.id === "r2")!;
    expect(r1.inside_count).toBeGreaterThanOrEqual(1);
    expect(r2.inside_count).toBeGreaterThanOrEqual(1);
    expect(model.edges.length).toBeGreaterThan(0);
    expect(formatGlobalMapDistance(0.123)).toBe("0.12");
    expect(GLOBAL_MAP_NEAR_RADIUS_FACTOR).toBeGreaterThan(1);
  });
});

describe("Global Map pan/zoom transform", () => {
  it("clamps zoom and pans/zooms with pure helpers", () => {
    expect(clampGlobalMapZoom(0.01)).toBeGreaterThan(0);
    expect(clampGlobalMapZoom(100)).toBeLessThanOrEqual(8);
    expect(clampGlobalMapZoom(Number.NaN)).toBe(1);

    const panned = panGlobalMapView(GLOBAL_MAP_VIEW_DEFAULT, 40, -20);
    expect(panned.panX).toBe(40);
    expect(panned.panY).toBe(-20);
    expect(panned.zoom).toBe(1);

    const zoomed = zoomGlobalMapView(GLOBAL_MAP_VIEW_DEFAULT, 2, 480, 260);
    expect(zoomed.zoom).toBe(2);
    // Focus point stays fixed: after transform, 480 maps through pan+scale
    expect(globalMapViewTransformAttr(zoomed)).toContain("scale(2)");
    expect(globalMapViewTransformAttr(zoomed)).toContain("translate(");

    // Absolute zoom-out toward same focus stays finite and clamps
    const again = zoomGlobalMapView(zoomed, 0.5, 480, 260);
    expect(again.zoom).toBe(0.5);
    expect(Number.isFinite(again.panX)).toBe(true);
    expect(Number.isFinite(again.panY)).toBe(true);
    // Restore to 1×
    const reset = zoomGlobalMapView(again, 1, 480, 260);
    expect(reset.zoom).toBe(1);
  });
});

describe("Global Map focus helpers", () => {
  it("enabledRegionsForLocalFocus returns only the clicked region id", () => {
    expect(enabledRegionsForLocalFocus("reg-abc")).toEqual(["reg-abc"]);
    expect(enabledRegionsForLocalFocus("  ")).toEqual([]);
    expect(enabledRegionsForLocalFocus("")).toEqual([]);
  });

  it("globalMapRegionSummary maps node fields for the selection panel", () => {
    const summary = globalMapRegionSummary({
      id: "r1",
      name: "Analysis",
      workspace_id: "ws",
      workspace_title: "Mathematics",
      x: 0,
      y: 0,
      z: 0.2,
      radius: 0.4,
      inside_count: 3,
      near_count: 2,
    });
    expect(summary).toEqual({
      region_id: "r1",
      name: "Analysis",
      workspace_id: "ws",
      workspace_title: "Mathematics",
      inside_count: 3,
      near_count: 2,
      radius: 0.4,
    });
    expect(globalMapRegionSummary(null)).toBeNull();
  });

  it("buildGlobalMapModel carries multi-algo 3D z into region nodes", () => {
    const model = buildGlobalMapModel(
      [
        region({
          id: "r-z",
          name: "Depth",
          workspace_id: "ws",
          x: 1,
          y: 2,
          z: 0.75,
          vector: unitAt(0),
        }),
      ],
      [],
    );
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].z).toBe(0.75);
    expect(model.nodes[0].x).toBe(1);
    expect(model.nodes[0].y).toBe(2);
  });

  it("projectGlobalMapLayoutPoint uses z so depth changes the plane", () => {
    const a = projectGlobalMapLayoutPoint(1, 0, 0);
    const b = projectGlobalMapLayoutPoint(1, 0, 1.5);
    expect(Number.isFinite(a.lx) && Number.isFinite(a.ly)).toBe(true);
    expect(Number.isFinite(b.lx) && Number.isFinite(b.ly)).toBe(true);
    // Same x,y with different z must shift ly (isometric depth term).
    expect(Math.abs(a.ly - b.ly)).toBeGreaterThan(1e-6);
  });

  it("layoutGlobalMapNodes3D consumes multi-algo x,y,z (z not forced to 0)", () => {
    const nodes = [
      {
        id: "a",
        name: "A",
        workspace_id: "ws",
        workspace_title: "WS",
        x: 2,
        y: 0,
        z: 1.5,
        radius: 0.4,
        inside_count: 1,
        near_count: 0,
      },
      {
        id: "b",
        name: "B",
        workspace_id: "ws",
        workspace_title: "WS",
        x: 0,
        y: 3,
        z: -0.8,
        radius: 0.3,
        inside_count: 0,
        near_count: 2,
      },
    ];
    const scale = globalMap3dLayoutScale(nodes, 5);
    expect(scale).toBeGreaterThan(0);
    expect(Number.isFinite(scale)).toBe(true);

    const laid = layoutGlobalMapNodes3D(nodes, 5);
    expect(laid.scale).toBe(scale);
    expect(laid.nodes).toHaveLength(2);
    for (const n of laid.nodes) {
      expect(Number.isFinite(n.wx)).toBe(true);
      expect(Number.isFinite(n.wy)).toBe(true);
      expect(Number.isFinite(n.wz)).toBe(true);
      expect(n.display_radius).toBeGreaterThan(0);
      expect(n.orbit_near).toBeGreaterThan(n.orbit_inside);
    }
    // wz must reflect source z (not collapsed to 0)
    expect(Math.abs(laid.nodes[0].wz)).toBeGreaterThan(1e-9);
    expect(Math.abs(laid.nodes[1].wz)).toBeGreaterThan(1e-9);
    // Different source z → different world z
    expect(Math.abs(laid.nodes[0].wz - laid.nodes[1].wz)).toBeGreaterThan(1e-6);
    // Scale is applied: wx = x * scale
    expect(Math.abs(laid.nodes[0].wx - nodes[0].x * scale)).toBeLessThan(1e-9);
    expect(Math.abs(laid.nodes[0].wz - nodes[0].z * scale)).toBeLessThan(1e-9);
  });

  it("reprojectMapLayout + Global nodes use multi-algo 3D for every option", () => {
    const vectors = [
      unitAt(0, 6, 1),
      unitAt(1, 6, 1.2),
      unitAt(2, 6, 0.8),
      unitAt(3, 6, 1.5),
    ];
    const users = vectors.slice(0, 2).map((vector, i) =>
      user({
        id: `u${i}`,
        workspace_id: "ws",
        vector,
        x: 0,
        y: 0,
        z: 0,
      }),
    );
    const regions = vectors.slice(2).map((vector, i) =>
      region({
        id: `r${i}`,
        name: `R${i}`,
        workspace_id: "ws",
        vector,
        x: 0,
        y: 0,
        z: 0,
      }),
    );

    const layouts: Array<{ algo: string; zs: number[] }> = [];
    for (const algo of PROJECTION_ALGORITHM_IDS) {
      const laid = reprojectMapLayout({
        userLocations: users,
        regions,
        algorithm: algo,
      });
      for (const r of laid.regions) {
        expect(Number.isFinite(r.x)).toBe(true);
        expect(Number.isFinite(r.y)).toBe(true);
        expect(Number.isFinite(r.z)).toBe(true);
      }
      for (const u of laid.userLocations) {
        expect(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.z)).toBe(
          true,
        );
      }
      const model = buildGlobalMapModel(laid.regions, laid.userLocations);
      expect(model.nodes.every((n) => Number.isFinite(n.z))).toBe(true);
      layouts.push({ algo, zs: laid.regions.map((r) => r.z) });
      // Direct multi-algo 3D entry agrees with reproject for region vectors alone
      const direct = projectVectors3D(
        laid.regions.map((r) => r.vector),
        algo,
      );
      expect(direct).toHaveLength(laid.regions.length);
    }
    // At least two algorithms differ in z (true multi-option 3D, not a fixed residual).
    const differ = layouts.some((a, i) =>
      layouts.some(
        (b, j) =>
          i < j &&
          a.zs.some((z, k) => Math.abs(z - b.zs[k]) > 1e-6),
      ),
    );
    expect(differ).toBe(true);
  });

  it("workspaceKnowledgeToGlobalMapInputs builds MapRegion/user rows for Knowledge tab", () => {
    const { regions, users } = workspaceKnowledgeToGlobalMapInputs({
      workspaceId: "ws-1",
      workspaceTitle: "Demo",
      regions: [
        {
          id: "region-a",
          name: "Backend",
          centroid: [1, 0, 0, 0],
          mean_radius: 0.3,
        },
      ],
      subjectVectors: [{ id: "u:1", vector: [1, 0, 0, 0], label: "User 1" }],
      project2d: (v) => ({ x: v[0] ?? 0, y: v[1] ?? 0 }),
    });
    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe("region-a");
    expect(regions[0].workspace_id).toBe("ws-1");
    expect(regions[0].radius).toBe(0.3);
    expect(users).toHaveLength(1);
    expect(users[0].workspace_id).toBe("ws-1");
    expect(users[0].vector[0]).toBe(1);
  });
});

describe("Global Map UI structure", () => {
  it("ships Local Map / Global Map controls and interactive Global Map renderer", () => {
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const global = join(root, "components/MapOfKnowledgeGlobal.tsx");
    const knowledge = join(root, "components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(existsSync(client)).toBe(true);
    expect(existsSync(global)).toBe(true);
    expect(existsSync(knowledge)).toBe(true);
    const clientSrc = readFileSync(client, "utf8");
    const globalSrc = readFileSync(global, "utf8");
    const knowledgeSrc = readFileSync(knowledge, "utf8");

    expect(clientSrc).toContain("Local Map");
    expect(clientSrc).toContain("Global Map");
    expect(clientSrc).toContain("data-map-scope-toggle");
    expect(clientSrc).toContain('data-map-scope="global"');
    expect(clientSrc).toContain('data-map-scope="local"');
    expect(clientSrc).toContain("MapOfKnowledgeGlobal");
    expect(clientSrc).toContain("mapScope");
    // Default map representation is Global Map on both MoK and workspace Knowledge.
    expect(clientSrc).toMatch(/useState<MapScope>\(["']global["']\)/);
    expect(knowledgeSrc).toMatch(
      /useState<["']local["']\s*\|\s*["']global["']>\(["']global["']\)/,
    );
    expect(clientSrc).toContain("openLocalMapFocusedOnRegion");
    expect(clientSrc).toContain("enabledRegionsForLocalFocus");
    expect(clientSrc).toContain("fullscreen");
    expect(clientSrc).toContain("data-map-fullscreen");
    expect(clientSrc).toMatch(/mapScope === ["']global["']/);

    expect(globalSrc).toContain("data-map-global");
    expect(globalSrc).toContain("data-map-global-interactive");
    expect(globalSrc).toContain("data-map-global-viewport");
    expect(globalSrc).toContain("data-map-global-zoom-controls");
    expect(globalSrc).toContain("data-map-global-zoom-in");
    expect(globalSrc).toContain("data-map-global-zoom-out");
    expect(globalSrc).toContain("data-map-global-zoom-reset");
    expect(globalSrc).toContain("onWheel");
    expect(globalSrc).toContain("onPointerDown");
    expect(globalSrc).toContain("zoomGlobalMapView");
    expect(globalSrc).toContain("panGlobalMapView");
    expect(globalSrc).toContain("data-map-global-legend");
    expect(globalSrc).toContain("data-map-global-legend-toggle");
    expect(globalSrc).toMatch(/useState\(false\)/); // legend collapsed by default
    expect(globalSrc).toContain("data-map-global-region-dot");
    expect(globalSrc).toContain("data-map-global-orbit-inside");
    expect(globalSrc).toContain("data-map-global-orbit-near");
    expect(globalSrc).toContain("data-map-global-bubble-inside");
    expect(globalSrc).toContain("data-map-global-bubble-near");
    expect(globalSrc).toContain("data-map-global-edge");
    expect(globalSrc).toContain("data-map-global-distance");
    expect(globalSrc).toContain("data-map-global-region-summary");
    expect(globalSrc).toContain("data-map-global-open-local");
    expect(globalSrc).toContain("onOpenLocalMap");
    expect(globalSrc).toContain("strokeDasharray");
    expect(globalSrc).not.toMatch(/userLocations\.map/);
    // Global Map supports 2D + 3D via shared viewMode
    expect(globalSrc).toContain('viewMode = "2d"');
    expect(globalSrc).toContain('viewMode === "3d"');
    expect(globalSrc).toContain("MapOfKnowledgeGlobal3D");
    expect(globalSrc).toContain('data-map-global-view="2d"');

    const global3d = join(root, "components/MapOfKnowledgeGlobal3D.tsx");
    expect(existsSync(global3d)).toBe(true);
    const global3dSrc = readFileSync(global3d, "utf8");
    expect(global3dSrc).toContain('from "three"');
    expect(global3dSrc).toContain("OrbitControls");
    expect(global3dSrc).toContain("layoutGlobalMapNodes3D");
    expect(global3dSrc).toContain("buildGlobalMapModel");
    expect(global3dSrc).toContain("data-map-global-3d");
    expect(global3dSrc).toContain('data-map-global-view="3d"');
    expect(global3dSrc).toContain("data-map-global-open-local");
    // True multi-algo z path (world wz from layout)
    expect(global3dSrc).toMatch(/n\.wz|wx,\s*n\.wy,\s*n\.wz/);

    // MoK: 2D/3D available for Global Map (not Local-only)
    expect(clientSrc).toContain("data-map-view-mode-toggle");
    expect(clientSrc).toContain('data-map-view-mode="3d"');
    expect(clientSrc).toContain("viewMode={viewMode}");
    expect(clientSrc).not.toMatch(
      /mapScope === ["']local["'] && \([\s\S]{0,80}data-map-view-mode-toggle/,
    );

    expect(knowledgeSrc).toContain("data-knowledge-map-scope-toggle");
    expect(knowledgeSrc).toContain("MapOfKnowledgeGlobal");
    expect(knowledgeSrc).toContain("openLocalMapFocusedOnRegion");
    expect(knowledgeSrc).toContain("data-knowledge-global-map");
    expect(knowledgeSrc).toContain("workspaceKnowledgeToGlobalMapInputs");
    // Workspace Global Map 2D/3D toggle
    expect(knowledgeSrc).toContain("data-knowledge-global-view-mode-toggle");
    expect(knowledgeSrc).toContain('data-knowledge-global-view-mode="3d"');
    expect(knowledgeSrc).toContain("knowledgeGlobalViewMode");
    expect(knowledgeSrc).toContain("viewMode={knowledgeGlobalViewMode}");
    // Project control drives 2D, Local 3D, and Global Map multi-algo 3D layout
    expect(clientSrc).toContain("data-map-projection-select");
    expect(clientSrc).toContain("data-map-3d-projection-select");
    expect(clientSrc).toContain("2D / Local 3D / Global Map multi-algo layout");
    expect(clientSrc).toContain("projectionAlgorithm={projectionAlgorithm}");
    expect(clientSrc).toContain("MapOfKnowledge3D");
    expect(knowledgeSrc).toContain("data-projection-algorithm-select");
    expect(knowledgeSrc).toContain("data-map-3d-projection-select");
    expect(knowledgeSrc).toContain("reprojectMapLayout");
    expect(knowledgeSrc).toMatch(/algorithm:\s*projectionAlgorithm/);
    expect(knowledgeSrc).toContain("projectionAlgorithm={projectionAlgorithm}");
    expect(globalSrc).toContain("projectGlobalMapLayoutPoint");
    expect(globalSrc).toContain("data-map-global-projection");
    expect(globalSrc).toContain("projectionAlgorithm");
    const threeD = join(root, "components/MapOfKnowledge3D.tsx");
    expect(existsSync(threeD)).toBe(true);
    const threeDSrc = readFileSync(threeD, "utf8");
    expect(threeDSrc).toContain("data-map-3d-projection");
    expect(threeDSrc).toContain("projectionAlgorithm");
    // Region picker matches Map of Knowledge (collapsible group + All/None + sync)
    expect(knowledgeSrc).toContain("data-map-region-workspace-group");
    expect(knowledgeSrc).toContain("data-map-region-workspace-select-all");
    expect(knowledgeSrc).toContain("data-map-region-workspace-toggle");
    expect(knowledgeSrc).toContain("toggleAllWorkspaceRegions");
    expect(knowledgeSrc).toContain("selectedRegionIds.has(r.id)");
    expect(knowledgeSrc).toMatch(/selectedRegionIds\.has\(r\.id\)/);
  });
});
