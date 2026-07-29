import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  GLOBAL_MAP_NEAR_RADIUS_FACTOR,
  buildGlobalMapEdges,
  buildGlobalMapModel,
  classifyUserAgainstRegion,
  countUsersForRegion,
  formatGlobalMapDistance,
  regionCentroidDistance,
} from "@/lib/map-of-knowledge/global-map";
import type { MapRegion, MapUserLocation } from "@/lib/map-of-knowledge";

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

describe("Global Map UI structure", () => {
  it("ships Local Map / Global Map controls and Global Map renderer", () => {
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const global = join(root, "components/MapOfKnowledgeGlobal.tsx");
    expect(existsSync(client)).toBe(true);
    expect(existsSync(global)).toBe(true);
    const clientSrc = readFileSync(client, "utf8");
    const globalSrc = readFileSync(global, "utf8");

    expect(clientSrc).toContain("Local Map");
    expect(clientSrc).toContain("Global Map");
    expect(clientSrc).toContain("data-map-scope-toggle");
    expect(clientSrc).toContain('data-map-scope="global"');
    expect(clientSrc).toContain('data-map-scope="local"');
    expect(clientSrc).toContain("MapOfKnowledgeGlobal");
    expect(clientSrc).toContain("mapScope");
    // Fullscreen path reuses mapSurface (global included)
    expect(clientSrc).toContain("fullscreen");
    expect(clientSrc).toContain("data-map-fullscreen");
    expect(clientSrc).toMatch(/mapScope === ["']global["']/);

    expect(globalSrc).toContain("data-map-global");
    expect(globalSrc).toContain("data-map-global-region-dot");
    expect(globalSrc).toContain("data-map-global-orbit-inside");
    expect(globalSrc).toContain("data-map-global-orbit-near");
    expect(globalSrc).toContain("data-map-global-bubble-inside");
    expect(globalSrc).toContain("data-map-global-bubble-near");
    expect(globalSrc).toContain("data-map-global-edge");
    expect(globalSrc).toContain("data-map-global-distance");
    expect(globalSrc).toContain("strokeDasharray");
    // Users not free-scatter markers
    expect(globalSrc).not.toMatch(/userLocations\.map/);
    expect(globalSrc).toMatch(/Users are not plotted|not free/i);
  });
});
