"use client";

import { Lightbulb } from "lucide-react";
import { DialogFrame } from "@/components/ui/DialogFrame";
import { insightPublicPath, type InsightSummary } from "@/lib/insights";

export function IleSessionInsightsPanel({
  open,
  onClose,
  insights,
}: {
  open: boolean;
  onClose: () => void;
  insights: InsightSummary[];
}) {
  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      size="lg"
      testId="ile-session-insights-panel"
      labelledBy="ile-session-insights-title"
      panelClassName="flex max-h-[min(80vh,36rem)] flex-col"
    >
      <div data-ile-session-insights-panel className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              This session
            </p>
            <h2
              id="ile-session-insights-title"
              className="mt-0.5 flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-wide text-white"
            >
              <Lightbulb className="size-3.5" strokeWidth={2.3} aria-hidden />
              Crafted insights
            </h2>
          </div>
          <button
            type="button"
            data-ile-session-insights-close
            onClick={onClose}
            className="px-1.5 py-0.5 text-xs text-neutral-500 hover:text-neutral-200"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {insights.length === 0 ? (
            <p className="px-4 py-8 text-sm text-neutral-500">
              No insights crafted in this session yet.
            </p>
          ) : (
            <ul className="flex flex-col">
              {insights.map((insight) => (
                <li
                  key={insight.id}
                  data-ile-session-insight={insight.id}
                  className="border-b border-neutral-800 px-4 py-3"
                >
                  <p className="font-mono text-[12px] font-semibold uppercase tracking-wide text-white">
                    {insight.title}
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">{insight.summary}</p>
                  <a
                    href={insightPublicPath(insight)}
                    className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-neutral-300 underline"
                  >
                    Open insight
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}
