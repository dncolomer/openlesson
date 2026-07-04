"use client";

import { useMemo, useState } from "react";

export interface ThoughtMemoryEntry {
  id: string;
  text: string;
  timestamp: number;
}

function formatThoughtTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

interface ThoughtMemoryPanelProps {
  thoughts: ThoughtMemoryEntry[];
  sentThoughtIds: ReadonlySet<string>;
  skippedThoughtIds: ReadonlySet<string>;
  onSendThought: (text: string, thoughtIds: string[]) => void;
  planId?: string;
  planNodeId?: string;
  sessionId?: string;
  className?: string;
  listClassName?: string;
  emptyMessage?: string;
}

function statusClasses(isSent: boolean, isSkipped: boolean) {
  if (isSent) return "text-emerald-400";
  if (isSkipped) return "text-neutral-500";
  return "text-cyan-300";
}

export function ThoughtMemoryPanel({
  thoughts,
  sentThoughtIds,
  skippedThoughtIds,
  onSendThought,
  planId,
  planNodeId,
  sessionId,
  className = "flex h-full min-h-0 flex-col",
  listClassName = "min-h-0 flex-1 space-y-0 overflow-y-auto",
  emptyMessage = "Speak or press C to crystallize thoughts. Every trace appears here.",
}: ThoughtMemoryPanelProps) {
  const [mode, setMode] = useState<"memory" | "insights">("memory");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingInsight, setCreatingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [lastInsightUrl, setLastInsightUrl] = useState<string | null>(null);

  const selectedThoughts = useMemo(
    () => thoughts.filter((thought) => selectedIds.has(thought.id)),
    [selectedIds, thoughts],
  );

  const toggleSelected = (thoughtId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(thoughtId)) next.delete(thoughtId);
      else next.add(thoughtId);
      return next;
    });
  };

  const createInsight = async () => {
    if (selectedThoughts.length === 0 || creatingInsight) return;
    setCreatingInsight(true);
    setInsightError(null);
    try {
      const response = await fetch("/api/insights/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thoughtIds: selectedThoughts.map((t) => t.id),
          thoughts: selectedThoughts.map((t) => ({ id: t.id, text: t.text })),
          planId,
          planNodeId,
          sessionId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create insight");
      const token = data.insight?.share_token || data.insight?.id;
      setLastInsightUrl(`/insights/${token}`);
      setSelectedIds(new Set());
      setMode("insights");
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "Failed to create insight");
    } finally {
      setCreatingInsight(false);
    }
  };

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
              onClick={() => setMode("insights")}
              className={`rounded px-2 py-1 ${mode === "insights" ? "bg-neutral-800 text-white" : "text-neutral-500"}`}
            >
              Insights
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {mode === "memory"
            ? "Send any trace back into the dialogue, or select multiple to bookmark an insight."
            : "Insights synthesize selected thoughts into shareable bookmarks."}
        </p>
      </div>

      {mode === "insights" ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm text-neutral-400">
          <p>Select thoughts in Memory mode, then create an insight. Insights link to this workspace and can be shared.</p>
          {lastInsightUrl && (
            <a href={lastInsightUrl} className="inline-flex text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
              View latest insight
            </a>
          )}
          <a href="/dashboard?tab=insights" className="inline-flex text-neutral-300 underline underline-offset-2 hover:text-white">
            Open insights on Dashboard
          </a>
        </div>
      ) : (
        <>
          {selectedThoughts.length > 0 && (
            <div className="mb-3 shrink-0 flex items-center justify-between gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-2">
              <span className="text-[11px] text-cyan-200">{selectedThoughts.length} selected</span>
              <button
                type="button"
                disabled={creatingInsight}
                onClick={() => void createInsight()}
                className="text-[11px] font-medium text-cyan-100 underline underline-offset-2 disabled:opacity-40"
              >
                {creatingInsight ? "Creating…" : "Create insight"}
              </button>
            </div>
          )}
          {insightError && <p className="mb-2 text-xs text-red-400">{insightError}</p>}
          <div className={listClassName}>
            {thoughts.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">{emptyMessage}</p>
            ) : (
              thoughts.map((thought) => {
                const isSent = sentThoughtIds.has(thought.id);
                const isSkipped = skippedThoughtIds.has(thought.id);
                const statusLabel = isSent ? "sent" : isSkipped ? "skipped" : "active";
                const isSelected = selectedIds.has(thought.id);
                return (
                  <article
                    key={thought.id}
                    className={`border-b border-neutral-800/80 py-4 last:border-b-0 ${isSelected ? "bg-cyan-500/5" : ""}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(thought.id)}
                          className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-950"
                        />
                        <span className="text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-medium uppercase tracking-[1px] ${statusClasses(isSent, isSkipped)}`}>
                          {statusLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSendThought(thought.text, [thought.id])}
                          className="text-[11px] font-medium text-neutral-300 underline decoration-neutral-600 underline-offset-2 transition hover:text-white hover:decoration-neutral-400"
                        >
                          {isSent ? "resend" : "send"}
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                      {thought.text}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}