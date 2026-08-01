"use client";

import { useState, type ReactNode } from "react";
import { nextRightPaneDrawerExpanded } from "@/lib/workspace-right-pane";

/**
 * Shared chrome for map right-column form surfaces:
 * top-anchored, full column width, collapsible body — not a floating card.
 * Collapse/expand via header only (no close button on the chrome).
 */
export function WorkspaceRightPaneDrawer({
  paneKind,
  title,
  defaultExpanded = true,
  children,
  headerExtra,
  bodyClassName = "",
  surfaceDataAttr,
  drawerId,
  /** fill = sole surface (h-full). section = stackable drawer in a column. */
  variant = "fill",
}: {
  /** Value for data-workspace-right-pane (add_block | generate_shape | block-detail | …). */
  paneKind?: string;
  title: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
  headerExtra?: ReactNode;
  bodyClassName?: string;
  /**
   * Extra surface marker on the shell (e.g. data-workspace-add-block-pane).
   */
  surfaceDataAttr?: string;
  /** Optional stable id for data-block-detail-drawer / section markers. */
  drawerId?: string;
  variant?: "fill" | "section";
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const surfaceProps = surfaceDataAttr
    ? ({ [surfaceDataAttr]: true } as Record<string, boolean>)
    : {};

  const shellClass =
    variant === "fill"
      ? "flex h-full w-full min-h-0 flex-col overflow-hidden border-b border-neutral-800/70 bg-neutral-950/95"
      : expanded
        ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden border-b border-neutral-800/70 bg-neutral-950/95"
        : "flex w-full shrink-0 flex-col overflow-hidden border-b border-neutral-800/70 bg-neutral-950/95";

  return (
    <div
      data-workspace-right-pane-drawer
      {...(paneKind ? { "data-workspace-right-pane": paneKind } : {})}
      {...(drawerId
        ? {
            "data-block-detail-drawer": drawerId,
            "data-block-detail-tab": drawerId,
          }
        : {})}
      data-drawer-expanded={expanded ? "true" : "false"}
      data-drawer-open={expanded ? "true" : "false"}
      data-drawer-anchor="top"
      data-drawer-width="full"
      data-drawer-variant={variant}
      className={shellClass}
      {...surfaceProps}
    >
      <header
        data-workspace-right-pane-drawer-header
        {...(drawerId
          ? { "data-block-detail-drawer-header": drawerId }
          : {})}
        className="flex shrink-0 items-stretch border-b border-neutral-800/70 bg-neutral-950"
      >
        <button
          type="button"
          data-workspace-right-pane-drawer-toggle
          aria-expanded={expanded}
          onClick={() =>
            setExpanded((cur) => nextRightPaneDrawerExpanded(cur, "toggle"))
          }
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition hover:bg-neutral-900/60 sm:px-4"
        >
          <span
            className={`shrink-0 text-[10px] text-neutral-500 transition ${
              expanded ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ›
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
            {title}
          </span>
        </button>
        {headerExtra}
      </header>

      {expanded ? (
        <div
          data-workspace-right-pane-drawer-body
          {...(drawerId
            ? {
                "data-block-detail-drawer-body": drawerId,
                "data-block-detail-tab-panel": drawerId,
                "data-block-detail-tab-content": drawerId,
              }
            : {})}
          role="region"
          className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4 sm:py-4 ${bodyClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
