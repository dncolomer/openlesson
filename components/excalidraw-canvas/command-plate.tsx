"use client";

import {
  ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL,
  ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP,
  ILE_WORK_CANVAS_COMMANDS,
  type IleWorkCanvasCommandId,
} from "@/lib/learn-work-canvas-commands";

export const ILE_CANVAS_COMMAND_BUTTON_CLASS =
  "pointer-events-auto relative flex h-full flex-col min-w-0 items-center justify-center gap-1 whitespace-normal rounded-none border border-white/45 bg-black px-1.5 pb-1.5 pt-3 text-center font-mono text-[11px] leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-white hover:bg-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

export const ILE_CANVAS_COMMAND_RAIL_CLASS =
  "pointer-events-auto relative flex min-h-9 w-full min-w-0 flex-row items-center justify-start gap-1.5 whitespace-nowrap rounded-none border border-white/45 bg-black px-1.5 py-2 text-left font-mono text-[11px] leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:border-white hover:bg-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

/** Sidebar Commands tab: fill the row, then shrink type and marks with the tile. */
export const ILE_CANVAS_COMMAND_SIDEBAR_CLASS =
  "pointer-events-auto relative flex h-full min-h-0 w-full flex-col min-w-0 items-center justify-center gap-0.5 overflow-hidden whitespace-normal rounded-none border border-white/35 bg-black px-0.5 py-0 pt-1.5 text-center font-mono text-[clamp(9px,14cqh,12px)] leading-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-white hover:bg-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600 [container-type:size]";

/** Commit stays inverted so it reads as the primary command. */
export const ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_CLASS =
  "pointer-events-auto relative flex h-full min-h-0 w-full flex-col min-w-0 items-center justify-center gap-0.5 overflow-hidden whitespace-normal rounded-none border border-white bg-white px-1 py-0.5 pt-1.5 text-center font-mono text-[clamp(7px,10cqh,10px)] leading-tight text-neutral-950 shadow-[inset_0_1px_0_rgba(0,0,0,0.12)] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600 [container-type:size]";

/** Full-width commit bar in the Commands bottom subsection. Twice a command tile. */
export const ILE_CANVAS_COMMAND_SIDEBAR_COMMIT_BAR_CLASS =
  "pointer-events-auto relative flex min-h-[3.25rem] w-full min-w-0 flex-row items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-none border border-white bg-white px-2 py-2 text-center font-mono text-[12px] leading-tight text-neutral-950 shadow-[inset_0_1px_0_rgba(0,0,0,0.12)] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:opacity-100 disabled:shadow-none disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600";

export const ILE_CANVAS_COMMAND_SIDEBAR_MARK_CLASS =
  "h-[clamp(0.75rem,24cqh,1.15rem)] w-[clamp(0.75rem,24cqh,1.15rem)] shrink-0";

export function ileWorkCanvasCommandIndex(
  id: string,
  catalog: readonly { id: string }[] = ILE_WORK_CANVAS_COMMANDS,
): string {
  const at = catalog.findIndex((command) => command.id === id);
  return String(Math.max(0, at) + 1).padStart(2, "0");
}

const ICON_PATHS: Record<string, string> = {
  focus: "M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  simplify: "M3 4h10M3 8h7M3 12h4",
  split: "M3 3h4v10H3zM9 3h4v4H9zM9 9h4v4H9z",
  breakdown: "M2 6.5h4v3H2zM10 2.5h4v3h-4zM10 10.5h4v3h-4zM6 8h4M10 8V4M10 8v6.5",
  concepts: "M2 2.5h4v3H2zM10 2.5h4v3h-4zM6 10.5h4v3H6zM4 5.5v5M12 5.5v5M8 8.5v2",
  define: "M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h7M5.5 10.5h4",
  answer: "M3 3h10v7H8l-3 3v-3H3z",
  draw: "M10.5 2.5l3 3-8 8H2.5v-3zM9 4l3 3",
  refactor: "M4 3h5v2H6.5A4.5 4.5 0 1 1 3 10M12 13H7v-2h2.5A4.5 4.5 0 1 1 13 6",
  dictate: "M8 2.5a2 2 0 0 1 2 2V8a2 2 0 1 1-4 0V4.5a2 2 0 0 1 2-2zM5 8.5a3 3 0 0 0 6 0M8 11.5V14",
  commit: "M3 8h10M10 5l3 3-3 3",
  "auto-layout": "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
};

/** Corner ticks, a stencil number, and a lamp. They follow the button color, including the dim disabled state. */
export function CommandPlate({ index }: { index: string }) {
  const tick = "pointer-events-none absolute h-1 w-1 border-current opacity-40";
  return (
    <>
      <span aria-hidden className={`${tick} left-0.5 top-0.5 border-l border-t`} />
      <span aria-hidden className={`${tick} right-0.5 top-0.5 border-r border-t`} />
      <span aria-hidden className={`${tick} bottom-0.5 left-0.5 border-b border-l`} />
      <span aria-hidden className={`${tick} bottom-0.5 right-0.5 border-b border-r`} />
      <span
        aria-hidden
        data-ile-command-index={index}
        className="absolute left-1.5 top-0.5 font-mono text-[8px] leading-none tracking-[0.14em] opacity-60"
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
  id: IleWorkCanvasCommandId | "dictate" | "commit" | "auto-layout";
  label?: string;
  className?: string;
}) {
  const d = ICON_PATHS[id] ?? ICON_PATHS.simplify;
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-ile-command-mark={id}
      data-command-icon={id}
    >
      <title>{label || id}</title>
      <path d={d} />
    </svg>
  );
}

export function AutoLayoutToggle({
  enabled,
  disabled,
  onToggle,
  compact = false,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      data-session-command="auto-layout"
      data-session-auto-layout=""
      aria-checked={enabled}
      aria-label={ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL}
      title={ILE_WORK_CANVAS_AUTO_LAYOUT_TOOLTIP}
      disabled={disabled}
      onClick={onToggle}
      className={
        compact
          ? "pointer-events-auto flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-none border border-white/40 bg-black px-2 py-1 text-left font-mono text-[10px] text-white hover:border-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
          : "pointer-events-auto flex min-h-[1.75rem] w-full min-w-0 shrink-0 items-center justify-between gap-2 rounded-none border border-white/40 bg-black px-2 py-1 text-left font-mono text-[10px] leading-none text-white hover:border-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-600"
      }
    >
      <span className="min-w-0 truncate">{ILE_WORK_CANVAS_AUTO_LAYOUT_LABEL}</span>
      <span
        aria-hidden
        data-session-auto-layout-track={enabled ? "on" : "off"}
        className={`relative h-3.5 w-7 shrink-0 rounded-full border ${
          enabled ? "border-white bg-white" : "border-white/50 bg-neutral-900"
        }`}
      >
        <span
          className={`absolute top-0.5 h-2 w-2 rounded-full transition-transform ${
            enabled ? "left-4 bg-neutral-950" : "left-0.5 bg-white"
          }`}
        />
      </span>
    </button>
  );
}
