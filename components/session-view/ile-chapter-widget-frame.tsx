"use client";

import type { CSSProperties, ReactNode } from "react";
import { ileCompactRootFillStyle } from "@/lib/ile-compact-window";

export function IleChapterWidgetFrame({
  children,
  onClose,
  fill = false,
  compact = false,
  className = "",
  style,
  footer,
}: {
  children: ReactNode;
  onClose?: () => void;
  fill?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  footer?: ReactNode;
}) {
  return (
    <div
      data-ile-helios-widget
      data-ile-chapter-widget-frame
      data-ile-compact-stash={compact ? "true" : undefined}
      className={`flex flex-col overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95 ${
        fill ? "h-full" : ""
      } ${className}`}
      style={style}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Chapter</span>
        {onClose ? (
          <button
            type="button"
            data-ile-helios-widget-close
            onClick={onClose}
            className="rounded-none px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
          >
            ✕
          </button>
        ) : (
          <span className="px-1.5 py-0.5 text-xs text-transparent">✕</span>
        )}
      </div>
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
