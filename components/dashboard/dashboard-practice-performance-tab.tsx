"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SOLVE_PERFORMANCE_PATH,
  formatSolvePerformanceDuration,
  solvePerformanceInsightsForSession,
  solveSessionHref,
  type SolvePerformanceInsight,
  type SolvePerformanceRow,
  type SolvePerformanceSummary,
} from "@/lib/solve-performance";

const EMPTY_SUMMARY: SolvePerformanceSummary = {
  sessionCount: 0,
  insightCount: 0,
  durationMs: 0,
  flowCount: 0,
};

function formatWhen(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DashboardPracticePerformanceTab() {
  const [rows, setRows] = useState<SolvePerformanceRow[]>([]);
  const [insights, setInsights] = useState<SolvePerformanceInsight[]>([]);
  const [summary, setSummary] = useState<SolvePerformanceSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/solve/performance" satisfies typeof SOLVE_PERFORMANCE_PATH)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
        const nextInsights = Array.isArray(payload?.insights) ? payload.insights : [];
        setRows(nextRows);
        setInsights(nextInsights);
        if (payload?.summary) setSummary(payload.summary);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setInsights([]);
          setSummary(EMPTY_SUMMARY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleInsights = useMemo(
    () => solvePerformanceInsightsForSession(insights, selectedSessionId),
    [insights, selectedSessionId],
  );

  const selectedInsight = useMemo(() => {
    if (visibleInsights.length === 0) return null;
    return (
      visibleInsights.find((row) => row.id === selectedInsightId) ?? visibleInsights[0]
    );
  }, [selectedInsightId, visibleInsights]);

  const selectedIndex = selectedInsight
    ? visibleInsights.findIndex((row) => row.id === selectedInsight.id)
    : -1;

  function selectSession(sessionId: string | null) {
    setSelectedSessionId(sessionId);
    const next = solvePerformanceInsightsForSession(insights, sessionId);
    setSelectedInsightId(next[0]?.id ?? null);
  }

  function stepInsight(delta: number) {
    if (visibleInsights.length === 0 || selectedIndex < 0) return;
    const next =
      (selectedIndex + delta + visibleInsights.length) % visibleInsights.length;
    setSelectedInsightId(visibleInsights[next].id);
  }

  return (
    <div className="flex flex-col gap-4" data-dashboard-practice-performance>
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Solve / Practice
        </p>
        <h2 className="mt-1 text-2xl font-medium tracking-[-0.6px] text-white">
          Performance
        </h2>
      </header>

      <section
        className="console-copy grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4"
        data-dashboard-practice-performance-summary
      >
        <SummaryStat label="Sessions" value={loading ? "—" : String(summary.sessionCount)} />
        <SummaryStat label="Flows" value={loading ? "—" : String(summary.flowCount)} />
        <SummaryStat label="Insights" value={loading ? "—" : String(summary.insightCount)} />
        <SummaryStat
          label="Time"
          value={loading ? "—" : formatSolvePerformanceDuration(summary.durationMs)}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <section
          className="console-copy min-h-[22rem] px-4 py-4"
          data-dashboard-practice-history
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              Sessions
            </p>
            <button
              type="button"
              onClick={() => selectSession(null)}
              className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                selectedSessionId
                  ? "text-neutral-500 hover:text-white"
                  : "text-white"
              }`}
            >
              All
            </button>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-neutral-400">Loading history…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No Solve runs yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rows.map((row) => {
                const active = selectedSessionId === row.sessionId;
                return (
                  <li key={row.sessionId}>
                    <button
                      type="button"
                      data-dashboard-practice-history-row={row.sessionId}
                      onClick={() => selectSession(row.sessionId)}
                      className={`flex w-full flex-col gap-1 border px-3 py-2 text-left transition ${
                        active
                          ? "border-white/70 bg-white/10 text-white"
                          : "border-white/15 text-neutral-200 hover:border-white/50"
                      }`}
                    >
                      <span className="truncate text-sm">{row.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                        {row.insightCount} insights · {formatSolvePerformanceDuration(row.durationMs)}{" "}
                        · {row.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="console-copy flex min-h-[22rem] flex-col px-4 py-4"
          data-dashboard-practice-insights
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              Insights
            </p>
            {visibleInsights.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-dashboard-practice-insight-prev
                  onClick={() => stepInsight(-1)}
                  className="console-button px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-300 hover:text-white"
                >
                  Prev
                </button>
                <span className="font-mono text-[10px] text-neutral-500">
                  {selectedIndex + 1} / {visibleInsights.length}
                </span>
                <button
                  type="button"
                  data-dashboard-practice-insight-next
                  onClick={() => stepInsight(1)}
                  className="console-button px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-300 hover:text-white"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-neutral-400">Loading insights…</p>
          ) : visibleInsights.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              No insights yet for this selection.
            </p>
          ) : (
            <>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {visibleInsights.map((insight) => {
                  const active = selectedInsight?.id === insight.id;
                  return (
                    <button
                      key={insight.id}
                      type="button"
                      data-dashboard-practice-insight={insight.id}
                      onClick={() => setSelectedInsightId(insight.id)}
                      className={`shrink-0 border px-3 py-2 text-left text-xs transition ${
                        active
                          ? "border-white/70 bg-white/10 text-white"
                          : "border-white/15 text-neutral-400 hover:border-white/50 hover:text-white"
                      }`}
                    >
                      <span className="block max-w-[12rem] truncate">{insight.title}</span>
                    </button>
                  );
                })}
              </div>

              {selectedInsight ? (
                <article
                  className="mt-4 min-h-0 flex-1 overflow-y-auto"
                  data-dashboard-practice-insight-detail={selectedInsight.id}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                    {selectedInsight.flowTitle}
                    {selectedInsight.sessionElapsedMs != null
                      ? ` · ${formatSolvePerformanceDuration(selectedInsight.sessionElapsedMs)}`
                      : ""}
                    {selectedInsight.createdAt ? ` · ${formatWhen(selectedInsight.createdAt)}` : ""}
                  </p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.4px] text-white">
                    {selectedInsight.title}
                  </h3>
                  {selectedInsight.summary ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                      {selectedInsight.summary}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-500">No summary stored.</p>
                  )}
                  <Link
                    href={solveSessionHref(selectedInsight.sessionId)}
                    className="mt-4 inline-flex h-9 items-center border border-white/40 px-3 text-xs text-white transition hover:border-white/80"
                  >
                    Open session
                  </Link>
                </article>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-lg text-white">{value}</p>
    </div>
  );
}
