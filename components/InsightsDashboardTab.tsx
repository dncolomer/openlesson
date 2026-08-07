"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  archiveInsight,
  formatInsightDate,
  insightPublicPath,
  insightsListUrl,
  type InsightSummary,
} from "@/lib/insights";

type WorkspaceInsightThought = {
  id: string;
  text: string;
  timestamp: number;
  sessionId?: string | null;
  blockId?: string | null;
};

type InsightSuggestion = {
  title: string;
  summary: string;
  thoughtIds: string[];
};

export function InsightsDashboardTab({
  workspaceId,
  workspaceTitle,
  workspaceTitles = {},
  compact = false,
}: {
  /** When set, only loads insights for this workspace (Knowledge surface). */
  workspaceId?: string;
  workspaceTitle?: string;
  /** Optional map for multi-workspace labels (legacy dashboard). */
  workspaceTitles?: Record<string, string>;
  compact?: boolean;
}) {
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [thoughts, setThoughts] = useState<WorkspaceInsightThought[]>([]);
  const [loadingThoughts, setLoadingThoughts] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<InsightSuggestion[]>([]);
  const [bookmarkingKey, setBookmarkingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastInsightUrl, setLastInsightUrl] = useState<string | null>(null);

  const scoped = Boolean(workspaceId);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(insightsListUrl(workspaceId));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const loadThoughts = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingThoughts(true);
    try {
      const res = await fetch(`/api/insights/traces?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load thought traces");
      setThoughts(Array.isArray(data.thoughts) ? data.thoughts : []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load thought traces");
      setThoughts([]);
    } finally {
      setLoadingThoughts(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    if (!workspaceId) return;
    void loadThoughts();
  }, [workspaceId, loadThoughts]);

  const sortedInsights = useMemo(
    () => [...insights].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [insights],
  );

  const thoughtsById = useMemo(() => {
    const map = new Map<string, WorkspaceInsightThought>();
    for (const thought of thoughts) map.set(thought.id, thought);
    return map;
  }, [thoughts]);

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

  const suggestInsights = async () => {
    if (!workspaceId || suggesting || thoughts.length < 2) return;
    setSuggesting(true);
    setActionError(null);
    setSuggestions([]);
    try {
      const response = await fetch("/api/insights/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thoughts: thoughts.map((thought) => ({ id: thought.id, text: thought.text })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to suggest insights");
      const next = Array.isArray(data.suggestions) ? (data.suggestions as InsightSuggestion[]) : [];
      setSuggestions(next);
      if (next.length === 0) {
        setActionError("No strong insight patterns found yet. Keep thinking aloud in an ILE session and try again.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to suggest insights");
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  };

  const bookmarkSuggestion = async (suggestion: InsightSuggestion, index: number) => {
    if (!workspaceId || bookmarkingKey) return;
    const key = `${suggestion.title}-${index}`;
    const sourceThoughts = suggestion.thoughtIds
      .map((id) => thoughtsById.get(id))
      .filter((thought): thought is WorkspaceInsightThought => Boolean(thought));

    if (sourceThoughts.length === 0) {
      setActionError("Could not resolve source traces for this suggestion.");
      return;
    }

    setBookmarkingKey(key);
    setActionError(null);
    try {
      const sessionId = sourceThoughts.find((t) => t.sessionId)?.sessionId ?? null;
      const blockId = sourceThoughts.find((t) => t.blockId)?.blockId ?? null;
      const response = await fetch("/api/insights/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thoughtIds: sourceThoughts.map((t) => t.id),
          thoughts: sourceThoughts.map((t) => ({ id: t.id, text: t.text })),
          workspaceId,
          blockId,
          sessionId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to bookmark insight");
      if (data.insight) {
        setInsights((current) => [data.insight as InsightSummary, ...current]);
        setLastInsightUrl(insightPublicPath(data.insight));
      } else {
        await loadInsights();
      }
      setSuggestions((current) => current.filter((_, i) => i !== index));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to bookmark insight");
    } finally {
      setBookmarkingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border border-neutral-800 bg-neutral-950/75 px-6 py-12 flex items-center justify-center">
        <LoadingStatusMessage tone="subtle" message="Loading insights" />
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
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div
        className={
          compact
            ? "border border-neutral-800 bg-neutral-950/75 px-4 py-4 sm:px-5"
            : "border border-neutral-800 bg-neutral-950/75 px-6 py-7 sm:px-8 sm:py-8 backdrop-blur-sm"
        }
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Insights</p>
        <h2
          className={
            compact
              ? "max-w-2xl text-xl font-medium tracking-tight text-white"
              : "max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl"
          }
        >
          {scoped
            ? workspaceTitle
              ? `Insights for ${workspaceTitle}`
              : "Workspace insights"
            : "Bookmarks from your workspaces"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          {scoped
            ? "Generate insight suggestions from PoW data in this workspace, then bookmark the ones worth keeping."
            : "Insights originating from your workspaces — separate from Performance metrics inside a workspace."}
        </p>
        {!scoped ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
            Open a workspace Knowledge → Insights tab to generate suggestions from PoW data and bookmark them.
          </p>
        ) : null}

        {scoped ? (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={loadingThoughts || suggesting || thoughts.length < 2}
                onClick={() => void suggestInsights()}
                className="rounded-md border border-neutral-800/80 bg-neutral-950/40 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-white/60 hover:bg-neutral-950/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {suggesting
                  ? "Generating suggestions…"
                  : loadingThoughts
                    ? "Loading traces…"
                    : "Generate insight suggestions"}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-600">
                {loadingThoughts
                  ? "Scanning thought traces"
                  : thoughts.length === 0
                    ? "No ILE traces yet"
                    : `${thoughts.length} trace${thoughts.length === 1 ? "" : "s"} available`}
              </span>
            </div>
            {thoughts.length > 0 && thoughts.length < 2 ? (
              <p className="text-xs text-neutral-500">
                Need at least two thought traces to suggest insights. Continue an ILE session and try again.
              </p>
            ) : null}
            {thoughts.length === 0 && !loadingThoughts ? (
              <p className="text-xs text-neutral-500">
                Start an ILE session and think aloud — traces land here so you can generate and bookmark insights.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {scoped && lastInsightUrl ? (
        <div className="rounded-md border border-neutral-600/25 bg-neutral-800/10 px-4 py-3 text-xs text-neutral-200">
          Insight bookmarked.{" "}
          <Link href={lastInsightUrl} className="underline underline-offset-2 hover:text-white">
            View now
          </Link>
        </div>
      ) : null}

      {scoped && actionError ? (
        <div className="rounded-md border border-neutral-800/40 bg-neutral-950/20 px-4 py-3 text-xs text-neutral-200">
          {actionError}
        </div>
      ) : null}

      {scoped && suggestions.length > 0 ? (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-300/80">Suggested insights</p>
          <div className={compact ? "grid gap-3 md:grid-cols-2" : "grid gap-4 md:grid-cols-2"}>
            {suggestions.map((suggestion, index) => {
              const key = `${suggestion.title}-${index}`;
              const isBookmarking = bookmarkingKey === key;
              return (
                <div
                  key={key}
                  className="rounded-md border border-neutral-600/20 bg-neutral-800/5 p-4 transition hover:border-neutral-600/35"
                >
                  <h3 className="text-base font-medium leading-snug text-neutral-100">{suggestion.title}</h3>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-neutral-400">{suggestion.summary}</p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-neutral-300/70">
                    From {suggestion.thoughtIds.length} trace{suggestion.thoughtIds.length === 1 ? "" : "s"}
                  </p>
                  <div className="mt-4 flex items-center gap-3 border-t border-neutral-600/15 pt-3">
                    <button
                      type="button"
                      disabled={Boolean(bookmarkingKey)}
                      onClick={() => void bookmarkSuggestion(suggestion, index)}
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBookmarking ? "Bookmarking…" : "Bookmark insight"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {sortedInsights.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-800 px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No insights yet.</p>
          <p className="mt-2 text-xs text-neutral-600">
            {scoped
              ? "Generate suggestions from PoW data above, then bookmark the ones worth keeping."
              : "Open a workspace, generate insight suggestions from PoW data, and bookmark your first insight."}
          </p>
        </div>
      ) : (
        <div className={compact ? "grid gap-3 md:grid-cols-2" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
          {sortedInsights.map((insight) => {
            const titleFromMap = insight.workspace_id ? workspaceTitles[insight.workspace_id] : null;
            const label = scoped ? null : titleFromMap;
            const isArchiving = archivingId === insight.id;
            return (
              <div
                key={insight.id}
                className="group overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/75 transition hover:border-neutral-700 hover:bg-neutral-900/80"
              >
                <Link href={insightPublicPath(insight)} className="block">
                  <div className={compact ? "relative h-28 bg-neutral-900" : "relative h-40 bg-neutral-900"}>
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
                    {label ? (
                      <>
                        <span>•</span>
                        <span className="line-clamp-1">{label}</span>
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
                      className="text-xs text-neutral-500 transition hover:text-neutral-300 disabled:opacity-50"
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
