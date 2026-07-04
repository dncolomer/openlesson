"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface InsightRecord {
  id: string;
  title: string;
  summary: string;
  aesthetic_image?: string | null;
  plan_id?: string | null;
  share_token?: string | null;
  source_thoughts?: Array<{ text: string }>;
  created_at: string;
}

export function InsightDetailClient({ insightId }: { insightId: string }) {
  const [insight, setInsight] = useState<InsightRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/insights/${insightId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load insight");
        setInsight(data.insight);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load insight"));
  }, [insightId]);

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
      {insight.aesthetic_image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${insight.aesthetic_image})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-black/90" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Insight</p>
          {insight.plan_id && (
            <Link href={`/workspace/${insight.plan_id}`} className="text-xs text-neutral-400 hover:text-white">
              Back to workspace
            </Link>
          )}
        </div>
        <h1 className="text-4xl font-medium tracking-tight md:text-5xl">{insight.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-200">{insight.summary}</p>
        {Array.isArray(insight.source_thoughts) && insight.source_thoughts.length > 0 && (
          <div className="mt-10 rounded-2xl border border-neutral-800/80 bg-black/40 p-5 backdrop-blur-sm">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Source thoughts</p>
            <ul className="space-y-3 text-sm leading-relaxed text-neutral-400">
              {insight.source_thoughts.map((thought, index) => (
                <li key={index} className="border-l border-neutral-700 pl-3">
                  {thought.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}