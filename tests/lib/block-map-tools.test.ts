import { describe, expect, it } from "vitest";
import {
  BLOCK_MAP_TOOL_STRIP,
  DEFAULT_BLOCK_MAP_MODE,
  blockDragMoveDelta,
  blockMapToolKind,
  clientPointToGridCell,
  isBlockMapManipulationMode,
  isBlockMapToolEnabled,
  isBlockMultiSelectGesture,
  isEmptyCellMultiSelectGesture,
  isMultiCellBlockSpan,
  nextActiveModeTool,
  resolveBlockSelectionOnClick,
  toggleOrReplaceBlockSelection,
  visibleBlockMapTools,
  type BlockMapToolEnablementInput,
} from "@/lib/block-map-tools";

function state(
  partial: Partial<BlockMapToolEnablementInput> = {},
): BlockMapToolEnablementInput {
  return {
    canEdit: true,
    busy: false,
    hasGridOps: true,
    selectedBlockCount: 0,
    selectedEmptyCellCount: 0,
    selectedMultiCellBlockCount: 0,
    selectedBlocksContiguous: false,
    ...partial,
  };
}

describe("block-map-tools", () => {
  it("defaults to Select mode and treats Select/Move as modes", () => {
    expect(DEFAULT_BLOCK_MAP_MODE).toBe("select");
    expect(blockMapToolKind("select")).toBe("mode");
    expect(blockMapToolKind("move")).toBe("mode");
    expect(blockMapToolKind("merge")).toBe("action");
    expect(blockMapToolKind("zoom_in")).toBe("viewport");
  });

  it("activates Select vs Move when those tools are clicked", () => {
    expect(nextActiveModeTool("select", "move")).toBe("move");
    expect(nextActiveModeTool("move", "select")).toBe("select");
    // Action / viewport clicks leave the mode alone (Photoshop-style)
    expect(nextActiveModeTool("move", "merge")).toBe("move");
    expect(nextActiveModeTool("select", "zoom_in")).toBe("select");
    expect(nextActiveModeTool("select", "split")).toBe("select");
  });

  it("enables merge only with 2+ contiguous selected blocks", () => {
    expect(isBlockMapToolEnabled("merge", state({ selectedBlockCount: 0 }))).toBe(false);
    expect(isBlockMapToolEnabled("merge", state({ selectedBlockCount: 1 }))).toBe(false);
    // Two blocks but not contiguous
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: 2, selectedBlocksContiguous: false }),
      ),
    ).toBe(false);
    // Two+ contiguous
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: 2, selectedBlocksContiguous: true }),
      ),
    ).toBe(true);
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: 3, selectedBlocksContiguous: true, busy: true }),
      ),
    ).toBe(false);
  });

  it("enables split only when a multi-cell block is selected; edit only with exactly one", () => {
    expect(isMultiCellBlockSpan({ span_w: 1, span_h: 1 })).toBe(false);
    expect(isMultiCellBlockSpan({ span_w: 2, span_h: 1 })).toBe(true);
    expect(isMultiCellBlockSpan({ span_w: 1, span_h: 3 })).toBe(true);

    // Single 1×1 selection — split disabled
    expect(
      isBlockMapToolEnabled(
        "split",
        state({ selectedBlockCount: 1, selectedMultiCellBlockCount: 0 }),
      ),
    ).toBe(false);
    // Multi-cell block selected — split enabled
    expect(
      isBlockMapToolEnabled(
        "split",
        state({ selectedBlockCount: 1, selectedMultiCellBlockCount: 1 }),
      ),
    ).toBe(true);
    // Several singles still cannot split
    expect(
      isBlockMapToolEnabled(
        "split",
        state({ selectedBlockCount: 4, selectedMultiCellBlockCount: 0 }),
      ),
    ).toBe(false);
    // At least one multi-cell among selection
    expect(
      isBlockMapToolEnabled(
        "split",
        state({ selectedBlockCount: 3, selectedMultiCellBlockCount: 1 }),
      ),
    ).toBe(true);

    expect(isBlockMapToolEnabled("edit", state({ selectedBlockCount: 0 }))).toBe(false);
    expect(isBlockMapToolEnabled("edit", state({ selectedBlockCount: 1 }))).toBe(true);
    expect(isBlockMapToolEnabled("edit", state({ selectedBlockCount: 2 }))).toBe(false);
  });

  it("enables generate_shape when any empty cells are selected (solid check on submit)", () => {
    expect(
      isBlockMapToolEnabled("generate_shape", state({ selectedEmptyCellCount: 0 })),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled("generate_shape", state({ selectedEmptyCellCount: 3 })),
    ).toBe(true);
    // Sparse selections still open the dialog; solid-rectangle is enforced on submit
    expect(
      isBlockMapToolEnabled(
        "generate_shape",
        state({ selectedEmptyCellCount: 3, selectedEmptyCellsSolidRectangle: false }),
      ),
    ).toBe(true);
  });

  it("keeps Select and Move mode tools available before selection exists", () => {
    const empty = state();
    expect(isBlockMapToolEnabled("select", empty)).toBe(true);
    expect(isBlockMapToolEnabled("move", empty)).toBe(true);
    expect(isBlockMapToolEnabled("clear_selection", empty)).toBe(false);
    expect(
      isBlockMapToolEnabled(
        "clear_selection",
        state({ selectedBlockCount: 1 }),
      ),
    ).toBe(true);
  });

  it("disables grid-op actions when hasGridOps is false", () => {
    const noOps = state({ hasGridOps: false, selectedBlockCount: 3, selectedEmptyCellCount: 2 });
    expect(isBlockMapToolEnabled("merge", noOps)).toBe(false);
    expect(isBlockMapToolEnabled("split", noOps)).toBe(false);
    expect(isBlockMapToolEnabled("move", noOps)).toBe(false);
    expect(isBlockMapToolEnabled("generate_shape", noOps)).toBe(false);
    expect(isBlockMapToolEnabled("select", noOps)).toBe(true);
    expect(isBlockMapToolEnabled("zoom_in", noOps)).toBe(true);
  });

  it("lists a full strip including Select for editable maps with grid ops", () => {
    const tools = visibleBlockMapTools({ canEdit: true, hasGridOps: true });
    expect(tools).toContain("select");
    expect(tools).toContain("move");
    expect(tools).toContain("merge");
    expect(tools).toContain("split");
    expect(tools).toContain("edit");
    expect(tools).toContain("generate_shape");
    expect(tools).toContain("zoom_in");
    expect(tools).toContain("zoom_out");
    expect(tools).toContain("recenter");
    expect(tools[0]).toBe("select");
    // Order matches the canonical strip (subset)
    for (let i = 1; i < tools.length; i++) {
      expect(BLOCK_MAP_TOOL_STRIP.indexOf(tools[i])).toBeGreaterThan(
        BLOCK_MAP_TOOL_STRIP.indexOf(tools[i - 1]),
      );
    }
  });

  it("hides grid-op tools when map is not editable", () => {
    const tools = visibleBlockMapTools({ canEdit: false, hasGridOps: false });
    expect(tools).toEqual(["zoom_in", "zoom_out", "recenter"]);
    expect(tools).not.toContain("select");
    expect(tools).not.toContain("merge");
  });

  it("Select plain-click multi-toggles filled blocks (same as empties)", () => {
    // Select tool: every plain click toggles membership (not replace-only)
    expect(
      isBlockMultiSelectGesture({
        multiModifier: false,
        activeTool: "select",
        prevSelectedBlockCount: 0,
      }),
    ).toBe(true);

    const afterFirst = resolveBlockSelectionOnClick({
      blockId: "block-a",
      multiModifier: false,
      prevSelectedBlockIds: [],
      activeTool: "select",
    });
    expect(afterFirst).toEqual(["block-a"]);

    const afterSecond = resolveBlockSelectionOnClick({
      blockId: "block-b",
      multiModifier: false,
      prevSelectedBlockIds: afterFirst,
      activeTool: "select",
    });
    expect(afterSecond).toEqual(["block-a", "block-b"]);

    // Move tool plain click replaces
    expect(
      resolveBlockSelectionOnClick({
        blockId: "c",
        multiModifier: false,
        prevSelectedBlockIds: ["a", "b"],
        activeTool: "move",
      }),
    ).toEqual(["c"]);

    // Empty cells: Select/Move always multi; no tool → only when already selecting
    expect(
      isEmptyCellMultiSelectGesture({
        multiModifier: false,
        activeTool: "select",
        prevSelectedEmptyCount: 0,
      }),
    ).toBe(true);
    expect(
      isEmptyCellMultiSelectGesture({
        multiModifier: false,
        activeTool: "move",
        prevSelectedEmptyCount: 0,
      }),
    ).toBe(true);

    const enablement = state({
      selectedBlockCount: afterFirst.length,
      selectedMultiCellBlockCount: 0,
    });
    expect(isBlockMapToolEnabled("edit", enablement)).toBe(true);
    expect(isBlockMapToolEnabled("split", enablement)).toBe(false);
    expect(isBlockMapToolEnabled("clear_selection", enablement)).toBe(true);

    const multiCell = state({
      selectedBlockCount: 1,
      selectedMultiCellBlockCount: 1,
    });
    expect(isBlockMapToolEnabled("split", multiCell)).toBe(true);
  });

  it("marks Select/Move as manipulation mode (no TAP/ILE) when grid ops exist", () => {
    expect(
      isBlockMapManipulationMode("select", { canEdit: true, hasGridOps: true }),
    ).toBe(true);
    expect(
      isBlockMapManipulationMode("move", { canEdit: true, hasGridOps: true }),
    ).toBe(true);
    expect(
      isBlockMapManipulationMode("select", { canEdit: true, hasGridOps: false }),
    ).toBe(false);
    expect(
      isBlockMapManipulationMode("select", { canEdit: false, hasGridOps: true }),
    ).toBe(false);
  });

  it("converts client drag points into grid move deltas", () => {
    // pan=(0,0), zoom=1, pitch=100 → cell at client (150, 250) relative to viewport origin
    const cell = clientPointToGridCell({
      clientX: 150,
      clientY: 250,
      viewportLeft: 0,
      viewportTop: 0,
      panX: 0,
      panY: 0,
      zoom: 1,
      pitch: 100,
    });
    expect(cell).toEqual({ col: 1, row: 2 });

    const delta = blockDragMoveDelta({ row: 2, col: 1 }, { row: 4, col: 3 });
    expect(delta).toEqual({ dRow: 2, dCol: 2 });
    expect(blockDragMoveDelta({ row: 0, col: 0 }, { row: 0, col: 0 })).toEqual({
      dRow: 0,
      dCol: 0,
    });
  });

  it("Move plain click replaces multi-selection with the focused block", () => {
    const after = resolveBlockSelectionOnClick({
      blockId: "c",
      multiModifier: false,
      prevSelectedBlockIds: ["a", "b", "c"],
      activeTool: "move",
    });
    expect(after).toEqual(["c"]);
    expect(isBlockMapToolEnabled("edit", state({ selectedBlockCount: after.length }))).toBe(
      true,
    );
    expect(isBlockMapToolEnabled("merge", state({ selectedBlockCount: after.length }))).toBe(
      false,
    );
  });

  it("Select tool multi-selects occupied blocks the same way as empty cells", () => {
    const first = resolveBlockSelectionOnClick({
      blockId: "a",
      multiModifier: false,
      prevSelectedBlockIds: [],
      activeTool: "select",
    });
    expect(first).toEqual(["a"]);

    // Second plain click adds another filled block (no modifier) — matches empty multi-select
    const second = resolveBlockSelectionOnClick({
      blockId: "b",
      multiModifier: false,
      prevSelectedBlockIds: first,
      activeTool: "select",
    });
    expect(second).toEqual(["a", "b"]);
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: second.length, selectedBlocksContiguous: true }),
      ),
    ).toBe(true);

    const third = resolveBlockSelectionOnClick({
      blockId: "c",
      multiModifier: false,
      prevSelectedBlockIds: second,
      activeTool: "select",
    });
    expect(third).toEqual(["a", "b", "c"]);

    // Re-click toggles off
    const toggled = resolveBlockSelectionOnClick({
      blockId: "a",
      multiModifier: false,
      prevSelectedBlockIds: third,
      activeTool: "select",
    });
    expect(toggled).toEqual(["b", "c"]);
  });

  it("toggleOrReplaceBlockSelection accumulates then toggles off (two sequential clicks)", () => {
    // Simulates applyBlockSelection with ref source of truth
    let selected: string[] = [];
    selected = toggleOrReplaceBlockSelection({
      blockId: "a",
      multi: true,
      prevSelectedBlockIds: selected,
    });
    expect(selected).toEqual(["a"]);
    selected = toggleOrReplaceBlockSelection({
      blockId: "b",
      multi: true,
      prevSelectedBlockIds: selected,
    });
    expect(selected).toEqual(["a", "b"]);
    selected = toggleOrReplaceBlockSelection({
      blockId: "c",
      multi: true,
      prevSelectedBlockIds: selected,
    });
    expect(selected).toEqual(["a", "b", "c"]);
    // replace mode (Move plain click)
    selected = toggleOrReplaceBlockSelection({
      blockId: "z",
      multi: false,
      prevSelectedBlockIds: selected,
    });
    expect(selected).toEqual(["z"]);
  });

  it("BlockSkillGrid Select multi-select does not re-sync ref from state (race fix)", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    expect(src).toContain("selectedBlockIdsRef");
    expect(src).toContain("applyBlockSelection");
    expect(src).toContain("toggleOrReplaceBlockSelection");
    expect(src).toContain("applyBlockSelection(blockId, /* multi */ true)");
    expect(src).toContain("bg-cyan-500/20");
    // Must NOT mirror state→ref in useEffect (wipes multi-select on parent re-render)
    expect(src).not.toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{\s*selectedBlockIdsRef\.current\s*=\s*selectedBlockIds/,
    );
  });

  it("modifier click toggles membership for multi-select merge", () => {
    const added = resolveBlockSelectionOnClick({
      blockId: "b",
      multiModifier: true,
      prevSelectedBlockIds: ["a"],
      activeTool: "move",
    });
    expect(added).toEqual(["a", "b"]);
    // Count alone is not enough — contiguity must also hold
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: added.length, selectedBlocksContiguous: false }),
      ),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: added.length, selectedBlocksContiguous: true }),
      ),
    ).toBe(true);

    const removed = resolveBlockSelectionOnClick({
      blockId: "a",
      multiModifier: true,
      prevSelectedBlockIds: ["a", "b"],
    });
    expect(removed).toEqual(["b"]);
    expect(isBlockMapToolEnabled("edit", state({ selectedBlockCount: removed.length }))).toBe(
      true,
    );
  });

  it("Generate-in-shape dialog wires shape-aware suggest 3 options", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const panel = fs.readFileSync(
      path.join(process.cwd(), "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(process.cwd(), "app/api/workspace/suggest-blocks/route.ts"),
      "utf8",
    );
    expect(panel).toContain("data-suggest-shape-topics");
    expect(panel).toContain("handleSuggestShapeTopics");
    expect(panel).toContain("data-generate-shape-dialog");
    expect(panel).toContain("shape: true");
    expect(panel).toContain("span_w");
    expect(panel).toContain("span_h");
    expect(route).toContain("composeSuggestShapeBlockTitlesUserPrompt");
    expect(route).toContain("isShapeSuggest");
  });
});
