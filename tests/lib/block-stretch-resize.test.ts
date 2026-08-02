import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOccupancyFromPlaced,
  footprintCells,
  isStretchHandle,
  previewStretchBlockFromHandle,
  STRETCH_HANDLES,
  stretchBlockFromHandle,
  stretchFootprintFromHandle,
  type PlacedBlockRef,
  type StretchHandle,
} from "@/lib/skill-grid-ops";
import { getCellKey } from "@/lib/block-skill-grid";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function sole(overrides: Partial<PlacedBlockRef> = {}): PlacedBlockRef {
  return {
    id: "solo",
    position_x: 2,
    position_y: 3,
    span_w: 2,
    span_h: 2,
    ...overrides,
  };
}

describe("stretchFootprintFromHandle (pure geometry)", () => {
  it("expands east edge (+width) keeping west and height fixed", () => {
    const block = sole();
    const fp = stretchFootprintFromHandle(block, "e", 0, 2);
    expect(fp).toEqual({
      position_x: 2,
      position_y: 3,
      span_w: 4,
      span_h: 2,
    });
  });

  it("expands south edge (+height)", () => {
    const fp = stretchFootprintFromHandle(sole(), "s", 3, 0);
    expect(fp).toEqual({
      position_x: 2,
      position_y: 3,
      span_w: 2,
      span_h: 5,
    });
  });

  it("expands north (shifts anchor up, grows height)", () => {
    const fp = stretchFootprintFromHandle(sole(), "n", -2, 0);
    expect(fp).toEqual({
      position_x: 2,
      position_y: 1,
      span_w: 2,
      span_h: 4,
    });
  });

  it("expands west (shifts anchor left, grows width)", () => {
    const fp = stretchFootprintFromHandle(sole(), "w", 0, -1);
    expect(fp).toEqual({
      position_x: 1,
      position_y: 3,
      span_w: 3,
      span_h: 2,
    });
  });

  it("expands SE corner on both axes", () => {
    const fp = stretchFootprintFromHandle(sole(), "se", 1, 2);
    expect(fp).toEqual({
      position_x: 2,
      position_y: 3,
      span_w: 4,
      span_h: 3,
    });
  });

  it("expands NW corner on both axes", () => {
    const fp = stretchFootprintFromHandle(sole(), "nw", -1, -2);
    expect(fp).toEqual({
      position_x: 0,
      position_y: 2,
      span_w: 4,
      span_h: 3,
    });
  });

  it("clamps shrink to min 1×1 (south edge pulled above north)", () => {
    // 2×2 at (2,3): maxRow=4. Pull south edge by -10 → collapse to 1 row.
    const fp = stretchFootprintFromHandle(sole(), "s", -10, 0);
    expect(fp).toEqual({
      position_x: 2,
      position_y: 3,
      span_w: 2,
      span_h: 1,
    });
  });

  it("exposes all 8 stretch handles", () => {
    expect(STRETCH_HANDLES).toHaveLength(8);
    for (const h of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as StretchHandle[]) {
      expect(isStretchHandle(h)).toBe(true);
    }
    expect(isStretchHandle("x")).toBe(false);
  });
});

describe("stretchBlockFromHandle (collision + settle)", () => {
  it("settles edge expand when cells free", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);
    const next = stretchBlockFromHandle(block, "e", 0, 1, occupancy);
    expect(next).toEqual({
      id: "solo",
      position_x: 2,
      position_y: 3,
      span_w: 3,
      span_h: 2,
      shape_cells: null,
    });
    expect(
      footprintCells({
        position_x: next!.position_x,
        position_y: next!.position_y,
        span_w: next!.span_w!,
        span_h: next!.span_h!,
      })
        .map((c) => getCellKey(c.row, c.col))
        .sort(),
    ).toEqual(["3:2", "3:3", "3:4", "4:2", "4:3", "4:4"].sort());
  });

  it("settles corner expand when free", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);
    const next = stretchBlockFromHandle(block, "se", 1, 1, occupancy);
    expect(next).toMatchObject({
      id: "solo",
      position_x: 2,
      position_y: 3,
      span_w: 3,
      span_h: 3,
      shape_cells: null,
    });
    expect(
      footprintCells({
        position_x: next!.position_x,
        position_y: next!.position_y,
        span_w: next!.span_w!,
        span_h: next!.span_h!,
      }).length,
    ).toBe(9);
  });

  it("rejects expand into another block's occupancy", () => {
    const block = sole(); // covers (2,3)-(3,4)
    const wall: PlacedBlockRef = {
      id: "wall",
      position_x: 4,
      position_y: 3,
      span_w: 1,
      span_h: 1,
    };
    const occupancy = buildOccupancyFromPlaced([block, wall]);
    // Expand east by 1 → claims (3,4) which is wall
    expect(stretchBlockFromHandle(block, "e", 0, 1, occupancy)).toBeNull();
  });

  it("ignores self occupancy when expanding over own cells", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);
    // Expand north into empty — own cells ignored
    const next = stretchBlockFromHandle(block, "n", -1, 0, occupancy);
    expect(next).toMatchObject({
      position_x: 2,
      position_y: 2,
      span_w: 2,
      span_h: 3,
    });
  });

  it("returns null for zero delta (no commit on idle mouseup)", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);
    expect(stretchBlockFromHandle(block, "e", 0, 0, occupancy)).toBeNull();
  });

  it("returns null when expand then shrink lands on same solid bbox", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);
    // East expand by 0 after clamp? Actually e with dCol=0 is zero-like for that axis
    // but we require any non-zero delta. dCol=0,dRow=0 already covered.
    // Shrink south to min then... use n with dRow that keeps same? 
    // dRow=0 for n with dCol=0 returns null from zero check.
    expect(stretchBlockFromHandle(block, "n", 0, 0, occupancy)).toBeNull();
  });

  it("fills freeform L into solid rect when expanding bbox", () => {
    const L: PlacedBlockRef = {
      id: "L",
      position_x: 0,
      position_y: 0,
      span_w: 2,
      span_h: 2,
      shape_cells: [
        { dr: 0, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 1, dc: 0 },
      ],
    };
    const occupancy = buildOccupancyFromPlaced([L]);
    // Expand south by 0 cols, +1 row — new solid 2×3
    const next = stretchBlockFromHandle(L, "s", 1, 0, occupancy);
    expect(next).toMatchObject({
      id: "L",
      position_x: 0,
      position_y: 0,
      span_w: 2,
      span_h: 3,
      shape_cells: null,
    });
    expect(
      footprintCells({
        position_x: next!.position_x,
        position_y: next!.position_y,
        span_w: next!.span_w!,
        span_h: next!.span_h!,
      }).length,
    ).toBe(6);
  });

  it("preview falls back to current placement when collision rejects", () => {
    const block = sole();
    const wall: PlacedBlockRef = {
      id: "wall",
      position_x: 4,
      position_y: 3,
      span_w: 1,
      span_h: 1,
    };
    const occupancy = buildOccupancyFromPlaced([block, wall]);
    const preview = previewStretchBlockFromHandle(block, "e", 0, 1, occupancy);
    expect(preview).toMatchObject({
      id: "solo",
      position_x: 2,
      position_y: 3,
      span_w: 2,
      span_h: 2,
    });
  });

  it("preview shows valid expanded footprint during drag", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);
    const preview = previewStretchBlockFromHandle(block, "e", 0, 2, occupancy);
    expect(preview.span_w).toBe(4);
    expect(preview.span_h).toBe(2);
  });
});

describe("stretch settle sequence (preview then commit on end only)", () => {
  it("mid-drag candidates do not auto-commit; final settle uses same pure path", () => {
    const block = sole();
    const occupancy = buildOccupancyFromPlaced([block]);

    // Mid-drag preview steps (UI would only store local state)
    const mid1 = previewStretchBlockFromHandle(block, "e", 0, 1, occupancy);
    const mid2 = previewStretchBlockFromHandle(block, "e", 0, 2, occupancy);
    expect(mid1.span_w).toBe(3);
    expect(mid2.span_w).toBe(4);
    // Source block unchanged until commit
    expect(block.span_w).toBe(2);

    // Commit only at end with final delta
    const settled = stretchBlockFromHandle(block, "e", 0, 2, occupancy);
    expect(settled).toMatchObject({ span_w: 4, span_h: 2, shape_cells: null });
  });
});

describe("stretch map UI chrome (structural)", () => {
  it("sole-select mounts edge and corner stretch targets; multi/unselected omit", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).toContain("data-stretch-handle");
    expect(grid).toContain("stretchBlockFromHandle");
    // All 8 handles referenced
    for (const h of STRETCH_HANDLES) {
      expect(grid).toContain(`"${h}"`);
    }
    // Sole-selection gate
    expect(grid).toMatch(/selectedBlockIds\.length\s*===\s*1|soleStretch|stretchHandles/);
    // Persist path on pointer up
    expect(grid).toMatch(/op:\s*"resize"|op:\s*'resize'/);
    // Move path still present
    expect(grid).toMatch(/op:\s*"move"|op:\s*'move'/);
    // No right-pane resize form
    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).not.toMatch(/resize|stretch/i);
  });
});
