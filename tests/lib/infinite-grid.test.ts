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
