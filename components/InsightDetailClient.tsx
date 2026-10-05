"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import {
  archiveInsight,
  insightApiErrorMessage,
  insightPublicPath,
  insightShareUrl,
  workspaceKnowledgeInsightsPath,
  type InsightSummary,
} from "@/lib/insights";
import {
  INSIGHT_HERO_NOTE_BODY,
  INSIGHT_HERO_NOTE_TITLE,
  INSIGHT_PAGE_BLUEPRINT,
  INSIGHT_PAGE_LIGHT_CONE,
  deriveInsightPageStats,
  insightPageFieldImage,
} from "@/lib/insight-share";

type InsightRecord = InsightSummary & {
  thought_ids?: unknown;
  workspace_title?: string | null;
};

export function InsightDetailClient({ insightId }: { insightId: string }) {
  const router = useRouter();
  const [insight, setInsight] = useState<InsightRecord | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    void fetch(`/api/insights/${insightId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(insightApiErrorMessage(data, "Failed to load insight"));
        setInsight(data.insight);
        setIsOwner(Boolean(data.isOwner));
        setIsAuthenticated(Boolean(data.isAuthenticated));
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
      if (insight.workspace_id) {
        router.push(workspaceKnowledgeInsightsPath(insight.workspace_id));
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive insight");
      setArchiving(false);
    }
  };

  if (error) {
    return (
      <InsightPageField>
        <div className="flex min-h-screen items-center justify-center text-neutral-400">{error}</div>
      </InsightPageField>
    );
  }

  if (!insight) {
    return (
      <InsightPageField>
        <div className="flex min-h-screen items-center justify-center">
          <LoadingStatusMessage message="Loading insight" />
        </div>
      </InsightPageField>
    );
  }

  const stats = deriveInsightPageStats(insight);

  return (
    <InsightPageField seed={insight.id}>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Insight</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="rounded-none border border-white/40 bg-black/70 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-white hover:text-white"
            >
              {copied ? "Link copied" : "Copy share link"}
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiving}
                className="rounded-none border border-white/25 bg-black/70 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-white/70 disabled:opacity-50"
              >
                {archiving ? "Archiving…" : "Archive"}
              </button>
            ) : null}
            {isAuthenticated === false ? (
              <Link
                href={`/pricing?redirect=${encodeURIComponent(insightPublicPath(insight))}`}
                className="rounded-none border border-white bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-zinc-200"
              >
                Sign up
              </Link>
            ) : isAuthenticated === true && insight.workspace_id ? (
              <Link
                href={`/workspace/${insight.workspace_id}`}
                className="rounded-none border border-white/40 bg-black/70 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-white hover:text-white"
              >
                Workspace
              </Link>
            ) : null}
          </div>
        </div>

        <div
          data-insight-hero
          className="relative mb-8 overflow-hidden rounded-none border border-white/40 shadow-2xl shadow-black/50"
        >
          <img
            src={INSIGHT_PAGE_LIGHT_CONE}
            alt=""
            className="block w-full"
          />
          <img
            src={INSIGHT_PAGE_BLUEPRINT}
            alt=""
            className="block w-full border-t border-white/40"
          />
          <div
            data-insight-hero-note
            className="border-t border-neutral-200 bg-white px-4 py-3 text-neutral-950 sm:px-5 sm:py-3.5"
          >
            <p className="text-sm font-semibold leading-snug text-neutral-950">
              {INSIGHT_HERO_NOTE_TITLE}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
              {INSIGHT_HERO_NOTE_BODY}
            </p>
          </div>
        </div>

        <h1 className="text-4xl font-medium tracking-tight md:text-5xl">{insight.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-200">{insight.summary}</p>

        <div
          data-insight-page-stats
          className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div
            data-insight-stat="pow"
            className="rounded-none border border-white/40 bg-black/75 px-4 py-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Proof of Work
            </p>
            <p className="mt-2 text-lg font-medium text-white">{stats.powLabel}</p>
          </div>
          <div
            data-insight-stat="time"
            className="rounded-none border border-white/40 bg-black/75 px-4 py-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Time
            </p>
            <p className="mt-2 text-lg font-medium text-white">{stats.timeLabel}</p>
          </div>
          <div
            data-insight-stat="workspace"
            className="rounded-none border border-white/40 bg-black/75 px-4 py-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Workspace
            </p>
            <p className="mt-2 text-lg font-medium text-white">{stats.workspaceName}</p>
          </div>
        </div>

        <Link
          href={stats.homeHref}
          data-insight-home-link
          className="mt-8 inline-flex w-fit text-sm text-neutral-400 underline decoration-neutral-700 underline-offset-4 transition hover:text-white hover:decoration-white"
        >
          {stats.homeLabel}
        </Link>
      </div>
    </InsightPageField>
  );
}

function InsightPageField({
  seed,
  children,
}: {
  seed?: string | null;
  children: ReactNode;
}) {
  const field = insightPageFieldImage(seed);
  return (
    <div
      data-insight-page
      className="relative min-h-screen overflow-hidden border border-white/40 bg-black text-white"
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        data-insight-page-field
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${field})` }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <PublicConsoleWash />
      {children}
    </div>
  );
}