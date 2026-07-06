"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Target, X } from "lucide-react";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import { extractGameCoaching } from "@/lib/evidence-api-demo/game-tips";
import { matchCoachingHintToAction, type OrbitCoachTarget } from "@/lib/evidence-api-demo/orbit-coach-map";

type SmartCoachOverlayProps = {
  report: PerformanceReport | null;
  isReporting: boolean;
  dismissedStep: string | null;
  onDismiss: (stepKey: string) => void;
};

function clampScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function SmartCoachOverlay({
  report,
  isReporting,
  dismissedStep,
  onDismiss,
}: SmartCoachOverlayProps) {
  const coaching = useMemo(() => extractGameCoaching(report), [report]);
  const coachTarget = useMemo(
    () =>
      matchCoachingHintToAction([
        ...coaching.events,
        ...coaching.gapRepairs,
        ...coaching.directions,
      ]),
    [coaching]
  );

  const stepKey = coachTarget
    ? `${coachTarget.actionId}:${coaching.events[0] ?? coaching.gapRepairs[0] ?? ""}`
    : "idle";

  const [spotlight, setSpotlight] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!coachTarget || dismissedStep === stepKey) {
      setSpotlight(null);
      return;
    }

    const updateSpotlight = () => {
      const el = document.querySelector(`[data-coach="${coachTarget.coachKey}"]`);
      if (el) {
        setSpotlight(el.getBoundingClientRect());
      } else {
        setSpotlight(null);
      }
    };

    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    const timer = window.setInterval(updateSpotlight, 500);
    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
      window.clearInterval(timer);
    };
  }, [coachTarget, dismissedStep, stepKey]);

  const overallScore = clampScore(report?.overall_score);
  const showCard = isReporting || coachTarget || coaching.directions.length > 0;

  if (!showCard) return null;

  const hint =
    coaching.events[0] ??
    coaching.gapRepairs[0] ??
    coaching.directions[0] ??
    "Keep working — coaching appears after your first score card.";

  return (
    <>
      {spotlight && dismissedStep !== stepKey ? (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/55" />
          <div
            className="absolute rounded-md ring-2 ring-[#5e6ad2] ring-offset-2 ring-offset-[#0d0d0d] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{
              top: spotlight.top - 6,
              left: spotlight.left - 6,
              width: spotlight.width + 12,
              height: spotlight.height + 12,
            }}
          />
        </div>
      ) : null}

      <div className="fixed bottom-5 right-5 z-[90] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[#2f2f3a] bg-[#14141a]/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#9b9bb8]">
            {isReporting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-[#5e6ad2]" />}
            {isReporting ? "Scoring your work…" : "Smart coach"}
          </div>
          {coachTarget && dismissedStep !== stepKey ? (
            <button
              type="button"
              onClick={() => onDismiss(stepKey)}
              className="rounded p-1 text-[#6b6b80] transition hover:bg-white/5 hover:text-white"
              aria-label="Dismiss coaching step"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {overallScore !== null ? (
          <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-[#6b6b80]">
            Learn score <span className="text-white">{overallScore}</span>/100
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-relaxed text-[#d6d6e8]">{hint}</p>

        {coachTarget && dismissedStep !== stepKey ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/10 px-3 py-2 text-xs text-[#c4c9ff]">
            <Target className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Try: <strong className="font-medium text-white">{coachTarget.label}</strong>
              {!spotlight ? " (use the highlighted area when available)" : ""}
            </span>
          </div>
        ) : null}

        {coaching.directions.length > 1 ? (
          <ul className="mt-3 space-y-1 text-[11px] text-[#8b8ba3]">
            {coaching.directions.slice(1, 3).map((line) => (
              <li key={line}>◎ {line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

export type { OrbitCoachTarget };