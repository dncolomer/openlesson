"use client";

import type { PointerEvent } from "react";
import {
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_WIDTH,
} from "@/lib/map-minimap-clusters";

export type MapMinimapTile = {
  blockId: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MapMinimapLabel = {
  clusterId: string;
  count: number;
  centerBlockId: string;
  x: number;
  y: number;
};

export type MapMinimapViewportRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function MapMinimapChrome({
  clusterCount,
  totalBlocks,
  tiles,
  labels,
  viewportRect,
  onTilePointerDown,
  onClusterPointerDown,
  onViewportPointerDown,
  onViewportPointerMove,
  onViewportPointerUp,
}: {
  clusterCount: number;
  totalBlocks: number;
  tiles: readonly MapMinimapTile[];
  labels: readonly MapMinimapLabel[];
  viewportRect: MapMinimapViewportRect | null;
  onTilePointerDown: (cell: { row: number; col: number }) => void;
  onClusterPointerDown: (label: any) => void;
  onViewportPointerDown: (e: PointerEvent<SVGRectElement>) => void;
  onViewportPointerMove: (e: PointerEvent<SVGRectElement>) => void;
  onViewportPointerUp: (e: PointerEvent<SVGRectElement>) => void;
}) {
  return (
    <div
      data-block-minimap
      data-minimap-mode="tiles"
      data-minimap-cluster-count={clusterCount}
      data-minimap-block-count={totalBlocks}
      data-minimap-tile-count={tiles.length}
      data-minimap-empty={tiles.length === 0 ? "true" : "false"}
      className="pointer-events-auto absolute right-2 top-2 z-20 overflow-hidden rounded-md border border-neutral-700/90 bg-neutral-950/95 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      style={{ width: MINIMAP_FRAME_WIDTH, height: MINIMAP_FRAME_HEIGHT }}
      onPointerDown={(e) => e.stopPropagation()}
      title={
        tiles.length > 0
          ? "Minimap — click a cluster or square for 1:1 view"
          : "Minimap — create blocks to see them here"
      }
    >
      {tiles.length === 0 ? (
        <div
          className="flex h-full w-full items-center justify-center px-4 text-center"
          data-minimap-empty-message
        >
          <p className="text-[11px] leading-snug text-neutral-500">
            Create a cluster to see it in the minimap
          </p>
        </div>
      ) : (
        <svg
          width={MINIMAP_FRAME_WIDTH}
          height={MINIMAP_FRAME_HEIGHT}
          className="block"
          aria-label="Block map minimap"
          data-minimap-tile-view
        >
          <defs>
            <radialGradient id="minimap-fog-gradient" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor="rgba(14,14,16,0.2)" />
              <stop offset="60%" stopColor="rgba(8,8,10,0.55)" />
              <stop offset="100%" stopColor="rgba(4,4,6,0.88)" />
            </radialGradient>
            <pattern
              id="minimap-fog-noise"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
            >
              <rect width="7" height="7" fill="rgba(16,16,20,0.35)" />
              <circle cx="1.4" cy="2.2" r="0.5" fill="rgba(70,70,78,0.28)" />
              <circle cx="4.5" cy="5" r="0.4" fill="rgba(55,55,62,0.3)" />
              <circle cx="3.2" cy="1.2" r="0.3" fill="rgba(90,90,100,0.2)" />
            </pattern>
          </defs>
          <rect
            data-minimap-fog-base
            x={0}
            y={0}
            width={MINIMAP_FRAME_WIDTH}
            height={MINIMAP_FRAME_HEIGHT}
            fill="url(#minimap-fog-gradient)"
          />
          <rect
            data-minimap-fog-texture
            x={0}
            y={0}
            width={MINIMAP_FRAME_WIDTH}
            height={MINIMAP_FRAME_HEIGHT}
            fill="url(#minimap-fog-noise)"
            opacity={0.7}
            pointerEvents="none"
          />
          {tiles.map((tile) => (
            <rect
              key={`tile-${tile.blockId}-${tile.row}:${tile.col}`}
              data-minimap-tile
              data-minimap-tile-block={tile.blockId}
              data-minimap-tile-row={tile.row}
              data-minimap-tile-col={tile.col}
              x={tile.x}
              y={tile.y}
              width={tile.w}
              height={tile.h}
              rx={Math.min(1.5, tile.w * 0.2)}
              fill="rgba(255,255,255,0.82)"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={0.6}
              className="cursor-pointer transition hover:fill-white"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTilePointerDown({ row: tile.row, col: tile.col });
              }}
            />
          ))}
          {labels.map((label) => {
            const r = Math.min(16, 10 + Math.log2(label.count + 1) * 2);
            return (
              <g
                key={label.clusterId}
                data-minimap-cluster={label.clusterId}
                data-minimap-cluster-count={label.count}
                data-minimap-center-block={label.centerBlockId}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onClusterPointerDown(label);
                }}
              >
                <circle
                  data-minimap-cluster-hit
                  cx={label.x}
                  cy={label.y}
                  r={r}
                  fill="transparent"
                  stroke="none"
                />
              </g>
            );
          })}
          <g
            data-minimap-total-blocks={totalBlocks}
            data-minimap-counts-hidden="true"
          />
          {viewportRect ? (
            <rect
              data-minimap-viewport-rect
              data-minimap-viewport-window
              x={viewportRect.x}
              y={viewportRect.y}
              width={viewportRect.w}
              height={viewportRect.h}
              fill="rgba(96, 165, 250, 0.18)"
              stroke="rgba(147, 197, 253, 0.95)"
              strokeWidth={1.5}
              rx={2}
              className="cursor-grab active:cursor-grabbing"
              style={{ pointerEvents: "all" }}
              onPointerDown={onViewportPointerDown}
              onPointerMove={onViewportPointerMove}
              onPointerUp={onViewportPointerUp}
              onPointerCancel={onViewportPointerUp}
            />
          ) : null}
        </svg>
      )}
    </div>
  );
}
