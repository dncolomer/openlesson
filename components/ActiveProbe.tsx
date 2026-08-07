"use client";

import { useState, useEffect, useRef } from "react";
import type { Probe } from "@/lib/storage";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useI18n } from "../lib/i18n";

interface ActiveProbeProps {
  probe: Probe | null;
  problem: string;
  isLoading?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrevProbe?: () => void;
  onNextProbe?: () => void;
  probePosition?: string;
  onToggleStar?: (probeId: string, starred: boolean) => void;
}

function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ActiveProbe({
  probe,
  problem,
  isLoading = false,
  hasPrev = false,
  hasNext = false,
  onPrevProbe,
  onNextProbe,
  probePosition,
  onToggleStar,
}: ActiveProbeProps) {
  const { t } = useI18n();
  const [animateIn, setAnimateIn] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);
  const prevProbeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (probe) {
      const isNewProbe = prevProbeIdRef.current !== null && prevProbeIdRef.current !== probe.id;
      prevProbeIdRef.current = probe.id;

      setAnimateIn(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });

      if (isNewProbe) {
        setFlashPulse(true);
        const timer = setTimeout(() => setFlashPulse(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [probe?.id]);

  if (isLoading) {
    return (
      <div className="w-full h-full">
        <div className="bg-neutral-900/80 border border-neutral-700/50 rounded-2xl p-6 h-full flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-800/20 flex items-center justify-center">
            <ThinkingDots />
          </div>
          <p className="text-neutral-400 text-sm italic">
            {t('probes.formulatingQuestion')}
          </p>
        </div>
      </div>
    );
  }

  if (!probe) {
    return (
      <div className="w-full h-full">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-6 h-full flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
            <ListenIcon />
          </div>
          <p className="text-neutral-500 text-sm">
            {t('probes.listening')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {flashPulse && (
        <div className="absolute inset-0 rounded-2xl bg-neutral-800/20 animate-probe-flash pointer-events-none z-10" />
      )}
      <div
        className={`bg-neutral-900 border rounded-2xl p-4 sm:p-5 h-full flex flex-col transition-all duration-500 ${
          animateIn
            ? flashPulse
              ? "opacity-100 translate-y-0 border-neutral-500/60 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.01]"
              : "opacity-100 translate-y-0 border-neutral-600/30 shadow-lg shadow-neutral-900/5"
            : "opacity-0 translate-y-4 border-neutral-700/50"
        }`}
        style={{ transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <div className="mb-3 pb-3 border-b border-neutral-800/60">
          <p className="text-[11px] sm:text-xs text-neutral-300/80 font-medium truncate" title={problem}>
            {problem}
          </p>
        </div>

        {flashPulse && (
          <div className="flex items-center gap-2 mb-3 animate-probe-badge">
            <div className="w-2 h-2 rounded-full bg-neutral-200 animate-ping" />
            <span className="text-[11px] font-medium text-neutral-300 uppercase tracking-wider">{t('activeProbe.newQuestion')}</span>
          </div>
        )}
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-700 ${
            flashPulse ? "bg-neutral-800/40 scale-110" : "bg-neutral-800/20"
          }`}>
            <QuestionIcon />
          </div>
          <div className="flex-1 min-w-0">
            <MarkdownContent content={probe.text} className="text-white text-base sm:text-lg leading-relaxed break-words" />

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar?.(probe.id, !probe.starred);
                }}
                className={`p-2 sm:p-1.5 rounded-md transition-all ${
                  probe.starred
                    ? "text-neutral-300 hover:text-neutral-300"
                    : "text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800"
                }`}
                title={probe.starred ? t('probes.unstarQuestion') : t('probes.starQuestion')}
              >
                <StarIcon filled={!!probe.starred} />
              </button>

              {(hasPrev || hasNext) && (
                <div className="flex items-center gap-0.5 rounded-lg border border-neutral-600/60 bg-neutral-800/60 px-1.5 py-1">
                  <button
                    onClick={onPrevProbe}
                    disabled={!hasPrev}
                    className={`p-1 rounded transition-all disabled:opacity-25 disabled:cursor-default ${
                      hasPrev ? "text-neutral-200 hover:text-white hover:bg-neutral-700" : "text-neutral-600"
                    }`}
                    title={t('probes.previousQuestion')}
                  >
                    <ChevronLeftIcon />
                  </button>
                  {probePosition && (
                    <span className="text-xs font-medium text-neutral-200 tabular-nums min-w-[2.5rem] text-center">
                      {probePosition}
                    </span>
                  )}
                  <button
                    onClick={onNextProbe}
                    disabled={!hasNext}
                    className={`p-1 rounded transition-all disabled:opacity-25 disabled:cursor-default ${
                      hasNext ? "text-neutral-200 hover:text-white hover:bg-neutral-700" : "text-neutral-600"
                    }`}
                    title={t('probes.nextQuestion')}
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              )}

              <span className="text-xs text-neutral-600">
                {t('activeProbe.gap')} {Math.round(probe.gapScore * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1">
      <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-1.5 h-1.5 rounded-full bg-neutral-200 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function QuestionIcon() {
  return (
    <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ListenIcon() {
  return (
    <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
