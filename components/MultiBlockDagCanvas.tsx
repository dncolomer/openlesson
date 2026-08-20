"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  layoutMultiBlockDagNodes,
  multiBlockDagEdgeEndpoints,
  resolveMultiBlockDagConnect,
  type MultiBlockDagDraft,
  type MultiBlockDagEdge,
} from "@/lib/multi-block-dag";

/** Larger viewBox so the mini graph uses more of the right pane. */
const VIEW_W = 420;
const VIEW_H = 360;
const NODE_W = 88;
const NODE_H = 34;

export type MultiBlockDagCanvasBlock = {
  id: string;
  title: string;
  position_x?: number | null;
  position_y?: number | null;
};

/**
 * Visual connect canvas for multi-select DAG editing (leads-to only).
 * Drag from one node to another (or click source then target) to toggle edges.
 */
export function MultiBlockDagCanvas({
  blocks,
  draft,
  disabled = false,
  readOnly = false,
  onToggleEdge,
}: {
  blocks: MultiBlockDagCanvasBlock[];
  draft: MultiBlockDagDraft;
  disabled?: boolean;
  /** Learner / view-only: no connect gestures; still shows edges. */
  readOnly?: boolean;
  onToggleEdge?: (
    from: string,
    to: string,
    kind: "next" | "lock",
    enabled: boolean,
  ) => void;
}) {
  const interactionOff = disabled || readOnly;
  const nodes = useMemo(
    () =>
      layoutMultiBlockDagNodes(blocks, {
        width: VIEW_W,
        height: VIEW_H,
        padding: 48,
      }),
    [blocks],
  );
  const byId = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const [wireFrom, setWireFrom] = useState<string | null>(null);
  const [wireTo, setWireTo] = useState<{ x: number; y: number } | null>(null);
  /** Click-to-connect source (no drag). */
  const [clickFrom, setClickFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pressRef = useRef<{
    id: string;
    x: number;
    y: number;
    dragged: boolean;
  } | null>(null);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * VIEW_W;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * VIEW_H;
    return { x, y };
  }, []);

  const hitNode = useCallback(
    (pt: { x: number; y: number }): string | null => {
      for (const n of nodes) {
        if (
          Math.abs(pt.x - n.x) <= NODE_W / 2 &&
          Math.abs(pt.y - n.y) <= NODE_H / 2
        ) {
          return n.id;
        }
      }
      return null;
    },
    [nodes],
  );

  const applyConnect = useCallback(
    (from: string, to: string) => {
      if (interactionOff || !onToggleEdge) return;
      const result = resolveMultiBlockDagConnect(draft, from, to, "next");
      if (result.action === "none") return;
      onToggleEdge(
        result.edge.from,
        result.edge.to,
        "next",
        result.enabled,
      );
    },
    [interactionOff, draft, onToggleEdge],
  );

  const clearWire = useCallback(() => {
    pressRef.current = null;
    setWireFrom(null);
    setWireTo(null);
  }, []);

  const handleNodePointerDown = (
    nodeId: string,
    event: React.PointerEvent,
  ) => {
    if (interactionOff || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    pressRef.current = {
      id: nodeId,
      x: event.clientX,
      y: event.clientY,
      dragged: false,
    };
    setWireFrom(nodeId);
    setWireTo(clientToSvg(event.clientX, event.clientY));
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press) return;
    const dist = Math.hypot(
      event.clientX - press.x,
      event.clientY - press.y,
    );
    if (dist > 6) press.dragged = true;
    setWireTo(clientToSvg(event.clientX, event.clientY));
  };

  const finishGesture = (
    event: React.PointerEvent,
    releaseTarget: Element | null,
  ) => {
    const press = pressRef.current;
    if (!press) return;
    if (releaseTarget?.hasPointerCapture?.(event.pointerId)) {
      releaseTarget.releasePointerCapture(event.pointerId);
    }
    const pt = clientToSvg(event.clientX, event.clientY);
    const hit = hitNode(pt);

    if (press.dragged) {
      if (hit && hit !== press.id) applyConnect(press.id, hit);
      setClickFrom(null);
      clearWire();
      return;
    }

    if (clickFrom && clickFrom !== press.id) {
      applyConnect(clickFrom, press.id);
      setClickFrom(null);
    } else if (clickFrom === press.id) {
      setClickFrom(null);
    } else {
      setClickFrom(press.id);
    }
    clearWire();
  };

  const handleNodePointerUp = (
    _nodeId: string,
    event: React.PointerEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    finishGesture(event, event.currentTarget as Element);
  };

  const handleSvgPointerUp = (event: React.PointerEvent) => {
    if (!pressRef.current) return;
    finishGesture(event, null);
  };

  const handleEdgeClick = (edge: MultiBlockDagEdge) => {
    if (interactionOff || !onToggleEdge) return;
    onToggleEdge(edge.from, edge.to, "next", false);
  };

  const wireOrigin = wireFrom ? byId.get(wireFrom) : null;
  const nextEdges = draft.edges.filter((e) => e.kind === "next");

  return (
    <div
      data-multi-block-dag-canvas
      data-dag-edge-kind="next"
      data-dag-read-only={readOnly ? "true" : undefined}
      data-dag-connect-from={clickFrom || wireFrom || undefined}
      className="space-y-2"
    >
      {!readOnly ? (
        <p className="text-[10px] leading-snug text-neutral-500" data-dag-connect-hint>
          {clickFrom
            ? "Click another block to connect · click same to cancel"
            : "Drag between blocks to connect · click an edge to remove"}
        </p>
      ) : null}

      <div
        className="overflow-hidden rounded-md border border-white/10 bg-neutral-950/80"
        data-dag-canvas-frame
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[min(52vh,360px)] w-full touch-none select-none"
          data-dag-canvas-svg
          onPointerMove={handlePointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={() => {
            if (pressRef.current?.dragged) {
              setClickFrom(null);
              clearWire();
            }
          }}
        >
          <defs>
            <marker
              id="dag-arrow-white"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="rgb(255 255 255 / 0.85)" />
            </marker>
          </defs>

          <g data-dag-edges>
            {nextEdges.map((edge) => {
              const a = byId.get(edge.from);
              const b = byId.get(edge.to);
              if (!a || !b) return null;
              const { x1, y1, x2, y2 } = multiBlockDagEdgeEndpoints(
                a,
                b,
                NODE_W * 0.42,
              );
              return (
                <g
                  key={`next:${edge.from}->${edge.to}`}
                  data-dag-edge={`next:${edge.from}->${edge.to}`}
                  data-dag-edge-kind="next"
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={12}
                    className={interactionOff ? "" : "cursor-pointer"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeClick(edge);
                    }}
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgb(255 255 255 / 0.72)"
                    strokeWidth={1.75}
                    markerEnd="url(#dag-arrow-white)"
                    className="pointer-events-none"
                  />
                </g>
              );
            })}
          </g>

          {wireOrigin && wireTo ? (
            <line
              data-dag-wire-preview
              x1={wireOrigin.x}
              y1={wireOrigin.y}
              x2={wireTo.x}
              y2={wireTo.y}
              stroke="rgb(255 255 255 / 0.55)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              className="pointer-events-none"
            />
          ) : null}

          <g data-dag-nodes>
            {nodes.map((n) => {
              const armed = clickFrom === n.id || wireFrom === n.id;
              return (
                <g
                  key={n.id}
                  data-dag-node={n.id}
                  data-dag-node-armed={armed ? "true" : "false"}
                  transform={`translate(${n.x}, ${n.y})`}
                  className={
                    interactionOff
                      ? readOnly
                        ? "cursor-default"
                        : "opacity-60"
                      : "cursor-grab active:cursor-grabbing"
                  }
                  onPointerDown={(e) => handleNodePointerDown(n.id, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(e) => handleNodePointerUp(n.id, e)}
                  onPointerCancel={() => {
                    setClickFrom(null);
                    clearWire();
                  }}
                >
                  <rect
                    x={-NODE_W / 2}
                    y={-NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={7}
                    ry={7}
                    fill={
                      armed
                        ? "rgb(255 255 255 / 0.12)"
                        : "rgb(23 23 23 / 0.95)"
                    }
                    stroke={
                      armed
                        ? "rgb(255 255 255 / 0.65)"
                        : "rgb(255 255 255 / 0.14)"
                    }
                    strokeWidth={armed ? 1.5 : 1}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="pointer-events-none fill-neutral-100"
                    style={{ fontSize: 10, fontWeight: 500 }}
                  >
                    {truncateLabel(n.title, 12)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {nextEdges.length > 0 ? (
        <ul
          className="flex max-h-20 flex-wrap gap-1 overflow-y-auto"
          data-dag-edge-chips
        >
          {nextEdges.map((edge) => {
            const fromTitle =
              blocks.find((b) => b.id === edge.from)?.title || edge.from;
            const toTitle =
              blocks.find((b) => b.id === edge.to)?.title || edge.to;
            return (
              <li key={`next:${edge.from}->${edge.to}`}>
                <button
                  type="button"
                  data-dag-edge-chip={`next:${edge.from}->${edge.to}`}
                  disabled={interactionOff}
                  title={readOnly ? undefined : "Click to remove"}
                  onClick={() => handleEdgeClick(edge)}
                  className="inline-flex max-w-full items-center gap-1 rounded border border-white/20 bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-neutral-100 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="truncate">{truncateLabel(fromTitle, 10)}</span>
                  <span className="shrink-0 opacity-70">→</span>
                  <span className="truncate">{truncateLabel(toTitle, 10)}</span>
                  <span className="shrink-0 text-[9px] opacity-50" aria-hidden>
                    ×
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[10px] text-neutral-600" data-dag-empty-edges>
          No connections yet — drag one block onto another.
        </p>
      )}
    </div>
  );
}

function truncateLabel(label: string, max: number): string {
  const t = String(label || "").trim() || "Untitled";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}
