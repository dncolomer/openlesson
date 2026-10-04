"use client";

import { useState, type ReactNode } from "react";
import {
  SESSION_SIDEBAR_FOCUS_REM,
  sessionSidebarHasSection,
  sessionSidebarRailStyle,
  type SessionSidebarMode,
} from "@/lib/session-sidebar";

const SECTION_LABEL = {
  chapters: "Chapters",
  signals: "Signals",
} as const;

function SessionResourcesSection({
  children,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const expanded = open ?? uncontrolledOpen;
  return (
    <section data-session-sidebar-section="resources" className="min-w-0 border border-neutral-800 bg-black/40">
      <button
        type="button"
        data-ile-global-resources
        aria-expanded={expanded}
        onClick={() => {
          const next = !expanded;
          if (open === undefined) setUncontrolledOpen(next);
          onOpenChange?.(next);
        }}
        className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left font-mono text-[11px] font-semibold leading-none text-neutral-200 hover:text-white"
      >
        <span>session resources</span>
        <span aria-hidden="true" className="font-mono text-[10px] text-neutral-500">
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded ? (
        <div
          data-session-sidebar-resources
          className="max-h-36 overflow-y-auto border-t border-neutral-800"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Shared right rail. The major block is a fixed-height focus slot
 * (insights, stashed text, or generated questions). Chapters and signals
 * sit under it on every mode. The column does not collapse.
 */
export function SessionSidebar({
  mode,
  clock = null,
  focus = null,
  focusLabel = null,
  chapters = null,
  signals = null,
  transcript = null,
  actions = null,
  resources = null,
  resourcesOpen,
  onResourcesOpenChange,
}: {
  mode: SessionSidebarMode;
  clock?: ReactNode;
  /** Major fixed-height block. Insights, stashed text, or generated questions. */
  focus?: ReactNode;
  focusLabel?: string | null;
  chapters?: ReactNode;
  signals?: ReactNode;
  transcript?: ReactNode;
  /** Bottom row. Learn uses it for Save. Other flows use it for End session. */
  actions?: ReactNode;
  /** Workspace files for this session. Hidden until the section is opened. */
  resources?: ReactNode;
  resourcesOpen?: boolean;
  onResourcesOpenChange?: (open: boolean) => void;
}) {
  const showClock = sessionSidebarHasSection(mode, "clock") && clock != null;
  const showFocus = sessionSidebarHasSection(mode, "focus") && focus != null;
  const showChapters = sessionSidebarHasSection(mode, "chapters") && chapters != null;
  const showSignals = sessionSidebarHasSection(mode, "signals") && signals != null;
  const focusHeight = `${SESSION_SIDEBAR_FOCUS_REM}rem`;

  return (
    <aside
      data-session-sidebar
      data-session-sidebar-mode={mode}
      style={sessionSidebarRailStyle(false)}
      className="box-border flex h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950"
    >
      {resources != null || showClock ? (
        <div className="flex shrink-0 flex-col gap-1 border-b border-neutral-800 px-1.5 py-1.5">
          {resources != null ? (
            <SessionResourcesSection open={resourcesOpen} onOpenChange={onResourcesOpenChange}>
              {resources}
            </SessionResourcesSection>
          ) : null}
          {showClock ? (
            <div data-session-sidebar-clock className="min-w-0 w-full overflow-hidden">
              {clock}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto px-1.5 py-1.5">
          {showFocus ? (
            <section
              data-session-sidebar-section="focus"
              data-session-sidebar-focus
              style={{ height: focusHeight, minHeight: focusHeight, maxHeight: focusHeight }}
              className="flex shrink-0 flex-col overflow-hidden border border-white/20 bg-black/40"
            >
              {focusLabel ? (
                <p
                  data-session-sidebar-focus-label
                  className="shrink-0 border-b border-neutral-800 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400"
                >
                  {focusLabel}
                </p>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{focus}</div>
            </section>
          ) : null}
          {showChapters ? (
            <div data-session-sidebar-section="chapters" className="min-w-0 max-w-full">
              <p className="mb-1 px-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {SECTION_LABEL.chapters}
              </p>
              {chapters}
            </div>
          ) : null}
          {showSignals ? (
            <div data-session-sidebar-section="signals" className="min-w-0 max-w-full">
              <p className="mb-1 px-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {SECTION_LABEL.signals}
              </p>
              {signals}
            </div>
          ) : null}
        </div>
        {sessionSidebarHasSection(mode, "transcript") && transcript != null ? (
          <div data-session-sidebar-section="transcript" className="shrink-0">
            {transcript}
          </div>
        ) : null}
        {actions != null ? (
          <div
            data-session-sidebar-actions
            className="shrink-0 border-t border-neutral-800 bg-black px-1.5 py-1.5"
          >
            <div className="flex w-full min-w-0 items-center gap-1">{actions}</div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
