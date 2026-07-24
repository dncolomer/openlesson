import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeDataBounds,
  computeProjectionFitBounds,
  selectProjectionDisplayPoints,
  fitViewTransform,
  zoomViewTransform,
  panViewTransform,
  dataToScreen,
  screenToData,
  mapRadiusToScreen,
  generateAxisTicks,
  generateGridTicks,
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
} from "@/lib/knowledge-config/projection-view";

const screen = { width: 960, height: 560, margin: 48 };

describe("projection-view helpers (shipped)", () => {
  it("computeDataBounds expands for points and region radii", () => {
    const b = computeDataBounds(
      [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
      [{ x: 1, y: 1, radius: 0.5 }],
    );
    expect(b).not.toBeNull();
    expect(b!.minX).toBeCloseTo(0);
    expect(b!.maxX).toBeCloseTo(2);
    expect(b!.minY).toBeCloseTo(0);
    expect(b!.maxY).toBeCloseTo(1.5);
  });

  it("fitViewTransform + zoom increases scale (smaller span)", () => {
    const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    const fit = fitViewTransform(bounds, { zoom: 1 });
    expect(fit.zoom).toBe(1);
    expect(fit.spanX).toBeGreaterThan(0);
    expect(Number.isFinite(fit.originX)).toBe(true);

    const midX = fit.originX + fit.spanX / 2;
    const midY = fit.originY + fit.spanY / 2;
    const zoomed = zoomViewTransform(fit, 2, midX, midY);
    expect(zoomed.zoom).toBe(2);
    expect(zoomed.spanX).toBeCloseTo(fit.spanX / 2, 8);
    // Focus point stays fixed under zoom.
    const before = dataToScreen(midX, midY, fit, screen);
    const after = dataToScreen(midX, midY, zoomed, screen);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });

  it("dataToScreen / screenToData round-trip", () => {
    const view = fitViewTransform({ minX: 0, maxX: 10, minY: -5, maxY: 5 });
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 2.5 },
      { x: 10, y: -5 },
    ];
    for (const p of pts) {
      const s = dataToScreen(p.x, p.y, view, screen);
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
      const back = screenToData(s.x, s.y, view, screen);
      expect(back.x).toBeCloseTo(p.x, 8);
      expect(back.y).toBeCloseTo(p.y, 8);
    }
  });

  it("panViewTransform shifts origin and mapRadiusToScreen is positive", () => {
    const view = fitViewTransform({ minX: 0, maxX: 4, minY: 0, maxY: 4 });
    const panned = panViewTransform(view, 1, -0.5);
    expect(panned.originX).toBeCloseTo(view.originX + 1);
    expect(panned.originY).toBeCloseTo(view.originY - 0.5);
    const r = mapRadiusToScreen(0.2, view, screen);
    expect(r).toBeGreaterThan(4);
    expect(Number.isFinite(r)).toBe(true);
  });

  it("generateAxisTicks covers min/max with finite labels", () => {
    const ticks = generateAxisTicks(-1.2, 3.4, 6);
    expect(ticks.length).toBeGreaterThan(2);
    // Nice ticks sit within/around the range (first ≥ min after ceil, last ≤ max+step).
    expect(ticks[0].value).toBeGreaterThanOrEqual(-1.2 - 1e-9);
    expect(ticks[ticks.length - 1].value).toBeLessThanOrEqual(3.4 + 1);
    expect(ticks[0].value).toBeLessThan(ticks[ticks.length - 1].value);
    for (const t of ticks) {
      expect(Number.isFinite(t.value)).toBe(true);
      expect(t.label.length).toBeGreaterThan(0);
    }
    const grid = generateGridTicks(fitViewTransform({ minX: -2, maxX: 2, minY: -2, maxY: 2 }));
    expect(grid.xTicks.length).toBeGreaterThan(2);
    expect(grid.yTicks.length).toBeGreaterThan(2);
  });

  it("clampZoom enforces min/max", () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
    expect(clampZoom(2)).toBe(2);
  });

  it("selectProjectionDisplayPoints latest keeps only last coord", () => {
    const pts = [
      { x: 0, y: 0, id: 1 },
      { x: 1, y: 1, id: 2 },
      { x: 3, y: -1, id: 3 },
    ];
    expect(selectProjectionDisplayPoints(pts, "trajectory")).toHaveLength(3);
    const latest = selectProjectionDisplayPoints(pts, "latest");
    expect(latest).toHaveLength(1);
    expect(latest[0]).toEqual({ x: 3, y: -1, id: 3 });
  });

  it("computeProjectionFitBounds latest + region includes both in min/max", () => {
    const coords = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 1, y: 1 }, // latest
    ];
    const regions = [{ x: 5, y: 0, radius: 1 }];
    const traj = computeProjectionFitBounds(coords, regions, "trajectory");
    const latest = computeProjectionFitBounds(coords, regions, "latest");
    expect(traj).not.toBeNull();
    expect(latest).not.toBeNull();
    // Trajectory spans full path; latest ignores early far points.
    expect(traj!.maxX).toBeGreaterThanOrEqual(10);
    expect(latest!.maxX).toBeLessThan(10);
    // Latest mode still frames the selected region disk + latest point.
    expect(latest!.minX).toBeLessThanOrEqual(1);
    expect(latest!.maxX).toBeGreaterThanOrEqual(5 + 1 - 1e-9);
    expect(latest!.minY).toBeLessThanOrEqual(0 - 1 + 1e-9);
    expect(latest!.maxY).toBeGreaterThanOrEqual(1);
  });
});

describe("projection widget surface (Embeddings)", () => {
  it("mounts professional projection markers, large canvas, and latest-mode toggle", () => {
    const src = readFileSync(
      join(process.cwd(), "components/KnowledgeConfigTrajectoryPanel.tsx"),
      "utf8",
    );
    expect(src).toContain("ProjectionSpaceWidget");
    expect(src).toContain("data-projection-widget");
    expect(src).toContain("data-projection-professional");
    expect(src).toContain("data-projection-grid");
    expect(src).toContain("data-projection-axes");
    expect(src).toContain("data-projection-zoom-controls");
    expect(src).toContain("data-projection-canvas");
    expect(src).toContain("data-projection-display-toggle");
    expect(src).toContain("data-projection-mode-latest");
    expect(src).toContain("data-projection-mode-trajectory");
    expect(src).toContain("data-projection-latest-position");
    // Multi-subject display uses panel-local selectDisplayCoords (latest-per-subject).
    expect(src).toContain("selectDisplayCoords");
    expect(src).toContain("computeProjectionFitBounds");
    expect(src).toContain("resolveEmbeddingsSubjectSelection");
    expect(src).toContain("data-embeddings-user-multiselect");
    expect(src).toContain("min-h-[28rem]");
    expect(src).not.toMatch(/className="h-56 w-full rounded-xl border border-neutral-800 bg-neutral-950\/80"/);
    expect(src).toContain("fitViewTransform");
    expect(src).toContain("zoomViewTransform");
    expect(src).toContain("generateGridTicks");
  });
});
