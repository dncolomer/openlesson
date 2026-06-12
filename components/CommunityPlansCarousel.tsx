"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface CommunityPlan {
  id: string;
  root_topic: string;
  title?: string | null;
  cover_image_url?: string | null;
  author_username: string;
  remix_count: number;
  created_at: string;
}

const AUTOPLAY_MS = 3000;

interface CommunityPlansCarouselProps {
  /**
   * When true, the carousel fills the height of its parent column (used
   * for the side-by-side hero layout on the landing page). When false,
   * renders as a fixed-aspect full-width banner (original behavior).
   */
  fillHeight?: boolean;
}

/**
 * Hero-banner carousel of **public** workspaces from other users.
 * Each slide is a cinematic card with a cover image, gentle Ken-Burns
 * zoom, title, author, and a CTA chip. Autoplays every 3s and pauses on
 * hover/focus. Skips gracefully when the API returns zero eligible
 * (cover-image-having) plans.
 */
export function CommunityPlansCarousel({ fillHeight = false }: CommunityPlansCarouselProps) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<CommunityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Load plans once on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/learning-plans/community?withCover=1&limit=20");
        if (!res.ok) return;
        const json = (await res.json()) as { plans?: CommunityPlan[] };
        if (!cancelled && Array.isArray(json.plans)) {
          setPlans(json.plans);
        }
      } catch {
        /* quietly hide the strip on error */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Autoplay with pause-on-hover. `paused` also flips when the tab is
  // hidden so we don't waste frames in the background.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (paused || plans.length < 2) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % plans.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [paused, plans.length]);

  // Pause while the page is hidden to avoid driving transitions no one sees.
  useEffect(() => {
    const handler = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  if (loading || plans.length === 0) return null;

  const go = (delta: number) => {
    setIndex((i) => (i + delta + plans.length) % plans.length);
  };
  const jump = (to: number) => {
    setIndex(((to % plans.length) + plans.length) % plans.length);
  };

  return (
    <section
      aria-label={t("home.communityPlans")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={fillHeight ? "w-full h-full flex flex-col min-w-0" : "w-full max-w-6xl mx-auto px-4 sm:px-6"}
    >
      {/* Banner frame — fills available height when side-by-side, otherwise
          uses a cinematic 16:7/16:6 aspect ratio. */}
      <div
        className={
          fillHeight
            ? "relative w-full flex-1 min-h-[360px] overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
            : "relative w-full aspect-[16/7] sm:aspect-[16/6] overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
        }
      >
        {/* Slide layers — absolutely stacked, cross-fade via opacity */}
        {plans.map((plan, i) => {
          const active = i === index;
          return (
            <Link
              key={plan.id}
              href={`/workspace/${plan.id}`}
              tabIndex={active ? 0 : -1}
              aria-hidden={!active}
              className={`absolute inset-0 block transition-opacity duration-700 ease-out ${
                active ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Cover image with slow Ken-Burns drift when active */}
              {plan.cover_image_url && (
                <img
                  src={plan.cover_image_url}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover object-center scale-[1.15] ${
                    active ? "animate-[herozoom_12s_ease-out_forwards]" : ""
                  }`}
                />
              )}
              {/* Readability gradient — strong bottom-left to transparent top-right */}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70 mb-2">
                  @{plan.author_username}
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight drop-shadow-lg max-w-[28ch] line-clamp-2">
                  {plan.title || plan.root_topic}
                </h2>
                <div className="mt-4 flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-sm font-medium text-white transition-colors group-hover:bg-white/20">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    {t("home.exploreThisPlan")}
                  </span>
                  {plan.remix_count > 0 && (
                    <span className="text-xs text-white/60">
                      {plan.remix_count} {t("home.remixes")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {/* Nav arrows — only if more than one slide */}
        {plans.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("home.topicBrowserScrollLeft")}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("home.topicBrowserScrollRight")}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Dots + progress bar */}
            <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5">
              {plans.slice(0, Math.min(plans.length, 8)).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jump(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index % Math.min(plans.length, 8)
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
              {plans.length > 8 && (
                <span className="ml-1 font-mono text-[10px] text-white/60 tabular-nums">
                  {String(index + 1).padStart(2, "0")}/{String(plans.length).padStart(2, "0")}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
