"use client";

import type { SessionStageKind } from "@/lib/session-stage-progress";
import { SESSION_STAGE_INDEX } from "@/lib/session-stage-progress";

/**
 * Live stage index. Calibrate shows the pass, Learn the cheapest next
 * action, Verify the remaining time.
 */
export function SessionStageProgress({
  kind,
  label,
  placement = "overlay",
}: {
  kind: SessionStageKind;
  label: string;
  placement?: "overlay" | "panel";
}) {
  return (
    <div
      data-session-stage-progress=""
      data-session-stage-kind={kind}
      className={
        placement === "panel"
          ? "flex items-baseline gap-2"
          : "pointer-events-none absolute left-3 top-3 z-[12] flex items-baseline gap-2"
      }
    >
      <span
        aria-hidden
        className="font-mono text-[9px] tracking-[0.28em] text-white/45"
      >
        {SESSION_STAGE_INDEX}
      </span>
      <p
        data-session-stage-progress-label=""
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/80"
      >
        {label}
      </p>
    </div>
  );
}
