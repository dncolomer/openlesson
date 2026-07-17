"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/lib/i18n";

import { TOPIC_CATALOGUE as TOPIC_CATALOGUE_EN, type TopicCategory } from "@/lib/topics";
import { TOPIC_CATALOGUE as TOPIC_CATALOGUE_VI } from "@/lib/topics-vi";

const TOPIC_CATALOGUES: Record<string, TopicCategory[]> = {
  en: TOPIC_CATALOGUE_EN,
  vi: TOPIC_CATALOGUE_VI,
};

function getTopics(locale: string): TopicCategory[] {
  return TOPIC_CATALOGUES[locale] || TOPIC_CATALOGUES.en;
}

interface TopicBrowserProps {
  onSelectTopic: (topic: string) => void;
  fullWidth?: boolean;
  /**
   * Compact rendering: fewer topics per view (3 in "All", 6 in a
   * single-category filter) and a tighter 1-column grid. Used in the
   * right-hand split pane on the landing page.
   */
  compact?: boolean;
}

const ALL_LABEL = "All";
const SCROLL_AMOUNT = 200;

export function TopicBrowser({ onSelectTopic, fullWidth = false, compact = false }: TopicBrowserProps) {
  const { t, locale } = useI18n();
  const topicCatalogue = useMemo(() => {
    return getTopics(locale);
  }, [locale]);
  const [activeFilter, setActiveFilter] = useState(ALL_LABEL);
  const [visibleTopics, setVisibleTopics] = useState<
    { topic: string; category: string; emoji: string }[]
  >([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener("scroll", updateScrollState);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, visibleTopics]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  };

  const buildTopics = useCallback((filter: string) => {
    const pool: { topic: string; category: string; emoji: string }[] = [];
    for (const cat of topicCatalogue) {
      if (filter !== ALL_LABEL && cat.name !== filter) continue;
      for (const topicItem of cat.topics) {
        pool.push({ topic: topicItem, category: cat.name, emoji: cat.emoji });
      }
    }
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Compact mode shows fewer (3/6) so the picker stays small enough
    // to sit comfortably inside the right pane of the split hero.
    const allLimit = compact ? 3 : 12;
    const catLimit = compact ? 6 : 20;
    return pool.slice(0, filter === ALL_LABEL ? allLimit : catLimit);
  }, [compact]);

  useEffect(() => {
    setVisibleTopics(buildTopics(activeFilter));
  }, [activeFilter, buildTopics]);

  const handleReshuffle = () => {
    setVisibleTopics(buildTopics(activeFilter));
  };

  const handleFilterClick = (name: string) => {
    setActiveFilter(name);
    // Scroll filter into view
    scrollRef.current?.querySelector(`[data-filter="${name}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className={`w-full ${fullWidth ? "" : "max-w-5xl"} mx-auto`}>
      {/* Section header */}
      <div className={`flex items-center justify-between ${compact ? "mb-3" : "mb-5"}`}>
        <p className={`text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>
          {t('home.topicBrowserPrompt')}
        </p>
        <button
          onClick={handleReshuffle}
          className="text-xs text-slate-600 hover:text-white transition-colors inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-slate-800"
        >
          <ShuffleIcon />
          {t('home.topicBrowserShuffle')}
        </button>
      </div>

      {/* Category filter strip */}
      <div className={`flex items-center gap-2 ${compact ? "mb-3" : "mb-5"}`}>
        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
            canScrollLeft
              ? "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white hover:bg-slate-800"
              : "border-slate-800 text-slate-700 cursor-default"
          }`}
          aria-label={t('home.topicBrowserScrollLeft')}
        >
          <ChevronLeftIcon />
        </button>
        <div
          ref={scrollRef}
          className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth min-w-0"
        >
          <button
            data-filter={ALL_LABEL}
            onClick={() => handleFilterClick(ALL_LABEL)}
            className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeFilter === ALL_LABEL
                ? "bg-slate-200 text-slate-900 border-slate-200"
                : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white"
            }`}
          >
            {t('home.topicBrowserAll')}
          </button>
          {topicCatalogue.map((cat) => (
            <button
              key={cat.name}
              data-filter={cat.name}
              onClick={() => handleFilterClick(cat.name)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                activeFilter === cat.name
                  ? "bg-slate-200 text-slate-900 border-slate-200"
                  : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
            canScrollRight
              ? "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white hover:bg-slate-800"
              : "border-slate-800 text-slate-700 cursor-default"
          }`}
          aria-label={t('home.topicBrowserScrollRight')}
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Topic cards grid — compact mode uses a 1-column list with
          smaller padding so ~3 topics fit the right pane comfortably. */}
      <div
        className={
          compact
            ? "grid grid-cols-1 gap-2"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
        }
      >
        {visibleTopics.map(({ topic, category, emoji }) => (
          <button
            key={topic}
            onClick={() => onSelectTopic(topic)}
            className={`group text-left rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-200 ${
              compact ? "p-3" : "p-4"
            }`}
          >
            <p
              className={`text-slate-300 group-hover:text-white leading-snug ${
                compact ? "text-[12.5px] mb-1.5" : "text-[13px] mb-2.5"
              }`}
            >
              {topic}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{emoji}</span>
              <span className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors">
                {category}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShuffleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
