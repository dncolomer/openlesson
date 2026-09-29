"use client";

import { useEffect, useState } from "react";
import { insightApiErrorMessage } from "@/lib/insights";
import {
  WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY,
  WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL,
  workspaceKpiTimeToInsightReadout,
  type TimeToInsightInsightRecord,
  type TimeToInsightSessionRecord,
  type WorkspaceKpiTimeToInsightReadout,
} from "@/lib/workspace-time-to-insight";

type TimeToInsightPayload = {
  viewerId?: string;
  sessions?: TimeToInsightSessionRecord[];
  insights?: TimeToInsightInsightRecord[];
};

/**
 * Signed-in viewer's time-to-insight average for the open workspace.
 * The number is `workspaceKpiTimeToInsightReadout` — no other metrics.
 */
export function WorkspaceKpisPanel({ workspaceId }: { workspaceId: string }) {
  const [readout, setReadout] = useState<WorkspaceKpiTimeToInsightReadout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReadout(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/workspace/time-to-insight?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await res.json()) as TimeToInsightPayload;
        if (!res.ok) {
          throw new Error(insightApiErrorMessage(data, "Failed to load time-to-insight"));
        }
        if (cancelled) return;
        setReadout(
          workspaceKpiTimeToInsightReadout({
            sessions: Array.isArray(data.sessions) ? data.sessions : [],
            insights: Array.isArray(data.insights) ? data.insights : [],
            viewerId: typeof data.viewerId === "string" ? data.viewerId : "",
            workspaceId,
          }),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load time-to-insight");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const valueText = readout?.valueText ?? null;
  const showEmpty = !loading && !error && valueText === WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY;
  const showValue =
    !loading && !error && valueText != null && valueText !== WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY;

  return (
    <div
      data-workspace-kpis-panel
      className="flex h-full min-h-0 flex-col overflow-y-auto p-6 sm:p-8"
    >
      <p
        data-kpi-metric-label
        className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400"
      >
        {WORKSPACE_KPI_TIME_TO_INSIGHT_LABEL}
      </p>
      {loading ? (
        <p data-kpi-time-to-insight-loading className="mt-3 text-sm text-neutral-400">
          Loading
        </p>
      ) : null}
      {error ? (
        <p data-kpi-time-to-insight-error className="mt-3 text-sm text-neutral-300">
          {error}
        </p>
      ) : null}
      {showValue ? (
        <p
          data-kpi-time-to-insight-value
          className="mt-3 text-4xl font-medium tracking-tight text-white"
        >
          {valueText}
        </p>
      ) : null}
      {showEmpty ? (
        <p data-kpi-time-to-insight-empty className="mt-3 text-sm text-neutral-300">
          {WORKSPACE_KPI_TIME_TO_INSIGHT_EMPTY}
        </p>
      ) : null}
    </div>
  );
}
