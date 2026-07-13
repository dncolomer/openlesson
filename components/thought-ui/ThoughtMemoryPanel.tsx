"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveInsight,
  formatInsightDate,
  insightPublicPath,
  type InsightSummary,
} from "@/lib/insights";
import { createClient } from "@/lib/supabase/client";
import {
  thoughtSelectionActionClass,
  thoughtSelectionBarClass,
  thoughtSelectionBarTextClass,
  thoughtSelectionCardClass,
} from "@/components/thought-ui/ThoughtUi";
import { cn } from "@/lib/utils";

const INSIGHTS_AUTH_MESSAGE = "You need to have a user and be logged in — not available as a guest user.";

export interface ThoughtMemoryEntry {
  id: string;
  text: string;
  timestamp: number;
}

interface InsightSuggestion {
  title: string;
  summary: string;
  thoughtIds: string[];
}

function formatThoughtTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

interface ThoughtMemoryPanelProps {
  thoughts: ThoughtMemoryEntry[];
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  className?: string;
  listClassName?: string;
  emptyMessage?: string;
}

export function ThoughtMemoryPanel({
  thoughts,
  workspaceId,
  blockId,
  sessionId,
  className = "flex h-full min-h-0 max-h-full flex-col overflow-hidden",
  listClassName = "",
  emptyMessage = "Speak, press Del to stash thoughts, or Enter to send. Every trace appears here.",
}: ThoughtMemoryPanelProps) {
  const [mode, setMode] = useState<"memory" | "insights">("memory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingInsight, setCreatingInsight] = useState(false);
  const [suggestingInsights, setSuggestingInsights] = useState(false);
  const [insightSuggestions, setInsightSuggestions] = useState<InsightSuggestion[]>([]);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [lastInsightUrl, setLastInsightUrl] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [archivingInsightId, setArchivingInsightId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const insightsAvailable = isAuthenticated === true;

  useEffect(() => {
    const supabase = createClient();
    const syncAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    void syncAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncAuth();
    });
    return () => subscription.unsubscribe();
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredThoughts = useMemo(() => {
    if (!normalizedSearch) return thoughts;
    return thoughts.filter((thought) => thought.text.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, thoughts]);

  const selectedThoughts = useMemo(
    () => thoughts.filter((thought) => selectedIds.has(thought.id)),
    [selectedIds, thoughts],
  );

  const loadInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const params = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      const response = await fetch(`/api/insights${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Failed to load insights");
    } finally {
      setLoadingInsights(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (mode !== "insights") return;
    void loadInsights();
  }, [mode, loadInsights]);

  useEffect(() => {
    setInsightSuggestions([]);
  }, [thoughts]);

  const toggleSelected = (thoughtId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(thoughtId)) next.delete(thoughtId);
      else next.add(thoughtId);
      return next;
    });
  };

  const handleArchiveInsight = async (insight: InsightSummary) => {
    if (archivingInsightId) return;
    if (!confirm("Archive this insight? It will be removed from your lists and share links will stop working.")) {
      return;
    }
    setArchivingInsightId(insight.id);
    setInsightError(null);
    try {
      await archiveInsight(insight.id);
      setInsights((current) => current.filter((entry) => entry.id !== insight.id));
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Failed to archive insight");
    } finally {
      setArchivingInsightId(null);
    }
  };

  const suggestInsights = async () => {
    if (!insightsAvailable || thoughts.length < 2 || suggestingInsights) return;
    setSuggestingInsights(true);
    setInsightError(null);
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
      const suggestions = Array.isArray(data.suggestions) ? (data.suggestions as InsightSuggestion[]) : [];
      setInsightSuggestions(suggestions);
      if (suggestions.length === 0) {
        setInsightError("No strong insight patterns found yet. Keep thinking aloud and try again.");
      }
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Failed to suggest insights");
      setInsightSuggestions([]);
    } finally {
      setSuggestingInsights(false);
    }
  };

  const applySuggestion = (suggestion: InsightSuggestion) => {
    const validIds = suggestion.thoughtIds.filter((id) => thoughts.some((thought) => thought.id === id));
    setSelectedIds(new Set(validIds));
    setInsightError(null);
  };

  const createInsight = async () => {
    if (!insightsAvailable || selectedThoughts.length === 0 || creatingInsight) return;
    setCreatingInsight(true);
    setInsightError(null);
    try {
      const response = await fetch("/api/insights/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thoughtIds: selectedThoughts.map((t) => t.id),
          thoughts: selectedThoughts.map((t) => ({ id: t.id, text: t.text })),
          workspaceId,
          blockId,
          sessionId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create insight");
      setLastInsightUrl(insightPublicPath(data.insight));
      setSelectedIds(new Set());
      setInsightSuggestions([]);
      setMode("insights");
      if (data.insight) {
        setInsights((current) => [data.insight, ...current]);
      } else {
        await loadInsights();
      }
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Failed to create insight");
    } finally {
      setCreatingInsight(false);
    }
  };

  const scrollListClassName = cn(listClassName, "h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain");

  return (
    <div className={className}>
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Thought Memory</p>
          <div className="flex rounded-md border border-neutral-800 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setMode("memory")}
              className={`rounded px-2 py-1 ${mode === "memory" ? "bg-neutral-800 text-white" : "text-neutral-500"}`}
            >
              Memory
            </button>
            <button
              type="button"
              disabled={!insightsAvailable}
              onClick={() => setMode("insights")}
              className={`rounded px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "insights" ? "bg-neutral-800 text-white" : "text-neutral-500"
              }`}
            >
              Insights
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {mode === "memory"
            ? "Search traces, click cards to select, then bookmark or autosuggest insights."
            : workspaceId
              ? "Insights bookmarked from this workspace."
              : "Insights synthesize selected thoughts into shareable bookmarks."}
        </p>
      </div>

      {mode === "insights" ? (
        <div className={cn(scrollListClassName, "space-y-3 text-sm text-neutral-400")}>
          {lastInsightUrl ? (
            <div className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
              Latest insight saved.{" "}
              <Link href={lastInsightUrl} className="underline underline-offset-2 hover:text-white">
                View now
              </Link>
            </div>
          ) : null}

          {loadingInsights ? (
            <p className="py-6 text-center text-xs text-neutral-600">Loading insights…</p>
          ) : insights.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-800 px-3 py-6 text-center text-xs text-neutral-600">
              No insights yet. Select thought traces in Memory mode, then create an insight.
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className="overflow-hidden rounded-md border border-neutral-800 bg-black/30 transition hover:border-neutral-700 hover:bg-neutral-900/50"
                >
                  <Link href={insightPublicPath(insight)} className="block">
                    {insight.aesthetic_image ? (
                      <div
                        className="h-16 bg-cover bg-center opacity-80"
                        style={{ backgroundImage: `url(${insight.aesthetic_image})` }}
                      />
                    ) : null}
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-medium text-neutral-100">{insight.title}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{insight.summary}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-neutral-600">
                        {formatInsightDate(insight.created_at)}
                      </p>
                    </div>
                  </Link>
                  <div className="border-t border-neutral-800/80 px-3 py-2">
                    <button
                      type="button"
                      disabled={archivingInsightId === insight.id}
                      onClick={() => void handleArchiveInsight(insight)}
                      className="text-[11px] text-neutral-500 underline underline-offset-2 transition hover:text-amber-200 disabled:opacity-50"
                    >
                      {archivingInsightId === insight.id ? "Archiving…" : "Archive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/dashboard?tab=insights"
            className="inline-flex text-xs text-neutral-300 underline underline-offset-2 hover:text-white"
          >
            Open all insights on Dashboard
          </Link>
        </div>
      ) : (
        <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-3 shrink-0 space-y-2">
            <label className="block">
              <span className="sr-only">Search thought traces</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search traces…"
                className="w-full rounded-md border border-neutral-800 bg-black/40 px-2.5 py-1.5 text-xs text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-600"
              />
            </label>
            <button
              type="button"
              disabled={!insightsAvailable || thoughts.length < 2 || suggestingInsights}
              onClick={() => void suggestInsights()}
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {suggestingInsights ? "Suggesting insights…" : "Suggest insights from traces"}
            </button>
            {!insightsAvailable && isAuthenticated !== null ? (
              <p className="text-[11px] leading-relaxed text-neutral-500">{INSIGHTS_AUTH_MESSAGE}</p>
            ) : null}
          </div>

          {insightSuggestions.length > 0 ? (
            <div className="mb-3 shrink-0 space-y-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
              <p className="text-[10px] uppercase tracking-[1.5px] text-amber-200/80">Suggested insights</p>
              {insightSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.title}-${index}`}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="block w-full rounded-md border border-neutral-800 bg-black/30 px-2.5 py-2 text-left transition hover:border-amber-500/35 hover:bg-black/45"
                >
                  <p className="text-sm font-medium text-neutral-100">{suggestion.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{suggestion.summary}</p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-wide text-amber-200/70">
                    Select {suggestion.thoughtIds.length} traces
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {selectedThoughts.length > 0 && (
            <div className={cn(thoughtSelectionBarClass, "mb-3 shrink-0 flex items-center justify-between gap-2 px-2.5 py-2")}>
              <span className={thoughtSelectionBarTextClass}>{selectedThoughts.length} selected</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelectedIds(new Set())} className={thoughtSelectionActionClass}>
                  Clear
                </button>
                <button
                  type="button"
                  disabled={!insightsAvailable || creatingInsight}
                  onClick={() => void createInsight()}
                  className={cn(thoughtSelectionActionClass, "font-medium")}
                >
                  {creatingInsight ? "Creating…" : "Create insight"}
                </button>
              </div>
            </div>
          )}
          {insightError ? <p className="mb-2 shrink-0 text-xs text-red-400">{insightError}</p> : null}
          <div className={scrollListClassName}>
            {thoughts.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">{emptyMessage}</p>
            ) : filteredThoughts.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">No traces match your search.</p>
            ) : (
              filteredThoughts.map((thought) => {
                const isSelected = selectedIds.has(thought.id);
                return (
                  <article
                    key={thought.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => toggleSelected(thought.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSelected(thought.id);
                      }
                    }}
                    className={thoughtSelectionCardClass(
                      isSelected,
                      "cursor-pointer rounded-md border-b border-neutral-800/80 py-4 transition last:border-b-0 hover:bg-neutral-900/35",
                    )}
                  >
                    <p className="mb-2 text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                      {thought.text}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}