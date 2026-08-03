import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRIDGE_WIDTH_MAX,
  BRIDGE_WIDTH_MIN,
  clampBridgeWidth,
  resolveBridgeSelection,
  selectCorridorByDensity,
} from "@/lib/bridge-blocks";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d5c6027932ea/implementer";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("bridge independent width + density", () => {
  it("width changes corridor candidates; density changes selected subset", () => {
    const anchors = [
      { row: 0, col: 0 },
      { row: 0, col: 6 },
    ];
    const thin = resolveBridgeSelection({
      anchors,
      width: 0,
      density: 100,
    });
    const thick = resolveBridgeSelection({
      anchors,
      width: BRIDGE_WIDTH_MAX,
      density: 100,
    });
    expect(thin.halfWidth).toBe(0);
    expect(thick.halfWidth).toBe(BRIDGE_WIDTH_MAX);
    expect(thick.candidates.length).toBeGreaterThan(thin.candidates.length);
    expect(thick.selected.length).toBe(thick.candidates.length);

    const sparse = resolveBridgeSelection({
      anchors,
      width: BRIDGE_WIDTH_MAX,
      density: 0,
    });
    const full = resolveBridgeSelection({
      anchors,
      width: BRIDGE_WIDTH_MAX,
      density: 100,
    });
    expect(sparse.selected.length).toBeLessThan(full.selected.length);
    // Same candidate pool (width fixed); density only samples
    expect(sparse.candidates.length).toBe(full.candidates.length);
    expect(sparse.halfWidth).toBe(full.halfWidth);

    // Mid density between spine-only and full
    const mid = resolveBridgeSelection({
      anchors,
      width: BRIDGE_WIDTH_MAX,
      density: 50,
    });
    expect(mid.selected.length).toBeGreaterThanOrEqual(sparse.selected.length);
    expect(mid.selected.length).toBeLessThanOrEqual(full.selected.length);
  });

  it("clampBridgeWidth bounds", () => {
    expect(clampBridgeWidth(-1)).toBe(BRIDGE_WIDTH_MIN);
    expect(clampBridgeWidth(99)).toBe(BRIDGE_WIDTH_MAX);
  });

  it("selectCorridorByDensity pure extremes", () => {
    const spine = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    const candidates = [
      ...spine,
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ];
    expect(selectCorridorByDensity(candidates, spine, 0)).toHaveLength(2);
    expect(selectCorridorByDensity(candidates, spine, 100)).toHaveLength(4);
  });

  it("UI exposes two range inputs (width + density)", () => {
    const pane = read("components/WorkspaceCombineBlocksPane.tsx");
    expect(pane).toContain("data-bridge-width-input");
    expect(pane).toContain("data-bridge-density-input");
    expect(pane).toContain("setBridgeWidth");
    expect(pane).toContain("setBridgeDensity");
    expect(pane).toMatch(/width:\s*bridgeWidth/);
    expect(pane).toMatch(/density:\s*bridgeDensity/);

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "bridge-width-density.log"),
      [
        "bridge-width-density",
        "width_input=" + pane.includes("data-bridge-width-input"),
        "density_input=" + pane.includes("data-bridge-density-input"),
        "resolve_independent=true",
      ].join("\n") + "\n",
    );
  });
});
