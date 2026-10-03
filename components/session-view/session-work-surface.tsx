"use client";

import type { ReactNode } from "react";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import type { SessionSidebarMode, SessionSidebarSection } from "@/lib/session-sidebar";

/**
 * Canvas-first live surface for Prepare, Drill, conversational TAP, and
 * verification TAP. The stage is the main column. Session chrome sits in the
 * same collapsible right sidebar Learn already mounts.
 */
export function SessionWorkSurface({
  mode,
  stage,
  clock = null,
  chapters = null,
  transcript = null,
  actions = null,
  counts,
  sectionLabels,
}: {
  mode: SessionSidebarMode;
  stage: ReactNode;
  clock?: ReactNode;
  chapters?: ReactNode;
  transcript?: ReactNode;
  /** Expanded-only bottom row. Leave/end controls go here, not in the clock. */
  actions?: ReactNode;
  counts?: Partial<Record<SessionSidebarSection, number>>;
  sectionLabels?: Partial<Record<"insights" | "chapters" | "signals", string>>;
}) {
  return (
    <div
      data-session-work-surface
      data-ile-canvas-sidebar-split
      className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden"
    >
      <div data-ile-canvas-stage className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 flex h-full min-h-0 w-full flex-col">{stage}</div>
      </div>
      <SessionSidebar
        mode={mode}
        clock={clock}
        chapters={chapters}
        transcript={transcript}
        actions={actions}
        counts={counts}
        sectionLabels={sectionLabels}
      />
    </div>
  );
}
