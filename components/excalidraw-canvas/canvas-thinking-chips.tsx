"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { ileHeliosThinkingLine } from "@/lib/learn-dialogue-turn";

export function CanvasThinkingChips({
  thinkingChips,
  thinkingHostByIdRef,
  thinkingOverlayBox,
  thinkingTick,
  onChipPointerDown,
  onChipPointerMove,
  onChipPointerUp,
}: {
  thinkingChips: Array<{ turnId: string; left: number; top: number; zoom: number }>;
  thinkingHostByIdRef: { current: Map<string, HTMLDivElement> };
  thinkingOverlayBox: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
  };
  thinkingTick: number;
  onChipPointerDown?: (turnId: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onChipPointerMove?: (turnId: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onChipPointerUp?: (turnId: string, event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
        {thinkingChips.map((chip) => (
          <div
            key={chip.turnId}
            ref={(node) => {
              if (node) thinkingHostByIdRef.current.set(chip.turnId, node);
              else thinkingHostByIdRef.current.delete(chip.turnId);
            }}
            data-ile-canvas-thinking
            data-ile-canvas-thinking-id={chip.turnId}
            data-ile-canvas-thinking-drag=""
            className="pointer-events-auto absolute z-[55] origin-top-left cursor-grab touch-none select-none active:cursor-grabbing"
            style={{
              left: chip.left,
              top: chip.top,
              transform: `scale(${chip.zoom})`,
            }}
            onPointerDown={(event) => onChipPointerDown?.(chip.turnId, event)}
            onPointerMove={(event) => onChipPointerMove?.(chip.turnId, event)}
            onPointerUp={(event) => onChipPointerUp?.(chip.turnId, event)}
            onPointerCancel={(event) => onChipPointerUp?.(chip.turnId, event)}
          >
            <div
              data-ile-canvas-thinking-chip
              className="animate-ile-canvas-thinking relative box-border flex flex-col overflow-hidden rounded-none border border-white/85 bg-neutral-950/94 shadow-[0_18px_48px_rgba(0,0,0,0.58)]"
              style={{
                width: thinkingOverlayBox.width,
                height: thinkingOverlayBox.height,
                minWidth: thinkingOverlayBox.minWidth,
                minHeight: thinkingOverlayBox.minHeight,
                maxWidth: thinkingOverlayBox.maxWidth,
                maxHeight: thinkingOverlayBox.maxHeight,
              }}
            >
              <span aria-hidden className="pointer-events-none absolute left-1 top-1 h-2 w-2 border-l border-t border-white/50" />
              <span aria-hidden className="pointer-events-none absolute right-1 top-1 h-2 w-2 border-r border-t border-white/50" />
              <span aria-hidden className="pointer-events-none absolute bottom-1 left-1 h-2 w-2 border-b border-l border-white/50" />
              <span aria-hidden className="pointer-events-none absolute bottom-1 right-1 h-2 w-2 border-b border-r border-white/50" />
              <span aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 h-1 w-1 bg-white/70" />
              <span aria-hidden className="pointer-events-none absolute inset-y-3 left-0 w-px bg-white/20" />
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 py-6">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden>
                  <span className="animate-ile-canvas-thinking-orbit absolute inset-0 rounded-full border border-white/25 border-t-white" />
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
                <span
                  data-ile-canvas-thinking-copy
                  className="min-w-0 w-full text-center font-mono text-[11px] uppercase leading-snug tracking-[0.16em] text-white/90"
                >
                  {ileHeliosThinkingLine(thinkingTick)}
                </span>
                <span className="flex shrink-0 flex-col items-center gap-1.5" aria-hidden>
                  <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "0ms" }} />
                  <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "150ms" }} />
                  <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          </div>
        ))}
    </>
  );
}
