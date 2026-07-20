import { describe, expect, it } from "vitest";
import {
  areBlocksContiguous,
  blocksShareEdge,
  buildOccupancyFromPlaced,
  canPlaceFootprint,
  footprintCells,
  footprintFromCells,
  mergeBlockFootprints,
  canPlaceAbsoluteCells,
  cellsAreContiguous,
  freeformCellExternalEdges,
  freeformLabelCell,
  freeformShapeFromCells,
  freeformShapeKeySet,
  freeformTilePixelSize,
  occupiedCellsInFootprint,
  relativeOffsets,
  selectionIsFreeformLectureShape,
  selectionIsSolidRectangle,
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

  it("freeform tile geometry fills gaps and only draws outer edges", () => {
    const L = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ];
    const keys = freeformShapeKeySet(L);
    // Cell (0,0) has neighbors right and bottom inside the shape
    const originEdges = freeformCellExternalEdges({ row: 0, col: 0 }, keys);
    expect(originEdges).toEqual({ top: true, right: false, bottom: false, left: true });
    const originSize = freeformTilePixelSize({ row: 0, col: 0 }, keys, 92, 10);
    expect(originSize).toEqual({ width: 102, height: 102 }); // extends into both gaps
    // Tip of L (0,1): only left neighbor in shape
    const tipEdges = freeformCellExternalEdges({ row: 0, col: 1 }, keys);
    expect(tipEdges.left).toBe(false);
    expect(tipEdges.right).toBe(true);
    expect(tipEdges.top).toBe(true);
    expect(tipEdges.bottom).toBe(true);
    const tipSize = freeformTilePixelSize({ row: 0, col: 1 }, keys, 92, 10);
    expect(tipSize).toEqual({ width: 92, height: 92 });
    // Label near centroid of L
    const label = freeformLabelCell(L);
    expect(keys.has(`${label.row}:${label.col}`)).toBe(true);
  });

  it("allows freeform contiguous L-shapes and rejects diagonal gaps", () => {
    const L = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ];
    expect(cellsAreContiguous(L)).toBe(true);
    const free = selectionIsFreeformLectureShape(L);
    expect(free.ok).toBe(true);
    expect(free.reason).toBe("ok");
    expect(free.shape_cells).toEqual([
      { dr: 0, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
    ]);
    // L-shape placement only needs the 3 selected cells free (hole may be occupied)
    const occupancy = buildOccupancyFromPlaced([
      { id: "wall", position_x: 1, position_y: 1, span_w: 1, span_h: 1 },
    ]);
    expect(canPlaceAbsoluteCells(L, occupancy)).toBe(true);
    // Bounding-box canPlace would still fail — freeform must not use that
    const fp = footprintFromCells(L)!;
    expect(canPlaceFootprint(fp, occupancy)).toBe(false);

    // Diagonal-only is not contiguous
    const diag = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ];
    expect(cellsAreContiguous(diag)).toBe(false);
    expect(selectionIsFreeformLectureShape(diag).reason).toBe("not_contiguous");

    // Solid rectangle still works; shape_cells null for storage
    const full = freeformShapeFromCells([
      ...L,
      { row: 1, col: 1 },
    ])!;
    expect(full.isSolidRectangle).toBe(true);
    expect(selectionIsSolidRectangle([...L, { row: 1, col: 1 }]).ok).toBe(true);
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

  it("detects edge adjacency and contiguity of selected blocks", () => {
    const a: PlacedBlockRef = { id: "a", position_x: 0, position_y: 0, span_w: 1, span_h: 1 };
    const b: PlacedBlockRef = { id: "b", position_x: 1, position_y: 0, span_w: 1, span_h: 1 };
    const c: PlacedBlockRef = { id: "c", position_x: 3, position_y: 0, span_w: 1, span_h: 1 };
    const wide: PlacedBlockRef = { id: "w", position_x: 0, position_y: 1, span_w: 2, span_h: 1 };

    expect(blocksShareEdge(a, b)).toBe(true);
    expect(blocksShareEdge(a, c)).toBe(false);
    // Diagonal-only is not contiguous
    expect(
      blocksShareEdge(
        { id: "d1", position_x: 0, position_y: 0 },
        { id: "d2", position_x: 1, position_y: 1 },
      ),
    ).toBe(false);

    expect(areBlocksContiguous([])).toBe(false);
    expect(areBlocksContiguous([a])).toBe(true);
    expect(areBlocksContiguous([a, b])).toBe(true);
    expect(areBlocksContiguous([a, c])).toBe(false);
    // a-b-wide form a connected L (wide touches both a and b from below)
    expect(areBlocksContiguous([a, b, wide])).toBe(true);
    // a and c with no bridge
    expect(areBlocksContiguous([a, b, c])).toBe(false);
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
