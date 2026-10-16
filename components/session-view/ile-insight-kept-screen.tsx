"use client";

import { useState } from "react";
import { IleInsightTrophyIcon } from "@/components/session-view/ile-insight-trophies";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import type { InsightSummary } from "@/lib/insights";
import { FLOW_END_KICKERS } from "@/lib/session-stage-progress";

/** Accepted Learn insight. Leaving this screen ends the session at the workspace. */
export function IleInsightKeptScreen({
  insight,
  onBackToWorkspace,
}: {
  insight: InsightSummary;
  onBackToWorkspace: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <SessionFinishedScreen
      overlay
      data-ile-insight-kept=""
      kicker={FLOW_END_KICKERS.learn}
      title={insight.title}
      body={insight.summary ? `${insight.summary}\n\nThis takeaway stays with the chapter.` : "This takeaway stays with the chapter."}
      actions={
        <button
          type="button"
          data-ile-insight-kept-leave
          disabled={leaving}
          onClick={() => {
            if (leaving) return;
            setLeaving(true);
            onBackToWorkspace();
          }}
          className="border border-white bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-200 disabled:cursor-wait disabled:bg-neutral-200"
        >
          Back to workspace
        </button>
      }
    >
      <div className="mt-6 inline-flex size-14 items-center justify-center bg-amber-300 text-neutral-950">
        <IleInsightTrophyIcon className="size-8" />
      </div>
    </SessionFinishedScreen>
  );
}
