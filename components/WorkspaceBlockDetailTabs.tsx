"use client";

import { useState, type ReactNode } from "react";
import {
  BLOCK_DETAIL_MINI_TABS,
  resolveExclusiveBlockDetailDrawer,
  type BlockDetailMiniTab,
} from "@/lib/workspace-right-pane";
import { deriveBlockExampleTopics } from "@/lib/block-example-topics";
import type {
  BlockLocalContextInput,
  PromptBlockInventoryItem,
  WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

const DRAWER_LABELS: Record<BlockDetailMiniTab, string> = {
  local: "Local context",
  examples: "Simulation",
  content_samples: "Simulation",
  simulation: "Simulation",
};

/**
 * Photoshop-style exclusive drawers under block launch:
 * Local context + Simulation (Prompt tab removed). One body open at a time.
 * @deprecated Prefer WorkspaceBlockDetailPane peer drawers.
 */
export function WorkspaceBlockDetailTabs({
  blockTitle,
  blockDescription,
  planningPrompt,
  localContext,
  localContextPanel,
}: {
  canEdit: boolean;
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  planningPrompt?: string | null;
  localContext?: BlockLocalContextInput | null;
  /** Pre-rendered local context authoring/readonly panel (flat, no outer card stack). */
  localContextPanel: ReactNode;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  workspaceFiles?: WorkspaceFileContextItem[] | null;
  blocks?: PromptBlockInventoryItem[] | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
}) {
  const [openDrawer, setOpenDrawer] = useState<BlockDetailMiniTab>("local");
  const examples = deriveBlockExampleTopics({
    title: blockTitle,
    description: blockDescription,
    planningPrompt,
    localNotes: localContext?.notes ?? null,
  });

  return (
    <div
      data-block-detail-drawers
      data-block-detail-mini-tabs
      data-active-drawer={openDrawer}
      data-active-tab={openDrawer}
      className="flex min-h-0 flex-col border-t border-neutral-800/80"
    >
      {BLOCK_DETAIL_MINI_TABS.map((id) => {
        const open = openDrawer === id;
        return (
          <div
            key={id}
            data-block-detail-drawer={id}
            data-drawer-open={open ? "true" : "false"}
            className="border-b border-neutral-800/70 last:border-b-0"
          >
            <button
              type="button"
              data-block-detail-tab={id}
              data-block-detail-drawer-header={id}
              aria-expanded={open}
              onClick={() =>
                setOpenDrawer((cur) => resolveExclusiveBlockDetailDrawer(cur, id))
              }
              className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition ${
                open
                  ? "bg-neutral-900/80 text-white"
                  : "bg-transparent text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-200"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.12em]">
                {DRAWER_LABELS[id]}
              </span>
              <span
                className={`text-[10px] text-neutral-500 transition ${open ? "rotate-90" : ""}`}
                aria-hidden
              >
                ›
              </span>
            </button>

            {open ? (
              <div
                role="region"
                aria-label={DRAWER_LABELS[id]}
                data-block-detail-tab-panel={id}
                data-block-detail-drawer-body={id}
                className="border-t border-neutral-800/50 px-2.5 py-2.5"
              >
                {id === "local" ? (
                  <div data-block-detail-tab-content="local">{localContextPanel}</div>
                ) : null}

                {id === "examples" || id === "content_samples" || id === "simulation" ? (
                  <div
                    data-block-detail-tab-content="simulation"
                    className="space-y-3"
                  >
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                        Topics this block explores
                      </p>
                      {examples.topics.length > 0 ? (
                        <ul
                          className="mt-1.5 flex flex-wrap gap-1"
                          data-block-example-topics
                        >
                          {examples.topics.map((topic) => (
                            <li
                              key={topic}
                              className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-neutral-300"
                            >
                              {topic}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-neutral-600">
                          No topics derived yet.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                        Sample questions
                      </p>
                      {examples.questions.length > 0 ? (
                        <ul
                          className="mt-1.5 space-y-1"
                          data-block-example-questions
                        >
                          {examples.questions.map((q) => (
                            <li
                              key={q}
                              className="flex gap-1.5 text-[11px] leading-snug text-neutral-400"
                            >
                              <span
                                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/25"
                                aria-hidden
                              />
                              <span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-neutral-600">
                          No sample questions yet.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
