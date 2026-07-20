"use client";

import { Gauge, Loader2, Sparkles, Target } from "lucide-react";
import type { WorkspaceGoalSource } from "@/lib/agent-v2/conversion-goal";
import type { PerformanceReport } from "@/lib/agent-v2/performance-context";
import { normalizeDemoSessionUrl } from "@/lib/product-demos/demo-session-url";
import { extractGameCoaching } from "@/lib/product-demos/game-tips";
import { useMemo } from "react";

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function DemoPerformanceHud({
  report,
  isReporting,
  workspaceGoal,
  workspaceGoalSource,
  showTapValidation = false,
  tapValidationHint,
  tapLinkUrl = null,
  isCreatingTapLink = false,
  onOpenTapValidation,
}: {
  report: PerformanceReport | null;
  isReporting: boolean;
  workspaceGoal?: string;
  workspaceGoalSource?: WorkspaceGoalSource;
  showTapValidation?: boolean;
  tapValidationHint?: string;
  tapLinkUrl?: string | null;
  isCreatingTapLink?: boolean;
  onOpenTapValidation?: () => void;
}) {
  const coaching = useMemo(() => extractGameCoaching(report), [report]);
  const primaryScore = clampScore(report?.score);
  const verticalLabel =
    report?.vertical === "augmentation"
      ? "Augment"
      : report?.vertical === "optimization"
        ? "Optimize"
        : "Verify";
  const goalText = workspaceGoal?.trim() || report?.workspace_goal?.trim() || null;
  const hasCoaching =
    coaching.directions.length > 0 || coaching.events.length > 0 || coaching.gapRepairs.length > 0;
  const hasScores = primaryScore !== null || goalText !== null;

  const directionPreview = coaching.directions.slice(0, 2);
  const eventPreview = coaching.events.slice(0, 2);

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-zinc-800 bg-zinc-950/95 lg:w-52 lg:border-l lg:border-t-0">
      {hasScores ? (
        <div className="shrink-0 border-b border-violet-500/20 px-3 py-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[1.5px] text-violet-300">
            <Gauge className="size-3" />
            Score
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {primaryScore !== null ? (
              <div>
                <div className="font-mono text-[9px] uppercase text-zinc-500">{verticalLabel}</div>
                <div className="font-mono text-lg text-white">
                  {primaryScore}
                  <span className="text-xs text-zinc-500">/100</span>
                </div>
              </div>
            ) : null}
          </div>
          {goalText ? (
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-zinc-400">
              {workspaceGoalSource === "workspace" ? "◎ " : "◇ "}
              {goalText}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-violet-200">
          {isReporting ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          {isReporting ? "Scoring…" : "Coaching"}
        </div>
        {hasCoaching ? (
          <div className="mt-2 space-y-2">
            {directionPreview.length > 0 ? (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-zinc-600">Goals</div>
                <ul className="mt-1 space-y-1">
                  {directionPreview.map((line, index) => (
                    <li key={`d-${index}`} className="line-clamp-2 text-[10px] leading-snug text-zinc-300">
                      ◎ {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {eventPreview.length > 0 ? (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-zinc-600">Next</div>
                <ul className="mt-1 space-y-1">
                  {eventPreview.map((line, index) => (
                    <li key={`e-${index}`} className="flex gap-1 text-[10px] leading-snug text-zinc-300">
                      <Target className="mt-0.5 size-2.5 shrink-0 text-violet-400" />
                      <span className="line-clamp-2">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-zinc-600">
            {isReporting ? "Reading your work…" : "Coaching appears after score cards."}
          </p>
        )}

        {showTapValidation && report ? (
          <div className="mt-3 border-t border-violet-500/20 pt-2.5">
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-violet-300">TAP validation</div>
            <p className="mt-1.5 text-[10px] leading-snug text-zinc-400">
              {tapValidationHint ||
                "Open a Think Aloud session to validate that you can explain the workbook numbers yourself."}
            </p>
            {tapLinkUrl && !isCreatingTapLink ? (
              <a
                href={normalizeDemoSessionUrl(tapLinkUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center rounded-md border border-violet-500/35 bg-violet-950/30 px-2 py-1.5 text-[10px] font-medium text-violet-100 transition hover:border-violet-400"
              >
                Open TAP session ↗
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onOpenTapValidation?.()}
                disabled={isCreatingTapLink || !onOpenTapValidation}
                className="mt-2 w-full rounded-md border border-violet-500/35 bg-violet-950/30 px-2 py-1.5 text-[10px] font-medium text-violet-100 transition hover:border-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingTapLink ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" />
                    Creating link…
                  </span>
                ) : (
                  "Start TAP validation ↗"
                )}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}