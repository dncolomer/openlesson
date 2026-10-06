"use client";

import { ileHeliosThinkingLine } from "@/lib/ile-dialogue-turn";

export function CanvasThinkingChips({
  thinkingChips,
  thinkingHostByIdRef,
  thinkingOverlayBox,
  thinkingTick,
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
            className="pointer-events-none absolute z-[55] origin-top-left"
            style={{
              left: chip.left,
              top: chip.top,
              transform: `scale(${chip.zoom})`,
            }}
          >
            <div
              data-ile-canvas-thinking-chip
              className="animate-ile-canvas-thinking box-border flex flex-col items-center justify-center gap-2 overflow-hidden rounded-none border border-white bg-neutral-950/92 px-3 py-3 shadow-[0_10px_32px_rgba(0,0,0,0.55)]"
              style={{
                width: thinkingOverlayBox.width,
                height: thinkingOverlayBox.height,
                minWidth: thinkingOverlayBox.minWidth,
                minHeight: thinkingOverlayBox.minHeight,
                maxWidth: thinkingOverlayBox.maxWidth,
                maxHeight: thinkingOverlayBox.maxHeight,
              }}
            >
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                <span className="animate-ile-canvas-thinking-orbit absolute inset-0 rounded-full border border-white/30 border-t-white" />
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span
                data-ile-canvas-thinking-copy
                className="min-w-0 w-full overflow-hidden text-center font-mono text-[10px] uppercase leading-tight tracking-wider text-white"
              >
                {ileHeliosThinkingLine(thinkingTick)}
              </span>
              <span className="flex shrink-0 items-center gap-1" aria-hidden>
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "0ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "150ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-white" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        ))}
    </>
  );
}
