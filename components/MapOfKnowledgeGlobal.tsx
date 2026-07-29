"use client";

import { useMemo } from "react";
import {
  buildGlobalMapModel,
  formatGlobalMapDistance,
  type GlobalMapEdge,
  type GlobalMapRegionNode,
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
  // Pad degenerate spans so a single region still centers.
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
 * Users are not free-scatter markers — only orbit bubble counts.
 */
export function MapOfKnowledgeGlobal({
  userLocations,
  regions,
  className = "",
  fill = false,
}: MapOfKnowledgeGlobalProps) {
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

  const heightClass = fill ? "h-full min-h-0 flex-1" : "h-[min(58vh,520px)]";

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#09090b] ${heightClass} ${className}`}
      data-map-global
      data-map-global-surface
    >
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-full w-full"
        role="img"
        aria-label="Global Map of Knowledge: regions as dots with orbit membership counts"
        data-map-global-svg
      >
        <defs>
          <radialGradient id="global-map-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.18)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
        </defs>
        <rect width={layout.width} height={layout.height} fill="#09090b" />
        <circle
          cx={layout.width / 2}
          cy={layout.height / 2}
          r={Math.min(layout.width, layout.height) * 0.42}
          fill="url(#global-map-glow)"
        />

        {/* Edges: dotted connectors + distance labels */}
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

        {/* Region nodes + dual orbits (no free user scatter) */}
        {layout.nodes.map((n) => {
          const innerR = 22;
          const outerR = 36;
          return (
            <g key={n.id} transform={`translate(${n.sx},${n.sy})`} data-map-global-node data-region-id={n.id}>
              {/* Outer orbit (near) */}
              <circle
                r={outerR}
                fill="none"
                stroke="rgba(251,191,36,0.35)"
                strokeWidth={1}
                strokeDasharray="2 3"
                data-map-global-orbit-near
              />
              {/* Inner orbit (inside) */}
              <circle
                r={innerR}
                fill="none"
                stroke="rgba(34,211,238,0.45)"
                strokeWidth={1.25}
                strokeDasharray="2 2"
                data-map-global-orbit-inside
              />
              {/* Region dot */}
              <circle
                r={7}
                fill="#22d3ee"
                stroke="#ecfeff"
                strokeWidth={1.5}
                data-map-global-region-dot
              />
              {/* Inside bubble (inner orbit, top-right) */}
              <g transform={`translate(${innerR * 0.72},${-innerR * 0.72})`} data-map-global-bubble-inside>
                <circle r={10} fill="#0e7490" stroke="#67e8f9" strokeWidth={1} />
                <text
                  textAnchor="middle"
                  y={3.5}
                  className="fill-white"
                  style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
                >
                  {n.inside_count}
                </text>
              </g>
              {/* Near bubble (outer orbit, bottom-right) */}
              <g transform={`translate(${outerR * 0.72},${outerR * 0.72})`} data-map-global-bubble-near>
                <circle r={10} fill="#78350f" stroke="#fbbf24" strokeWidth={1} />
                <text
                  textAnchor="middle"
                  y={3.5}
                  className="fill-amber-50"
                  style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
                >
                  {n.near_count}
                </text>
              </g>
              {/* Labels */}
              <text
                y={outerR + 14}
                textAnchor="middle"
                className="fill-zinc-200"
                style={{ fontSize: 10, fontFamily: "ui-sans-serif, system-ui, sans-serif", fontWeight: 500 }}
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
      </svg>

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[16rem] border border-zinc-800/90 bg-black/70 px-3 py-2.5 backdrop-blur-sm"
        data-map-global-legend
      >
        <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-500">Global Map</p>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-zinc-400">
          <li>
            <span className="text-cyan-300">Inner orbit</span> — users inside region
          </li>
          <li>
            <span className="text-amber-300">Outer orbit</span> — near, not inside
          </li>
          <li>Dotted links show inter-region distance</li>
          <li className="text-zinc-500">Users are not plotted as free markers</li>
        </ul>
      </div>
    </div>
  );
}
