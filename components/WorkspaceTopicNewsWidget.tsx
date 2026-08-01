"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkspaceNewsItem } from "@/lib/workspace-news";

/**
 * Empty map right-pane widget: xAI-powered recent news for workspace topic.
 * Links open the full source in a new tab.
 */
export function WorkspaceTopicNewsWidget({
  workspaceTitle,
  rootTopic,
  workspaceGoal,
  workspaceDescription,
  notes,
}: {
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
}) {
  const [items, setItems] = useState<WorkspaceNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topicLabel = (rootTopic || workspaceTitle || "this workspace").trim();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceTitle,
          rootTopic,
          workspaceGoal,
          workspaceDescription,
          notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: WorkspaceNewsItem[];
        error?: string;
      };
      const next = Array.isArray(data.items) ? data.items : [];
      setItems(next);
      if (!res.ok && next.length === 0) {
        setError(data.error || "Could not load news");
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Could not load news");
    } finally {
      setLoading(false);
    }
  }, [workspaceTitle, rootTopic, workspaceGoal, workspaceDescription, notes]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      data-workspace-topic-news
      data-news-loading={loading ? "true" : "false"}
      data-news-count={items.length}
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <header className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          Recent news
        </p>
        <p className="text-xs leading-relaxed text-neutral-400">
          xAI-powered headlines related to{" "}
          <span className="text-neutral-200">{topicLabel}</span>
        </p>
      </header>

      {loading ? (
        <p className="text-xs text-neutral-600" data-news-status="loading">
          Pulling recent sources…
        </p>
      ) : null}

      {error && items.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
          <p className="text-xs text-neutral-500" data-news-status="error">
            {error}
          </p>
          <button
            type="button"
            data-news-retry
            onClick={() => void load()}
            className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-news-list>
          {items.map((item) => (
            <li
              key={`${item.url}-${item.title}`}
              data-news-item
              className="rounded-lg border border-neutral-800/80 bg-neutral-950/70 p-2.5"
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                data-news-link
                className="block text-xs font-medium leading-snug text-white transition hover:text-neutral-200"
              >
                {item.title}
              </a>
              {item.summary ? (
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 line-clamp-3">
                  {item.summary}
                </p>
              ) : null}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                {item.source ? (
                  <span className="truncate text-[10px] text-neutral-600">{item.source}</span>
                ) : (
                  <span />
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-medium text-neutral-400 underline-offset-2 hover:text-white hover:underline"
                >
                  Read source ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-xs text-neutral-600" data-news-status="empty">
          No source-linked headlines yet for this topic.
        </p>
      ) : null}
    </div>
  );
}
