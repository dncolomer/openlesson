"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, translateWithLocale } from "@/lib/i18n";
import { emitHeliosVoicePlayback } from "@/lib/useHeliosVoicePlayback";

/**
 * Map the app's 6-locale i18n code to an xAI-supported BCP-47 code for TTS.
 * Falls back to "auto" if unrecognized.
 */
const XAI_LANG_MAP: Record<string, string> = {
  en: "en",
  zh: "zh",
  vi: "vi",
  de: "de",
  pl: "auto", // Polish not on xAI's explicit list — auto-detect
  es: "es-ES",
};

interface ListenButtonProps {
  /** Text to speak. If empty/whitespace the button no-ops. */
  text: string;
  /**
   * Optional BCP-47 language override (e.g. the session's tutoring
   * language). When omitted we map from the active i18n locale.
   */
  language?: string;
  /**
   * Stable identity for the spoken text. When this changes we invalidate
   * the cached audio and stop any in-flight playback (e.g. probe change).
   */
  cacheKey?: string;
  /**
   * Visual size. "sm" (default) for in-list buttons; "md" for the
   * welcome screen where it's more prominent.
   */
  size?: "sm" | "md";
  /** Extra classes for alignment tweaks in specific layouts. */
  className?: string;
}

/**
 * Small ghost button that narrates the given text using the xAI TTS
 * endpoint. Plays on tap (always a user gesture, so autoplay policies
 * never bite), toggles to "Stop" while speaking, and caches the audio
 * blob so repeated taps are instant.
 *
 * The component owns its own `<audio>` element and aborts/cleans up on
 * unmount and on `cacheKey` changes.
 */
export function ListenButton({
  text,
  language,
  cacheKey,
  size = "sm",
  className = "",
}: ListenButtonProps) {
  const { locale } = useI18n();
  // Button label follows the tutoring language (inferred from the
  // `language` prop when provided) rather than the UI chrome language,
  // so narration and label feel consistent.
  const labelLocale = language ?? locale;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceSourceIdRef = useRef(`listen-${Math.random().toString(36).slice(2, 10)}`);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const stop = () => {
    try {
      abortRef.current?.abort();
    } catch {
      /* ignore */
    }
    abortRef.current = null;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    setIsSpeaking(false);
    emitHeliosVoicePlayback(voiceSourceIdRef.current, false);
    setIsFetching(false);
  };

  const clearCache = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  // Invalidate cache + stop any in-flight playback when the target text
  // changes identity (cacheKey), e.g. the user navigates to a new probe.
  useEffect(() => {
    stop();
    clearCache();
  }, [cacheKey]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      stop();
      clearCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attach = (audio: HTMLAudioElement) => {
    const markPlaying = () => {
      setIsSpeaking(true);
      emitHeliosVoicePlayback(voiceSourceIdRef.current, true);
    };
    const markStopped = () => {
      setIsSpeaking(false);
      emitHeliosVoicePlayback(voiceSourceIdRef.current, false);
    };
    audio.addEventListener("playing", markPlaying);
    audio.addEventListener("ended", markStopped);
    audio.addEventListener("pause", markStopped);
    audio.addEventListener("error", markStopped);
  };

  const handleClick = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Toggle: if already speaking, stop.
    if (audioRef.current && !audioRef.current.paused) {
      stop();
      return;
    }

    // Cached path: instant replay of the same text.
    if (audioUrlRef.current) {
      const audio = new Audio(audioUrlRef.current);
      audioRef.current = audio;
      attach(audio);
      try {
        await audio.play();
      } catch {
        setIsSpeaking(false);
      }
      return;
    }

    // Cold path: fetch from xAI.
    setIsFetching(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const lang = language ?? XAI_LANG_MAP[locale] ?? "auto";
      const res = await fetch("/api/xai-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language: lang }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      attach(audio);
      try {
        await audio.play();
      } catch {
        setIsSpeaking(false);
      }
    } catch {
      /* abort or network failure — silent */
    } finally {
      setIsFetching(false);
    }
  };

  const sizeClasses =
    size === "md"
      ? "px-3 py-1.5 text-xs gap-2"
      : "px-2.5 py-1 text-[11px] gap-1.5";
  const iconSize = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

  const label = isSpeaking
    ? translateWithLocale(labelLocale, "welcome.stopNarration")
    : translateWithLocale(labelLocale, "welcome.listenToTutor");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isFetching || !text.trim()}
      className={`shrink-0 inline-flex items-center font-medium text-neutral-500 hover:text-neutral-200 disabled:opacity-60 disabled:cursor-wait transition-colors ${sizeClasses} ${className}`}
      aria-label={label}
      title={label}
    >
      {isFetching ? (
        <svg
          className={`${iconSize} animate-spin shrink-0`}
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : isSpeaking ? (
        <svg
          className={`${iconSize} shrink-0`}
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        </svg>
      ) : (
        <svg
          className={`${iconSize} shrink-0`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
