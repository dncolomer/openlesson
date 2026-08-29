"use client";

import {
  BLOCK_MAP_GRID_SIZE,
  DEFAULT_BLOCK_MAP_ICON,
  blockMapPatternBits,
  blockMapPatternCells,
  parseBlockMapIconName,
} from "@/lib/block-map-glyph";

const CELL = 7;
const GAP = 1;
const ORIGIN = 1;
const PITCH = CELL + GAP;

export function BlockMapGlyphIcon({
  name,
  className,
  variant = "solid",
}: {
  name?: string | null;
  className?: string;
  /** Workspace tiles fill squares; TAP/ILE chapter tiles are outlines. */
  variant?: "solid" | "outline";
}) {
  const resolved = parseBlockMapIconName(name) ?? DEFAULT_BLOCK_MAP_ICON;
  const cells = blockMapPatternCells(resolved);
  const bits = blockMapPatternBits(resolved);
  const outline = variant === "outline";

  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-8 w-8"}
      aria-hidden
      data-block-map-icon={resolved}
      data-block-map-grid="3x3"
      data-block-map-bits={bits}
      data-block-map-variant={variant}
    >
      {cells.map((filled, i) => {
        if (!filled) return null;
        const col = i % BLOCK_MAP_GRID_SIZE;
        const row = Math.floor(i / BLOCK_MAP_GRID_SIZE);
        const pad = outline ? 0.75 : 0;
        return (
          <rect
            key={i}
            x={ORIGIN + col * PITCH + pad}
            y={ORIGIN + row * PITCH + pad}
            width={CELL - pad * 2}
            height={CELL - pad * 2}
            fill={outline ? "none" : "currentColor"}
            stroke={outline ? "currentColor" : "none"}
            strokeWidth={outline ? 1.5 : undefined}
            strokeLinecap={outline ? "square" : undefined}
            strokeLinejoin={outline ? "miter" : undefined}
            data-block-map-cell={i}
          />
        );
      })}
    </svg>
  );
}
