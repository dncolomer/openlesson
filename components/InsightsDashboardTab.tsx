"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { archiveInsight, formatInsightDate, insightPublicPath, type InsightSummary } from "@/lib/insights";

export function InsightsDashboardTab({
  planTitles = {},
}: {
  planTitles?: Record<string, string>;
}) {
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const sortedInsights = useMemo(
    () => [...insights].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [insights],
  );

  const handleArchive = async (insight: InsightSummary) => {
    if (archivingId) return;
    if (!confirm("Archive this insight? It will be removed from your lists and share links will stop working.")) {
      return;
    }
    setArchivingId(insight.id);
    try {
      await archiveInsight(insight.id);
      setInsights((current) => current.filter((entry) => entry.id !== insight.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive insight");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 px-6 py-12 text-center text-sm text-neutral-500">
        Loading insights…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-900/50 bg-red-950/20 px-6 py-12 text-center text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-neutral-800 bg-neutral-950/75 px-6 py-7 sm:px-8 sm:py-8 backdrop-blur-sm">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Insights</p>
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Bookmarks from your thinking
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          Select thought traces in any workspace, synthesize them into durable insights, and share the detail page
          anonymously.
        </p>
      </div>

      {sortedInsights.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-800 px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No insights yet.</p>
          <p className="mt-2 text-xs text-neutral-600">
            Open a workspace, use Thought Memory, select multiple traces, and create your first insight.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedInsights.map((insight) => {
            const workspaceTitle = insight.plan_id ? planTitles[insight.plan_id] : null;
            const isArchiving = archivingId === insight.id;
            return (
              <div
                key={insight.id}
                className="group overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 transition hover:border-neutral-700 hover:bg-neutral-900/80"
              >
                <Link href={insightPublicPath(insight)} className="block">
                  <div className="relative h-40 bg-neutral-900">
                    {insight.aesthetic_image ? (
                      <img
                        src={insight.aesthetic_image}
                        alt=""
                        className="h-full w-full object-cover opacity-75 grayscale transition group-hover:opacity-90 group-hover:grayscale-0"
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%),linear-gradient(135deg,#171717,#050505)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                    <div className="absolute left-4 top-4">
                      <span className="border border-white/10 bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300 backdrop-blur-sm">
                        Insight
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={insightPublicPath(insight)}>
                    <h3 className="line-clamp-2 text-base font-medium leading-snug text-neutral-100 transition group-hover:text-white">
                      {insight.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-500">{insight.summary}</p>
                  </Link>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                    <span>{formatInsightDate(insight.created_at)}</span>
                    {workspaceTitle ? (
                      <>
                        <span>•</span>
                        <span className="line-clamp-1">{workspaceTitle}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-800 pt-3">
                    <Link
                      href={insightPublicPath(insight)}
                      className="text-sm font-medium text-neutral-200 group-hover:text-white"
                    >
                      Open insight →
                    </Link>
                    <button
                      type="button"
                      disabled={isArchiving}
                      onClick={() => void handleArchive(insight)}
                      className="text-xs text-neutral-500 transition hover:text-amber-200 disabled:opacity-50"
                    >
                      {isArchiving ? "Archiving…" : "Archive"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}