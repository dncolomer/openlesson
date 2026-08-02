/**
 * Pure Bridge Blocks corridor geometry + knowledge prompt framing.
 * Structural checks wire multi-select UI into expand-job create path.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRIDGE_MAX_HALF_WIDTH,
  bridgeAnchorsFromPlacedBlocks,
  bridgeHalfWidthForDensity,
  buildBridgeKnowledgePrompt,
  clampBridgeDensity,
  defaultMultiSelectDrawer,
  lineCellsBetween,
  polylineCells,
  resolveBridgeSelection,
  thickenCorridor,
} from "@/lib/bridge-blocks";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.BRIDGE_BLOCKS_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-13324bdfeaef/implementer";

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

describe("bridge geometry", () => {
  it("line + multi-anchor polyline is straight; density caps thickness", () => {
    const line = lineCellsBetween({ row: 0, col: 0 }, { row: 0, col: 4 });
    expect(line).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ]);

    const poly = polylineCells([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 2, col: 3 },
    ]);
    expect(poly[0]).toEqual({ row: 0, col: 0 });
    expect(poly.some((c) => c.row === 0 && c.col === 3)).toBe(true);
    expect(poly[poly.length - 1]).toEqual({ row: 2, col: 3 });

    expect(bridgeHalfWidthForDensity(0)).toBe(0);
    expect(bridgeHalfWidthForDensity(100)).toBe(BRIDGE_MAX_HALF_WIDTH);
    expect(bridgeHalfWidthForDensity(999)).toBe(BRIDGE_MAX_HALF_WIDTH);
    expect(clampBridgeDensity(150)).toBe(100);

    const thick = thickenCorridor(
      [{ row: 5, col: 5 }],
      BRIDGE_MAX_HALF_WIDTH + 10,
    );
    // Chebyshev ball radius ≤ MAX only
    for (const c of thick) {
      expect(Math.max(Math.abs(c.row - 5), Math.abs(c.col - 5))).toBeLessThanOrEqual(
        BRIDGE_MAX_HALF_WIDTH,
      );
    }
  });

  it("resolveBridgeSelection excludes occupied/unusable; density thickens full spine between anchors", () => {
    const occupied = new Set(["0:1", "0:2"]);
    const unusable = new Set(["0:3"]);
    const r = resolveBridgeSelection({
      anchors: [
        { row: 0, col: 0 },
        { row: 0, col: 5 },
      ],
      density: 100,
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });
    const keys = r.selected.map((c) => `${c.row}:${c.col}`);
    expect(keys).not.toContain("0:1");
    expect(keys).not.toContain("0:2");
    expect(keys).not.toContain("0:3");
    // Placeable endpoints / free cells remain
    expect(keys).toContain("0:0");
    expect(keys).toContain("0:4");
    expect(keys).toContain("0:5");

    // Thin density (halfWidth 0): full placeable spine between distant anchors —
    // not a prefix near the first point only.
    const thin = resolveBridgeSelection({
      anchors: [
        { row: 2, col: 0 },
        { row: 2, col: 20 },
      ],
      density: 0,
      occupiedKeys: new Set(),
    });
    expect(thin.halfWidth).toBe(0);
    expect(thin.selected.length).toBe(21); // cols 0..20 inclusive
    const thinCols = thin.selected.map((c) => c.col).sort((a, b) => a - b);
    expect(thinCols[0]).toBe(0);
    expect(thinCols[thinCols.length - 1]).toBe(20);
    for (const c of thin.selected) {
      expect(c.row).toBe(2);
    }
    // Default / mid density still spans both ends
    const mid = resolveBridgeSelection({
      anchors: [
        { row: 2, col: 0 },
        { row: 2, col: 20 },
      ],
      density: 20,
      occupiedKeys: new Set(),
    });
    const midCols = mid.selected.map((c) => c.col);
    expect(Math.min(...midCols)).toBeLessThanOrEqual(0);
    expect(Math.max(...midCols)).toBeGreaterThanOrEqual(20);

    const fat = resolveBridgeSelection({
      anchors: [
        { row: 2, col: 0 },
        { row: 2, col: 6 },
      ],
      density: 100,
      occupiedKeys: new Set(),
    });
    expect(fat.halfWidth).toBe(BRIDGE_MAX_HALF_WIDTH);
    expect(fat.candidates.length).toBeGreaterThan(thin.candidates.length);
    // Density does not prefix-truncate: selected === full placeable corridor
    expect(fat.selected).toEqual(fat.candidates);

    // Over-thick density still clamped
    const over = resolveBridgeSelection({
      anchors: [
        { row: 10, col: 0 },
        { row: 10, col: 4 },
      ],
      density: 10_000,
    });
    expect(over.halfWidth).toBe(BRIDGE_MAX_HALF_WIDTH);

    writeEvidence(
      "bridge-geometry.log",
      [
        "maxHalf=" + BRIDGE_MAX_HALF_WIDTH,
        "thinHalf=" + thin.halfWidth,
        "thinSpansBothEnds=" +
          String(thinCols[0] === 0 && thinCols[thinCols.length - 1] === 20),
        "thinSelectedN=" + thin.selected.length,
        "midSpansFar=" + String(Math.max(...midCols) >= 20),
        "fatHalf=" + fat.halfWidth,
        "selectedFreeOfOccupied=" +
          String(!keys.includes("0:1") && !keys.includes("0:2")),
        "overClamped=" + String(over.halfWidth === BRIDGE_MAX_HALF_WIDTH),
        "noPrefixSample=" +
          String(
            fat.selected.length === fat.candidates.length &&
              thin.selected.length === thin.candidates.length,
          ),
        "fatCandidatesGtThin=" +
          String(fat.candidates.length > thin.candidates.length),
      ].join("\n"),
    );
  });

  it("anchors from placed blocks + knowledge prompt forces bridge framing", () => {
    const anchors = bridgeAnchorsFromPlacedBlocks([
      { id: "a", position_x: 1, position_y: 2 },
      { id: "b", position_x: 5, position_y: 2 },
      { id: "c", position_x: null, position_y: 0 },
    ]);
    expect(anchors).toEqual([
      { row: 2, col: 1 },
      { row: 2, col: 5 },
    ]);

    const prompt = buildBridgeKnowledgePrompt({
      blockTitles: ["Photosynthesis", "Cellular respiration"],
      userGuidance: "focus on energy transfer",
      slotIndex: 0,
      totalSlots: 3,
      cell: { row: 2, col: 3 },
    });
    expect(prompt).toMatch(/knowledge-bridge|knowledge bridge/i);
    expect(prompt).toMatch(/Photosynthesis/);
    expect(prompt).toMatch(/Cellular respiration/);
    expect(prompt).toMatch(/energy transfer/);
    expect(prompt).toMatch(/Bridge slot 1 of 3/);
    // Even sparse user guidance still forces link framing
    const sparse = buildBridgeKnowledgePrompt({
      blockTitles: ["A", "B"],
    });
    expect(sparse).toMatch(/link|bridge|connecting/i);
    expect(sparse).toMatch(/"A"/);
    expect(sparse).toMatch(/"B"/);

    writeEvidence(
      "bridge-job-prompt.log",
      [
        "hasKnowledgeBridge=" + /knowledge-bridge|knowledge bridge/i.test(prompt),
        "hasBothTitles=" +
          String(
            prompt.includes("Photosynthesis") &&
              prompt.includes("Cellular respiration"),
          ),
        "hasUserGuidance=" + prompt.includes("energy transfer"),
        "sparseForcesBridge=" + /bridge|link|connecting/i.test(sparse),
        "hostsUsePrompt=" +
          read("components/WorkspaceView.tsx").includes(
            "buildBridgeKnowledgePrompt",
          ),
        "ayclUsesPrompt=" +
          read("components/AyclWorkspaceView.tsx").includes(
            "buildBridgeKnowledgePrompt",
          ),
        "hostsRunExpandLoop=" +
          read("components/WorkspaceView.tsx").includes(
            "handleGenerateBridge",
          ),
      ].join("\n"),
    );
  });
});

describe("structural: Bridge Blocks multi-select UI + job wire", () => {
  it("default drawer: contiguous → combine, gaps → bridge", () => {
    expect(defaultMultiSelectDrawer(true)).toBe("combine");
    expect(defaultMultiSelectDrawer(false)).toBe("bridge");
  });

  it("Combine pane mounts Bridge drawer; hosts enqueue expand jobs", () => {
    const pane = read("components/WorkspaceCombineBlocksPane.tsx");
    expect(pane).toContain("Bridge Blocks");
    expect(pane).toContain("data-bridge-blocks-pane");
    expect(pane).toContain("data-bridge-density");
    expect(pane).toContain("data-bridge-density-input");
    expect(pane).toContain("data-bridge-prompt");
    expect(pane).toContain("data-bridge-generate");
    expect(pane).toContain("resolveBridgeSelection");
    expect(pane).toContain("onGenerateBridge");
    expect(pane).toContain("Generate bridge");
    // Corridor highlight while Bridge drawer is open; density defaults to min.
    expect(pane).toContain("BRIDGE_DENSITY_MIN");
    expect(pane).toContain("useState(BRIDGE_DENSITY_MIN)");
    expect(pane).toContain('openDrawerId === "bridge"');
    expect(pane).toContain("onBridgePreviewChange");
    expect(pane).toContain("data-bridge-drawer-open");
    // Smart defaults: Bridge expands when selection is not edge-contiguous
    expect(pane).toContain("defaultExpanded={contiguous}");
    expect(pane).toContain("defaultExpanded={!contiguous}");
    // Accordion: combine + bridge collapse each other
    expect(pane).toContain("WorkspaceRightPaneDrawerGroup");
    expect(pane).toContain('drawerId="combine"');
    expect(pane).toContain('drawerId="bridge"');
    expect(pane).toContain("openId={openDrawerId}");

    const view = read("components/WorkspaceView.tsx");
    expect(view).toContain("handleGenerateBridge");
    expect(view).toContain("onGenerateBridge={handleGenerateBridge}");
    expect(view).toContain("buildBridgeKnowledgePrompt");
    expect(view).toContain("runAddExpandCreateLoop");
    expect(view).toContain("createAddExpandJob");
    // Bridge job uses frozen slots from corridor selection
    expect(view).toMatch(/handleGenerateBridge[\s\S]*frozenSlots/);

    const aycl = read("components/AyclWorkspaceView.tsx");
    expect(aycl).toContain("handleGenerateBridge");
    expect(aycl).toContain("onGenerateBridge={handleGenerateBridge}");
    expect(aycl).toContain("buildBridgeKnowledgePrompt");

    const lib = read("lib/bridge-blocks.ts");
    expect(lib).toContain("export function resolveBridgeSelection");
    expect(lib).toContain("BRIDGE_MAX_HALF_WIDTH");
    expect(lib).toContain("export function buildBridgeKnowledgePrompt");

    writeEvidence(
      "bridge-ui.log",
      [
        "hasDrawerTitle=" + pane.includes("Bridge Blocks"),
        "hasDensity=" + pane.includes("data-bridge-density"),
        "hasPrompt=" + pane.includes("data-bridge-prompt"),
        "hasGenerate=" + pane.includes("data-bridge-generate"),
        "viewWire=" + view.includes("handleGenerateBridge"),
        "ayclWire=" + aycl.includes("handleGenerateBridge"),
        "usesExpandJob=" + view.includes("runAddExpandCreateLoop"),
      ].join("\n"),
    );
  });
});
