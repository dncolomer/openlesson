"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  formatProofOfWorkBytes,
  type WorkspaceProofOfWorkStats,
} from "@/lib/pow-api/proof-of-work-stats";
import type { PowQualityFilter } from "@/lib/pow-api/pow-quality";

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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-xl text-white tabular-nums">{value}</div>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-neutral-600">{hint}</p> : null}
    </div>
  );
}

const selectClass =
  "rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-500";

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
  const [qualityFilter, setQualityFilter] = useState<PowQualityFilter>("all");
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
          quality: qualityFilter,
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
  }, [ayclToken, currentUserId, qualityFilter, subjectKey, t, workspaceId]);

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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-3">
        <label className="flex min-w-[9rem] flex-col gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
          {t("planView.powStatsFilterQuality")}
          <select
            className={selectClass}
            value={qualityFilter}
            data-pow-quality-filter
            onChange={(event) => setQualityFilter(event.target.value as PowQualityFilter)}
          >
            <option value="all">{t("planView.powStatsFilterQualityAll")}</option>
            <option value="scored">{t("planView.powStatsFilterQualityScored")}</option>
            <option value="practice">{t("planView.powStatsFilterQualityPractice")}</option>
            <option value="impure">{t("planView.powStatsFilterQualityImpure")}</option>
          </select>
        </label>
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
            <p className="text-[11px] text-amber-500/90">
              {t("planView.powStatsSampleCapped", {
                sampled: stats.sampled_artifacts,
                total: stats.total_artifacts,
              })}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t("planView.powStatsTotal")} value={stats.total_artifacts} />
            <StatCard
              label={t("planView.powStatsScored")}
              value={stats.scored_artifacts}
              hint={t("planView.powStatsScoredHint")}
            />
            <StatCard
              label={t("planView.powStatsPractice")}
              value={stats.practice_artifacts}
              hint={t("planView.powStatsPracticeHint")}
            />
            <StatCard
              label={t("planView.powStatsImpure")}
              value={stats.impure_artifacts}
              hint={t("planView.powStatsImpureHint")}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={t("planView.powStatsSessions")}
              value={stats.unique_sessions}
              hint={t("planView.powStatsSessionsHint")}
            />
            <StatCard
              label={t("planView.powStatsBlocks")}
              value={stats.unique_blocks}
              hint={t("planView.powStatsBlocksHint")}
            />
            <StatCard
              label={t("planView.powStatsTools")}
              value={stats.unique_tools}
              hint={t("planView.powStatsToolsHint")}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/50 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {t("planView.powStatsActivity")}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsLast24h")}</dt>
                <dd className="mt-0.5 font-mono text-neutral-200 tabular-nums">{stats.last_24h}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsLast7d")}</dt>
                <dd className="mt-0.5 font-mono text-neutral-200 tabular-nums">{stats.last_7d}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsFirst")}</dt>
                <dd className="mt-0.5 text-neutral-300" title={formatAbsolute(stats.first_at)}>
                  {formatRelative(stats.first_at, nowMs)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsLast")}</dt>
                <dd className="mt-0.5 text-neutral-300" title={formatAbsolute(stats.last_at)}>
                  {formatRelative(stats.last_at, nowMs)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsTotalBytes")}</dt>
                <dd className="mt-0.5 font-mono text-neutral-200">
                  {formatProofOfWorkBytes(stats.total_bytes)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsAvgBytes")}</dt>
                <dd className="mt-0.5 font-mono text-neutral-200">
                  {formatProofOfWorkBytes(stats.avg_bytes)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t("planView.powStatsScoped")}</dt>
                <dd className="mt-0.5 font-mono text-neutral-200 tabular-nums">
                  {stats.with_block}
                  <span className="text-neutral-600"> / {stats.without_block} workspace</span>
                </dd>
              </div>
            </dl>
          </div>
        </>
      ) : null}
    </section>
  );
}
