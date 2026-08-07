"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  formatProofOfWorkBytes,
  type WorkspaceProofOfWorkStats,
} from "@/lib/pow-api/proof-of-work-stats";

interface ProofOfWorkStatsPanelProps {
  workspaceId: string;
  currentUserId?: string | null;
  ayclToken?: string;
}

function formatRelative(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const delta = Math.max(0, nowMs - t);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString();
}

const selectClass =
  "w-full min-w-[11rem] rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-500";

function StatsRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <tr className="border-t border-neutral-800/80" data-pow-stats-row>
      <th
        scope="row"
        className="px-3 py-2 text-left text-[11px] font-medium text-neutral-400"
      >
        <span className="block">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[10px] font-normal leading-snug text-neutral-600">
            {hint}
          </span>
        ) : null}
      </th>
      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-neutral-100">
        {value}
      </td>
    </tr>
  );
}

export function ProofOfWorkStatsPanel({
  workspaceId,
  currentUserId = null,
  ayclToken,
}: ProofOfWorkStatsPanelProps) {
  const { t } = useI18n();
  const [stats, setStats] = useState<WorkspaceProofOfWorkStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  /** User/subject filter only — quality is not filtered on this panel. */
  const [subjectKey, setSubjectKey] = useState<string>("all");

  const load = useCallback(async () => {
    if (!currentUserId && !ayclToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace/proof-of-work-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          subjectKey,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("planView.powStatsLoadError"));
      setStats(json.stats as WorkspaceProofOfWorkStats);
      setNowMs(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("planView.powStatsLoadError"));
    } finally {
      setLoading(false);
    }
  }, [ayclToken, currentUserId, subjectKey, t, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentUserId && !ayclToken) {
    return (
      <section className="flex min-h-0 flex-1 flex-col">
        <p className="text-xs text-neutral-600">{t("planView.powStatsSignIn")}</p>
      </section>
    );
  }

  const subjects = stats?.subjects ?? [];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-pow-stats-panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-white">{t("planView.powStatsTitle")}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
            {t("planView.powStatsHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-neutral-500 disabled:opacity-40"
        >
          {loading ? t("planView.powStatsRefreshing") : t("planView.powStatsRefresh")}
        </button>
      </div>

      <div
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-3"
        data-pow-stats-filters
      >
        <label className="flex min-w-[11rem] flex-1 flex-col gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
          {t("planView.powStatsFilterUser")}
          <select
            className={selectClass}
            value={subjectKey}
            data-pow-subject-filter
            onChange={(event) => setSubjectKey(event.target.value)}
          >
            <option value="all">{t("planView.powStatsFilterUserAll")}</option>
            {currentUserId ? (
              <option value="me">{t("planView.powStatsFilterUserMe")}</option>
            ) : null}
            {subjects.map((subject) => (
              <option key={subject.key} value={subject.key}>
                {subject.label} ({subject.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !stats ? (
        <div className="mt-2">
          <LoadingStatusMessage tone="subtle" message={t("planView.powStatsLoading")} />
        </div>
      ) : null}

      {stats && stats.total_artifacts === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 px-4 py-10 text-center">
          <p className="text-sm text-neutral-400">{t("planView.powStatsEmpty")}</p>
          <p className="mt-2 text-xs text-neutral-600">{t("planView.powStatsEmptyHint")}</p>
        </div>
      ) : null}

      {stats && stats.total_artifacts > 0 ? (
        <>
          {stats.sample_capped ? (
            <p className="text-[11px] text-neutral-200/90">
              {t("planView.powStatsSampleCapped", {
                sampled: stats.sampled_artifacts,
                total: stats.total_artifacts,
              })}
            </p>
          ) : null}

          <div
            className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/50"
            data-pow-stats-table-wrap
          >
            <table className="w-full border-collapse text-sm" data-pow-stats-table>
              <caption className="sr-only">{t("planView.powStatsTitle")}</caption>
              <thead>
                <tr className="bg-neutral-900/60">
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    Metric
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                  >
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                <StatsRow label={t("planView.powStatsTotal")} value={stats.total_artifacts} />
                <StatsRow
                  label={t("planView.powStatsScored")}
                  value={stats.scored_artifacts}
                  hint={t("planView.powStatsScoredHint")}
                />
                <StatsRow
                  label={t("planView.powStatsPractice")}
                  value={stats.practice_artifacts}
                  hint={t("planView.powStatsPracticeHint")}
                />
                <StatsRow
                  label={t("planView.powStatsImpure")}
                  value={stats.impure_artifacts}
                  hint={t("planView.powStatsImpureHint")}
                />
                <StatsRow
                  label={t("planView.powStatsSessions")}
                  value={stats.unique_sessions}
                  hint={t("planView.powStatsSessionsHint")}
                />
                <StatsRow
                  label={t("planView.powStatsBlocks")}
                  value={stats.unique_blocks}
                  hint={t("planView.powStatsBlocksHint")}
                />
                <StatsRow
                  label={t("planView.powStatsTools")}
                  value={stats.unique_tools}
                  hint={t("planView.powStatsToolsHint")}
                />
                <StatsRow label={t("planView.powStatsLast24h")} value={stats.last_24h} />
                <StatsRow label={t("planView.powStatsLast7d")} value={stats.last_7d} />
                <StatsRow
                  label={t("planView.powStatsFirst")}
                  value={
                    <span title={formatAbsolute(stats.first_at)}>
                      {formatRelative(stats.first_at, nowMs)}
                    </span>
                  }
                />
                <StatsRow
                  label={t("planView.powStatsLast")}
                  value={
                    <span title={formatAbsolute(stats.last_at)}>
                      {formatRelative(stats.last_at, nowMs)}
                    </span>
                  }
                />
                <StatsRow
                  label={t("planView.powStatsTotalBytes")}
                  value={formatProofOfWorkBytes(stats.total_bytes)}
                />
                <StatsRow
                  label={t("planView.powStatsAvgBytes")}
                  value={formatProofOfWorkBytes(stats.avg_bytes)}
                />
                <StatsRow
                  label={t("planView.powStatsScoped")}
                  value={
                    <>
                      {stats.with_block}
                      <span className="text-neutral-600">
                        {" "}
                        / {stats.without_block} workspace
                      </span>
                    </>
                  }
                />
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
