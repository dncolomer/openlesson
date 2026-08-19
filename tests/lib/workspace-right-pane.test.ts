import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Workspace right pane: block detail, single-empty Add, multi-empty generate shape.
 * Drives shipped pure helpers + structural wiring in WorkspaceView / AYCL / SessionList.
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
import { BLOCK_MAP_TOOL_STRIP, visibleBlockMapTools } from "@/lib/block-map-tools";

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
      resolveEmptySelectionSurface({ selectedEmptyCells: [] }),
    ).toBeNull();

    writeEvidence(
      "multi-empty-right-pane-resolve.log",
      [
        "singleSurface=" +
          JSON.stringify(resolveEmptySelectionSurface({ selectedEmptyCells: [a] })),
        "multiSurface=" +
          JSON.stringify(resolveEmptySelectionSurface({ selectedEmptyCells: [a, b] })),
        "paneSingle=" +
          resolveWorkspaceRightPane(
            null,
            resolveEmptySelectionSurface({ selectedEmptyCells: [a] }),
          ),
        "paneMulti=" +
          resolveWorkspaceRightPane(
            null,
            resolveEmptySelectionSurface({ selectedEmptyCells: [a, b] }),
          ),
        "paneBlockWins=" +
          resolveWorkspaceRightPane(
            "b1",
            resolveEmptySelectionSurface({ selectedEmptyCells: [a, b] }),
          ),
        "paneMap=" + resolveWorkspaceRightPane(null, null),
        "stripHasGenerateShape=" + BLOCK_MAP_TOOL_STRIP.includes("generate_shape"),
      ].join("\n"),
    );
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

  it("WorkspaceView swaps right column among map tools, block detail, add, generate_shape", () => {
    const view = readWorkspaceViewSurface();
    expect(view).toContain("resolveWorkspaceRightPane");
    expect(view).toContain("WorkspaceBlockDetailPane");
    expect(view).toContain("WorkspaceMapAuthoringPane");
    expect(view).toContain("WorkspaceAddBlockPane");
    expect(view).toContain("WorkspaceGenerateShapePane");
    expect(view).toContain("WorkspaceBlockLocalContextPanel");
    expect(view).toContain("expandedBlockId");
    expect(view).toContain("emptySurface");
    expect(view).toContain("handleCloseBlockDetail");
    expect(view).toContain("handleCloseEmptyCreate");
    expect(view).toContain("handleSubmitAddBlock");
    expect(view).toContain("handleSubmitGenerateShape");
    expect(view).toContain("nextWorkspaceMapSelection");
    expect(view).toContain("onMapSelectionChange");
    expect(view).toContain("data-workspace-right-pane=");
    expect(view).toContain('showMapExplore ? "map_explore" : rightPane');
    expect(view).toContain("onExpandedNodeIdChange");
    expect(view).toContain('rightPane === "add_block"');
    expect(view).toContain('rightPane === "generate_shape"');
    expect(view).toContain("/api/workspace/add-block-at-slot");
    expect(view).toContain('op: "generate_shape"');
    // Notes/files live under Context section, not map right pane default
    expect(view).toContain("data-workspace-context-section");
    // No map-covering drawer from SessionList path
    expect(view).not.toContain("BlockDetailDrawer");
  });

  it("AyclWorkspaceView shares the same right-pane open/close path including add + shape", () => {
    const aycl = read("components/AyclWorkspaceView.tsx");
    const view = readWorkspaceViewSurface();
    // AYCL is a token/access wrapper — right pane lives on WorkspaceView.
    expect(aycl).toContain("<WorkspaceView");
    expect(aycl).toContain("ayclToken={accessToken}");
    expect(view).toContain("resolveWorkspaceRightPane");
    expect(view).toContain("WorkspaceBlockDetailPane");
    expect(view).toContain("WorkspaceMapAuthoringPane");
    expect(view).toContain("WorkspaceAddBlockPane");
    expect(view).toContain("WorkspaceGenerateShapePane");
    expect(view).toContain("handleCloseBlockDetail");
    expect(view).toContain("handleCloseEmptyCreate");
    expect(view).toContain("onExpandedNodeIdChange");
    expect(view).toContain("onMapSelectionChange");
    expect(view).toContain('rightPane === "add_block"');
    expect(view).toContain('rightPane === "generate_shape"');
    expect(aycl).not.toContain("BlockDetailDrawer");
    expect(view).not.toContain("BlockDetailDrawer");
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

  it("split drawer UI: visual, splitting prompt, submit wires op split", () => {
    const pane = read("components/WorkspaceSplitBlockPane.tsx");
    expect(pane).toContain("data-workspace-split-block-pane");
    expect(pane).toContain("data-split-visual");
    expect(pane).toContain("data-split-prompt");
    expect(pane).toContain("data-split-submit");
    expect(pane).toMatch(/Splitting prompt/);
    expect(pane).toMatch(/broader multi-cell|focused/i);

    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("WorkspaceSplitBlockPane");
    expect(detail).toContain('drawerId="split"');
    expect(detail).toContain('title="Split"');
    expect(detail).toContain("onSplitBlock");
    expect(detail).toContain("blockOffersSplitDrawer");

    const view = readWorkspaceViewSurface();
    expect(view).toContain("handleSplitBlock");
    expect(view).toContain('op: "split"');
    expect(view).toContain("onSplitBlock={isOwner ? handleSplitBlock");

    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("<WorkspaceView");
    expect(view).toContain("handleSplitBlock");
    expect(view).toContain('op: "split"');

    const ops = read("lib/workspace-grid-ops/split.ts");
    expect(ops).toContain("userGuidance:");
    expect(ops).toMatch(/composeSplitBlockUserPrompt\([\s\S]*userGuidance/);

    writeEvidence(
      "split-drawer-ui.log",
      [
        "panePrompt=" + pane.includes("data-split-prompt"),
        "paneSubmit=" + pane.includes("data-split-submit"),
        "detailDrawer=" + detail.includes('drawerId="split"'),
        "viewSplitOp=" + view.includes('op: "split"'),
        "opsGuidance=" + ops.includes("userGuidance:"),
      ].join("\n"),
    );
  });

  it("combine blocks pane: A+B visual, broader copy, combination prompt, merge op", () => {
    const pane = read("components/WorkspaceCombineBlocksPane.tsx");
    expect(pane).toContain("data-workspace-combine-blocks-pane");
    expect(pane).toContain("data-combine-visual");
    expect(pane).toContain('data-combine-layout="stack"');
    expect(pane).toContain("data-combine-source-list");
    expect(pane).toContain("data-combine-plus");
    expect(pane).toContain("data-combine-result");
    expect(pane).toContain("data-combine-prompt");
    expect(pane).toContain("data-combine-submit");
    expect(pane).toMatch(/broader/i);
    expect(pane).toContain("Combination prompt");
    expect(pane).toContain("areBlocksContiguous");
    // Stack layout — no wide side-by-side wrap for 3+ cards
    expect(pane).not.toContain("flex-wrap items-center justify-center");

    const view = readWorkspaceViewSurface();
    expect(view).toContain("WorkspaceCombineBlocksPane");
    expect(view).toContain('rightPane === "combine_blocks"');
    expect(view).toContain("handleCombineBlocks");
    expect(view).toContain('op: "merge"');
    expect(view).toContain("onMapSelectionChange");

    const grid = readMapGridSurface();
    expect(grid).toContain("onMapSelectionChange");
    expect(grid).toContain("onMapSelectionChange(selection)");
    expect(grid).not.toContain("notifyMapHostCommit");
    expect(grid).not.toContain("emitFilledBlockSelection");

    const list = read("components/SessionList.tsx");
    expect(list).toContain("onMapSelectionChange");

    writeEvidence(
      "combine-blocks-ui.log",
      [
        "paneVisual=" + pane.includes("data-combine-visual"),
        "plus=" + pane.includes("data-combine-plus"),
        "prompt=" + pane.includes("data-combine-prompt"),
        "viewMerge=" + view.includes('op: "merge"'),
        "gridEmit=" + grid.includes("onMapSelectionChange(selection)"),
      ].join("\n"),
    );
  });

  it("block detail stacks Details + Local context + Simulation; simulation collapsed; no X", () => {
    const pane = read("components/WorkspaceBlockDetailPane.tsx");
    const drawer = read("components/WorkspaceRightPaneDrawer.tsx");

    expect(pane).toContain("WorkspaceRightPaneDrawer");
    expect(pane).toContain("WorkspaceRightPaneDrawerGroup");
    expect(pane).toContain("data-workspace-block-detail-pane");
    expect(pane).toContain("data-block-detail-drawers");
    // Accordion: opening one drawer collapses siblings
    expect(pane).toContain("resolveDetailDrawerDefaultOpenId");
    expect(drawer).toContain("nextAccordionOpenDrawerId");
    expect(drawer).toContain("data-drawer-accordion");
    // Peer top-level drawers — no Sessions/detail drawer (Edit owns title/body)
    expect(pane).not.toContain('drawerId="detail"');
    expect(pane).toContain('drawerId="local"');
    expect(pane).toContain('drawerId="simulation"');
    expect(pane).toContain('drawerId="edit"');
    expect(pane).toContain("WORKSPACE_EDITOR_DANGER_DRAWER_ID");
    expect(pane).toContain("WorkspaceBlockDangerPanel");
    expect(pane).toContain('title="Local context"');
    expect(pane).toContain('title="Block Simulation"');
    expect(pane).toContain("WorkspaceBlockSimulationPanel");
    // Order: simulation → … → edit → danger → … → local
    expect(pane).toMatch(
      /drawerId="simulation"[\s\S]*?drawerId="edit"[\s\S]*?WORKSPACE_EDITOR_DANGER_DRAWER_ID[\s\S]*?drawerId="local"/,
    );
    // Simulation collapsed; local opens when materials exist
    expect(pane).toMatch(
      /drawerId="local"[\s\S]*?defaultExpanded=\{hasLocalMaterials\}/,
    );
    expect(pane).toMatch(
      /drawerId="simulation"[\s\S]*?defaultExpanded=\{false\}/,
    );
    // No X close on drawer chrome
    expect(pane).not.toContain("data-block-detail-close");
    expect(pane).not.toContain("onClose={");
    expect(drawer).not.toContain("onClose");
    expect(drawer).not.toContain("closeDataAttr");
    expect(drawer).not.toContain("lucide-react");
    expect(drawer).not.toContain("data-add-block-close");
    expect(drawer).not.toContain("data-generate-shape-close");
    expect(drawer).not.toContain("data-block-detail-close");
    expect(drawer).toContain("data-workspace-right-pane-drawer-toggle");

    writeEvidence(
      "block-detail-top-level-drawers.log",
      [
        "detailDrawer=" + pane.includes('drawerId="detail"'),
        "editDrawer=" + pane.includes('drawerId="edit"'),
        "dangerDrawer=" + pane.includes("WORKSPACE_EDITOR_DANGER_DRAWER_ID"),
        "localDrawer=" + pane.includes('drawerId="local"'),
        "simulationDrawer=" + pane.includes('drawerId="simulation"'),
        "simulationCollapsedDefault=" +
          /drawerId="simulation"[\s\S]*?defaultExpanded=\{false\}/.test(pane),
        "noXOnShell=" + !drawer.includes("closeDataAttr"),
      ].join("\n"),
    );
  });

  it("right-pane forms use top-anchored full-width collapsible drawers (no floating cards, no X)", () => {
    const drawer = read("components/WorkspaceRightPaneDrawer.tsx");
    expect(drawer).toContain("data-workspace-right-pane-drawer");
    expect(drawer).toContain('data-drawer-anchor="top"');
    expect(drawer).toContain('data-drawer-width="full"');
    expect(drawer).toContain("data-workspace-right-pane-drawer-header");
    expect(drawer).toContain("data-workspace-right-pane-drawer-body");
    expect(drawer).toContain("data-workspace-right-pane-drawer-toggle");
    expect(drawer).toContain("data-drawer-expanded");
    expect(drawer).toContain("nextRightPaneDrawerExpanded");
    // Full width flex column; not a floating inset card
    expect(drawer).toMatch(/h-full w-full min-h-0 flex-col|w-full.*flex-col/);
    expect(drawer).not.toMatch(/rounded-xl border border-neutral-800\/80 bg-neutral-950\/90 shadow-\[0_10px/);
    expect(drawer).not.toContain("shadow-[0_10px_40px");
    expect(drawer).not.toContain("max-w-md");
    // No close X anywhere on shared drawer
    expect(drawer).not.toContain("onClose");
    expect(drawer).not.toContain("closeDataAttr");
    expect(drawer).not.toContain("from \"lucide-react\"");

    expect(nextRightPaneDrawerExpanded(true, "toggle")).toBe(false);
    expect(nextRightPaneDrawerExpanded(false, "toggle")).toBe(true);
    expect(nextRightPaneDrawerExpanded(false, "open")).toBe(true);
    expect(nextRightPaneDrawerExpanded(true, "close")).toBe(false);

    // Accordion: open one → that id; re-click → collapse all
    expect(
      nextAccordionOpenDrawerId({ currentOpenId: "detail", clickedId: "simulation" }),
    ).toBe("simulation");
    expect(
      nextAccordionOpenDrawerId({ currentOpenId: "simulation", clickedId: "simulation" }),
    ).toBeNull();
    expect(
      nextAccordionOpenDrawerId({ currentOpenId: null, clickedId: "edit" }),
    ).toBe("edit");
    expect(
      initialAccordionOpenDrawerId([
        { id: "detail", defaultExpanded: true },
        { id: "local", defaultExpanded: true },
      ]),
    ).toBe("detail");
    expect(
      initialAccordionOpenDrawerId([
        { id: "simulation", defaultExpanded: false },
        { id: "local", defaultExpanded: true },
      ]),
    ).toBe("local");

    for (const rel of [
      "components/WorkspaceBlockDetailPane.tsx",
      "components/WorkspaceAddBlockPane.tsx",
      "components/WorkspaceGenerateShapePane.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("WorkspaceRightPaneDrawer");
      expect(src, rel).not.toMatch(
        /rounded-xl border border-neutral-800\/80 bg-neutral-950\/90 shadow-\[0_10px/,
      );
      expect(src, rel).not.toContain("shadow-[0_10px_40px_rgba(0,0,0,0.35)]");
      expect(src, rel).not.toContain("closeDataAttr");
    }

    const add = read("components/WorkspaceAddBlockPane.tsx");
    expect(add).toContain("data-workspace-add-block-pane");
    expect(add).toContain("data-add-block-submit");
    // Empty cell: only the Add drawer (attach context is inside it)
    expect(add).toContain('drawerId="add"');
    expect(add).toContain("data-add-block-context-picker");
    expect(add).not.toContain('drawerId="local"');
    expect(add).not.toContain('drawerId="effect_dynamic"');
    expect(add).not.toContain('drawerId="effect_generator"');
    expect(add).toContain('variant="section"');
    expect(add).not.toContain("data-add-block-close");

    const shape = read("components/WorkspaceGenerateShapePane.tsx");
    expect(shape).toContain('paneKind="generate_shape"');
    expect(shape).toContain("data-workspace-generate-shape-pane");
    expect(shape).toContain("data-generate-shape-submit");
    expect(shape).not.toContain("data-generate-shape-close");

    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).toContain("data-workspace-block-detail-pane");
    expect(detail).not.toContain("data-block-detail-close");

    // Hosts: edge-to-edge column; no nested WorkspaceBlockDetailTabs
    const view = readWorkspaceViewSurface();
    expect(view).toContain("overflow-hidden p-0");
    expect(view).toContain("WorkspaceBlockDetailPane");
    expect(view).not.toContain("WorkspaceBlockDetailTabs");
    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("<WorkspaceView");
    expect(view).toContain("overflow-hidden p-0");
    expect(aycl).not.toContain("WorkspaceBlockDetailTabs");

    writeEvidence(
      "right-pane-drawer-chrome.log",
      [
        "drawerShell=" + drawer.includes("data-workspace-right-pane-drawer"),
        "anchorTop=" + drawer.includes('data-drawer-anchor="top"'),
        "widthFull=" + drawer.includes('data-drawer-width="full"'),
        "noFloatingShadow=" + !drawer.includes("shadow-[0_10px_40px"),
        "noCloseX=" + !drawer.includes("closeDataAttr"),
        "toggle=" + String(nextRightPaneDrawerExpanded(true, "toggle") === false),
        "addUsesDrawer=" + add.includes("WorkspaceRightPaneDrawer"),
        "shapeUsesDrawer=" + shape.includes("WorkspaceRightPaneDrawer"),
        "detailUsesDrawer=" + detail.includes("WorkspaceRightPaneDrawer"),
        "viewEdgeToEdge=" + /overflow-hidden p-0/.test(view),
      ].join("\n"),
    );
    writeEvidence(
      "block-detail-drawer-no-x-tests.log",
      [
        "shellNoOnClose=" + !drawer.includes("onClose"),
        "shellNoLucideX=" + !drawer.includes("lucide-react"),
        "detailNoClose=" + !detail.includes("data-block-detail-close"),
        "addNoClose=" + !add.includes("data-add-block-close"),
        "shapeNoClose=" + !shape.includes("data-generate-shape-close"),
      ].join("\n"),
    );
  });

  it("empty single → Add pane; multi empty → shape pane; no toolbar generate_shape required", () => {
    const grid = readMapGridSurface();
    const addPane = read("components/WorkspaceAddBlockPane.tsx");
    const shapePane = read("components/WorkspaceGenerateShapePane.tsx");
    const list = read("components/SessionList.tsx");
    const tools = read("lib/block-map-tools.ts");

    expect(grid).toContain("onMapSelectionChange");
    expect(grid).toContain("resolveEmptySelectionSurface");
    expect(grid).not.toContain("handleEmptyCellDoubleClick");
    expect(grid).not.toContain("double-click empty to add");
    // Multi empty does not require setShapePromptOpen(true) for right-pane path
    expect(grid).toContain("useRightPaneEmpty");
    expect(addPane).toContain("data-workspace-add-block-pane");
    expect(shapePane).toContain("data-workspace-generate-shape-pane");
    expect(shapePane).toContain("data-generate-shape-submit");
    expect(shapePane).toContain("onSubmit");
    expect(shapePane).toContain("data-shape-context-picker");
    // Strip no longer lists generate_shape as a required opener
    expect(BLOCK_MAP_TOOL_STRIP).not.toContain("generate_shape");
    expect(tools).toMatch(/generate_shape is omitted/);
    const stripVisible = visibleBlockMapTools({
      canEdit: true,
      hasGridOps: true,
    });
    expect(stripVisible).not.toContain("generate_shape");

    expect(list).toContain("onMapSelectionChange");
    expect(list).toContain("mapSelection={mapSelection}");
    expect(list).not.toContain("onEmptySelectionChange");
    expect(list).not.toMatch(
      /onMapSelectionChange \? undefined : onEmptySelectionChange/,
    );

    writeEvidence(
      "multi-empty-right-pane-tests.log",
      [
        "gridOnEmptySelection=" + grid.includes("onMapSelectionChange"),
        "shapePane=" + shapePane.includes("data-workspace-generate-shape-pane"),
        "shapeSubmit=" + shapePane.includes("data-generate-shape-submit"),
        "stripHasGenerateShape=" + BLOCK_MAP_TOOL_STRIP.includes("generate_shape"),
        "visibleHasGenerateShape=" + stripVisible.includes("generate_shape"),
        "viewShapePane=" +
          readWorkspaceViewSurface().includes("WorkspaceGenerateShapePane"),
        "viewOpGenerateShape=" +
          readWorkspaceViewSurface().includes('op: "generate_shape"'),
      ].join("\n"),
    );
  });
});
