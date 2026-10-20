"use client";

import {
  useSessionFieldReveal,
  useSessionPolicyInferences,
  useSessionPolicySuggestion,
} from "@/components/session-view/session-policy-context";
import { SessionStageProgress } from "@/components/session-view/session-stage-progress";
import { sessionHarnessFocusLine } from "@/lib/session-harness";
import type { SessionGuideId } from "@/lib/session-instructions";
import {
  sessionStageProgressLine,
  type SessionStageKind,
} from "@/lib/session-stage-progress";

const GUIDE_KIND: Record<SessionGuideId, SessionStageKind> = {
  learn: "learn",
  calibrate: "calibrate",
  verification: "verify",
};

/**
 * Third sidebar tab: the live recommendation in text. No graph.
 */
export function SessionHarnessPanel({
  guide,
  remainingSeconds = 0,
}: {
  guide: SessionGuideId;
  remainingSeconds?: number;
}) {
  const reveal = useSessionFieldReveal();
  const suggestion = useSessionPolicySuggestion();
  const inferences = useSessionPolicyInferences();
  const kind = GUIDE_KIND[guide];
  const stageLine = sessionStageProgressLine(
    kind === "calibrate"
      ? { kind, pass: reveal.pass ?? 1, passes: reveal.passes ?? 2 }
      : kind === "learn"
        ? { kind, policyLabel: "Learn" }
        : { kind, remainingSeconds },
  );
  const nextLine = sessionHarnessFocusLine({
    guide,
    suggestion,
    inferenceLabel: inferences.at(-1)?.label ?? null,
  });
  return (
    <div data-session-harness={guide} className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <div className="relative shrink-0 px-3 pt-2">
        <SessionStageProgress kind={kind} label={stageLine.label} placement="panel" />
      </div>
      <p
        data-session-harness-next=""
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 font-mono text-[13px] leading-relaxed text-white/90"
      >
        {nextLine}
      </p>
    </div>
  );
}
