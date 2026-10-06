/**
 * Axis-aligned work-canvas rectangles. Collision layout stays in the scene module.
 */
import type { IleWorkCanvasElement } from "@/lib/ile-work-canvas";

export function ileWorkCanvasElementRect(
  el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + (el.width || 0),
    maxY: el.y + (el.height || 0),
  };
}

export function ileWorkCanvasRectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  pad = 0,
): boolean {
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
): { minX: number; minY: number; maxX: number; maxY: number } | null {
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

/** Positive-area intersection. Shared edges do not count. */
export function ileWorkCanvasPositiveAreaOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0
  );
}
