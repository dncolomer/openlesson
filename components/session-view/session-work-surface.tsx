"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import type { SessionSidebarMode } from "@/lib/session-sidebar";

function useNarrowViewport(enabled: boolean): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [enabled]);
  return enabled && narrow;
}

/**
 * Canvas-first live surface for Prepare, Drill, conversational TAP, and
 * verification TAP. The stage is the main column. Session chrome sits in the
 * same right sidebar Learn already mounts.
 */
export function SessionWorkSurface({
  mode,
  stage,
  clock = null,
  focus = null,
  focusLabel = null,
  chapters = null,
  signals = null,
  transcript = null,
  actions = null,
  stackBelow = false,
}: {
  mode: SessionSidebarMode;
  stage: ReactNode;
  clock?: ReactNode;
  /** Block between the topic card and Data. Stashed text or generated questions. */
  focus?: ReactNode;
  focusLabel?: string | null;
  chapters?: ReactNode;
  signals?: ReactNode;
  transcript?: ReactNode;
  /** Bottom row. Leave and end controls go here, not in the clock. */
  actions?: ReactNode;
  /** Phone width: canvas on top, sidebar under it. Desktop stays a row. */
  stackBelow?: boolean;
}) {
  const stacked = useNarrowViewport(stackBelow);
  return (
    <div
      data-session-work-surface
      data-ile-canvas-sidebar-split
      data-session-work-stacked={stacked ? "true" : "false"}
      className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden ${stacked ? "flex-col" : "flex-row"}`}
    >
      <div
        data-ile-canvas-stage
        className={`relative z-0 min-h-0 min-w-0 overflow-hidden ${stacked ? "h-[58%] w-full flex-none" : "flex-1"}`}
      >
        <div className="absolute inset-0 flex h-full min-h-0 w-full flex-col">{stage}</div>
      </div>
      <SessionSidebar
        mode={mode}
        clock={clock}
        focus={focus}
        focusLabel={focusLabel}
        chapters={chapters}
        signals={signals}
        transcript={transcript}
        actions={actions}
        fillWidth={stacked}
      />
    </div>
  );
}
