/**
 * Knowledge-region projection layout: joint project + fit + screen mapping.
 * Overlay Data Studio browse/admin helpers were removed; inspect lives on
 * Knowledge Regions via lib/data-studio-view.ts.
 */

import {
  computeProjectionFitBounds,
  dataToScreen,
  fitViewTransform,
  mapRadiusToScreen,
  selectProjectionDisplayPoints,
  type ProjectionDisplayMode,
  type ScreenRect,
  type ViewTransform,
} from "@/lib/knowledge-config/projection-view";
import {
  projectTrajectoryAndRegions,
  type ProjectionAlgorithmId,
  type RegionCentroidInput,
  type TrajectoryPointInput,
} from "@/lib/knowledge-config/project-2d";

export type StudioProjectionPoint = {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  as_of_ms?: number;
  confidence?: number;
};

export type StudioRegionOverlayView = {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  screenX: number;
  screenY: number;
  screenRadius: number;
  membershipRadius: number;
  membershipScreenRadius: number;
  cosine_threshold?: number;
};

export function buildStudioProjectionView(input: {
  points: TrajectoryPointInput[];
  regions?: RegionCentroidInput[];
  algorithm?: ProjectionAlgorithmId | string;
  displayMode?: ProjectionDisplayMode;
  screen?: ScreenRect;
}): {
  algorithm: ProjectionAlgorithmId;
  frame_id: string;
  bounds: ReturnType<typeof computeProjectionFitBounds>;
  view: ViewTransform | null;
  coords: StudioProjectionPoint[];
  regionOverlays: StudioRegionOverlayView[];
  displayMode: ProjectionDisplayMode;
} {
  const displayMode = input.displayMode ?? "trajectory";
  const screen = input.screen ?? { width: 640, height: 400, margin: 40 };
  const joint = projectTrajectoryAndRegions({
    points: input.points,
    regions: input.regions,
    algorithm: input.algorithm as ProjectionAlgorithmId | undefined,
  });

  const displayCoords = selectProjectionDisplayPoints(joint.coords, displayMode);
  const regionDisks = joint.regionOverlays.map((r) => ({
    x: r.x,
    y: r.y,
    radius: r.radius,
  }));
  const bounds = computeProjectionFitBounds(displayCoords, regionDisks, displayMode);
  const innerW = Math.max(1, screen.width - 2 * screen.margin);
  const innerH = Math.max(1, screen.height - 2 * screen.margin);
  const view = bounds
    ? fitViewTransform(bounds, { aspectRatio: innerW / innerH })
    : null;

  const coords: StudioProjectionPoint[] = displayCoords.map((c) => {
    const scr = view ? dataToScreen(c.x, c.y, view, screen) : { x: 0, y: 0 };
    return {
      x: c.x,
      y: c.y,
      screenX: scr.x,
      screenY: scr.y,
      as_of_ms: c.as_of_ms,
      confidence: c.confidence,
    };
  });

  const regionOverlays: StudioRegionOverlayView[] = joint.regionOverlays.map((r) => {
    const scr = view ? dataToScreen(r.x, r.y, view, screen) : { x: 0, y: 0 };
    const screenRadius = view ? mapRadiusToScreen(r.radius, view, screen) : 0;
    const membershipRadius =
      typeof r.membershipRadius === "number" && Number.isFinite(r.membershipRadius)
        ? Math.max(0, r.membershipRadius)
        : 0;
    return {
      id: r.id,
      name: r.name,
      x: r.x,
      y: r.y,
      radius: r.radius,
      screenX: scr.x,
      screenY: scr.y,
      screenRadius,
      membershipRadius,
      membershipScreenRadius: view ? mapRadiusToScreen(membershipRadius, view, screen) : 0,
      cosine_threshold: r.cosine_threshold,
    };
  });

  return {
    algorithm: joint.algorithm,
    frame_id: joint.frame_id,
    bounds,
    view,
    coords,
    regionOverlays,
    displayMode,
  };
}
