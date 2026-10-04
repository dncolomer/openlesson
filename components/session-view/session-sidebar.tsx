"use client";

import { useState, type ReactNode } from "react";
import {
  SESSION_DATA_CARD_REM,
  sessionSidebarHasSection,
  sessionSidebarRailStyle,
  type SessionSidebarMode,
} from "@/lib/session-sidebar";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { SessionTopicCardTimerProvider } from "@/components/session-view/ile-work-dock-bar";

const SECTION_LABEL = {
  signals: "Data",
} as const;

const FOCUS_TAB_CLASS =
  "min-w-0 flex-1 rounded-none px-2 py-1 text-left font-mono font-semibold uppercase tracking-[0.18em]";

const RAIL_GRID = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
} as const;

/**
 * Shared right rail. The first block is one static topic card.
 * The focus slot fills whatever height is left under that card and above Data.
 * Session resources, when present, is the second tab of that slot.
 * Sections stack flush. The rail itself does not scroll. It does not collapse.
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
  /** Block between the topic card and Data. Insights, stashed text, or generated questions. */
  focus?: ReactNode;
  focusLabel?: string | null;
  chapters?: ReactNode;
  signals?: ReactNode;
  transcript?: ReactNode;
  /** Bottom row. Learn uses it for Exit. Other flows use it for End session. */
  actions?: ReactNode;
  /** Workspace files for this session. The second tab of the focus block. */
  resources?: ReactNode;
  resourcesOpen?: boolean;
  onResourcesOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledResources, setUncontrolledResources] = useState(false);
  const resourcesOpenNow = resourcesOpen ?? uncontrolledResources;
  const selectResources = (next: boolean) => {
    if (resourcesOpen === undefined) setUncontrolledResources(next);
    onResourcesOpenChange?.(next);
  };
  const showClock = sessionSidebarHasSection(mode, "clock") && clock != null;
  const showFocus = sessionSidebarHasSection(mode, "focus") && focus != null;
  const showTopic = sessionSidebarHasSection(mode, "chapters") && chapters != null;
  const showSignals = sessionSidebarHasSection(mode, "signals") && signals != null;
  const showTranscript = sessionSidebarHasSection(mode, "transcript") && transcript != null;
  const resourcesInFocus = showFocus && resources != null;
  const dataCardHeight = `${SESSION_DATA_CARD_REM}rem`;

  return (
    <aside
      data-session-sidebar
      data-session-sidebar-mode={mode}
      style={{ ...sessionSidebarRailStyle(false), ...RAIL_GRID }}
      className="relative box-border flex h-full min-h-0 flex-col overflow-hidden border-l border-white/40 bg-black"
    >
      {showTopic ? (
        <SessionTopicCardTimerProvider
          timer={
            showClock ? (
              <div
                data-session-sidebar-clock
                data-session-topic-card-timer
                className="pointer-events-none max-w-full [&>div]:px-0 [&>div]:py-0"
              >
                {clock}
              </div>
            ) : null
          }
        >
          <div data-session-sidebar-section="topic" className="relative shrink-0">
            {chapters}
          </div>
        </SessionTopicCardTimerProvider>
      ) : null}
      {resources != null && !resourcesInFocus ? (
        <div className="shrink-0 border-b border-white/30 bg-black">
          <button
            type="button"
            data-ile-global-resources
            data-session-sidebar-section="resources"
            aria-expanded={resourcesOpenNow}
            onClick={() => selectResources(!resourcesOpenNow)}
            className="flex w-full items-center justify-between gap-2 rounded-none px-2 py-1 text-left font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.18em] text-white/80 hover:bg-white hover:text-black"
          >
            <span>session resources</span>
          </button>
          {resourcesOpenNow ? (
            <div data-session-sidebar-resources className="overflow-y-auto border-t border-white/25">
              {resources}
            </div>
          ) : null}
        </div>
      ) : null}
      {showFocus ? (
            <section
              data-session-sidebar-section="focus"
              data-session-sidebar-focus
              className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-b border-white/40 bg-black"
            >
              <SessionConsoleScan />
              <SessionConsoleMarks />
              {resourcesInFocus ? (
                <div role="tablist" className="relative z-[2] flex shrink-0 border-b border-white/30 bg-black">
                  <span aria-hidden className="flex items-center pl-3 pr-1 font-mono text-[9px] tracking-[0.28em] text-white/45">
                    02
                  </span>
                  <button
                    type="button"
                    role="tab"
                    data-session-sidebar-focus-label
                    data-session-sidebar-focus-tab="main"
                    aria-selected={!resourcesOpenNow}
                    onClick={() => selectResources(false)}
                    className={`${FOCUS_TAB_CLASS} text-[10px] ${
                      resourcesOpenNow ? "text-white/40 hover:text-white" : "bg-white text-black"
                    }`}
                  >
                    {focusLabel}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    data-ile-global-resources
                    data-session-sidebar-section="resources"
                    data-session-sidebar-focus-tab="resources"
                    aria-expanded={resourcesOpenNow}
                    aria-selected={resourcesOpenNow}
                    onClick={() => selectResources(!resourcesOpenNow)}
                    className={`${FOCUS_TAB_CLASS} text-[11px] ${
                      resourcesOpenNow ? "bg-white text-black" : "text-white/40 hover:text-white"
                    }`}
                  >
                    session resources
                  </button>
                </div>
              ) : focusLabel ? (
                <div className="relative z-[2] flex shrink-0 items-center gap-2 border-b border-white/30 bg-black px-2 py-1 pl-3">
                  <span aria-hidden className="font-mono text-[9px] tracking-[0.28em] text-white/45">
                    02
                  </span>
                  <p
                    data-session-sidebar-focus-label
                    className="min-w-0 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white"
                  >
                    {focusLabel}
                  </p>
                  <span aria-hidden className="ml-auto font-mono text-[8px] tracking-[0.35em] text-white/35">
                    ////
                  </span>
                </div>
              ) : null}
              {resourcesInFocus && resourcesOpenNow ? (
                <div data-session-sidebar-resources className="relative z-[2] min-h-0 flex-1 overflow-y-auto">
                  {resources}
                </div>
              ) : (
                <div className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-hidden">{focus}</div>
              )}
            </section>
      ) : null}
        {showSignals ? (
          <div data-session-sidebar-section="signals" className="shrink-0 bg-black">
            <div className="flex items-center gap-2 border-b border-white/30 px-2 py-1 pl-3">
              <span aria-hidden className="font-mono text-[9px] tracking-[0.28em] text-white/45">
                03
              </span>
              <p
                data-session-sidebar-signals-label
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white"
              >
                {SECTION_LABEL.signals}
              </p>
              <span aria-hidden className="ml-auto font-mono text-[8px] tracking-[0.35em] text-white/35">
                ////
              </span>
            </div>
            <div
              data-session-sidebar-signals-frame
              style={{ height: dataCardHeight, minHeight: dataCardHeight }}
              className="relative w-full min-w-0 overflow-hidden border border-white/25 bg-black"
            >
              {signals}
              {showTranscript ? (
                <div
                  data-session-sidebar-section="transcript"
                  className="pointer-events-auto absolute inset-x-0 bottom-0 z-20"
                >
                  {transcript}
                </div>
              ) : null}
            </div>
          </div>
        ) : showTranscript ? (
          <div data-session-sidebar-section="transcript" className="shrink-0">
            {transcript}
          </div>
        ) : null}
        {actions != null ? (
          <div
            data-session-sidebar-actions
            className="shrink-0 bg-black px-1.5 py-1.5"
          >
            <div className="flex w-full min-w-0 items-center gap-1">{actions}</div>
          </div>
        ) : null}
    </aside>
  );
}
