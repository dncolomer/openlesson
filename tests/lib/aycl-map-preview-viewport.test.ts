/**
 * AYCL landing view-only map preview: live minimap viewport window.
 * Drives the shipped camera→rect helper BlockSkillGrid uses.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
  projectMinimapTiles,
  resolveMinimapViewportWindow,
} from "@/lib/map-minimap-clusters";
import {
  getPanToCenterCell,
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-72d37baff7e6/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function finiteRect(
  rect: { x: number; y: number; w: number; h: number } | null,
): rect is { x: number; y: number; w: number; h: number } {
  return (
    !!rect &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.w) &&
    Number.isFinite(rect.h) &&
    rect.w > 0 &&
    rect.h > 0
  );
}

describe("resolveMinimapViewportWindow (shipped projector)", () => {
  const placements = [
    {
      id: "a",
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
    },
    {
      id: "b",
      cells: [
        { row: 0, col: 8 },
        { row: 0, col: 9 },
        { row: 1, col: 8 },
        { row: 1, col: 9 },
      ],
    },
    {
      id: "c",
      cells: [
        { row: 10, col: 0 },
        { row: 10, col: 1 },
        { row: 11, col: 0 },
        { row: 11, col: 1 },
      ],
    },
  ];

  const view = projectMinimapTiles({
    placements,
    width: MINIMAP_FRAME_WIDTH,
    height: MINIMAP_FRAME_HEIGHT,
    padding: MINIMAP_FRAME_PADDING,
  });

  const camera = {
    tileCount: view.tiles.length,
    bounds: view.bounds,
    cellSize: view.cellSize,
    viewportWidth: 800,
    viewportHeight: 600,
    pitch: SKILL_GRID_PITCH,
  };

  it("live camera yields a finite rect; pan/zoom move it; empty/invalid yield none", () => {
    expect(view.tiles.length).toBeGreaterThan(0);
    const pan0 = getPanToCenterCell(800, 600, { row: 5, col: 5 }, 1);
    const r0 = resolveMinimapViewportWindow({
      ...camera,
      pan: pan0,
      zoom: 1,
    });
    expect(finiteRect(r0)).toBe(true);
    if (!r0) return;

    const rRight = resolveMinimapViewportWindow({
      ...camera,
      pan: { x: pan0.x - 200, y: pan0.y },
      zoom: 1,
    });
    expect(finiteRect(rRight)).toBe(true);
    if (!rRight) return;
    expect(rRight.x).toBeGreaterThan(r0.x);

    const rDown = resolveMinimapViewportWindow({
      ...camera,
      pan: { x: pan0.x, y: pan0.y - 200 },
      zoom: 1,
    });
    expect(finiteRect(rDown)).toBe(true);
    if (!rDown) return;
    expect(rDown.y).toBeGreaterThan(r0.y);

    const rIn = resolveMinimapViewportWindow({
      ...camera,
      pan: pan0,
      zoom: 2,
    });
    expect(finiteRect(rIn)).toBe(true);
    if (!rIn) return;
    expect(rIn.w).toBeLessThan(r0.w);
    expect(rIn.h).toBeLessThan(r0.h);

    const rOut = resolveMinimapViewportWindow({
      ...camera,
      pan: pan0,
      zoom: 0.5,
    });
    expect(finiteRect(rOut)).toBe(true);
    if (!rOut) return;
    expect(rOut.w).toBeGreaterThan(r0.w);
    expect(rOut.h).toBeGreaterThan(r0.h);

    const empty = resolveMinimapViewportWindow({
      ...camera,
      tileCount: 0,
      pan: pan0,
      zoom: 1,
    });
    expect(empty).toBeNull();

    const zeroViewport = resolveMinimapViewportWindow({
      ...camera,
      viewportWidth: 0,
      viewportHeight: 600,
      pan: pan0,
      zoom: 1,
    });
    expect(zeroViewport).toBeNull();

    const badZoom = resolveMinimapViewportWindow({
      ...camera,
      pan: pan0,
      zoom: 0,
    });
    expect(badZoom).toBeNull();

    writeScratch(
      "aycl-map-preview-viewport.txt",
      [
        `r0=${JSON.stringify(r0)}`,
        `panRightMovesX=${rRight.x > r0.x}`,
        `panDownMovesY=${rDown.y > r0.y}`,
        `zoomInShrinks=${rIn.w < r0.w && rIn.h < r0.h}`,
        `zoomOutGrows=${rOut.w > r0.w && rOut.h > r0.h}`,
        `emptyTiles=${String(empty)}`,
        `zeroViewport=${String(zeroViewport)}`,
        `badZoom=${String(badZoom)}`,
      ].join("\n"),
    );
  });
});

describe("AYCL landing preview mounts the viewport window", () => {
  it("view-only snapshot uses BlockSkillGrid; grid renders the projector window", () => {
    const landing = read("components/AyclLandingClient.tsx");
    const grid = read("components/BlockSkillGrid.tsx");

    expect(landing).toContain("data-aycl-map-snapshot");
    expect(landing).toContain("data-aycl-map-viewport-window");
    expect(landing).toContain("viewOnly");
    expect(landing).toContain("canEdit={false}");
    expect(landing).toContain("BlockSkillGrid");
    expect(landing).toMatch(/nodes\.length === 0/);
    expect(landing).toContain('data-aycl-map-viewport-window={nodes.length > 0 ? "live" : "none"}');

    expect(grid).toContain("resolveMinimapViewportWindow");
    expect(grid).toContain("data-minimap-viewport-window");
    expect(grid).toContain("data-minimap-viewport-rect");
    expect(grid).toContain("minimapViewportRect");
    expect(grid).toContain("data-map-view-only");

    writeScratch(
      "aycl-map-preview-excerpts.txt",
      [
        "AyclLandingClient: data-aycl-map-snapshot + viewOnly BlockSkillGrid",
        "AyclLandingClient: data-aycl-map-viewport-window live|none from nodes.length",
        "empty preview does not mount BlockSkillGrid (no invented window)",
        "BlockSkillGrid: resolveMinimapViewportWindow + data-minimap-viewport-window",
      ].join("\n"),
    );
  });
});
