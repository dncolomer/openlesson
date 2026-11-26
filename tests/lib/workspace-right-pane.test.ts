import {
  readCombineBlocksSurface,
  readWorkspaceViewSurface,
} from "@/tests/helpers/surface-source";
/**
 * Workspace right pane: block detail, single-empty Add, multi-empty generate shape.
 * Drives shipped pure helpers + structural wiring in WorkspaceView / AYCL / SessionList.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyUnusableSelection, canPlaceOnMapGround } from "@/lib/map-ground-rules";
import {
  blockOffersSplitDrawer,
  clearWorkspaceAddTarget,
  clearWorkspaceBlockSelection,
  clearWorkspaceFilledBlockSelection,
  nextRightPaneDrawerExpanded,
  nextAccordionOpenDrawerId,
  initialAccordionOpenDrawerId,
  nextWorkspaceBlockSelection,
  resolveEmptyAddTarget,
  resolveEmptySelectionSurface,
  resolveFilledBlockSelectionSurface,
  resolveSplitDrawerAvailability,
  resolveWorkspaceRightPane,
  splitTargetCellCount,
} from "@/lib/workspace-right-pane";
import { isBlockMapToolEnabled } from "@/lib/block-map-tools";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.RIGHT_PANE_DRAWER_SCRATCH ||
  process.env.MULTI_EMPTY_RIGHT_PANE_SCRATCH ||
  process.env.EMPTY_ADD_SCRATCH ||
  process.env.COMBINE_BLOCKS_SCRATCH ||
  process.env.SPLIT_DRAWER_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f89c5e59d09f/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("resolveWorkspaceRightPane", () => {
  it("defaults to map_tools when nothing is selected (notes/files live under Context)", () => {
    expect(resolveWorkspaceRightPane(null)).toBe("map_tools");
    expect(resolveWorkspaceRightPane(undefined)).toBe("map_tools");
    expect(resolveWorkspaceRightPane("")).toBe("map_tools");
    expect(resolveWorkspaceRightPane("   ")).toBe("map_tools");
  });

  it("selected block id → block_detail", () => {
    expect(resolveWorkspaceRightPane("block-abc")).toBe("block_detail");
    expect(resolveWorkspaceRightPane("  block-abc  ")).toBe("block_detail");
  });

  it("single empty add target → add_block; multi empty → generate_shape; block wins", () => {
    const cell = { row: 2, col: 3 };
    const multi = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    expect(resolveWorkspaceRightPane(null, cell)).toBe("add_block");
    expect(resolveWorkspaceRightPane("", cell)).toBe("add_block");
    expect(
      resolveWorkspaceRightPane(null, {
        kind: "generate_shape",
        cells: multi,
      }),
    ).toBe("generate_shape");
    // Block detail takes priority when both present
    expect(resolveWorkspaceRightPane("block-1", cell)).toBe("block_detail");
    expect(
      resolveWorkspaceRightPane("block-1", {
        kind: "generate_shape",
        cells: multi,
      }),
    ).toBe("block_detail");
    expect(resolveWorkspaceRightPane(null, null)).toBe("map_tools");
  });

  it("2+ filled block ids → combine_blocks (wins over single detail and empty create)", () => {
    expect(
      resolveFilledBlockSelectionSurface(["a", "b"]),
    ).toEqual({ kind: "combine_blocks", blockIds: ["a", "b"] });
    expect(resolveFilledBlockSelectionSurface(["a"])).toEqual({
      kind: "block_detail",
      blockId: "a",
    });
    expect(resolveFilledBlockSelectionSurface([])).toBeNull();
    expect(clearWorkspaceFilledBlockSelection()).toEqual([]);

    expect(resolveWorkspaceRightPane(null, null, ["b1", "b2"])).toBe(
      "combine_blocks",
    );
    // Multi filled beats single expanded id and empty generate_shape
    expect(
      resolveWorkspaceRightPane("b1", { kind: "add_block", cell: { row: 0, col: 0 } }, [
        "b1",
        "b2",
      ]),
    ).toBe("combine_blocks");
    expect(
      resolveWorkspaceRightPane(
        null,
        {
          kind: "generate_shape",
          cells: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
        },
        ["x", "y", "z"],
      ),
    ).toBe("combine_blocks");
    // Sole multi-list id still detail
    expect(resolveWorkspaceRightPane(null, null, ["only"])).toBe("block_detail");

    writeEvidence(
      "combine-blocks-pane-route.log",
      [
        "multi2=" + resolveWorkspaceRightPane(null, null, ["a", "b"]),
        "multiWinsEmpty=" +
          resolveWorkspaceRightPane(
            null,
            { kind: "generate_shape", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] },
            ["a", "b"],
          ),
        "surface=" +
          JSON.stringify(resolveFilledBlockSelectionSurface(["a", "b", "a"])),
      ].join("\n"),
    );
  });
});

describe("resolveEmptySelectionSurface + resolveEmptyAddTarget", () => {
  it("single placeable → add_block; multi placeable → generate_shape; unusable/empty → null", () => {
    const a = { row: 1, col: 2 };
    const b = { row: 3, col: 4 };
    expect(
      resolveEmptyAddTarget({ selectedEmptyCells: [a] }),
    ).toEqual(a);
    expect(
      resolveEmptyAddTarget({ selectedEmptyCells: [a, b] }),
    ).toBeNull();
    expect(resolveEmptyAddTarget({ selectedEmptyCells: [] })).toBeNull();
    expect(
      resolveEmptyAddTarget({
        selectedEmptyCells: [a],
        unusableKeys: new Set(["1:2"]),
      }),
    ).toBeNull();
    expect(clearWorkspaceAddTarget()).toBeNull();

    expect(resolveEmptySelectionSurface({ selectedEmptyCells: [a] })).toEqual({
      kind: "add_block",
      cell: a,
    });
    expect(resolveEmptySelectionSurface({ selectedEmptyCells: [a, b] })).toEqual({
      kind: "generate_shape",
      cells: [a, b],
    });
    expect(
      resolveEmptySelectionSurface({
        selectedEmptyCells: [a, b],
        unusableKeys: ["1:2"],
      }),
    ).toEqual({ kind: "add_block", cell: b });
    expect(
      resolveEmptySelectionSurface({
        selectedEmptyCells: [a],
        unusableKeys: ["1:2"],
      }),
    ).toEqual({ kind: "add_block", cell: a });
    expect(
      resolveEmptySelectionSurface({
        selectedEmptyCells: [a, b],
        unusableKeys: ["1:2", "3:4"],
      }),
    ).toEqual({ kind: "generate_shape", cells: [a, b] });
    expect(
      resolveEmptySelectionSurface({ selectedEmptyCells: [] }),
    ).toBeNull();
  });

});

describe("clear / next selection (X close path)", () => {
  it("clearWorkspaceBlockSelection always returns null", () => {
    expect(clearWorkspaceBlockSelection()).toBeNull();
  });

  it("nextWorkspaceBlockSelection opens, replaces, and closes via null", () => {
    expect(nextWorkspaceBlockSelection(null, "b1")).toBe("b1");
    expect(nextWorkspaceBlockSelection("b1", "b2")).toBe("b2");
    expect(nextWorkspaceBlockSelection("b1", null)).toBeNull();
    expect(nextWorkspaceBlockSelection("b1", "")).toBeNull();
    // Same path as X: clear then resolve pane back to map tools
    const closed = nextWorkspaceBlockSelection("b1", clearWorkspaceBlockSelection());
    expect(closed).toBeNull();
    expect(resolveWorkspaceRightPane(closed)).toBe("map_tools");
  });
});

describe("structural: right pane not map modal", () => {
  it("SessionList no longer mounts BlockDetailDrawer modal overlay", () => {
    const list = read("components/SessionList.tsx");
    expect(list).not.toContain("BlockDetailDrawer");
    expect(list).not.toContain("aria-modal");
    expect(list).toContain("onExpandedNodeIdChange");
    expect(list).toContain("nextWorkspaceMapSelection");
    expect(list).toContain("data-session-list");
  });

  it("mobile non-owner auto-expand is one-shot so X close stays closed", () => {
    const list = read("components/SessionList.tsx");
    expect(list).toContain("mobileAutoExpandAttemptedRef");
    expect(list).toMatch(/mobileAutoExpandAttemptedRef\.current\s*=\s*true/);
    // Must not re-open solely because expandedNodeId became null after clear
    expect(list).toMatch(
      /if\s*\(\s*mobileAutoExpandAttemptedRef\.current\s*\)\s*return/,
    );
  });


  it("sole multi-cell block offers Split drawer; 1×1 and multi-select do not", () => {
    const multiCell = { id: "m1", span_w: 2, span_h: 2 };
    const single = { id: "s1", span_w: 1, span_h: 1 };
    expect(blockOffersSplitDrawer(multiCell)).toBe(true);
    expect(blockOffersSplitDrawer(single)).toBe(false);
    expect(blockOffersSplitDrawer({ shape_cells: [{ dr: 0, dc: 0 }, { dr: 0, dc: 1 }] })).toBe(
      true,
    );
    expect(splitTargetCellCount(multiCell)).toBe(4);

    expect(
      resolveSplitDrawerAvailability({
        selectedBlockId: "m1",
        block: multiCell,
      }),
    ).toEqual({ available: true, blockId: "m1", cellCount: 4 });

    expect(
      resolveSplitDrawerAvailability({
        selectedBlockId: "s1",
        block: single,
      }),
    ).toEqual({ available: false, blockId: "s1", cellCount: 1 });

    // Multi filled selection → combine, not sole split
    expect(
      resolveSplitDrawerAvailability({
        selectedBlockIds: ["a", "b"],
        block: multiCell,
      }),
    ).toEqual({ available: false, blockId: null, cellCount: 1 });

    // Pane routing: multi-cell sole still block_detail (Split is a peer drawer)
    expect(resolveWorkspaceRightPane("m1", null, null)).toBe("block_detail");
    expect(resolveWorkspaceRightPane(null, null, ["a", "b"])).toBe("combine_blocks");

    writeEvidence(
      "split-surface-resolve.log",
      [
        "multiCellOffers=" + blockOffersSplitDrawer(multiCell),
        "singleOffers=" + blockOffersSplitDrawer(single),
        "availMulti=" +
          JSON.stringify(
            resolveSplitDrawerAvailability({
              selectedBlockId: "m1",
              block: multiCell,
            }),
          ),
        "availSingle=" +
          JSON.stringify(
            resolveSplitDrawerAvailability({
              selectedBlockId: "s1",
              block: single,
            }),
          ),
        "availMultiSelect=" +
          JSON.stringify(
            resolveSplitDrawerAvailability({
              selectedBlockIds: ["a", "b"],
              block: multiCell,
            }),
          ),
        "paneMultiCell=" + resolveWorkspaceRightPane("m1"),
        "paneCombine=" + resolveWorkspaceRightPane(null, null, ["a", "b"]),
      ].join("\n"),
    );
  });


});
