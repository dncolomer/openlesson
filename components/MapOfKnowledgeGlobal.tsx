"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GLOBAL_MAP_VIEW_DEFAULT,
  buildGlobalMapModel,
  clampGlobalMapZoom,
  formatGlobalMapDistance,
  globalMapRegionSummary,
  globalMapViewTransformAttr,
  panGlobalMapView,
  zoomGlobalMapView,
  type GlobalMapEdge,
  type GlobalMapRegionNode,
  type GlobalMapRegionSummary,
  type GlobalMapViewTransform,
} from "@/lib/map-of-knowledge/global-map";
import type { MapRegion, MapUserLocation } from "@/lib/map-of-knowledge";

const WIDTH = 960;
const HEIGHT = 520;
const MARGIN = 56;

export type MapOfKnowledgeGlobalProps = {
  userLocations: MapUserLocation[];
  regions: MapRegion[];
  className?: string;
  fill?: boolean;
  /** Controlled selection (region id). */
  selectedRegionId?: string | null;
  /** Fired when a region dot is selected or cleared. */
  onSelectRegion?: (summary: GlobalMapRegionSummary | null) => void;
  /**
   * Open Local Map focused on this region only.
   * Parent should switch scope to local and enable only this region id.
   */
  onOpenLocalMap?: (regionId: string) => void;
  /** Optional CTA label (default: Open Local Map). */
  openLocalLabel?: string;
};

function layoutNodes(
  nodes: GlobalMapRegionNode[],
): { nodes: Array<GlobalMapRegionNode & { sx: number; sy: number }>; width: number; height: number } {
  if (nodes.length === 0) {
    return { nodes: [], width: WIDTH, height: HEIGHT };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }
  if (maxX - minX < 1e-6) {
    minX -= 1;
    maxX += 1;
  }
  if (maxY - minY < 1e-6) {
    minY -= 1;
    maxY += 1;
  }

  const innerW = WIDTH - MARGIN * 2;
  const innerH = HEIGHT - MARGIN * 2;
  const scale = Math.min(innerW / (maxX - minX), innerH / (maxY - minY)) * 0.82;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    width: WIDTH,
    height: HEIGHT,
    nodes: nodes.map((n) => ({
      ...n,
      sx: WIDTH / 2 + (n.x - cx) * scale,
      sy: HEIGHT / 2 - (n.y - cy) * scale,
    })),
  };
}

function edgeEndpoints(
  edges: GlobalMapEdge[],
  byId: Map<string, { sx: number; sy: number }>,
): Array<GlobalMapEdge & { x1: number; y1: number; x2: number; y2: number }> {
  const out: Array<GlobalMapEdge & { x1: number; y1: number; x2: number; y2: number }> = [];
  for (const e of edges) {
    const a = byId.get(e.source_id);
    const b = byId.get(e.target_id);
    if (!a || !b) continue;
    out.push({ ...e, x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy });
  }
  return out;
}

/**
 * Global Map: zoomed-out region graph with dual membership orbits.
 * Interactive pan (drag) + zoom (wheel / pinch / +/-) + keyboard.
 * Click a region dot for summary + Open Local Map.
 */
export function MapOfKnowledgeGlobal({
  userLocations,
  regions,
  className = "",
  fill = false,
  selectedRegionId: controlledSelectedId,
  onSelectRegion,
  onOpenLocalMap,
  openLocalLabel = "Open Local Map",
}: MapOfKnowledgeGlobalProps) {
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [view, setView] = useState<GlobalMapViewTransform>(GLOBAL_MAP_VIEW_DEFAULT);
  const selectedRegionId =
    controlledSelectedId !== undefined ? controlledSelectedId : uncontrolledSelectedId;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    lastSx: number;
    lastSy: number;
    moved: boolean;
  }>({ active: false, pointerId: null, lastSx: 0, lastSy: 0, moved: false });
  const pinchRef = useRef<{
    active: boolean;
    startDist: number;
    startView: GlobalMapViewTransform;
    focusX: number;
    focusY: number;
  } | null>(null);

  const model = useMemo(
    () => buildGlobalMapModel(regions, userLocations),
    [regions, userLocations],
  );

  const layout = useMemo(() => layoutNodes(model.nodes), [model.nodes]);
  const byId = useMemo(() => {
    const m = new Map<string, { sx: number; sy: number }>();
    for (const n of layout.nodes) m.set(n.id, { sx: n.sx, sy: n.sy });
    return m;
  }, [layout.nodes]);
  const drawnEdges = useMemo(
    () => edgeEndpoints(model.edges, byId),
    [model.edges, byId],
  );

  // Re-fit when region graph changes (new enable set / data).
  useEffect(() => {
    setView(GLOBAL_MAP_VIEW_DEFAULT);
  }, [regions, userLocations]);

  const selectedNode = useMemo(
    () => model.nodes.find((n) => n.id === selectedRegionId) ?? null,
    [model.nodes, selectedRegionId],
  );
  const selectedSummary = useMemo(
    () => globalMapRegionSummary(selectedNode),
    [selectedNode],
  );

  const selectNode = (node: GlobalMapRegionNode | null) => {
    const nextId = node?.id ?? null;
    if (controlledSelectedId === undefined) {
      setUncontrolledSelectedId(nextId);
    }
    onSelectRegion?.(globalMapRegionSummary(node));
  };

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { sx: WIDTH / 2, sy: HEIGHT / 2 };
    const rect = el.getBoundingClientRect();
    return {
      sx: ((clientX - rect.left) / Math.max(1, rect.width)) * WIDTH,
      sy: ((clientY - rect.top) / Math.max(1, rect.height)) * HEIGHT,
    };
  }, []);

  const zoomBy = useCallback((factor: number, focusX?: number, focusY?: number) => {
    setView((v) => {
      const fx = focusX ?? WIDTH / 2;
      const fy = focusY ?? HEIGHT / 2;
      return zoomGlobalMapView(v, v.zoom * factor, fx, fy);
    });
  }, []);

  const resetView = useCallback(() => {
    setView(GLOBAL_MAP_VIEW_DEFAULT);
  }, []);

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomBy(factor, sx, sy);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      lastSx: sx,
      lastSy: sy,
      moved: false,
    };
    e.currentTarget.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) return;
    if (pinchRef.current?.active) return;
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const dSx = sx - dragRef.current.lastSx;
    const dSy = sy - dragRef.current.lastSy;
    if (Math.abs(dSx) + Math.abs(dSy) > 2) dragRef.current.moved = true;
    dragRef.current.lastSx = sx;
    dragRef.current.lastSy = sy;
    setView((v) => panGlobalMapView(v, dSx, dSy));
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    e.currentTarget.style.cursor = "grab";
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // Clear selection only on click (not drag-end)
    if (!wasDrag && e.target === e.currentTarget) {
      selectNode(null);
    }
  };

  // Pinch-to-zoom
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const touchDist = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        dragRef.current.active = false;
        const d = touchDist(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const { sx, sy } = clientToSvg(midX, midY);
        const v = viewRef.current;
        pinchRef.current = {
          active: true,
          startDist: Math.max(1, d),
          startView: { ...v },
          focusX: sx,
          focusY: sy,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current?.active) {
        e.preventDefault();
        const d = touchDist(e.touches[0], e.touches[1]);
        const factor = d / pinchRef.current.startDist;
        const pinch = pinchRef.current;
        setView(
          zoomGlobalMapView(
            pinch.startView,
            pinch.startView.zoom * factor,
            pinch.focusX,
            pinch.focusY,
          ),
        );
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [clientToSvg]);

  // Keyboard: arrows / WASD pan, +/- zoom, 0/R reset
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!root.contains(document.activeElement) && document.activeElement !== root) {
        return;
      }
      const v = viewRef.current;
      const step = 40 / Math.max(0.5, v.zoom);
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          setView((cur) => panGlobalMapView(cur, step, 0));
          break;
        case "ArrowRight":
        case "d":
        case "D":
          setView((cur) => panGlobalMapView(cur, -step, 0));
          break;
        case "ArrowUp":
        case "w":
        case "W":
          setView((cur) => panGlobalMapView(cur, 0, step));
          break;
        case "ArrowDown":
        case "s":
        case "S":
          setView((cur) => panGlobalMapView(cur, 0, -step));
          break;
        case "+":
        case "=":
          zoomBy(1.15);
          break;
        case "-":
        case "_":
          zoomBy(0.87);
          break;
        case "0":
        case "r":
        case "R":
          resetView();
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [resetView, zoomBy]);

  const heightClass = fill ? "h-full min-h-0 flex-1" : "h-[min(58vh,520px)]";
  const transformAttr = globalMapViewTransformAttr(view);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative w-full overflow-hidden bg-[#09090b] outline-none ${heightClass} ${className}`}
      data-map-global
      data-map-global-surface
      data-map-global-interactive="true"
      data-map-global-zoom={String(clampGlobalMapZoom(view.zoom))}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-full w-full cursor-grab touch-none"
        role="img"
        aria-label="Global Map of Knowledge: pan and zoom; regions as dots with orbit membership counts"
        data-map-global-svg
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          if (dragRef.current.active) endDrag(e);
        }}
      >
        <defs>
          <radialGradient id="global-map-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.18)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
        </defs>
        <rect width={layout.width} height={layout.height} fill="#09090b" />

        <g data-map-global-viewport transform={transformAttr}>
          <circle
            cx={layout.width / 2}
            cy={layout.height / 2}
            r={Math.min(layout.width, layout.height) * 0.42}
            fill="url(#global-map-glow)"
          />

          {drawnEdges.map((e) => {
            const mx = (e.x1 + e.x2) / 2;
            const my = (e.y1 + e.y2) / 2;
            return (
              <g key={`${e.source_id}-${e.target_id}`} data-map-global-edge>
                <line
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="rgba(161,161,170,0.55)"
                  strokeWidth={1.25}
                  strokeDasharray="3 4"
                />
                <rect
                  x={mx - 18}
                  y={my - 9}
                  width={36}
                  height={16}
                  rx={3}
                  fill="rgba(9,9,11,0.85)"
                  stroke="rgba(63,63,70,0.9)"
                  strokeWidth={0.75}
                />
                <text
                  x={mx}
                  y={my + 3}
                  textAnchor="middle"
                  className="fill-zinc-400"
                  style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                  data-map-global-distance
                >
                  {formatGlobalMapDistance(e.distance)}
                </text>
              </g>
            );
          })}

          {layout.nodes.map((n) => {
            const innerR = 22;
            const outerR = 36;
            const selected = n.id === selectedRegionId;
            return (
              <g
                key={n.id}
                transform={`translate(${n.sx},${n.sy})`}
                data-map-global-node
                data-region-id={n.id}
                data-selected={selected ? "true" : "false"}
                className="cursor-pointer"
                onPointerDown={(ev) => {
                  // Allow click selection without starting a map drag
                  ev.stopPropagation();
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  selectNode(n);
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`Region ${n.name}: ${n.inside_count} inside, ${n.near_count} near`}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    selectNode(n);
                  }
                }}
              >
                <circle r={outerR + 8} fill="transparent" />
                <circle
                  r={outerR}
                  fill="none"
                  stroke={selected ? "rgba(251,191,36,0.7)" : "rgba(251,191,36,0.35)"}
                  strokeWidth={selected ? 1.5 : 1}
                  strokeDasharray="2 3"
                  data-map-global-orbit-near
                />
                <circle
                  r={innerR}
                  fill="none"
                  stroke={selected ? "rgba(34,211,238,0.85)" : "rgba(34,211,238,0.45)"}
                  strokeWidth={selected ? 1.75 : 1.25}
                  strokeDasharray="2 2"
                  data-map-global-orbit-inside
                />
                <circle
                  r={selected ? 9 : 7}
                  fill={selected ? "#67e8f9" : "#22d3ee"}
                  stroke="#ecfeff"
                  strokeWidth={selected ? 2 : 1.5}
                  data-map-global-region-dot
                />
                <g
                  transform={`translate(${innerR * 0.72},${-innerR * 0.72})`}
                  data-map-global-bubble-inside
                >
                  <circle r={10} fill="#0e7490" stroke="#67e8f9" strokeWidth={1} />
                  <text
                    textAnchor="middle"
                    y={3.5}
                    className="fill-white"
                    style={{
                      fontSize: 9,
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                    }}
                  >
                    {n.inside_count}
                  </text>
                </g>
                <g
                  transform={`translate(${outerR * 0.72},${outerR * 0.72})`}
                  data-map-global-bubble-near
                >
                  <circle r={10} fill="#78350f" stroke="#fbbf24" strokeWidth={1} />
                  <text
                    textAnchor="middle"
                    y={3.5}
                    className="fill-amber-50"
                    style={{
                      fontSize: 9,
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                    }}
                  >
                    {n.near_count}
                  </text>
                </g>
                <text
                  y={outerR + 14}
                  textAnchor="middle"
                  className={selected ? "fill-white" : "fill-zinc-200"}
                  style={{
                    fontSize: 10,
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 500,
                  }}
                >
                  {n.name.length > 22 ? `${n.name.slice(0, 20)}…` : n.name}
                </text>
                <text
                  y={outerR + 26}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
                >
                  {n.workspace_title.length > 24
                    ? `${n.workspace_title.slice(0, 22)}…`
                    : n.workspace_title}
                </text>
              </g>
            );
          })}

          {layout.nodes.length === 0 && (
            <text
              x={layout.width / 2}
              y={layout.height / 2}
              textAnchor="middle"
              className="fill-zinc-600"
              style={{ fontSize: 13, fontFamily: "ui-monospace, monospace" }}
            >
              Enable regions to build the Global Map
            </text>
          )}
        </g>
      </svg>

      {/* Zoom controls */}
      <div
        className="pointer-events-auto absolute bottom-3 right-3 z-10 flex flex-col gap-1"
        data-map-global-zoom-controls
      >
        <button
          type="button"
          className="rounded-sm border border-zinc-700 bg-black/80 px-2 py-1 font-mono text-xs text-zinc-200 hover:border-zinc-500 hover:text-white"
          onClick={() => zoomBy(1.2)}
          aria-label="Zoom in"
          data-map-global-zoom-in
        >
          +
        </button>
        <button
          type="button"
          className="rounded-sm border border-zinc-700 bg-black/80 px-2 py-1 font-mono text-xs text-zinc-200 hover:border-zinc-500 hover:text-white"
          onClick={() => zoomBy(0.8)}
          aria-label="Zoom out"
          data-map-global-zoom-out
        >
          −
        </button>
        <button
          type="button"
          className="rounded-sm border border-zinc-700 bg-black/80 px-2 py-1 font-mono text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-white"
          onClick={resetView}
          aria-label="Reset pan and zoom"
          data-map-global-zoom-reset
        >
          1:1
        </button>
      </div>

      <div
        className="pointer-events-auto absolute bottom-3 left-3 z-10 max-w-[16rem] border border-zinc-800/90 bg-black/80 backdrop-blur-sm"
        data-map-global-legend
        data-legend-open={legendOpen ? "true" : "false"}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLegendOpen((open) => !open);
          }}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-white/[0.03]"
          aria-expanded={legendOpen}
          data-map-global-legend-toggle
        >
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">
            Global Map
          </span>
          <span
            className={`font-mono text-[10px] text-zinc-500 transition-transform ${
              legendOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {legendOpen && (
          <ul
            className="space-y-1 border-t border-zinc-800/80 px-3 pb-2.5 pt-1.5 text-[11px] leading-snug text-zinc-400"
            data-map-global-legend-body
          >
            <li>
              <span className="text-cyan-300">Inner orbit</span> — users inside region
            </li>
            <li>
              <span className="text-amber-300">Outer orbit</span> — near, not inside
            </li>
            <li>Dotted links show inter-region distance</li>
            <li className="text-zinc-500">Drag to pan · scroll to zoom</li>
            <li className="text-zinc-500">Click a region for summary</li>
          </ul>
        )}
      </div>

      {selectedSummary && (
        <div
          className="absolute right-3 top-3 z-20 w-[min(100%-1.5rem,18rem)] border border-zinc-600 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-sm"
          data-map-global-region-summary
          data-region-id={selectedSummary.region_id}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">
                Region
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-white">
                {selectedSummary.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                {selectedSummary.workspace_title}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-sm border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-white"
              onClick={() => selectNode(null)}
              data-map-global-summary-dismiss
              aria-label="Dismiss region summary"
            >
              Close
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="border border-cyan-500/25 bg-cyan-950/20 px-2 py-1.5">
              <dt className="font-mono text-[9px] uppercase tracking-wide text-cyan-500/90">
                Inside
              </dt>
              <dd className="mt-0.5 font-mono text-base text-cyan-100" data-summary-inside>
                {selectedSummary.inside_count}
              </dd>
            </div>
            <div className="border border-amber-500/25 bg-amber-950/20 px-2 py-1.5">
              <dt className="font-mono text-[9px] uppercase tracking-wide text-amber-500/90">
                Near
              </dt>
              <dd className="mt-0.5 font-mono text-base text-amber-100" data-summary-near>
                {selectedSummary.near_count}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
            Membership radius {selectedSummary.radius.toFixed(2)} in knowledge space. Open Local Map
            to inspect this region only.
          </p>
          {onOpenLocalMap && (
            <button
              type="button"
              className="mt-3 w-full rounded-sm bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-zinc-200"
              onClick={() => onOpenLocalMap(selectedSummary.region_id)}
              data-map-global-open-local
            >
              {openLocalLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
