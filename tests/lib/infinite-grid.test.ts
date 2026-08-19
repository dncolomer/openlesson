import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";
import {
  MAP_INFINITE_GRID,
  MAP_INFINITE_GRID_BACKGROUND,
  MAP_INFINITE_GRID_CELL_PX,
  MAP_INFINITE_GRID_PATTERN_ID,
  MAP_INFINITE_GRID_STROKE,
  mapInfiniteGridPatternAttrs,
  mapInfiniteGridPatternFill,
  mapInfiniteGridPatternPath,
} from "@/lib/map-of-knowledge/infinite-grid";

const root = join(__dirname, "../..");

describe("MAP_INFINITE_GRID tokens", () => {
  it("exposes a single dark infinite-grid system used by all map surfaces", () => {
    expect(MAP_INFINITE_GRID.background).toBe(MAP_INFINITE_GRID_BACKGROUND);
    expect(MAP_INFINITE_GRID.background).toBe("#09090b");
    expect(MAP_INFINITE_GRID.stroke).toBe(MAP_INFINITE_GRID_STROKE);
    expect(MAP_INFINITE_GRID.cellPx).toBe(MAP_INFINITE_GRID_CELL_PX);
    expect(MAP_INFINITE_GRID.patternId).toBe(MAP_INFINITE_GRID_PATTERN_ID);
    expect(MAP_INFINITE_GRID.cellPx).toBeGreaterThan(0);
    expect(MAP_INFINITE_GRID.size3d).toBeGreaterThan(MAP_INFINITE_GRID.divisions3d);
    expect(MAP_INFINITE_GRID.divisions3d).toBeGreaterThan(20);
    expect(MAP_INFINITE_GRID.strokeOpacity).toBeGreaterThan(0);
    expect(MAP_INFINITE_GRID.strokeOpacity).toBeLessThanOrEqual(1);
  });
});

describe("mapInfiniteGridPatternPath / attrs — shipped pure helpers", () => {
  it("builds a repeating cell path from the shared cell size", () => {
    const d = mapInfiniteGridPatternPath(40);
    expect(d).toBe("M 40 0 L 0 0 0 40");
    expect(mapInfiniteGridPatternPath()).toBe(
      `M ${MAP_INFINITE_GRID_CELL_PX} 0 L 0 0 0 ${MAP_INFINITE_GRID_CELL_PX}`,
    );
    // Invalid sizes fall back to the shared token
    expect(mapInfiniteGridPatternPath(0)).toBe(mapInfiniteGridPatternPath());
    expect(mapInfiniteGridPatternPath(NaN)).toBe(mapInfiniteGridPatternPath());
  });

  it("returns SVG pattern attrs matching MAP_INFINITE_GRID tokens", () => {
    const attrs = mapInfiniteGridPatternAttrs("test-grid", 40);
    expect(attrs.id).toBe("test-grid");
    expect(attrs.width).toBe(40);
    expect(attrs.height).toBe(40);
    expect(attrs.patternUnits).toBe("userSpaceOnUse");
    expect(attrs.pathD).toBe(mapInfiniteGridPatternPath(40));
    expect(attrs.stroke).toBe(MAP_INFINITE_GRID_STROKE);
    expect(attrs.strokeWidth).toBe(0.5);
    expect(mapInfiniteGridPatternFill("test-grid")).toBe("url(#test-grid)");
    expect(mapInfiniteGridPatternFill()).toBe(`url(#${MAP_INFINITE_GRID_PATTERN_ID})`);
  });
});

describe("Map infinite-grid surfaces — no axes, shared treatment", () => {
  it("Local 2D, Local 3D, Global, and workspace Local use shared infinite grid and drop axes", () => {
    const twoD = join(root, "components/MapOfKnowledge2D.tsx");
    const threeD = join(root, "components/MapOfKnowledge3D.tsx");
    const global = join(root, "components/MapOfKnowledgeGlobal.tsx");
    const knowledge = join(root, "components/KnowledgeConfigTrajectoryPanel.tsx");
    const tokens = join(root, "lib/map-of-knowledge/infinite-grid.ts");

    expect(existsSync(twoD)).toBe(true);
    expect(existsSync(threeD)).toBe(true);
    expect(existsSync(global)).toBe(true);
    expect(existsSync(knowledge)).toBe(true);
    expect(existsSync(tokens)).toBe(true);

    const twoDSrc = readFileSync(twoD, "utf8");
    const threeDSrc = readFileSync(threeD, "utf8");
    const globalSrc = readFileSync(global, "utf8");
    const knowledgeSrc = readKnowledgePanelSurface();
    const tokensSrc = readFileSync(tokens, "utf8");

    // Shared module is the source of visual tokens
    expect(tokensSrc).toContain("MAP_INFINITE_GRID");
    expect(tokensSrc).toContain("mapInfiniteGridPatternAttrs");
    expect(tokensSrc).toContain("#09090b");

    // Every map surface wires the shared grid
    for (const src of [twoDSrc, threeDSrc, globalSrc, knowledgeSrc]) {
      expect(src).toContain("MAP_INFINITE_GRID");
      expect(src).toContain("data-map-infinite-grid");
    }

    expect(twoDSrc).toContain("mapInfiniteGridPatternAttrs");
    expect(twoDSrc).toContain("data-map-infinite-grid-surface=\"local-2d\"");
    expect(globalSrc).toContain("mapInfiniteGridPatternAttrs");
    expect(globalSrc).toContain("data-map-infinite-grid-surface=\"global\"");
    // Screen-space grid sits outside Global pan/zoom viewport
    const globalGridIdx = globalSrc.indexOf('data-map-infinite-grid-surface="global"');
    const viewportIdx = globalSrc.indexOf("data-map-global-viewport");
    expect(globalGridIdx).toBeGreaterThan(-1);
    expect(viewportIdx).toBeGreaterThan(globalGridIdx);

    // No axis helpers on 3D or workspace Local canvas
    expect(threeDSrc).not.toMatch(/AxesHelper\s*\(/);
    expect(threeDSrc).not.toContain("AXIS_COLOR");
    expect(threeDSrc).toContain("MAP_INFINITE_GRID.size3d");
    expect(threeDSrc).toContain("data-map-infinite-grid-surface");
    // Finite soft floor disc removed in favor of large grid plane
    expect(threeDSrc).not.toContain("CircleGeometry(12");

    expect(knowledgeSrc).not.toContain("data-projection-axes");
    expect(knowledgeSrc).not.toContain("data-projection-tick-x");
    expect(knowledgeSrc).not.toContain("data-projection-tick-y");
    expect(knowledgeSrc).not.toContain("projection x");
    expect(knowledgeSrc).not.toContain("projection y");
    expect(knowledgeSrc).not.toContain("generateGridTicks");
    expect(knowledgeSrc).toContain("data-map-infinite-grid-surface=\"workspace-local\"");
    expect(knowledgeSrc).toContain("mapInfiniteGridPatternAttrs");
  });
});
