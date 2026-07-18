import { describe, expect, it } from "vitest";
import {
  buildOccupancyFromPlaced,
  canPlaceFootprint,
  footprintCells,
  footprintFromCells,
  mergeBlockFootprints,
  relativeOffsets,
  splitBlocksToSingles,
  splitFootprintToSingles,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { getCellKey } from "@/lib/block-skill-grid";

describe("skill-grid multi-select geometry", () => {
  it("builds a combined-shape footprint from selected empty cells", () => {
    const fp = footprintFromCells([
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
    ]);
    expect(fp).toEqual({ position_x: 2, position_y: 1, span_w: 2, span_h: 2 });
    expect(footprintCells(fp!).length).toBe(4);
  });

  it("merges multiple block footprints into one larger rectangle", () => {
    const blocks: PlacedBlockRef[] = [
      { id: "a", position_x: 0, position_y: 0, span_w: 1, span_h: 1 },
      { id: "b", position_x: 1, position_y: 0, span_w: 1, span_h: 1 },
      { id: "c", position_x: 0, position_y: 1, span_w: 2, span_h: 1 },
    ];
    const merged = mergeBlockFootprints(blocks);
    expect(merged).toEqual({ position_x: 0, position_y: 0, span_w: 2, span_h: 2 });
  });

  it("splits a multi-cell footprint back to single squares", () => {
    const singles = splitFootprintToSingles({
      position_x: -1,
      position_y: 0,
      span_w: 2,
      span_h: 2,
    });
    expect(singles).toHaveLength(4);
    expect(singles.every((s) => s.span_w === 1 && s.span_h === 1)).toBe(true);
    expect(singles.map((s) => `${s.position_y},${s.position_x}`).sort()).toEqual([
      "0,-1",
      "0,0",
      "1,-1",
      "1,0",
    ]);
  });

  it("splits multiple blocks into per-cell singles tagged by source id", () => {
    const result = splitBlocksToSingles([
      { id: "big", position_x: 0, position_y: 0, span_w: 2, span_h: 1 },
      { id: "one", position_x: 3, position_y: 1 },
    ]);
    expect(result).toHaveLength(3);
    expect(result.filter((r) => r.sourceId === "big")).toHaveLength(2);
    expect(result.find((r) => r.sourceId === "one")).toMatchObject({
      position_x: 3,
      position_y: 1,
      span_w: 1,
      span_h: 1,
    });
  });

  it("translates multiple blocks together preserving relative shape", () => {
    const moving: PlacedBlockRef[] = [
      { id: "a", position_x: 0, position_y: 0 },
      { id: "b", position_x: 1, position_y: 0 },
      { id: "c", position_x: 0, position_y: 1 },
    ];
    const occupancy = buildOccupancyFromPlaced([
      ...moving,
      { id: "other", position_x: 5, position_y: 5 },
    ]);
    const next = translateBlocksPreservingShape(moving, 2, 3, occupancy);
    expect(next).not.toBeNull();
    expect(next).toEqual([
      { id: "a", position_x: 3, position_y: 2, span_w: 1, span_h: 1 },
      { id: "b", position_x: 4, position_y: 2, span_w: 1, span_h: 1 },
      { id: "c", position_x: 3, position_y: 3, span_w: 1, span_h: 1 },
    ]);
    const offsetsBefore = relativeOffsets(moving);
    const offsetsAfter = relativeOffsets(next!);
    for (const id of ["a", "b", "c"]) {
      expect(offsetsAfter.get(id)).toEqual(offsetsBefore.get(id));
    }
  });

  it("rejects multi-move when any target cell collides with a non-moving occupant", () => {
    const moving: PlacedBlockRef[] = [
      { id: "a", position_x: 0, position_y: 0 },
      { id: "b", position_x: 1, position_y: 0 },
    ];
    const occupancy = buildOccupancyFromPlaced([
      ...moving,
      { id: "wall", position_x: 2, position_y: 0 },
    ]);
    // Move +1 col would put b onto wall
    expect(translateBlocksPreservingShape(moving, 0, 1, occupancy)).toBeNull();
  });

  it("allows multi-move into cells vacated by the same selection", () => {
    const moving: PlacedBlockRef[] = [
      { id: "a", position_x: 0, position_y: 0 },
      { id: "b", position_x: 1, position_y: 0 },
    ];
    const occupancy = buildOccupancyFromPlaced(moving);
    const next = translateBlocksPreservingShape(moving, 0, 1, occupancy);
    expect(next).toEqual([
      { id: "a", position_x: 1, position_y: 0, span_w: 1, span_h: 1 },
      { id: "b", position_x: 2, position_y: 0, span_w: 1, span_h: 1 },
    ]);
  });

  it("checks combined-shape placement against occupancy", () => {
    const occupancy = new Map<string, string>([[getCellKey(0, 1), "x"]]);
    expect(
      canPlaceFootprint({ position_x: 0, position_y: 0, span_w: 2, span_h: 1 }, occupancy),
    ).toBe(false);
    expect(
      canPlaceFootprint({ position_x: 0, position_y: 0, span_w: 2, span_h: 1 }, occupancy, ["x"]),
    ).toBe(true);
    expect(
      canPlaceFootprint({ position_x: 2, position_y: 0, span_w: 2, span_h: 2 }, occupancy),
    ).toBe(true);
  });
});
