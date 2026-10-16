"use client";

import { AccelerandoMark } from "@/components/AccelerandoGlyphs";
import {
  ILE_WORK_CANVAS_COMMANDS,
  type IleWorkCanvasCommandId,
} from "@/lib/ile-work-canvas-commands";

export const ILE_CANVAS_COMMAND_BUTTON_CLASS =
  "pointer-events-auto relative flex h-full flex-col min-w-0 items-center justify-center gap-1 whitespace-normal rounded-none border border-white/45 bg-black px-1.5 pb-1.5 pt-3 text-center font-mono text-[11px] leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-white hover:bg-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

export const ILE_CANVAS_COMMAND_RAIL_CLASS =
  "pointer-events-auto relative flex min-h-9 w-full min-w-0 flex-row items-center justify-start gap-1.5 whitespace-nowrap rounded-none border border-white/45 bg-black px-1.5 py-2 text-left font-mono text-[11px] leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-white hover:bg-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

/** Sidebar Commands tab: the same plate as the dock, with a fixed tile height. */
export const ILE_CANVAS_COMMAND_SIDEBAR_CLASS =
  "pointer-events-auto relative flex min-h-[4.75rem] w-full flex-col min-w-0 items-center justify-center gap-1 whitespace-normal rounded-none border border-white/45 bg-black px-1.5 pb-1.5 pt-3 text-center font-mono text-[11px] leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-white hover:bg-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

export function ileWorkCanvasCommandIndex(id: IleWorkCanvasCommandId): string {
  const at = ILE_WORK_CANVAS_COMMANDS.findIndex((command) => command.id === id);
  return String(at + 1).padStart(2, "0");
}

/** Corner ticks, a stencil number, and a lamp. They follow the button color, including the dim disabled state. */
export function CommandPlate({ index }: { index: string }) {
  const tick = "pointer-events-none absolute h-1.5 w-1.5 border-current opacity-70";
  return (
    <>
      <span aria-hidden className={`${tick} left-0.5 top-0.5 border-l border-t`} />
      <span aria-hidden className={`${tick} right-0.5 top-0.5 border-r border-t`} />
      <span aria-hidden className={`${tick} bottom-0.5 left-0.5 border-b border-l`} />
      <span aria-hidden className={`${tick} bottom-0.5 right-0.5 border-b border-r`} />
      <span
        aria-hidden
        data-ile-command-index={index}
        className="absolute left-1.5 top-0.5 font-mono text-[7px] leading-none tracking-[0.14em] opacity-60"
      >
        {index}
      </span>
      <span aria-hidden className="absolute right-1.5 top-1 h-1 w-1 bg-current" />
    </>
  );
}

export function CommandMark({
  id,
  label,
  className = "h-3.5 w-3.5",
}: {
  id: IleWorkCanvasCommandId;
  label: string;
  className?: string;
}) {
  return <AccelerandoMark text={label} mark={id} className={className} />;
}
