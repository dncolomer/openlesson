"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { DataStudioExplainer } from "@/components/data-studio/DataStudioExplainer";
import type { DataStudioView } from "@/lib/data-studio-explainer";
import {
  studioCameraTransform,
  type StudioCamera,
  type StudioGridLine,
} from "@/lib/data-studio-camera";
import {
  formatStudioHighDimDistance,
  STUDIO_IN_REGION_FILL,
  STUDIO_IN_REGION_STROKE,
  STUDIO_OUT_REGION_FILL,
  type DataStudioProduct,
  type StudioPointRegionMembership,
  type StudioRegionDistanceRay,
} from "@/lib/data-studio-view";
import type { StudioRegionOverlayView } from "@/lib/admin/data-studio";

export function DataStudioPlot({
  product,
  view,
  loading,
  error,
  hostRef,
  screen,
  camera,
  dragging,
  grid,
  visibleOverlays,
  colorMembership,
  distanceRays,
  selectedId,
  membership,
  coords,
  showDistances,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onBackFromHelp,
}: {
  product: DataStudioProduct;
  view: DataStudioView;
  loading: boolean;
  error: string;
  hostRef: RefObject<HTMLDivElement | null>;
  screen: { width: number; height: number };
  camera: StudioCamera;
  dragging: boolean;
  grid: { lines: readonly StudioGridLine[] };
  visibleOverlays: readonly StudioRegionOverlayView[];
  colorMembership: boolean;
  distanceRays: readonly StudioRegionDistanceRay[];
  selectedId: string | null;
  membership: ReadonlyMap<string, StudioPointRegionMembership>;
  coords: readonly {
    id: string;
    screenX: number;
    screenY: number;
    identity: string | null;
  }[];
  showDistances: boolean;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onDoubleClick: () => void;
  onBackFromHelp: () => void;
}) {
  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden bg-[#070708] outline-none"
      tabIndex={0}
      data-data-studio-canvas-host
      onKeyDown={onKeyDown}
    >
      <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
        <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-white/30" />
        <span className="absolute right-3 top-3 h-4 w-4 border-r border-t border-white/30" />
        <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/30" />
        <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-white/30" />
      </div>
      {view === "help" ? (
        <DataStudioExplainer product={product} onBack={onBackFromHelp} />
      ) : loading ? (
        <p className="relative z-[3] p-4 text-sm text-neutral-500">
          Loading embeddings…
        </p>
      ) : error ? (
        <p className="relative z-[3] p-4 text-sm text-red-400" data-data-studio-error>
          {error}
        </p>
      ) : (
        <svg
          className="relative z-0 h-full w-full touch-none"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          viewBox={`0 0 ${screen.width} ${screen.height}`}
          data-data-studio-canvas
          data-projection-canvas
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <rect width={screen.width} height={screen.height} fill="#070708" />
          <g data-data-studio-grid>
            {grid.lines.map((line) =>
              line.axis === "x" ? (
                <line
                  key={`x-${line.world}`}
                  x1={line.screen}
                  x2={line.screen}
                  y1={0}
                  y2={screen.height}
                  stroke={line.major ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)"}
                  strokeWidth={line.major ? 1 : 0.5}
                />
              ) : (
                <line
                  key={`y-${line.world}`}
                  x1={0}
                  x2={screen.width}
                  y1={line.screen}
                  y2={line.screen}
                  stroke={line.major ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)"}
                  strokeWidth={line.major ? 1 : 0.5}
                />
              ),
            )}
            {grid.lines
              .filter((line) => line.major && line.axis === "x")
              .map((line) => (
                <text
                  key={`lx-${line.world}`}
                  x={line.screen + 3}
                  y={12}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                >
                  {line.world.toFixed(line.world % 1 === 0 ? 0 : 1)}
                </text>
              ))}
            {grid.lines
              .filter((line) => line.major && line.axis === "y")
              .map((line) => (
                <text
                  key={`ly-${line.world}`}
                  x={6}
                  y={line.screen - 3}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                >
                  {line.world.toFixed(line.world % 1 === 0 ? 0 : 1)}
                </text>
              ))}
          </g>
          <g transform={studioCameraTransform(camera)}>
            {visibleOverlays.map((region) => (
              <g key={region.id} data-data-studio-region={region.id}>
                <circle
                  cx={region.screenX}
                  cy={region.screenY}
                  r={region.screenRadius}
                  fill="rgba(255, 255, 255, 0.05)"
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  data-data-studio-spread-disk=""
                />
                {colorMembership && region.membershipScreenRadius > 0 ? (
                  <circle
                    cx={region.screenX}
                    cy={region.screenY}
                    r={region.membershipScreenRadius}
                    fill="none"
                    stroke={STUDIO_IN_REGION_FILL}
                    strokeOpacity={0.7}
                    strokeWidth={1.2}
                    strokeDasharray={`${5 / camera.scale} ${3.5 / camera.scale}`}
                    vectorEffect="non-scaling-stroke"
                    data-data-studio-membership-ring=""
                  />
                ) : null}
                <g
                  transform={`translate(${region.screenX + region.screenRadius + 6 / camera.scale} ${region.screenY}) scale(${1 / camera.scale})`}
                >
                  <text
                    fill="rgba(255,255,255,0.45)"
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                    data-data-studio-spread-label=""
                  >
                    spread
                  </text>
                </g>
                {colorMembership && region.membershipScreenRadius > 0 ? (
                  <g
                    transform={`translate(${region.screenX + region.membershipScreenRadius + 6 / camera.scale} ${region.screenY + 12 / camera.scale}) scale(${1 / camera.scale})`}
                  >
                    <text
                      fill={STUDIO_IN_REGION_FILL}
                      fillOpacity={0.75}
                      fontSize="9"
                      fontFamily="ui-monospace, monospace"
                      data-data-studio-membership-label=""
                    >
                      in (τ)
                    </text>
                  </g>
                ) : null}
                <circle
                  cx={region.screenX}
                  cy={region.screenY}
                  r={2 / camera.scale}
                  fill="rgba(255,255,255,0.7)"
                />
                <g
                  transform={`translate(${region.screenX} ${region.screenY - region.screenRadius - 8}) scale(${1 / camera.scale})`}
                >
                  <text
                    fill="rgba(255,255,255,0.7)"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                  >
                    {region.name}
                  </text>
                </g>
              </g>
            ))}
            {distanceRays.map((ray) => {
              const dimmed = selectedId ? !ray.selected : false;
              const dash = 6 / camera.scale;
              return (
                <g
                  key={`${ray.pointId}-${ray.regionId}`}
                  data-data-studio-distance-ray=""
                  data-data-studio-distance-point={ray.pointId}
                  data-data-studio-distance-region={ray.regionId}
                >
                  <line
                    x1={ray.x1}
                    y1={ray.y1}
                    x2={ray.x2}
                    y2={ray.y2}
                    stroke={dimmed ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)"}
                    strokeDasharray={`${dash} ${dash * 0.7}`}
                    strokeWidth={ray.selected ? 1.4 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <g transform={`translate(${ray.labelX} ${ray.labelY}) scale(${1 / camera.scale})`}>
                    <text
                      fill={dimmed ? "rgba(255,255,255,0.35)" : "#ffffff"}
                      fontSize="9"
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                      data-data-studio-distance-norm={String(ray.highDimL2)}
                    >
                      {formatStudioHighDimDistance(ray.highDimL2)}
                    </text>
                  </g>
                </g>
              );
            })}
            {coords.map((point) => {
              const active = point.id === selectedId;
              const radius = (active ? 5.5 : 3.6) / camera.scale;
              const member = membership.get(point.id);
              const inHighDim = Boolean(colorMembership && member?.inRegion);
              const fill = colorMembership
                ? inHighDim
                  ? STUDIO_IN_REGION_FILL
                  : STUDIO_OUT_REGION_FILL
                : active
                  ? "#ffffff"
                  : "rgba(255,255,255,0.82)";
              const stroke = colorMembership
                ? inHighDim
                  ? STUDIO_IN_REGION_STROKE
                  : "rgba(0,0,0,0.55)"
                : active
                  ? "#ffffff"
                  : "rgba(0,0,0,0.6)";
              return (
                <g
                  key={point.id}
                  data-data-studio-point={point.id}
                  data-projection-point=""
                  data-data-studio-in-region={
                    colorMembership ? (member?.inRegion ? "true" : "false") : undefined
                  }
                >
                  <circle
                    cx={point.screenX}
                    cy={point.screenY}
                    r={radius}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={inHighDim ? 1.5 : active ? 1.4 : 0.6}
                    vectorEffect="non-scaling-stroke"
                  />
                  {point.identity ? (
                    <g
                      transform={`translate(${point.screenX + 8 / camera.scale} ${point.screenY - 7 / camera.scale}) scale(${1 / camera.scale})`}
                    >
                      <text
                        fill={
                          inHighDim
                            ? STUDIO_IN_REGION_FILL
                            : active
                              ? "#ffffff"
                              : "rgba(255,255,255,0.62)"
                        }
                        fontSize="10"
                        fontFamily="ui-monospace, monospace"
                        data-data-studio-identity={point.identity}
                      >
                        {point.identity}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {view === "map" ? (
        <p className="pointer-events-none absolute bottom-3 left-3 z-[3] max-w-[min(36rem,calc(100%-14rem))] text-[10px] text-neutral-500">
          {colorMembership
            ? "Spread = mean builder distance to centroid · dashed ring = cosine ≥ τ · rays = ‖x−c‖ in 96-D"
            : showDistances
              ? "Dashed ‖x−c‖ is L2 in embedding space · Drag to pan · Scroll to zoom"
              : "Drag to pan · Scroll to zoom · Click a point to inspect"}
        </p>
      ) : null}
    </div>
  );
}
