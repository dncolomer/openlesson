/**
 * Axis-aligned work-canvas rectangles, including stroke points.
 */
import type { IleWorkCanvasElement } from "@/lib/learn-work-canvas-scene";

export const ILE_WORK_CANVAS_OVERLAP_GAP = 16;

export type IleWorkCanvasRect = { minX: number; minY: number; maxX: number; maxY: number };

export type IleWorkCanvasRectSource = Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height"> & {
  isDeleted?: boolean;
  points?: readonly (readonly number[])[] | null;
};

export function ileWorkCanvasElementRect(
  el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
): IleWorkCanvasRect {
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + (el.width || 0),
    maxY: el.y + (el.height || 0),
  };
}

export function ileWorkCanvasRectsOverlap(a: IleWorkCanvasRect, b: IleWorkCanvasRect, pad = 0): boolean {
  return !(
    a.maxX + pad <= b.minX ||
    b.maxX + pad <= a.minX ||
    a.maxY + pad <= b.minY ||
    b.maxY + pad <= a.minY
  );
}

/** Axis-aligned bounds. Zero-area marks (a line with no thickness) are null. */
export function ileWorkCanvasNormalizedRect(
  el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height"> | null | undefined,
): IleWorkCanvasRect | null {
  if (!el) return null;
  const x = Number(el.x) || 0;
  const y = Number(el.y) || 0;
  const w = Number(el.width) || 0;
  const h = Number(el.height) || 0;
  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  if (!(maxX > minX) || !(maxY > minY)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Axis-aligned mark, including stroke points. A zero-area line still reserves a
 * thin strip. `pad` grows the box; `points: false` ignores stroke points.
 */
export function ileWorkCanvasMarkRect(
  el: IleWorkCanvasRectSource | null | undefined,
  options?: { pad?: number; points?: boolean } | null,
): IleWorkCanvasRect | null {
  if (!el || el.isDeleted) return null;
  const base = ileWorkCanvasNormalizedRect(el);
  let minX = base?.minX ?? Infinity;
  let minY = base?.minY ?? Infinity;
  let maxX = base?.maxX ?? -Infinity;
  let maxY = base?.maxY ?? -Infinity;
  if (options?.points !== false) {
    const points = Array.isArray(el.points) ? el.points : [];
    for (const point of points) {
      if (!Array.isArray(point)) continue;
      const px = (Number(el.x) || 0) + (Number(point[0]) || 0);
      const py = (Number(el.y) || 0) + (Number(point[1]) || 0);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  const thickness = 8;
  if (!(maxX > minX)) {
    minX -= thickness / 2;
    maxX += thickness / 2;
  }
  if (!(maxY > minY)) {
    minY -= thickness / 2;
    maxY += thickness / 2;
  }
  const pad = Number(options?.pad) || 0;
  if (pad) {
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
  }
  return { minX, minY, maxX, maxY };
}

/** Positive-area intersection. Shared edges do not count. */
export function ileWorkCanvasPositiveAreaOverlap(a: IleWorkCanvasRect, b: IleWorkCanvasRect): boolean {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0
  );
}
