"use client";

import type { CSSProperties, ReactNode } from "react";
import { ileCompactRootFillStyle } from "@/lib/ile-compact-window";

export function IleChapterWidgetFrame({
  children,
  onMinimize,
  onToggleWide,
  wide = false,
  fill = false,
  compact = false,
  className = "",
  style,
  toolbar,
  footer,
}: {
  children: ReactNode;
  onMinimize?: () => void;
  onToggleWide?: () => void;
  wide?: boolean;
  fill?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  toolbar?: ReactNode;
  footer?: ReactNode;
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
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Work</span>
        <div className="flex items-center gap-0.5">
          {onToggleWide ? (
            <button
              type="button"
              data-ile-work-canvas-wide-toggle
              data-ile-work-canvas-wide={wide ? "true" : "false"}
              onClick={onToggleWide}
              title={wide ? "Exit full screen" : "Full screen canvas"}
              aria-label={wide ? "Exit full screen" : "Full screen canvas"}
              aria-pressed={wide}
              className="rounded-none px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
            >
              {wide ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M6 3H3v3M10 3h3v3M6 13H3v-3M10 13h3v-3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          ) : null}
          {onMinimize ? (
            <button
              type="button"
              data-ile-helios-widget-minimize
              onClick={onMinimize}
              title="Minimize"
              aria-label="Minimize work"
              className="rounded-none px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
            >
              –
            </button>
          ) : (
            <span className="px-1.5 py-0.5 text-xs text-transparent">–</span>
          )}
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

/** PiP / popup host: same Chapter chrome, fills the compact window. */
export function IleChapterPipFrame({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <IleChapterWidgetFrame
      fill
      compact
      footer={footer}
      className="pointer-events-auto"
      style={{
        position: "relative",
        boxSizing: "border-box",
        ...ileCompactRootFillStyle(),
      }}
    >
      {children}
    </IleChapterWidgetFrame>
  );
}
