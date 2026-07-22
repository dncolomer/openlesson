"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampZoom,
  computeDataBounds,
  dataToScreen,
  fitViewTransform,
  mapRadiusToScreen,
  panViewTransform,
  screenToData,
  zoomViewTransform,
  type ViewTransform,
} from "@/lib/knowledge-config";
import { mapDotColor, type MapRegion, type MapUserLocation } from "@/lib/map-of-knowledge";

const WIDTH = 960;
const HEIGHT = 480;
const MARGIN = 24;
const SCREEN = { width: WIDTH, height: HEIGHT, margin: MARGIN };

export type MapOfKnowledge2DProps = {
  userLocations: MapUserLocation[];
  regions: MapRegion[];
  projectionAlgorithm?: string;
  className?: string;
  fill?: boolean;
};

/**
 * Interactive 2D embedding map: drag/touch pan, pinch & wheel zoom, keyboard nudge.
 */
export function MapOfKnowledge2D({
  userLocations,
  regions,
  projectionAlgorithm = "pca",
  className = "",
  fill = false,
}: MapOfKnowledge2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    lastSx: number;
    lastSy: number;
  }>({ active: false, pointerId: null, lastSx: 0, lastSy: 0 });
  const pinchRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
    focusX: number;
    focusY: number;
    startView: ViewTransform;
  } | null>(null);
  const viewRef = useRef<ViewTransform | null>(null);

  const bounds = useMemo(() => {
    const pts = userLocations.map((p) => ({ x: p.x, y: p.y }));
    const regs = regions.map((r) => ({
      x: r.x,
      y: r.y,
      radius: Math.max(0.05, r.radius || 0.35),
    }));
    return (
      computeDataBounds(pts, regs) || {
        minX: -1,
        maxX: 1,
        minY: -1,
        maxY: 1,
      }
    );
  }, [userLocations, regions]);

  const [view, setView] = useState<ViewTransform>(() =>
    fitViewTransform(bounds, { padFraction: 0.16, zoom: 1, panX: 0, panY: 0 }),
  );
  viewRef.current = view;

  // Re-fit when data / projection layout changes
  useEffect(() => {
    setView(fitViewTransform(bounds, { padFraction: 0.16, zoom: 1, panX: 0, panY: 0 }));
  }, [bounds]);

  const resetView = useCallback(() => {
    setView(fitViewTransform(bounds, { padFraction: 0.16, zoom: 1, panX: 0, panY: 0 }));
  }, [bounds]);

  const zoomBy = useCallback((factor: number, focusX?: number, focusY?: number) => {
    setView((v) => {
      const fx = focusX ?? v.originX + v.spanX / 2;
      const fy = focusY ?? v.originY + v.spanY / 2;
      return zoomViewTransform(v, clampZoom(v.zoom * factor), fx, fy);
    });
  }, []);

  const panByData = useCallback((dDataX: number, dDataY: number) => {
    setView((v) => panViewTransform(v, dDataX, dDataY));
  }, []);

  const clientToSvg = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { sx: WIDTH / 2, sy: HEIGHT / 2 };
    const rect = el.getBoundingClientRect();
    return {
      sx: ((clientX - rect.left) / Math.max(1, rect.width)) * WIDTH,
      sy: ((clientY - rect.top) / Math.max(1, rect.height)) * HEIGHT,
    };
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const focus = screenToData(sx, sy, view, SCREEN);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomBy(factor, focus.x, focus.y);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    // Multi-touch handled separately via native listeners
    if (e.pointerType === "touch" && (e as unknown as { isPrimary?: boolean }).isPrimary === false) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      lastSx: sx,
      lastSy: sy,
    };
    e.currentTarget.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) return;
    if (pinchRef.current?.active) return;
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const dSx = sx - dragRef.current.lastSx;
    const dSy = sy - dragRef.current.lastSy;
    dragRef.current.lastSx = sx;
    dragRef.current.lastSy = sy;
    const innerW = WIDTH - 2 * MARGIN;
    const innerH = HEIGHT - 2 * MARGIN;
    const dDataX = -(dSx / innerW) * view.spanX;
    const dDataY = (dSy / innerH) * view.spanY;
    panByData(dDataX, dDataY);
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    e.currentTarget.style.cursor = "grab";
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // Pinch-to-zoom + multi-touch pan via native touch events
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
        if (!v) return;
        const focus = screenToData(sx, sy, v, SCREEN);
        pinchRef.current = {
          active: true,
          startDist: Math.max(1, d),
          startZoom: v.zoom,
          focusX: focus.x,
          focusY: focus.y,
          startView: { ...v },
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current?.active) {
        e.preventDefault();
        const d = touchDist(e.touches[0], e.touches[1]);
        const factor = d / pinchRef.current.startDist;
        const nextZoom = clampZoom(pinchRef.current.startZoom * factor);
        const pinch = pinchRef.current;
        setView(
          zoomViewTransform(pinch.startView, nextZoom, pinch.focusX, pinch.focusY),
        );
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
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
  }, [bounds]);

  // Keyboard: arrows / WASD pan, +/- zoom, 0/R reset
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Only when container (or child) is focused
      if (!root.contains(document.activeElement) && document.activeElement !== root) {
        return;
      }
      const v = viewRef.current;
      if (!v) return;
      const step = v.spanX * (e.shiftKey ? 0.18 : 0.08);
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          panByData(-step, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          panByData(step, 0);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          panByData(0, step);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          panByData(0, -step);
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
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [panByData, zoomBy, resetView]);

  const mapPoint = (x: number, y: number) => dataToScreen(x, y, view, SCREEN);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Interactive 2D Map of Knowledge. Drag to pan, scroll or pinch to zoom, arrow keys or WASD to pan, plus and minus to zoom, zero or R to reset."
      data-map-2d-root
      data-map-2d-interactive
      className={`relative outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40 ${
        fill ? "min-h-0 flex-1" : "h-[min(58vh,480px)]"
      } ${className}`}
      onClick={() => containerRef.current?.focus()}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full touch-none select-none"
        style={{ cursor: "grab", touchAction: "none" }}
        role="img"
        aria-label={`Map of Knowledge 2D embedding projection (${projectionAlgorithm})`}
        preserveAspectRatio="xMidYMid meet"
        data-map-2d-svg
        data-projection-algorithm={projectionAlgorithm}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          e.preventDefault();
          resetView();
        }}
      >
        <defs>
          <pattern id="map-grid-2d" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(63,63,70,0.35)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="#09090b" />
        <rect width={WIDTH} height={HEIGHT} fill="url(#map-grid-2d)" />

        {regions.map((region, i) => {
          const { x: sx, y: sy } = mapPoint(region.x, region.y);
          const hue = (i * 47) % 360;
          const rr = mapRadiusToScreen(Math.max(0.08, region.radius || 0.35), view, SCREEN);
          return (
            <g key={region.id}>
              <circle
                cx={sx}
                cy={sy}
                r={rr}
                fill={`hsla(${hue}, 70%, 55%, 0.08)`}
                stroke={`hsla(${hue}, 70%, 65%, 0.45)`}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={sx}
                y={sy - rr - 6}
                textAnchor="middle"
                className="fill-zinc-400"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
              >
                {region.name}
              </text>
            </g>
          );
        })}

        {userLocations.map((p) => {
          const { x: sx, y: sy } = mapPoint(p.x, p.y);
          const fill = mapDotColor(p.kind);
          const preview =
            p.id_preview || p.subject_label.replace(/^(user|guest|id):/, "").slice(0, 6);
          return (
            <g key={p.id}>
              <circle
                cx={sx}
                cy={sy}
                r={4.5}
                fill={fill}
                fillOpacity={0.9}
                stroke={p.kind === "ile" ? "#fde68a" : "rgba(255,255,255,0.25)"}
                strokeWidth={p.kind === "ile" ? 1.5 : 0.75}
              >
                <title>
                  {p.subject_label} · {p.workspace_title} · {p.kind.toUpperCase()}
                </title>
              </circle>
              <text
                x={sx + 7}
                y={sy + 3}
                className="fill-zinc-300"
                style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
              >
                {preview}
              </text>
            </g>
          );
        })}

        {userLocations.length === 0 && regions.length === 0 && (
          <text
            x={WIDTH / 2}
            y={HEIGHT / 2}
            textAnchor="middle"
            className="fill-zinc-600"
            style={{ fontSize: 13, fontFamily: "ui-monospace, monospace" }}
          >
            Awaiting public embeddings — make a workspace public to appear
          </text>
        )}
      </svg>

      {/* 2D control legend */}
      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[15rem] border border-zinc-800/90 bg-black/70 px-3 py-2.5 backdrop-blur-sm"
        data-map-2d-legend
      >
        <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">Controls</p>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-zinc-400">
          <li>
            <span className="text-zinc-200">Drag</span> / one-finger — pan
          </li>
          <li>
            <span className="text-zinc-200">Scroll</span> / pinch — zoom
          </li>
          <li>
            <span className="text-zinc-200">←↑↓→</span> or <span className="text-zinc-200">WASD</span>{" "}
            — pan
          </li>
          <li>
            <span className="text-zinc-200">+</span> / <span className="text-zinc-200">−</span> — zoom
          </li>
          <li>
            <span className="text-zinc-200">0</span> / <span className="text-zinc-200">R</span> /{" "}
            <span className="text-zinc-200">double-click</span> — reset
          </li>
          <li>
            <span className="text-zinc-200">Shift</span> + arrows — larger pan
          </li>
        </ul>
      </div>

      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button
          type="button"
          onClick={() => zoomBy(1.15)}
          className="rounded-sm border border-zinc-700 bg-black/60 px-2 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur-sm transition hover:border-zinc-500 hover:text-white"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.87)}
          className="rounded-sm border border-zinc-700 bg-black/60 px-2 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur-sm transition hover:border-zinc-500 hover:text-white"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-sm border border-zinc-700 bg-black/60 px-2.5 py-1 font-mono text-[10px] tracking-wide text-zinc-300 backdrop-blur-sm transition hover:border-zinc-500 hover:text-white"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
