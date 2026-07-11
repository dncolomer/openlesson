"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveInsight, formatInsightDate, insightShareUrl, type InsightSummary } from "@/lib/insights";

type InsightRecord = InsightSummary & {
  source_thoughts?: Array<{ id?: string; text: string }>;
};

export function InsightDetailClient({ insightId }: { insightId: string }) {
  const router = useRouter();
  const [insight, setInsight] = useState<InsightRecord | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    void fetch(`/api/insights/${insightId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load insight");
        setInsight(data.insight);
        setIsOwner(Boolean(data.isOwner));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load insight"));
  }, [insightId]);

  const handleCopyLink = async () => {
    if (!insight) return;
    const url = insightShareUrl(insight);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleArchive = async () => {
    if (!insight || archiving) return;
    if (!confirm("Archive this insight? It will be removed from your lists and share links will stop working.")) {
      return;
    }
    setArchiving(true);
    try {
      await archiveInsight(insight.id);
      router.push("/dashboard?tab=insights");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive insight");
      setArchiving(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-neutral-400">
        {error}
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-neutral-500">
        Loading insight…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      {insight.aesthetic_image ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${insight.aesthetic_image})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.18),transparent_42%),linear-gradient(180deg,#111,#050505)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/60 to-black/95" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Insight</p>
            <p className="mt-1 text-xs text-neutral-500">{formatInsightDate(insight.created_at)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="rounded-md border border-neutral-700 bg-black/40 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-neutral-500 hover:text-white"
            >
              {copied ? "Link copied" : "Copy share link"}
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiving}
                className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-200 transition hover:border-amber-600 disabled:opacity-50"
              >
                {archiving ? "Archiving…" : "Archive"}
              </button>
            ) : null}
            {insight.workspace_id ? (
              <Link
                href={`/workspace/${insight.workspace_id}`}
                className="rounded-md border border-neutral-700 bg-black/40 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                Back to workspace
              </Link>
            ) : null}
          </div>
        </div>

        {insight.aesthetic_image ? (
          <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
            <img src={insight.aesthetic_image} alt="" className="h-56 w-full object-cover md:h-72" />
          </div>
        ) : null}

        <h1 className="text-4xl font-medium tracking-tight md:text-5xl">{insight.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-200">{insight.summary}</p>

        {Array.isArray(insight.source_thoughts) && insight.source_thoughts.length > 0 ? (
          <div className="mt-10 rounded-2xl border border-neutral-800/80 bg-black/40 p-5 backdrop-blur-sm">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Source thoughts</p>
            <ul className="space-y-3 text-sm leading-relaxed text-neutral-400">
              {insight.source_thoughts.map((thought, index) => (
                <li key={thought.id || index} className="border-l border-neutral-700 pl-3">
                  {thought.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}