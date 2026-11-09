"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Workspace } from "@/lib/storage";
import {
  dashboardHomeCtas,
  presentDashboardHomeRecentMap,
  sortDashboardHomeRecentMaps,
} from "@/lib/dashboard-home-overview";
import {
  PRACTICE_HISTORY_PATH,
  formatPracticeDuration,
  practiceSessionHref,
  summarizePracticeHistory,
  type PracticeHistoryRow,
} from "@/lib/practice-problems";
import { dashboardHrefForTab } from "@/lib/dashboard-nav";
import { dashboardHasNoWorkspaces } from "@/lib/dashboard-workspace-filters";

export type DashboardHomeTabProps = {
  workspaces: Workspace[];
  playCopies?: Workspace[];
  t: (key: string, params?: Record<string, string | number>) => string;
  hasPaidAccess?: boolean;
};

export function DashboardHomeTab({
  workspaces,
  playCopies = [],
  t,
  hasPaidAccess = false,
}: DashboardHomeTabProps) {
  const [practiceRows, setPracticeRows] = useState<PracticeHistoryRow[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/practice/history" satisfies typeof PRACTICE_HISTORY_PATH)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const next = Array.isArray(payload?.rows) ? payload.rows : [];
        setPracticeRows(next);
      })
      .catch(() => {
        if (!cancelled) setPracticeRows([]);
      })
      .finally(() => {
        if (!cancelled) setPracticeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recentMaps = useMemo(() => {
    const rows = [...workspaces, ...playCopies]
      .map((row) =>
        presentDashboardHomeRecentMap({
          id: row.id,
          title: row.title,
          root_topic: row.root_topic,
          is_play_copy: row.is_play_copy,
          updated_at: (row as { updated_at?: string }).updated_at,
          created_at: row.created_at,
        }),
      )
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const seen = new Set<string>();
    const unique = rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    return sortDashboardHomeRecentMaps(unique);
  }, [workspaces, playCopies]);

  const recentPractice = practiceRows.slice(0, 4);
  const practiceSummary = summarizePracticeHistory(practiceRows);
  const emptyWorkspaces = dashboardHasNoWorkspaces(workspaces);
  const ctas = dashboardHomeCtas();

  return (
    <div
      className="flex flex-col gap-4"
      data-dashboard-home
      data-dashboard-home-overview
    >
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Platform
        </p>
        <h2 className="mt-1 text-2xl font-medium tracking-[-0.6px] text-white">
          Home
        </h2>
      </header>

      <section className="console-copy px-4 py-4" data-dashboard-home-cta>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Actions
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {ctas.map((cta) => (
            <Link
              key={cta.id}
              href={cta.href}
              data-dashboard-home-cta-link={cta.id}
              className="console-button flex min-h-[4.25rem] items-center justify-center px-3 py-3 text-center text-sm text-white transition hover:border-white/80 hover:bg-white/5"
            >
              {cta.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="console-copy min-h-[12rem] px-4 py-4"
          data-dashboard-home-recent-maps
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            Recent maps
          </p>
          {recentMaps.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">No maps yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentMaps.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 border border-white/15 px-3 py-2 text-sm text-white transition hover:border-white/50"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                      {item.kind === "play_copy" ? "Play" : "Build"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="console-copy min-h-[12rem] px-4 py-4"
          data-dashboard-home-recent-practice
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            Recent practice
          </p>
          {practiceLoading ? (
            <p className="mt-3 text-sm text-neutral-400">Loading practice…</p>
          ) : recentPractice.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">
              No practice sessions yet.{" "}
              <Link
                href={dashboardHrefForTab("practice")}
                className="text-white underline decoration-white/30 underline-offset-4"
              >
                Browse exercises
              </Link>
            </p>
          ) : (
            <>
              <p className="mt-2 font-mono text-[10px] text-neutral-500">
                {practiceSummary.sessionCount} sessions · {practiceSummary.insightCount} insights ·{" "}
                {formatPracticeDuration(practiceSummary.durationMs)}
              </p>
              <ul className="mt-3 space-y-2">
                {recentPractice.map((row) => (
                  <li key={row.sessionId}>
                    <Link
                      href={practiceSessionHref(row.sessionId)}
                      className="flex items-center justify-between gap-3 border border-white/15 px-3 py-2 text-sm text-white transition hover:border-white/50"
                    >
                      <span className="truncate">{row.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                        {row.insightCount} insights
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {emptyWorkspaces && hasPaidAccess ? (
        <section
          data-dashboard-empty-workspaces
          className="console-copy px-4 py-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {t("dashboard.emptyWorkspacesKicker")}
          </p>
          <h3 className="mt-2 text-lg font-medium tracking-[-0.4px] text-white">
            {t("dashboard.emptyWorkspacesTitle")}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-neutral-400">
            {t("dashboard.emptyWorkspacesBody")}
          </p>
          <Link
            href="/workspace/new"
            data-dashboard-empty-create
            className="mt-4 inline-flex h-9 items-center border border-white/40 px-4 text-sm text-white transition hover:border-white/80"
          >
            {t("dashboard.emptyWorkspacesCta")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
