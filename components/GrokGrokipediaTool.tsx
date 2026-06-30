"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const GROKIPEDIA_HOME = "https://grokipedia.com";
const GROK_HOME = "https://grok.com";

function grokipediaSearchUrl(query: string) {
  const trimmed = query.trim();
  return trimmed ? `${GROKIPEDIA_HOME}/search?q=${encodeURIComponent(trimmed)}` : GROKIPEDIA_HOME;
}

function grokSearchUrl(query: string) {
  const trimmed = query.trim();
  return trimmed ? `${GROK_HOME}/?q=${encodeURIComponent(trimmed)}` : GROK_HOME;
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

interface GrokGrokipediaToolProps {
  sessionProblem?: string;
  activeStepDescription?: string;
  activeProbes?: { text: string }[];
}

export function GrokGrokipediaTool({
  sessionProblem = "",
  activeStepDescription,
  activeProbes = [],
}: GrokGrokipediaToolProps) {
  const { t } = useI18n();
  const [grokipediaQuery, setGrokipediaQuery] = useState(sessionProblem);
  const [grokQuery, setGrokQuery] = useState("");
  const [grokipediaSuggestions, setGrokipediaSuggestions] = useState<string[]>([]);
  const [grokipediaSuggestionsLoading, setGrokipediaSuggestionsLoading] = useState(false);

  useEffect(() => {
    setGrokipediaQuery(sessionProblem);
  }, [sessionProblem]);

  const fetchGrokipediaSuggestions = async () => {
    if (!sessionProblem) return;
    setGrokipediaSuggestionsLoading(true);
    try {
      const response = await fetch("/api/suggest-grokipedia-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionProblem,
          currentPlanStep: activeStepDescription,
          activeProbes,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setGrokipediaSuggestions(data.terms || []);
      }
    } catch (err) {
      console.error("Grokipedia suggestions error:", err);
    } finally {
      setGrokipediaSuggestionsLoading(false);
    }
  };

  const openGrokipedia = (query: string) => {
    openExternal(grokipediaSearchUrl(query));
  };

  const openGrok = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    openExternal(grokSearchUrl(trimmed));
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-1">
      <div className="mb-5 shrink-0">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{t("session.grokipedia")}</p>
        <p className="mt-1 text-xs text-neutral-500">{t("session.grokipediaDesc")}</p>
      </div>

      <section className="space-y-4 border-b border-neutral-800/80 pb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Grokipedia</p>
          <p className="mt-1 text-xs text-neutral-500">Search reference material in a new tab.</p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (grokipediaQuery.trim()) openGrokipedia(grokipediaQuery);
          }}
        >
          <input
            type="text"
            value={grokipediaQuery}
            onChange={(event) => setGrokipediaQuery(event.target.value)}
            placeholder={t("session.grokipediaSearchPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!grokipediaQuery.trim()}
            className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-600"
          >
            {t("session.grokipediaSearch")}
          </button>
        </form>

        {sessionProblem && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-neutral-600">{t("session.grokipediaTopicSearch")}</p>
            <button
              type="button"
              onClick={() => openGrokipedia(sessionProblem)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-left text-sm text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-900"
            >
              <span className="line-clamp-2">{sessionProblem}</span>
            </button>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wide text-neutral-600">{t("session.grokipediaSuggestedSearches")}</p>
            <button
              type="button"
              onClick={() => void fetchGrokipediaSuggestions()}
              disabled={grokipediaSuggestionsLoading || !sessionProblem}
              className="text-[11px] text-neutral-500 underline decoration-neutral-700 underline-offset-2 transition hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {grokipediaSuggestionsLoading
                ? t("common.loading")
                : grokipediaSuggestions.length > 0
                  ? t("session.grokipediaRefresh")
                  : t("session.grokipediaGenerate")}
            </button>
          </div>
          {grokipediaSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {grokipediaSuggestions.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => openGrokipedia(term)}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-600 hover:text-white"
                >
                  {term}
                </button>
              ))}
            </div>
          ) : (
            !grokipediaSuggestionsLoading && (
              <p className="py-3 text-center text-xs text-neutral-600">{t("session.grokipediaNoSuggestions")}</p>
            )
          )}
        </div>
      </section>

      <section className="space-y-4 pt-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Grok</p>
          <p className="mt-1 text-xs text-neutral-500">Send a focused prompt to Grok in a new tab.</p>
        </div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            openGrok(grokQuery);
          }}
        >
          <input
            type="text"
            value={grokQuery}
            onChange={(event) => setGrokQuery(event.target.value)}
            placeholder="Ask Grok anything about this step..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!grokQuery.trim()}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-600"
          >
            Open Grok
          </button>
        </form>
      </section>
    </div>
  );
}