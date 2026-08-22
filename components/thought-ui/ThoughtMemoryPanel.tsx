"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveInsight,
  formatInsightDate,
  insightPublicPath,
  insightsListUrl,
  resolveInsightSurfaceCapabilities,
  workspaceKnowledgeInsightsPath,
  type InsightSummary,
  type InsightSurface,
} from "@/lib/insights";
import { createClient } from "@/lib/supabase/client";
import {
  thoughtSelectionActionClass,
  thoughtSelectionBarClass,
  thoughtSelectionBarTextClass,
  thoughtSelectionCardClass,
} from "@/components/thought-ui/ThoughtUi";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import {
  beginEditSelectedThoughts,
  submitEditedThoughtSelection,
  submitSelectedThoughts,
} from "@/lib/ile-last-stash";
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
  /**
   * Product surface. Controls insight generation (suggest/create) and list UI.
   * TAP: traces only. ILE/Knowledge: generation + list.
   * Prefer this over the raw allowInsightGeneration flag when known.
   */
  insightSurface?: InsightSurface;
  /** Explicit override; when omitted, derived from insightSurface (default ile). */
  allowInsightGeneration?: boolean;
  /** Helios send path for selected thoughts (ILE Thought tool). */
  onSendThought?: (text: string, thoughtIds: string[]) => void | Promise<void>;
  isSending?: boolean;
}

export function ThoughtMemoryPanel({
  thoughts,
  workspaceId,
  blockId,
  sessionId,
  className = "flex h-full min-h-0 max-h-full flex-col overflow-hidden",
  listClassName = "",
  emptyMessage = "Speak, press Del to stash thoughts, or Enter to send. Every trace appears here.",
  insightSurface = "ile",
  allowInsightGeneration,
  onSendThought,
  isSending = false,
}: ThoughtMemoryPanelProps) {
  const surfaceCaps = resolveInsightSurfaceCapabilities(insightSurface);
  const generationEnabled =
    allowInsightGeneration !== undefined ? allowInsightGeneration : surfaceCaps.allowInsightGeneration;
  const listEnabled = surfaceCaps.allowInsightList || generationEnabled;

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
  const [selectionEdit, setSelectionEdit] = useState<{
    draft: string;
    originalText: string;
    thoughtIds: string[];
  } | null>(null);

  const insightsAvailable = isAuthenticated === true && generationEnabled;
  const canSelectThoughts = generationEnabled || Boolean(onSendThought);

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
    if (!listEnabled) return;
    setLoadingInsights(true);
    try {
      const response = await fetch(insightsListUrl(workspaceId));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Failed to load insights");
    } finally {
      setLoadingInsights(false);
    }
  }, [listEnabled, workspaceId]);

  useEffect(() => {
    if (!listEnabled && mode === "insights") {
      setMode("memory");
    }
  }, [listEnabled, mode]);

  useEffect(() => {
    if (mode !== "insights" || !listEnabled) return;
    void loadInsights();
  }, [mode, loadInsights, listEnabled]);

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
    if (!generationEnabled || !insightsAvailable || thoughts.length < 2 || suggestingInsights) return;
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
    if (!generationEnabled || !insightsAvailable || selectedThoughts.length === 0 || creatingInsight) return;
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
          {listEnabled ? (
            <div className="flex rounded-none border border-neutral-800 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setMode("memory")}
                className={`rounded-none px-2 py-1 ${mode === "memory" ? "bg-neutral-800 text-white" : "text-neutral-500"}`}
              >
                Memory
              </button>
              <button
                type="button"
                disabled={!isAuthenticated}
                onClick={() => setMode("insights")}
                className={`rounded-none px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 ${
                  mode === "insights" ? "bg-neutral-800 text-white" : "text-neutral-500"
                }`}
              >
                Insights
              </button>
            </div>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {mode === "memory"
            ? generationEnabled
              ? "Search traces, click cards to select, then bookmark or autosuggest insights."
              : "Search and review thought traces from this session."
            : workspaceId
              ? "Insights bookmarked from this workspace."
              : "Insights synthesize selected thoughts into shareable bookmarks."}
        </p>
      </div>

      {mode === "insights" ? (
        <div className={cn(scrollListClassName, "space-y-3 text-sm text-neutral-400")}>
          {lastInsightUrl ? (
            <div className="rounded-none border border-neutral-600/25 bg-neutral-800/10 px-3 py-2 text-xs text-neutral-200">
              Latest insight saved.{" "}
              <Link href={lastInsightUrl} className="underline underline-offset-2 hover:text-white">
                View now
              </Link>
            </div>
          ) : null}

          {loadingInsights ? (
            <p className="py-6 text-center text-xs text-neutral-600">Loading insights…</p>
          ) : insights.length === 0 ? (
            <div className="rounded-none border border-dashed border-neutral-800 px-3 py-6 text-center text-xs text-neutral-600">
              No insights yet. Select thought traces in Memory mode, then create an insight.
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className="overflow-hidden rounded-none border border-neutral-800 bg-black/30 transition hover:border-neutral-700 hover:bg-neutral-900/50"
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
                      className="text-[11px] text-neutral-500 underline underline-offset-2 transition hover:text-neutral-300 disabled:opacity-50"
                    >
                      {archivingInsightId === insight.id ? "Archiving…" : "Archive"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {workspaceId ? (
            <Link
              href={workspaceKnowledgeInsightsPath(workspaceId)}
              className="inline-flex text-xs text-neutral-300 underline underline-offset-2 hover:text-white"
            >
              Open workspace insights in Knowledge
            </Link>
          ) : null}
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
                className="w-full rounded-none border border-neutral-800 bg-black/40 px-2.5 py-1.5 text-xs text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-600"
              />
            </label>
            {generationEnabled ? (
              <>
                <button
                  type="button"
                  disabled={!insightsAvailable || thoughts.length < 2 || suggestingInsights}
                  onClick={() => void suggestInsights()}
                  className="w-full rounded-none border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {suggestingInsights ? "Suggesting insights…" : "Suggest insights from traces"}
                </button>
                {!insightsAvailable && isAuthenticated !== null ? (
                  <p className="text-[11px] leading-relaxed text-neutral-500">{INSIGHTS_AUTH_MESSAGE}</p>
                ) : null}
              </>
            ) : null}
          </div>

          {generationEnabled && insightSuggestions.length > 0 ? (
            <div className="mb-3 shrink-0 space-y-2 rounded-none border border-neutral-600/20 bg-neutral-800/5 p-2.5">
              <p className="text-[10px] uppercase tracking-[1.5px] text-neutral-300/80">Suggested insights</p>
              {insightSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.title}-${index}`}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="block w-full rounded-none border border-neutral-800 bg-black/30 px-2.5 py-2 text-left transition hover:border-neutral-600/35 hover:bg-black/45"
                >
                  <p className="text-sm font-medium text-neutral-100">{suggestion.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{suggestion.summary}</p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-wide text-neutral-300/70">
                    Select {suggestion.thoughtIds.length} traces
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {canSelectThoughts && selectedThoughts.length > 0 && (
            <div className={cn(thoughtSelectionBarClass, "mb-3 shrink-0 flex items-center justify-between gap-2 px-2.5 py-2")}>
              <span className={thoughtSelectionBarTextClass}>{selectedThoughts.length} selected</span>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {onSendThought ? (
                  <>
                    <button
                      type="button"
                      data-submit-selection
                      disabled={isSending}
                      onClick={() => {
                        void submitSelectedThoughts({
                          thoughts,
                          selectedIds,
                          sendThought: onSendThought,
                        }).then((result) => {
                          if (result.submitted) setSelectedIds(new Set());
                        });
                      }}
                      className={cn(thoughtSelectionActionClass, "font-medium")}
                    >
                      Submit Selection
                    </button>
                    <button
                      type="button"
                      data-edit-selection
                      disabled={isSending}
                      onClick={() => {
                        const draft = beginEditSelectedThoughts({ thoughts, selectedIds });
                        if (draft) setSelectionEdit(draft);
                      }}
                      className={cn(thoughtSelectionActionClass, "font-medium")}
                    >
                      Edit Selection
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => setSelectedIds(new Set())} className={thoughtSelectionActionClass}>
                  Clear
                </button>
                {generationEnabled ? (
                  <button
                    type="button"
                    disabled={!insightsAvailable || creatingInsight}
                    onClick={() => void createInsight()}
                    className={cn(thoughtSelectionActionClass, "font-medium")}
                  >
                    {creatingInsight ? "Creating…" : "Create insight"}
                  </button>
                ) : null}
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
                const isSelected = canSelectThoughts && selectedIds.has(thought.id);
                if (!canSelectThoughts) {
                  return (
                    <article
                      key={thought.id}
                      className="rounded-none border-b border-neutral-800/80 py-4 last:border-b-0"
                    >
                      <p className="mb-2 text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                        {thought.text}
                      </p>
                    </article>
                  );
                }
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
                      "cursor-pointer rounded-none border-b border-neutral-800/80 py-4 transition last:border-b-0 hover:bg-neutral-900/35",
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

      {selectionEdit ? (
        <ThoughtEditPanel
          title="Edit selection"
          submitLabel="Submit"
          draft={selectionEdit.draft}
          onDraftChange={(draft) =>
            setSelectionEdit((current) => (current ? { ...current, draft } : null))
          }
          onCancel={() => setSelectionEdit(null)}
          onSend={() => {
            if (!onSendThought || !selectionEdit) return;
            void submitEditedThoughtSelection({
              draft: selectionEdit.draft,
              thoughtIds: selectionEdit.thoughtIds,
              sendThought: onSendThought,
            }).then((result) => {
              if (!result.submitted) return;
              setSelectionEdit(null);
              setSelectedIds(new Set());
            });
          }}
          isSending={isSending}
        />
      ) : null}
    </div>
  );
}