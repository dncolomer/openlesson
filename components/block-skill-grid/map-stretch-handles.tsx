"use client";

import type { CSSProperties, PointerEvent } from "react";
import { STRETCH_HANDLES, type StretchHandle } from "@/lib/skill-grid-ops";

export function stretchHandleStyle(handle: StretchHandle): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 0,
    zIndex: 30,
    boxSizing: "border-box",
  };
  switch (handle) {
    case "n":
      return { ...base, top: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" };
    case "s":
      return { ...base, bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" };
    case "e":
      return { ...base, right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
    case "w":
      return { ...base, left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
    case "ne":
      return { ...base, top: -5, right: -5, cursor: "nesw-resize" };
    case "nw":
      return { ...base, top: -5, left: -5, cursor: "nwse-resize" };
    case "se":
      return { ...base, bottom: -5, right: -5, cursor: "nwse-resize" };
    case "sw":
      return { ...base, bottom: -5, left: -5, cursor: "nesw-resize" };
    default:
      return base;
  }
}

export function MapStretchHandles({
  blockId,
  soleStretchBlockId,
  generationLocked,
  onPointerDown,
}: {
  blockId: string;
  soleStretchBlockId: string | null;
  generationLocked: boolean;
  onPointerDown: (blockId: string, handle: StretchHandle, e: PointerEvent<HTMLDivElement>) => void;
}) {
  if (soleStretchBlockId !== blockId || generationLocked) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-stretch-handles
      data-stretch-block={blockId}
    >
      {STRETCH_HANDLES.map((handle) => (
        <div
          key={handle}
          role="presentation"
          data-stretch-handle={handle}
          data-stretch-block={blockId}
          className="pointer-events-auto border border-white/90 bg-neutral-200 shadow-sm hover:bg-neutral-300"
          style={stretchHandleStyle(handle)}
          title={`Stretch ${handle.toUpperCase()}`}
          onPointerDown={(e) => onPointerDown(blockId, handle, e)}
        />
      ))}
    </div>
  );
}
