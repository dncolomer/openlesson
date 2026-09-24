"use client";

import type { CSSProperties, ReactNode } from "react";
import { ILE_SESSION_TOP_BAR_PAD_CLASS } from "@/lib/ile-map-chrome";

export function IleChapterWidgetFrame({
  children,
  onMinimize,
  wide = false,
  fill = false,
  compact = false,
  title = "Work",
  className = "",
  style,
  toolbar,
  footer,
  headerLeading,
  headerExtra,
}: {
  children: ReactNode;
  onMinimize?: () => void;
  wide?: boolean;
  fill?: boolean;
  compact?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  toolbar?: ReactNode;
  footer?: ReactNode;
  headerLeading?: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <div
      data-ile-helios-widget
      data-ile-chapter-widget-frame
      data-ile-compact-stash={compact ? "true" : undefined}
      className={`flex flex-col overflow-hidden rounded-none bg-neutral-950/95 ${
        wide ? "border-0" : "border border-neutral-700"
      } ${fill ? "h-full" : ""} ${className}`}
      style={style}
    >
      <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 ${ILE_SESSION_TOP_BAR_PAD_CLASS}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-[13px] font-semibold uppercase tracking-wider text-neutral-400">
            {title}
          </span>
          {headerLeading}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {headerExtra}
          {onMinimize ? (
            <button
              type="button"
              data-ile-helios-widget-minimize
              onClick={onMinimize}
              title="Minimize"
              aria-label={`Minimize ${title.toLowerCase()}`}
              className="rounded-none px-2 py-1 text-base leading-none text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
            >
              –
            </button>
          ) : null}
        </div>
      </div>
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {footer ? (
        <div
          data-ile-chapter-widget-footer
          className="shrink-0 border-t border-neutral-800 px-2 py-2"
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
