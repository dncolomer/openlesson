"use client";

import { useMemo } from "react";
import {
  layoutMultiBlockDagNodes,
  multiBlockDagEdgeEndpoints,
  type MultiBlockDagDraft,
} from "@/lib/multi-block-dag";

const PREVIEW_W = 280;
const PREVIEW_H = 160;
const NODE_W = 56;
const NODE_H = 22;

export type MultiBlockDagPreviewBlock = {
  id: string;
  title: string;
  position_x?: number | null;
  position_y?: number | null;
};

/**
 * Compact read-only SVG thumbnail of a leads-to DAG for card grids.
 */
export function MultiBlockDagPreview({
  blocks,
  draft,
  className,
}: {
  blocks: MultiBlockDagPreviewBlock[];
  draft: MultiBlockDagDraft;
  className?: string;
}) {
  const nodes = useMemo(
    () =>
      layoutMultiBlockDagNodes(blocks, {
        width: PREVIEW_W,
        height: PREVIEW_H,
        padding: 28,
      }),
    [blocks],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const nextEdges = draft.edges.filter((e) => e.kind === "next");

  return (
    <div
      data-multi-block-dag-preview
      data-dag-preview-node-count={nodes.length}
      data-dag-preview-edge-count={nextEdges.length}
      className={`overflow-hidden rounded-none border border-white/10 bg-neutral-950/90 ${className || ""}`}
    >
      <svg
        viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
        className="pointer-events-none h-[120px] w-full select-none"
        data-dag-preview-svg
        aria-hidden
      >
        <defs>
          <marker
            id="dag-preview-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="2.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L5,2.5 L0,5 Z" fill="rgb(255 255 255 / 0.75)" />
          </marker>
        </defs>

        <g data-dag-preview-edges>
          {nextEdges.map((edge) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const { x1, y1, x2, y2 } = multiBlockDagEdgeEndpoints(
              a,
              b,
              NODE_W * 0.4,
            );
            return (
              <line
                key={`next:${edge.from}->${edge.to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgb(255 255 255 / 0.55)"
                strokeWidth={1.25}
                markerEnd="url(#dag-preview-arrow)"
              />
            );
          })}
        </g>

        <g data-dag-preview-nodes>
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <rect
                x={-NODE_W / 2}
                y={-NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={5}
                ry={5}
                fill="rgb(23 23 23 / 0.95)"
                stroke="rgb(255 255 255 / 0.2)"
                strokeWidth={1}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgb(245 245 245)"
                style={{ fontSize: 8, fontWeight: 500 }}
              >
                {truncateLabel(n.title, 9)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function truncateLabel(label: string, max: number): string {
  const t = String(label || "").trim() || "Untitled";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}
