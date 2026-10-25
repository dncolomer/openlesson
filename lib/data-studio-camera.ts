/**
 * Data Studio camera, grid, and hit-test math.
 * Scale is clamped 0.25–16. Grid generation caps ~240 lines per axis.
 */

export type StudioCamera = {
  x: number;
  y: number;
  scale: number;
};

export const STUDIO_CAMERA_MIN_SCALE = 0.25;
export const STUDIO_CAMERA_MAX_SCALE = 16;
export const IDENTITY_STUDIO_CAMERA: StudioCamera = { x: 0, y: 0, scale: 1 };

export function clampStudioCameraScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(STUDIO_CAMERA_MAX_SCALE, Math.max(STUDIO_CAMERA_MIN_SCALE, scale));
}

export function panStudioCamera(
  camera: StudioCamera,
  dx: number,
  dy: number,
): StudioCamera {
  return {
    x: camera.x + dx,
    y: camera.y + dy,
    scale: clampStudioCameraScale(camera.scale),
  };
}

export function studioScreenToWorld(
  camera: StudioCamera,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const scale = camera.scale === 0 || !Number.isFinite(camera.scale) ? 1 : camera.scale;
  return {
    x: (screenX - camera.x) / scale,
    y: (screenY - camera.y) / scale,
  };
}

export function studioWorldToScreen(
  camera: StudioCamera,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const scale = Number.isFinite(camera.scale) ? camera.scale : 1;
  return {
    x: worldX * scale + camera.x,
    y: worldY * scale + camera.y,
  };
}

export function zoomStudioCamera(
  camera: StudioCamera,
  input: { factor: number; originX: number; originY: number },
): StudioCamera {
  const nextScale = clampStudioCameraScale(camera.scale * input.factor);
  const world = studioScreenToWorld(camera, input.originX, input.originY);
  return {
    scale: nextScale,
    x: input.originX - world.x * nextScale,
    y: input.originY - world.y * nextScale,
  };
}

export function studioCameraTransform(camera: StudioCamera): string {
  return `translate(${camera.x} ${camera.y}) scale(${camera.scale})`;
}

export function studioNiceGridStep(scale: number, targetPx = 56): number {
  const safeScale = scale > 0 && Number.isFinite(scale) ? scale : 1;
  const world = targetPx / safeScale;
  if (!(world > 0) || !Number.isFinite(world)) return 50;
  const exp = Math.floor(Math.log10(world));
  const base = 10 ** exp;
  const mantissa = world / base;
  const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return nice * base;
}

export type StudioGridLine = {
  axis: "x" | "y";
  world: number;
  screen: number;
  major: boolean;
};

export function studioGridLines(input: {
  width: number;
  height: number;
  camera: StudioCamera;
  targetPx?: number;
}): { step: number; lines: StudioGridLine[] } {
  const step = studioNiceGridStep(input.camera.scale, input.targetPx ?? 56);
  const majorEvery = 5;
  const topLeft = studioScreenToWorld(input.camera, 0, 0);
  const bottomRight = studioScreenToWorld(input.camera, input.width, input.height);
  const minX = Math.min(topLeft.x, bottomRight.x);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxY = Math.max(topLeft.y, bottomRight.y);
  const lines: StudioGridLine[] = [];
  const pushAxis = (axis: "x" | "y", min: number, max: number) => {
    const i0 = Math.floor(min / step);
    const i1 = Math.ceil(max / step);
    const last = Math.min(i1, i0 + 240);
    for (let index = i0; index <= last; index += 1) {
      const world = Number((index * step).toFixed(8));
      const screen =
        axis === "x"
          ? studioWorldToScreen(input.camera, world, 0).x
          : studioWorldToScreen(input.camera, 0, world).y;
      lines.push({
        axis,
        world,
        screen,
        major: index % majorEvery === 0,
      });
    }
  };
  pushAxis("x", minX, maxX);
  pushAxis("y", minY, maxY);
  return { step, lines };
}

export function hitTestStudioPoint(
  points: readonly { id: string; screenX: number; screenY: number }[],
  input: {
    screenX: number;
    screenY: number;
    camera: StudioCamera;
    pixelRadius?: number;
  },
): string | null {
  const world = studioScreenToWorld(input.camera, input.screenX, input.screenY);
  const radius = (input.pixelRadius ?? 16) / (input.camera.scale > 0 ? input.camera.scale : 1);
  let best: { id: string; dist: number } | null = null;
  for (const point of points) {
    const dist = Math.hypot(point.screenX - world.x, point.screenY - world.y);
    if (dist > radius) continue;
    if (!best || dist < best.dist) best = { id: point.id, dist };
  }
  return best?.id ?? null;
}
