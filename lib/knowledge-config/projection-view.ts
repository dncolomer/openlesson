/**
 * Pure view-transform helpers for the Embeddings projection widget.
 * Maps knowledgecfg 2D frame coordinates ↔ SVG screen space with zoom/pan.
 */

export interface DataBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ViewTransform {
  /** Data-space origin of the visible window (bottom-left style for y-up data). */
  originX: number;
  originY: number;
  /** Visible span in data units (x). */
  spanX: number;
  /** Visible span in data units (y). */
  spanY: number;
  /** Zoom multiplier relative to fit-bounds (1 = fit). */
  zoom: number;
  /** Pan offset in data units (added after fit). */
  panX: number;
  panY: number;
}

export interface ScreenRect {
  width: number;
  height: number;
  /** Inner margin (pixels) for axes/labels. */
  margin: number;
}

export interface TickMark {
  value: number;
  /** Position along axis in data space (same as value for linear). */
  data: number;
  label: string;
}

const MIN_SPAN = 1e-6;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export type ProjectionDisplayMode = "trajectory" | "latest";

/**
 * Points used for rendering + fit bounds under a display mode.
 * - trajectory: all coords
 * - latest: only the last coordinate (if any)
 */
export function selectProjectionDisplayPoints<T extends { x: number; y: number }>(
  coords: T[],
  mode: ProjectionDisplayMode,
): T[] {
  if (!coords.length) return [];
  if (mode === "latest") return [coords[coords.length - 1]];
  return coords;
}

/**
 * Bounds for fitting the viewport: display points + selected region disks.
 * Ensures latest position and selected regions share the visible area.
 */
export function computeProjectionFitBounds(
  coords: Array<{ x: number; y: number }>,
  regions: Array<{ x: number; y: number; radius: number }> = [],
  mode: ProjectionDisplayMode = "trajectory",
): DataBounds | null {
  return computeDataBounds(selectProjectionDisplayPoints(coords, mode), regions);
}

/** Compute data bounds from points and optional region disks. */
export function computeDataBounds(
  points: Array<{ x: number; y: number }>,
  regions: Array<{ x: number; y: number; radius: number }> = [],
): DataBounds | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  for (const r of regions) {
    if (Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.radius)) {
      xs.push(r.x - r.radius, r.x + r.radius);
      ys.push(r.y - r.radius, r.y + r.radius);
    }
  }
  if (xs.length === 0 || ys.length === 0) return null;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Fit transform that pads bounds slightly so points don't sit on the edge.
 * zoom=1, pan=0 shows full padded bounds.
 */
export function fitViewTransform(
  bounds: DataBounds,
  options?: { padFraction?: number; zoom?: number; panX?: number; panY?: number },
): ViewTransform {
  const pad = options?.padFraction ?? 0.1;
  const rawSpanX = Math.max(MIN_SPAN, bounds.maxX - bounds.minX);
  const rawSpanY = Math.max(MIN_SPAN, bounds.maxY - bounds.minY);
  // Symmetric pad; keep aspect roughly square by using max span.
  const baseSpan = Math.max(rawSpanX, rawSpanY) * (1 + pad * 2);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const zoom = clampZoom(options?.zoom ?? 1);
  const panX = options?.panX ?? 0;
  const panY = options?.panY ?? 0;
  const span = baseSpan / zoom;
  return {
    originX: midX - span / 2 + panX,
    originY: midY - span / 2 + panY,
    spanX: span,
    spanY: span,
    zoom,
    panX,
    panY,
  };
}

/** Apply zoom about a data-space focus point (keeps focus under the cursor). */
export function zoomViewTransform(
  view: ViewTransform,
  nextZoom: number,
  focusDataX: number,
  focusDataY: number,
): ViewTransform {
  const zoom = clampZoom(nextZoom);
  const prevSpan = view.spanX;
  const nextSpan = (view.spanX * view.zoom) / zoom;
  // Keep focus fixed: origin' = focus - (focus - origin) * (nextSpan/prevSpan)
  const t = nextSpan / prevSpan;
  const originX = focusDataX - (focusDataX - view.originX) * t;
  const originY = focusDataY - (focusDataY - view.originY) * t;
  const midX = originX + nextSpan / 2;
  const midY = originY + nextSpan / 2;
  // Reconstruct pan relative to zoomed-at-1 mid would need fit bounds; store absolute origin via pan.
  return {
    originX,
    originY,
    spanX: nextSpan,
    spanY: nextSpan,
    zoom,
    panX: view.panX + (midX - (view.originX + view.spanX / 2)),
    panY: view.panY + (midY - (view.originY + view.spanY / 2)),
  };
}

export function panViewTransform(view: ViewTransform, dDataX: number, dDataY: number): ViewTransform {
  return {
    ...view,
    originX: view.originX + dDataX,
    originY: view.originY + dDataY,
    panX: view.panX + dDataX,
    panY: view.panY + dDataY,
  };
}

export function dataToScreen(
  x: number,
  y: number,
  view: ViewTransform,
  screen: ScreenRect,
): { x: number; y: number } {
  const innerW = Math.max(1, screen.width - 2 * screen.margin);
  const innerH = Math.max(1, screen.height - 2 * screen.margin);
  const sx = screen.margin + ((x - view.originX) / view.spanX) * innerW;
  // SVG y grows downward; data y grows up.
  const sy = screen.height - screen.margin - ((y - view.originY) / view.spanY) * innerH;
  return { x: sx, y: sy };
}

export function screenToData(
  sx: number,
  sy: number,
  view: ViewTransform,
  screen: ScreenRect,
): { x: number; y: number } {
  const innerW = Math.max(1, screen.width - 2 * screen.margin);
  const innerH = Math.max(1, screen.height - 2 * screen.margin);
  const x = view.originX + ((sx - screen.margin) / innerW) * view.spanX;
  const y = view.originY + ((screen.height - screen.margin - sy) / innerH) * view.spanY;
  return { x, y };
}

export function mapRadiusToScreen(radius: number, view: ViewTransform, screen: ScreenRect): number {
  const innerW = Math.max(1, screen.width - 2 * screen.margin);
  return Math.max(4, (radius / view.spanX) * innerW);
}

/**
 * Generate nice axis ticks covering [min, max] with roughly `targetCount` marks.
 */
export function generateAxisTicks(min: number, max: number, targetCount = 6): TickMark[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  let lo = min;
  let hi = max;
  if (hi - lo < MIN_SPAN) {
    lo -= 0.5;
    hi += 0.5;
  }
  const span = hi - lo;
  const rough = span / Math.max(2, targetCount - 1);
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * power);
  let step = candidates[0];
  for (const c of candidates) {
    if (span / c <= targetCount) {
      step = c;
      break;
    }
    step = c;
  }
  const start = Math.ceil(lo / step) * step;
  const ticks: TickMark[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) {
    const rounded = Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12));
    ticks.push({
      value: rounded,
      data: rounded,
      label: formatTickLabel(rounded),
    });
    if (ticks.length > 24) break;
  }
  return ticks;
}

export function formatTickLabel(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 100 || abs < 0.001) return v.toExponential(1);
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export function generateGridTicks(view: ViewTransform, targetCount = 8): {
  xTicks: TickMark[];
  yTicks: TickMark[];
} {
  return {
    xTicks: generateAxisTicks(view.originX, view.originX + view.spanX, targetCount),
    yTicks: generateAxisTicks(view.originY, view.originY + view.spanY, targetCount),
  };
}

export { MIN_ZOOM, MAX_ZOOM };
