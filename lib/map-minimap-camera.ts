/**
 * Minimap camera projection — viewport rect and drag-to-pan.
 * Cluster graph stays in map-minimap-clusters.ts.
 */

import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import {
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
} from "@/lib/map-minimap-frame";

export {
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_HEIGHT_LEGACY,
  MINIMAP_FRAME_HEIGHT_PREV,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
  MINIMAP_FRAME_WIDTH_LEGACY,
  MINIMAP_FRAME_WIDTH_PREV,
} from "@/lib/map-minimap-frame";

// ── Main-viewport rectangle on the mini map ───────────────────────────────

/** Axis-aligned viewport indicator in minimap frame pixels. */
export type MinimapViewportRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Reconstruct the cell→frame origin used by `projectMinimapTiles` so the
 * viewport rect shares the same coordinate system as tiles/fog.
 */
export function getMinimapFrameOrigin(input: {
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  cellSize: number;
  width: number;
  height: number;
  padding?: number;
}): { originX: number; originY: number; cellSize: number } | null {
  const b = input.bounds;
  if (
    !b ||
    !Number.isFinite(b.minRow) ||
    !Number.isFinite(b.maxRow) ||
    !Number.isFinite(b.minCol) ||
    !Number.isFinite(b.maxCol) ||
    b.maxRow < b.minRow ||
    b.maxCol < b.minCol
  ) {
    return null;
  }
  const cellSize = Number(input.cellSize);
  if (!(cellSize > 0) || !Number.isFinite(cellSize)) return null;
  const width = Math.max(1, Math.floor(Number(input.width) || 0));
  const height = Math.max(1, Math.floor(Number(input.height) || 0));
  if (width <= 0 || height <= 0) return null;
  const padRaw = input.padding ?? MINIMAP_FRAME_PADDING;
  const pad = Math.max(
    0,
    Math.min(padRaw, Math.floor(Math.min(width, height) / 2) - 1),
  );
  const spanR = Math.max(1, b.maxRow - b.minRow + 1);
  const spanC = Math.max(1, b.maxCol - b.minCol + 1);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const usedW = cellSize * spanC;
  const usedH = cellSize * spanR;
  return {
    originX: pad + (innerW - usedW) / 2,
    originY: pad + (innerH - usedH) / 2,
    cellSize,
  };
}

/**
 * Project the main map camera (pan/zoom + viewport size) onto the minimap as
 * an axis-aligned rect in frame pixels. Continuous cell coords so the rect
 * tracks pan smoothly (no integer snap).
 *
 * World: cell (row,col) top-left at `(col * pitch, row * pitch)`.
 * Screen: `world * zoom + pan`.
 */
export function projectMainViewportToMinimapRect(input: {
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  cellSize: number;
  width: number;
  height: number;
  padding?: number;
  pitch?: number;
}): MinimapViewportRect | null {
  const origin = getMinimapFrameOrigin(input);
  if (!origin) return null;
  const zoom = Number(input.zoom);
  if (!(zoom > 0) || !Number.isFinite(zoom)) return null;
  const vw = Number(input.viewportWidth);
  const vh = Number(input.viewportHeight);
  if (!(vw > 0) || !(vh > 0) || !Number.isFinite(vw) || !Number.isFinite(vh)) {
    return null;
  }
  const pitch =
    Number.isFinite(input.pitch) && (input.pitch as number) > 0
      ? (input.pitch as number)
      : SKILL_GRID_PITCH;
  const panX = Number(input.pan?.x) || 0;
  const panY = Number(input.pan?.y) || 0;

  // Visible continuous cell range of the main viewport
  const minColView = -panX / zoom / pitch;
  const maxColView = (vw - panX) / zoom / pitch;
  const minRowView = -panY / zoom / pitch;
  const maxRowView = (vh - panY) / zoom / pitch;

  const { originX, originY, cellSize } = origin;
  const { minCol, minRow } = input.bounds;
  const x = originX + (minColView - minCol) * cellSize;
  const y = originY + (minRowView - minRow) * cellSize;
  const w = (maxColView - minColView) * cellSize;
  const h = (maxRowView - minRowView) * cellSize;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0
  ) {
    return null;
  }
  return { x, y, w, h };
}

/**
 * Viewport-window for a map snapshot (workspace minimap + AYCL view-only preview).
 * Empty tiles / invalid camera → no window (do not invent a frame).
 * Otherwise delegates to projectMainViewportToMinimapRect so pan/zoom stay live.
 */
export function resolveMinimapViewportWindow(input: {
  tileCount: number;
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  bounds: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  cellSize: number;
  width?: number;
  height?: number;
  padding?: number;
  pitch?: number;
}): MinimapViewportRect | null {
  const tileCount = Math.floor(Number(input.tileCount) || 0);
  const cellSize = Number(input.cellSize);
  if (tileCount <= 0 || !(cellSize > 0) || !Number.isFinite(cellSize)) {
    return null;
  }
  return projectMainViewportToMinimapRect({
    pan: input.pan,
    zoom: input.zoom,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    bounds: input.bounds,
    cellSize,
    width: input.width ?? MINIMAP_FRAME_WIDTH,
    height: input.height ?? MINIMAP_FRAME_HEIGHT,
    padding: input.padding ?? MINIMAP_FRAME_PADDING,
    pitch: input.pitch,
  });
}

/**
 * Convert a minimap-space drag of the viewport rect into an updated main-map pan.
 * Dragging the rect right/down shows further right/down of the map (pan decreases).
 *
 * Pure so unit tests share the same path as the pointer handler.
 */
export function panFromMinimapViewportDrag(input: {
  pan: { x: number; y: number };
  zoom: number;
  /** Minimap-frame delta of the rect (px). */
  deltaX: number;
  deltaY: number;
  cellSize: number;
  pitch?: number;
}): { x: number; y: number } {
  const zoom = Number(input.zoom);
  const cellSize = Number(input.cellSize);
  const panX = Number(input.pan?.x) || 0;
  const panY = Number(input.pan?.y) || 0;
  if (
    !(zoom > 0) ||
    !Number.isFinite(zoom) ||
    !(cellSize > 0) ||
    !Number.isFinite(cellSize)
  ) {
    return { x: panX, y: panY };
  }
  const pitch =
    Number.isFinite(input.pitch) && (input.pitch as number) > 0
      ? (input.pitch as number)
      : SKILL_GRID_PITCH;
  const dx = Number(input.deltaX) || 0;
  const dy = Number(input.deltaY) || 0;
  // dCol = dx / cellSize; dWorld = dCol * pitch; newPan = pan - dWorld * zoom
  const scale = (pitch * zoom) / cellSize;
  return {
    x: panX - dx * scale,
    y: panY - dy * scale,
  };
}
