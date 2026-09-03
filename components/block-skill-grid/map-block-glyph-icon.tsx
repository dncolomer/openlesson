"use client";

import { Pickaxe } from "lucide-react";
import {
  BLOCK_MAP_GRID_SIZE,
  CHAPTER_DONE_MAP_ICON,
  DEFAULT_BLOCK_MAP_ICON,
  ILE_GATHER_RUNNING_MAP_ICON,
  PREVIOUS_SESSIONS_MAP_ICON,
  TIM_EXPLORE_MAP_ICON,
  blockMapPatternBits,
  blockMapPatternCells,
  isChapterDoneMapIcon,
  isIleGatherRunningMapIcon,
  isPreviousSessionsMapIcon,
  isTimExploreMapIcon,
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
  if (isPreviousSessionsMapIcon(name)) {
    return (
      <Pickaxe
        className={className ?? "h-8 w-8"}
        strokeWidth={2.4}
        aria-hidden
        data-block-map-icon={PREVIOUS_SESSIONS_MAP_ICON}
        data-block-previous-sessions-icon="true"
        data-block-map-variant={variant}
      />
    );
  }

  if (isIleGatherRunningMapIcon(name)) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className ?? "h-8 w-8"}
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-block-map-icon={ILE_GATHER_RUNNING_MAP_ICON}
        data-ile-gather-running-icon="true"
        data-block-map-variant={variant}
      >
        <path d="M10 10h4" />
        <path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" />
        <path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z" />
        <path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z" />
        <path d="M9 7V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3" />
      </svg>
    );
  }

  if (isTimExploreMapIcon(name)) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className ?? "h-8 w-8"}
        aria-hidden
        data-block-map-icon={TIM_EXPLORE_MAP_ICON}
        data-tim-explore-icon="true"
        data-block-map-variant={variant}
      >
        <text
          x="12"
          y="18"
          textAnchor="middle"
          fill="currentColor"
          fontSize="16"
          fontWeight="700"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          ?
        </text>
      </svg>
    );
  }

  if (isChapterDoneMapIcon(name)) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className ?? "h-8 w-8"}
        aria-hidden
        fill="currentColor"
        data-block-map-icon={CHAPTER_DONE_MAP_ICON}
        data-chapter-done-flag="true"
        data-block-map-variant={variant}
      >
        <path d="M6 3.75v16.5a.75.75 0 01-1.5 0V3.75a.75.75 0 011.5 0z" />
        <path d="M6.75 4.5h8.1c.9 0 1.4.95.9 1.65L14.4 8.4l1.35 2.25c.5.7 0 1.65-.9 1.65H6.75V4.5z" />
      </svg>
    );
  }

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
