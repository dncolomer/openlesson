"use client";

import { SessionBranchFieldMap } from "@/components/session-view/session-branch-field-map";
import {
  useSessionBranchSlot,
  useSessionFieldReveal,
  useSessionPolicyInferences,
  useSessionPolicySuggestion,
} from "@/components/session-view/session-policy-context";
import { SessionStageProgress } from "@/components/session-view/session-stage-progress";
import { SESSION_HARNESS_FALLBACK, sessionHarnessNextLine } from "@/lib/session-harness";
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
 * Third sidebar tab: the generative-model field and the next thing to do,
 * written from the learner's work rather than an action name.
 */
export function SessionHarnessPanel({
  guide,
  remainingSeconds = 0,
}: {
  guide: SessionGuideId;
  remainingSeconds?: number;
}) {
  const slot = useSessionBranchSlot();
  const reveal = useSessionFieldReveal();
  const suggestion = useSessionPolicySuggestion();
  const inferences = useSessionPolicyInferences();
  const model = slot?.model ?? null;
  const kind = GUIDE_KIND[guide];
  const stageLine = sessionStageProgressLine(
    kind === "calibrate"
      ? { kind, pass: reveal.pass ?? 1, passes: reveal.passes ?? 2 }
      : kind === "learn"
        ? { kind, policyLabel: "Learn" }
        : { kind, remainingSeconds },
  );
  const nextLine = sessionHarnessNextLine({
    suggestion,
    inferenceLabel: inferences.at(-1)?.label ?? null,
    fallback: SESSION_HARNESS_FALLBACK[guide],
  });
  return (
    <div data-session-harness={guide} className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <div className="relative shrink-0 px-3 pt-2">
        <SessionStageProgress kind={kind} label={stageLine.label} placement="panel" />
      </div>
      <p
        data-session-harness-next=""
        className="shrink-0 px-3 pb-2 pt-1 font-mono text-[12px] leading-snug text-white/85"
      >
        {nextLine}
      </p>
      <div className="relative min-h-0 flex-1">
        {model ? (
          <SessionBranchFieldMap
            model={model}
            variant="panel"
            revealedIds={reveal.revealedIds}
            currentIds={reveal.currentIds}
          />
        ) : (
          <p className="px-3 font-mono text-[11px] leading-snug text-white/45">
            The field is still opening.
          </p>
        )}
      </div>
    </div>
  );
}
