"use client";

import { useState, type ReactNode } from "react";
import {
  sessionSidebarHasSection,
  sessionSidebarRailStyle,
  sessionSidebarSections,
  type SessionSidebarMode,
  type SessionSidebarSection,
} from "@/lib/session-sidebar";

const SCROLL_SECTIONS = ["insights", "chapters", "signals"] as const satisfies readonly SessionSidebarSection[];

const SECTION_LABELS: Record<(typeof SCROLL_SECTIONS)[number], string> = {
  insights: "Insights",
  chapters: "Chapters",
  signals: "Signals",
};

export function SessionSidebar({
  mode,
  clock = null,
  insights = null,
  chapters = null,
  signals = null,
  transcript = null,
  actions = null,
  counts = {},
  sectionLabels,
  onOpenGlobalResources,
  globalResourcesOpen = false,
  defaultCollapsed = false,
}: {
  mode: SessionSidebarMode;
  clock?: ReactNode;
  insights?: ReactNode;
  chapters?: ReactNode;
  signals?: ReactNode;
  transcript?: ReactNode;
  /** Bottom row. Rendered only while the rail is expanded, same slot as Learn's Save. */
  actions?: ReactNode;
  /** Shown on the collapsed rail in place of the section body. */
  counts?: Partial<Record<SessionSidebarSection, number>>;
  /** Replaces the collapsed-rail label for a scroll section. */
  sectionLabels?: Partial<Record<(typeof SCROLL_SECTIONS)[number], string>>;
  onOpenGlobalResources?: () => void;
  globalResourcesOpen?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const sections = sessionSidebarSections(mode);
  const showClock = sessionSidebarHasSection(mode, "clock") && clock != null;
  const slots: Record<(typeof SCROLL_SECTIONS)[number], ReactNode> = {
    insights,
    chapters,
    signals,
  };

  return (
    <aside
      data-session-sidebar
      data-session-sidebar-mode={mode}
      data-session-sidebar-collapsed={collapsed ? "true" : "false"}
      style={sessionSidebarRailStyle(collapsed)}
      className="box-border flex h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950"
    >
      <div className="flex shrink-0 flex-col gap-1 border-b border-neutral-800 px-1.5 py-1.5">
        <button
          type="button"
          data-session-sidebar-toggle
          aria-expanded={collapsed ? "false" : "true"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
          className="pointer-events-auto w-full rounded-none border border-neutral-600 bg-neutral-900 px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-100 hover:border-white hover:text-white"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
        {onOpenGlobalResources ? (
          <button
            type="button"
            data-ile-global-resources
            aria-pressed={globalResourcesOpen}
            onClick={onOpenGlobalResources}
            className="pointer-events-auto w-full rounded-none border border-neutral-600 bg-neutral-900 px-2 py-2.5 text-center font-mono text-sm font-semibold leading-snug text-neutral-100 hover:border-white hover:text-white aria-pressed:border-white aria-pressed:bg-white aria-pressed:text-neutral-950"
          >
            session resources
          </button>
        ) : null}
        {showClock ? (
          <div data-session-sidebar-clock className="min-w-0 w-full overflow-hidden">
            {clock}
          </div>
        ) : null}
      </div>
      {collapsed ? (
        <ul
          data-session-sidebar-counts
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-1.5 py-2"
        >
          {SCROLL_SECTIONS.map((section) => {
            if (!sections.includes(section)) return null;
            const count = counts[section];
            if (typeof count !== "number" || !Number.isFinite(count)) return null;
            const shown = Math.max(0, Math.floor(count));
            return (
              <li
                key={section}
                data-session-sidebar-count={section}
                className="flex flex-col items-center gap-0.5 border border-neutral-800 bg-neutral-900 px-1 py-1.5"
              >
                <span className="max-w-full truncate font-mono text-[9px] font-semibold uppercase tracking-wider text-neutral-400">
                  {sectionLabels?.[section] ?? SECTION_LABELS[section]}
                </span>
                <span
                  data-session-sidebar-count-value={shown}
                  className="font-mono text-lg font-semibold tabular-nums text-neutral-100"
                >
                  {shown}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto px-1.5 py-1.5">
            {SCROLL_SECTIONS.map((section) => {
              if (!sections.includes(section)) return null;
              const content = slots[section];
              if (content == null) return null;
              return (
                <div
                  key={section}
                  data-session-sidebar-section={section}
                  className="min-w-0 max-w-full"
                >
                  {content}
                </div>
              );
            })}
          </div>
          {sections.includes("transcript") && transcript != null ? (
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
      )}
    </aside>
  );
}
