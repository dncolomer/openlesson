import { describe, expect, it } from "vitest";
import {
  BLOCK_MAP_TOOL_STRIP,
  DEFAULT_BLOCK_MAP_MODE,
  allowsMapClickSelection,
  blockDragMoveDelta,
  blockMapToolKind,
  blocksIntersectingGridRect,
  cancelPrereqEditMode,
  clientPointToGridCell,
  confirmPrereqEdit,
  emptyCellsIntersectingGridRect,
  enterPrereqEditMode,
  isBlockMapManipulationMode,
  isBlockMapToolEnabled,
  isBlockMultiSelectGesture,
  isEmptyCellMultiSelectGesture,
  isMultiCellBlockSpan,
  nextActiveModeTool,
  normalizeGridSelectionRect,
  prereqEditIsDirty,
  resolveBlockSelectionOnClick,
  resolveEmptyCellSelectionOnClick,
  resolveLassoSelection,
  resolveLockUntilActions,
  resolveLockUntilFromSelection,
  resolveMapBlockHighlightRole,
  resolveUnlockSelectedBlocks,
  resolveUnusableFromSelection,
  shouldEmptyCellClickSelect,
  toggleOrReplaceBlockSelection,
  toggleOrReplaceEmptyCellSelection,
  toggleStagedPrereq,
  visibleBlockMapTools,
  type BlockMapToolEnablementInput,
} from "@/lib/block-map-tools";
import {
  canPlaceOnMapGround,
  isBlockLockedUntilCompleted,
  loadMapGroundRules,
} from "@/lib/map-ground-rules";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCRATCH =
  process.env.LASSO_EMPTY_SCRATCH ||
  process.env.EMPTY_SELECT_SCRATCH ||
  process.env.BLOCK_SELECT_LASSO_SCRATCH ||
  process.env.PAN_MODE_SCRATCH ||
  process.env.GROUND_TOOLBAR_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6e76dfec82b4/implementer";

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
  it("defaults to Select mode; Select/Move/Lasso are modes; ground tools as actions", () => {
    expect(DEFAULT_BLOCK_MAP_MODE).toBe("select");
    expect(blockMapToolKind("select")).toBe("mode");
    expect(blockMapToolKind("move")).toBe("mode");
    expect(blockMapToolKind("lasso")).toBe("mode");
    expect(blockMapToolKind("merge")).toBe("action");
    expect(blockMapToolKind("lock_until")).toBe("action");
    expect(blockMapToolKind("mark_unusable")).toBe("action");
    expect(blockMapToolKind("zoom_in")).toBe("viewport");
    expect(BLOCK_MAP_TOOL_STRIP[0]).toBe("select");
    expect(BLOCK_MAP_TOOL_STRIP).toContain("lasso");
    expect(BLOCK_MAP_TOOL_STRIP).not.toContain("pan" as never);
  });

  it("activates Select/Move/Lasso when those tools are clicked", () => {
    expect(nextActiveModeTool("select", "move")).toBe("move");
    expect(nextActiveModeTool("move", "select")).toBe("select");
    expect(nextActiveModeTool("select", "lasso")).toBe("lasso");
    expect(nextActiveModeTool("lasso", "select")).toBe("select");
    // Action / viewport clicks leave the mode alone (Photoshop-style)
    expect(nextActiveModeTool("move", "merge")).toBe("move");
    expect(nextActiveModeTool("select", "zoom_in")).toBe("select");
    expect(nextActiveModeTool("select", "split")).toBe("select");
    expect(nextActiveModeTool("lasso", "zoom_in")).toBe("lasso");
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

    // edit/pen tool removed from strip — update/delete live on block-detail Edit drawer
    expect(BLOCK_MAP_TOOL_STRIP).not.toContain("edit" as never);
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

  it("keeps Select/Move mode tools available before selection exists", () => {
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

  it("lists a full strip with Select first; generate_shape not on strip (right-pane multi empty)", () => {
    const tools = visibleBlockMapTools({ canEdit: true, hasGridOps: true });
    expect(tools).not.toContain("pan" as never);
    expect(tools).toContain("select");
    expect(tools).toContain("move");
    expect(tools).toContain("lasso");
    expect(tools).toContain("merge");
    expect(tools).toContain("split");
    // Pen edit tool removed — Edit drawer on block select owns update/delete
    expect(tools).not.toContain("edit" as never);
    expect(BLOCK_MAP_TOOL_STRIP).not.toContain("edit" as never);
    // Multi empty create opens in the right pane — no toolbar generate_shape
    expect(tools).not.toContain("generate_shape");
    expect(BLOCK_MAP_TOOL_STRIP).not.toContain("generate_shape");
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
    expect(tools).not.toContain("lasso");
    expect(tools).not.toContain("merge");
  });

  it("Select plain-click single-selects; re-click sole clears; only Shift multi-toggles", () => {
    // Plain select is NOT multi — single-select replace is the default.
    expect(
      isBlockMultiSelectGesture({
        multiModifier: false,
        activeTool: "select",
        prevSelectedBlockCount: 0,
      }),
    ).toBe(false);
    expect(
      isBlockMultiSelectGesture({
        multiModifier: true,
        activeTool: "select",
        prevSelectedBlockCount: 2,
      }),
    ).toBe(true);

    const afterFirst = resolveBlockSelectionOnClick({
      blockId: "block-a",
      multiModifier: false,
      prevSelectedBlockIds: [],
      activeTool: "select",
    });
    expect(afterFirst).toEqual(["block-a"]);

    // Second plain click on another block replaces (unselects the rest)
    const afterSecond = resolveBlockSelectionOnClick({
      blockId: "block-b",
      multiModifier: false,
      prevSelectedBlockIds: afterFirst,
      activeTool: "select",
    });
    expect(afterSecond).toEqual(["block-b"]);

    // Re-click the sole selected block → clear selection
    const afterReselect = resolveBlockSelectionOnClick({
      blockId: "block-b",
      multiModifier: false,
      prevSelectedBlockIds: afterSecond,
      activeTool: "select",
    });
    expect(afterReselect).toEqual([]);
    expect(
      toggleOrReplaceBlockSelection({
        blockId: "solo",
        multi: false,
        prevSelectedBlockIds: ["solo"],
      }),
    ).toEqual([]);

    // Shift multi-toggles membership
    const afterShift = resolveBlockSelectionOnClick({
      blockId: "block-c",
      multiModifier: true,
      prevSelectedBlockIds: ["block-b"],
      activeTool: "select",
    });
    expect(afterShift).toEqual(["block-b", "block-c"]);

    // Move tool plain click replaces
    expect(
      resolveBlockSelectionOnClick({
        blockId: "c",
        multiModifier: false,
        prevSelectedBlockIds: ["a", "b"],
        activeTool: "move",
      }),
    ).toEqual(["c"]);

    // Empty cells: same as blocks — plain is NOT multi; only Shift/modifier multi-toggles
    expect(
      isEmptyCellMultiSelectGesture({
        multiModifier: false,
        activeTool: "select",
        prevSelectedEmptyCount: 0,
      }),
    ).toBe(false);
    expect(
      isEmptyCellMultiSelectGesture({
        multiModifier: false,
        activeTool: "move",
        prevSelectedEmptyCount: 3,
      }),
    ).toBe(false);
    expect(
      isEmptyCellMultiSelectGesture({
        multiModifier: true,
        activeTool: "select",
        prevSelectedEmptyCount: 0,
      }),
    ).toBe(true);
    expect(
      isEmptyCellMultiSelectGesture({
        multiModifier: false,
        activeTool: "lasso",
        prevSelectedEmptyCount: 2,
      }),
    ).toBe(false);
    expect(shouldEmptyCellClickSelect({ activeTool: "select" })).toBe(true);
    expect(shouldEmptyCellClickSelect({ activeTool: "move" })).toBe(true);
    expect(shouldEmptyCellClickSelect({ activeTool: "lasso" })).toBe(false);

    const enablement = state({
      selectedBlockCount: afterFirst.length,
      selectedMultiCellBlockCount: 0,
    });
    expect(isBlockMapToolEnabled("split", enablement)).toBe(false);
    expect(isBlockMapToolEnabled("clear_selection", enablement)).toBe(true);
    expect(isBlockMapToolEnabled("lasso", state())).toBe(true);

    const multiCell = state({
      selectedBlockCount: 1,
      selectedMultiCellBlockCount: 1,
    });
    expect(isBlockMapToolEnabled("split", multiCell)).toBe(true);

    try {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, "block-select-single-default.log"),
        [
          "plainSelectMulti=" +
            isBlockMultiSelectGesture({
              multiModifier: false,
              activeTool: "select",
              prevSelectedBlockCount: 1,
            }),
          "shiftSelectMulti=" +
            isBlockMultiSelectGesture({
              multiModifier: true,
              activeTool: "select",
              prevSelectedBlockCount: 1,
            }),
          "plainA=" + afterFirst.join(","),
          "plainB_replaces=" + afterSecond.join(","),
          "shiftAddsC=" + afterShift.join(","),
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });

  it("marks Select/Move as manipulation mode when grid ops exist", () => {
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

  it("select is default; allows click selection; lasso does not; pan is not on the strip", () => {
    expect(DEFAULT_BLOCK_MAP_MODE).toBe("select");
    expect(allowsMapClickSelection("select")).toBe(true);
    expect(allowsMapClickSelection("move")).toBe(true);
    expect(allowsMapClickSelection("lasso")).toBe(false);
    expect(BLOCK_MAP_TOOL_STRIP).not.toContain("pan" as never);
    expect(BLOCK_MAP_TOOL_STRIP).toContain("lasso");
    expect(visibleBlockMapTools({ canEdit: true, hasGridOps: true })[0]).toBe("select");
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
    expect(after.length).toBe(1);
    expect(isBlockMapToolEnabled("merge", state({ selectedBlockCount: after.length }))).toBe(
      false,
    );
  });

  it("Select tool plain click replaces; Shift multi-selects for merge", () => {
    const first = resolveBlockSelectionOnClick({
      blockId: "a",
      multiModifier: false,
      prevSelectedBlockIds: [],
      activeTool: "select",
    });
    expect(first).toEqual(["a"]);

    // Second plain click replaces (does not accumulate)
    const second = resolveBlockSelectionOnClick({
      blockId: "b",
      multiModifier: false,
      prevSelectedBlockIds: first,
      activeTool: "select",
    });
    expect(second).toEqual(["b"]);

    // Shift+click adds for multi-select merge path
    const withShift = resolveBlockSelectionOnClick({
      blockId: "c",
      multiModifier: true,
      prevSelectedBlockIds: second,
      activeTool: "select",
    });
    expect(withShift).toEqual(["b", "c"]);
    expect(
      isBlockMapToolEnabled(
        "merge",
        state({ selectedBlockCount: withShift.length, selectedBlocksContiguous: true }),
      ),
    ).toBe(true);

    // Shift re-click toggles off
    const toggled = resolveBlockSelectionOnClick({
      blockId: "b",
      multiModifier: true,
      prevSelectedBlockIds: withShift,
      activeTool: "select",
    });
    expect(toggled).toEqual(["c"]);
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
    // replace mode (plain Select / Move click)
    selected = toggleOrReplaceBlockSelection({
      blockId: "z",
      multi: false,
      prevSelectedBlockIds: selected,
    });
    expect(selected).toEqual(["z"]);
  });

  it("blocksIntersectingGridRect returns ids under lasso rectangle", () => {
    const blocks = [
      { id: "a", row: 0, col: 0, span_w: 1, span_h: 1 },
      { id: "b", row: 0, col: 2, span_w: 2, span_h: 1 },
      { id: "c", row: 5, col: 5, span_w: 1, span_h: 1 },
      {
        id: "free",
        occupiedCells: [
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
      },
    ];

    // Empty-ish rect over origin cell only
    const onlyA = blocksIntersectingGridRect(
      blocks,
      normalizeGridSelectionRect({ row: 0, col: 0 }, { row: 0, col: 0 }),
    );
    expect(onlyA).toEqual(["a"]);

    // Wide top row hits a + b + freeform
    const top = blocksIntersectingGridRect(
      blocks,
      normalizeGridSelectionRect({ row: 0, col: 0 }, { row: 1, col: 3 }),
    );
    expect(top.sort()).toEqual(["a", "b", "free"].sort());

    // Far away → empty
    const none = blocksIntersectingGridRect(
      blocks,
      normalizeGridSelectionRect({ row: 20, col: 20 }, { row: 22, col: 22 }),
    );
    expect(none).toEqual([]);

    // Multi-cell span: rect touches only right half of b
    const halfB = blocksIntersectingGridRect(
      blocks,
      normalizeGridSelectionRect({ row: 0, col: 3 }, { row: 0, col: 3 }),
    );
    expect(halfB).toEqual(["b"]);

    try {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, "block-lasso-select.log"),
        [
          "onlyA=" + onlyA.join(","),
          "top=" + top.sort().join(","),
          "none=" + none.length,
          "halfB=" + halfB.join(","),
          "normalize=" +
            JSON.stringify(
              normalizeGridSelectionRect({ row: 3, col: 1 }, { row: 0, col: 4 }),
            ),
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });

  it("emptyCellsIntersectingGridRect returns placeable empties inside lasso rect", () => {
    const rect = normalizeGridSelectionRect(
      { row: 0, col: 0 },
      { row: 1, col: 2 },
    );
    // Occupied (0,0) and (0,1); unusable (1,0); free (0,2)(1,1)(1,2)
    const empties = emptyCellsIntersectingGridRect({
      rect,
      occupiedKeys: ["0:0", "0:1"],
      unusableKeys: ["1:0"],
    });
    expect(empties).toEqual([
      { row: 0, col: 2 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]);

    // Outside / no free cells
    expect(
      emptyCellsIntersectingGridRect({
        rect: normalizeGridSelectionRect({ row: 0, col: 0 }, { row: 0, col: 1 }),
        occupiedKeys: ["0:0", "0:1"],
      }),
    ).toEqual([]);

    // Full empty rect
    const full = emptyCellsIntersectingGridRect({
      rect: normalizeGridSelectionRect({ row: 2, col: 2 }, { row: 2, col: 3 }),
      occupiedKeys: [],
    });
    expect(full).toEqual([
      { row: 2, col: 2 },
      { row: 2, col: 3 },
    ]);

    // Blocks win when any block footprint hits — free cells in the gaps must not
    // steal multi-block lasso (gapped blocks / margin around a single block).
    const mixed = resolveLassoSelection({
      rect,
      blockHits: ["block-a", "block-b"],
      emptyHits: full,
    });
    expect(mixed.mode).toBe("blocks");
    expect(mixed.selectedBlockIds).toEqual(["block-a", "block-b"]);
    expect(mixed.selectedEmptyCells).toEqual([]);

    // Empty mode only when no blocks hit
    const emptyOnly = resolveLassoSelection({
      rect,
      blockHits: [],
      emptyHits: full,
    });
    expect(emptyOnly.mode).toBe("empty");
    expect(emptyOnly.selectedBlockIds).toEqual([]);
    expect(emptyOnly.selectedEmptyCells).toEqual(full);

    // Blocks only when no empties
    const blockMode = resolveLassoSelection({
      rect,
      blockHits: ["a", "b"],
      emptyHits: [],
    });
    expect(blockMode.mode).toBe("blocks");
    expect(blockMode.selectedBlockIds).toEqual(["a", "b"]);
    expect(blockMode.selectedEmptyCells).toEqual([]);

    expect(
      resolveLassoSelection({ rect, blockHits: [], emptyHits: [] }).mode,
    ).toBe("none");

    try {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, "lasso-empty-cells.log"),
        [
          "empties=" + empties.map((c) => `${c.row}:${c.col}`).join(","),
          "full=" + full.map((c) => `${c.row}:${c.col}`).join(","),
          "mixedMode=" + mixed.mode,
          "emptyOnlyMode=" + emptyOnly.mode,
          "blockMode=" + blockMode.mode,
          "blocksWinOverEmpties=" +
            String(
              resolveLassoSelection({
                rect,
                blockHits: ["x"],
                emptyHits: [{ row: 0, col: 0 }],
              }).mode === "blocks",
            ),
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });

  it("empty cells: plain click single-select; re-click sole clears; Shift multi-toggle", () => {
    const a = { row: 1, col: 2 };
    const b = { row: 3, col: 4 };
    const c = { row: 5, col: 6 };

    // Plain click under Select → only that cell
    const first = resolveEmptyCellSelectionOnClick({
      cell: a,
      multiModifier: false,
      prevSelectedEmptyCells: [],
      activeTool: "select",
    });
    expect(first).toEqual([a]);

    // Second plain click replaces (unselects prior empties)
    const second = resolveEmptyCellSelectionOnClick({
      cell: b,
      multiModifier: false,
      prevSelectedEmptyCells: first,
      activeTool: "select",
    });
    expect(second).toEqual([b]);

    // Re-click sole selected empty → clear
    const cleared = resolveEmptyCellSelectionOnClick({
      cell: b,
      multiModifier: false,
      prevSelectedEmptyCells: second,
      activeTool: "select",
    });
    expect(cleared).toEqual([]);
    expect(
      toggleOrReplaceEmptyCellSelection({
        cell: a,
        multi: false,
        prevSelectedEmptyCells: [a],
      }),
    ).toEqual([]);

    // Shift adds
    const withShift = resolveEmptyCellSelectionOnClick({
      cell: c,
      multiModifier: true,
      prevSelectedEmptyCells: [b],
      activeTool: "select",
    });
    expect(withShift).toEqual([b, c]);

    // Shift re-click toggles off
    const toggled = resolveEmptyCellSelectionOnClick({
      cell: b,
      multiModifier: true,
      prevSelectedEmptyCells: withShift,
      activeTool: "select",
    });
    expect(toggled).toEqual([c]);

    // Move plain also replaces
    expect(
      resolveEmptyCellSelectionOnClick({
        cell: a,
        multiModifier: false,
        prevSelectedEmptyCells: [b, c],
        activeTool: "move",
      }),
    ).toEqual([a]);

    // Lasso leaves previous empty selection unchanged (no invent multi)
    expect(
      resolveEmptyCellSelectionOnClick({
        cell: a,
        multiModifier: false,
        prevSelectedEmptyCells: [b],
        activeTool: "lasso",
      }),
    ).toEqual([b]);

    // Pure toggle/replace helper
    expect(
      toggleOrReplaceEmptyCellSelection({
        cell: a,
        multi: false,
        prevSelectedEmptyCells: [b, c],
      }),
    ).toEqual([a]);
    expect(
      toggleOrReplaceEmptyCellSelection({
        cell: a,
        multi: true,
        prevSelectedEmptyCells: [b],
      }),
    ).toEqual([b, a]);

    // Enablement still keys off selected empty count
    expect(
      isBlockMapToolEnabled(
        "generate_shape",
        state({ selectedEmptyCellCount: withShift.length }),
      ),
    ).toBe(true);
    expect(
      isBlockMapToolEnabled(
        "mark_unusable",
        state({ selectedEmptyCellCount: withShift.length, hasMapGroundOps: true }),
      ),
    ).toBe(true);

    try {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, "empty-select-single-default.log"),
        [
          "plainFirst=" + JSON.stringify(first),
          "plainSecondReplaces=" + JSON.stringify(second),
          "shiftAdds=" + JSON.stringify(withShift),
          "shiftToggleOff=" + JSON.stringify(toggled),
          "plainMultiGesture=" +
            isEmptyCellMultiSelectGesture({
              multiModifier: false,
              activeTool: "select",
              prevSelectedEmptyCount: 2,
            }),
          "shiftMultiGesture=" +
            isEmptyCellMultiSelectGesture({
              multiModifier: true,
              activeTool: "select",
              prevSelectedEmptyCount: 2,
            }),
          "shouldSelectEmpty_select=" + shouldEmptyCellClickSelect({ activeTool: "select" }),
          "shouldSelectEmpty_lasso=" + shouldEmptyCellClickSelect({ activeTool: "lasso" }),
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });

  it("BlockSkillGrid Select single-default + empty replace/toggle + lasso empty+blocks; no state→ref race", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    expect(src).toContain("selectedBlockIdsRef");
    expect(src).toContain("applyBlockSelection");
    expect(src).toContain("toggleOrReplaceBlockSelection");
    expect(src).toContain("applyEmptyCellSelection");
    expect(src).toContain("toggleOrReplaceEmptyCellSelection");
    expect(src).toContain("shouldEmptyCellClickSelect");
    // Plain select uses multiModifier; no always-true multi path for blocks or empties
    expect(src).toContain("applyBlockSelection(blockId, multiModifier)");
    expect(src).toContain("applyEmptyCellSelection(cell, multiModifier)");
    expect(src).not.toContain("applyBlockSelection(blockId, /* multi */ true)");
    // Old always-toggle empty helper path removed
    expect(src).not.toContain("const toggleEmptyCellSelection");
    expect(src).toContain("blocksIntersectingGridRect");
    expect(src).toContain("emptyCellsIntersectingGridRect");
    expect(src).toContain("resolveLassoSelection");
    expect(src).toContain("emitEmptySelectionRef");
    // Block lasso clears local Add/shape fallback (ChapterMapPanel path)
    expect(src).toMatch(
      /resolved\.mode === "blocks"[\s\S]*?setLocalPendingCell\(null\)[\s\S]*?setShapePromptOpen\(false\)/,
    );
    expect(src).toContain("data-tool-icon=\"lasso\"");
    expect(src).toContain("data-map-lasso-rect");
    expect(src).toContain("data-map-lasso-mode");
    expect(src).toContain("select blocks or empty cells");
    expect(src).toContain("Shift+click multi-select");
    expect(src).toContain("Click empty to Add · Shift+click multi-select for shape form");
    expect(src).not.toContain("double-click empty to add");
    expect(src).not.toContain("handleEmptyCellDoubleClick");
    expect(src).toContain("onEmptySelectionChange");
    expect(src).toContain("resolveEmptySelectionSurface");
    expect(src).toContain("onSelectNode(nextIds[0]");
    expect(src).toContain("bg-cyan-500/20");
    // Must NOT mirror state→ref in useEffect (wipes multi-select on parent re-render)
    expect(src).not.toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{\s*selectedBlockIdsRef\.current\s*=\s*selectedBlockIds/,
    );

    try {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, "lasso-empty-tests.log"),
        [
          "emptyCellsHelper=" + src.includes("emptyCellsIntersectingGridRect"),
          "resolveLasso=" + src.includes("resolveLassoSelection"),
          "emitEmpty=" + src.includes("emitEmptySelectionRef"),
          "clearsLocalOnBlockLasso=" +
            /resolved\.mode === "blocks"[\s\S]*?setLocalPendingCell\(null\)/.test(src),
          "lassoHint=" + src.includes("select blocks or empty cells"),
          "stripLasso=" + BLOCK_MAP_TOOL_STRIP.includes("lasso"),
          "blocksWin=" +
            String(
              resolveLassoSelection({
                rect: normalizeGridSelectionRect({ row: 0, col: 0 }, { row: 2, col: 2 }),
                blockHits: ["a"],
                emptyHits: [{ row: 1, col: 1 }],
              }).mode === "blocks",
            ),
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
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
    expect(removed.length).toBe(1);
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

describe("selection-driven ground authoring (left toolbar)", () => {
  it("prereq-edit: set, unselect some, clear all (empty staged), cancel", () => {
    // Enter seeds from saved locks
    let edit = enterPrereqEditMode({
      targetId: "target",
      currentLocks: ["p1", "p2"],
    });
    expect(edit).toEqual({
      active: true,
      targetId: "target",
      stagedPrereqIds: ["p1", "p2"],
    });
    expect(prereqEditIsDirty(edit, ["p1", "p2"])).toBe(false);

    // Remove one prereq (delete some)
    edit = toggleStagedPrereq(edit, "p1");
    expect(edit.stagedPrereqIds).toEqual(["p2"]);
    expect(prereqEditIsDirty(edit, ["p1", "p2"])).toBe(true);
    expect(confirmPrereqEdit(edit)).toEqual({
      blockId: "target",
      lock_until_block_ids: ["p2"],
    });

    // Remove remaining → empty staged clears all
    edit = toggleStagedPrereq(edit, "p2");
    expect(edit.stagedPrereqIds).toEqual([]);
    expect(confirmPrereqEdit(edit)).toEqual({
      blockId: "target",
      lock_until_block_ids: [],
    });

    // Re-enter and add prereqs
    edit = enterPrereqEditMode({ targetId: "target", currentLocks: [] });
    edit = toggleStagedPrereq(edit, "a");
    edit = toggleStagedPrereq(edit, "b");
    expect(confirmPrereqEdit(edit)).toEqual({
      blockId: "target",
      lock_until_block_ids: ["a", "b"],
    });

    // Cancel discards without write
    expect(cancelPrereqEditMode()).toEqual({
      active: false,
      targetId: null,
      stagedPrereqIds: [],
    });
    expect(confirmPrereqEdit(cancelPrereqEditMode())).toBeNull();

    // Target cannot stage itself
    edit = enterPrereqEditMode({ targetId: "t", currentLocks: [] });
    expect(toggleStagedPrereq(edit, "t")).toEqual(edit);

    // Mild prereq highlight roles
    edit = enterPrereqEditMode({ targetId: "t", currentLocks: ["p"] });
    expect(
      resolveMapBlockHighlightRole({
        blockId: "t",
        selected: true,
        prereqEdit: edit,
      }),
    ).toBe("target");
    expect(
      resolveMapBlockHighlightRole({
        blockId: "p",
        selected: false,
        prereqEdit: edit,
      }),
    ).toBe("prereq");
    expect(
      resolveMapBlockHighlightRole({
        blockId: "other",
        selected: false,
        prereqEdit: edit,
      }),
    ).toBe("neutral");
    // Preview saved prereqs when not editing
    expect(
      resolveMapBlockHighlightRole({
        blockId: "p",
        selected: false,
        previewTargetId: "t",
        previewPrereqIds: ["p"],
      }),
    ).toBe("prereq");

    // Deprecated multi-select helpers still clear / set for tests
    expect(resolveLockUntilFromSelection([])).toBeNull();
    expect(resolveLockUntilActions(["a"])).toEqual({
      updates: [{ blockId: "a", lock_until_block_ids: [] }],
      mode: "clear_all",
    });
    expect(resolveLockUntilActions(["target", "p1", "p2"])).toEqual({
      updates: [{ blockId: "target", lock_until_block_ids: ["p1", "p2"] }],
      mode: "set_prereqs",
    });
    // Same set again → clear_all (toggle off)
    expect(
      resolveLockUntilActions(
        ["target", "p1", "p2"],
        new Map([["target", ["p1", "p2"]]]),
      ),
    ).toEqual({
      updates: [{ blockId: "target", lock_until_block_ids: [] }],
      mode: "clear_all",
    });
    expect(
      resolveUnlockSelectedBlocks(
        ["a", "b"],
        new Map([
          ["a", ["x"]],
          ["b", ["y"]],
        ]),
      ),
    ).toEqual([
      { blockId: "a", lock_until_block_ids: [] },
      { blockId: "b", lock_until_block_ids: [] },
    ]);

    expect(
      isBlockMapToolEnabled("lock_until", state({ selectedBlockCount: 3 })),
    ).toBe(true);
    expect(
      isBlockMapToolEnabled("lock_until", state({ selectedBlockCount: 0 })),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled(
        "lock_until",
        state({ selectedBlockCount: 0, prereqEditActive: true }),
      ),
    ).toBe(true);
    expect(
      isBlockMapToolEnabled(
        "clear_selection",
        state({ selectedBlockCount: 0, prereqEditActive: true }),
      ),
    ).toBe(true);
  });

  it("mark_unusable: batch mark/clear selected empty cells; occupancy rules hold", () => {
    expect(resolveUnusableFromSelection([], [])).toBeNull();
    // Mark selected
    const marked = resolveUnusableFromSelection(
      [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ],
      [],
    );
    expect(marked).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ]);
    // All already unusable → clear those (requires selecting unusable cells on the map)
    const cleared = resolveUnusableFromSelection(
      [{ row: 0, col: 1 }],
      marked!,
    );
    expect(cleared).toEqual([{ row: 1, col: 1 }]);
    // Full clear of a multi-selected unusable region
    const clearedAll = resolveUnusableFromSelection(
      [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
      ],
      marked!,
    );
    expect(clearedAll).toEqual([]);

    expect(
      isBlockMapToolEnabled("mark_unusable", state({ selectedEmptyCellCount: 0 })),
    ).toBe(false);
    expect(
      isBlockMapToolEnabled("mark_unusable", state({ selectedEmptyCellCount: 2 })),
    ).toBe(true);

    // Pure unlock/occupancy still honor rules after selection apply
    const lock = resolveLockUntilFromSelection(["end", "start"]);
    const blocks = [
      { id: "start", title: "Start", status: "not_started" },
      {
        id: "end",
        title: "End",
        status: "not_started",
        lock_until_block_ids: lock!.lock_until_block_ids,
      },
    ];
    const byId = new Map(blocks.map((b) => [b.id, b]));
    expect(isBlockLockedUntilCompleted(blocks[1], byId)).toBe(true);
    byId.set("start", { ...blocks[0], status: "completed" });
    expect(
      isBlockLockedUntilCompleted(
        { ...blocks[1], lock_until_block_ids: lock!.lock_until_block_ids },
        byId,
      ),
    ).toBe(false);

    const unusable = resolveUnusableFromSelection([{ row: 2, col: 3 }], [])!;
    expect(
      canPlaceOnMapGround([{ row: 2, col: 3 }], unusable),
    ).toMatchObject({ ok: false, reason: "unusable" });
    expect(
      canPlaceOnMapGround([{ row: 0, col: 0 }], unusable),
    ).toMatchObject({ ok: true });

    const loaded = loadMapGroundRules({
      unusable_cells: unusable,
      blocks: [{ id: "end", lock_until_block_ids: lock!.lock_until_block_ids }],
    });
    expect(loaded.unusableCells).toEqual([{ row: 2, col: 3 }]);
    expect(loaded.blocks[0].lock_until_block_ids).toEqual(["start"]);

    try {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, "ground-toolbar-rules.log"),
        [
          "lock_until selection target+prereqs",
          JSON.stringify(lock),
          "unusable selection mark",
          JSON.stringify(unusable),
          "place on unusable: blocked",
          "place on open: ok",
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });

  it("structural: select default + hand move icon; pan not on toolbar", () => {
    const grid = readFileSync(
      join(process.cwd(), "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    const tools = readFileSync(
      join(process.cwd(), "lib/block-map-tools.ts"),
      "utf8",
    );
    expect(tools).toContain('export const DEFAULT_BLOCK_MAP_MODE: BlockMapModeTool = "select"');
    expect(tools).not.toMatch(/"pan"/);
    expect(tools).toContain("allowsMapClickSelection");
    expect(grid).toContain("DEFAULT_BLOCK_MAP_MODE");
    expect(grid).not.toContain('data-tool-icon="pan"');
    expect(grid).toContain('data-tool-icon="move-hand"');
    // Move uses open-hand path
    expect(grid).toMatch(/data-tool-icon="move-hand"[\s\S]*?M8\.5 11V7\.5/);
    expect(grid).toContain("allowsMapClickSelection");
    expect(grid).toContain("Move: drag blocks with hand");
    expect(grid).not.toContain("Pan: drag to move the map");
  });

  it("structural: left strip wires ground actions; unusable cells remain selectable to clear", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const grid = fs.readFileSync(
      path.join(process.cwd(), "components/BlockSkillGrid.tsx"),
      "utf8",
    );
    const pane = fs.readFileSync(
      path.join(process.cwd(), "components/WorkspaceMapAuthoringPane.tsx"),
      "utf8",
    );
    const list = fs.readFileSync(
      path.join(process.cwd(), "components/SessionList.tsx"),
      "utf8",
    );
    expect(grid).toContain("enterPrereqEditMode");
    expect(grid).toContain("confirmPrereqEdit");
    expect(grid).toContain("toggleStagedPrereq");
    expect(grid).toContain("resolveMapBlockHighlightRole");
    expect(grid).toContain("MAP_CELL_PREREQ_CLASS");
    expect(grid).toContain("resolveUnusableFromSelection");
    expect(grid).toContain('case "lock_until"');
    expect(grid).toContain('case "mark_unusable"');
    expect(grid).toContain("onMapGround");
    expect(grid).toContain('data-block-locked={lockedByPrereq ? "true" : "false"}');
    expect(grid).toContain("data-block-dependency-lock");
    expect(grid).toContain("data-block-has-dependencies");
    expect(grid).toContain("BlockDependencyLockBadge");
    expect(grid).toContain("normalizeLockUntilBlockIds");
    // Selected target previews deps with dashed prereq chrome
    expect(grid).toContain("previewPrereqIds");
    const chrome = fs.readFileSync(
      path.join(process.cwd(), "lib/map-cell-chrome.ts"),
      "utf8",
    );
    expect(chrome).toMatch(/MAP_CELL_PREREQ_CLASS[\s\S]*border-dashed/);
    expect(grid).toContain("data-block-highlight={highlightRole}");
    expect(grid).toContain("data-prereq-edit-active");
    expect(list).toContain("onMapGround");
    // Right pane: no ground authoring chrome (toolbar-only path).
    expect(pane).not.toContain("data-unusable-row");
    expect(pane).not.toContain("data-lock-target-select");
    expect(pane).not.toContain("data-map-ground-toolbar-hint");
    expect(pane).not.toContain("Map & topology");
    expect(pane).not.toContain("Ground authoring on the map");
    expect(pane).not.toContain("WorkspacePromptImpactPanel");
    expect(pane).not.toContain("How context shapes practice");
    // Unusable cells must be clickable for multi-select clear (not disabled={...isUnusable}).
    expect(grid).toContain('data-map-cell-unusable={isUnusable ? "true" : "false"}');
    expect(grid).toMatch(/disabled=\{!canEdit \|\| busy\}/);
    expect(grid).not.toMatch(/disabled=\{!canEdit \|\| busy \|\| isUnusable\}/);
    // Click path allows selecting unusable for clear; double-click still blocked for place.
    expect(grid).toContain("if (isUnusable) return;");
    expect(grid).toContain("Unusable cells must remain selectable");
    // Empty selection uses the same plain/Shift model as filled blocks.
    expect(grid).toContain("applyEmptyCellSelection(cell, multiModifier)");
    expect(grid).toContain("shouldEmptyCellClickSelect");
  });
});
