"use client";

import { useState } from "react";
import { useI18n, translateWithLocale } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { ListenButton } from "./ListenButton";

type TutorWelcomeVariant = "ile" | "tap";

interface TutorWelcomeProps {
  /** Tutor display name (used for the avatar monogram & greeting). */
  tutorName: string;
  /** ILE block welcome vs TAP demonstration welcome copy. */
  variant?: TutorWelcomeVariant;
  /** Fired when the user clicks the Play button. */
  onPlay: () => void;
  /** When true, shows a spinner on the Play button (probe fetch in-flight). */
  isStarting?: boolean;
  /**
   * When true, render the welcome text fully-revealed instantly (used after
   * refresh/revisit). Typing animation is skipped.
   */
  instant?: boolean;
  /**
   * Touch-mode tweaks (slightly bigger buttons, `active:` instead of `hover:`).
   * Defaults to false (desktop).
   */
  compactMobile?: boolean;
  /**
   * Session id. When present, enables the "Listen to tutor" TTS button.
   */
  sessionId?: string;
  /** BCP-47 language code for TTS. Defaults to the active i18n locale. */
  ttsLanguage?: string;
}

/**
 * Fresh-session onboarding shown inside the tutor panel before the first
 * probe is fetched. The tutor's greeting types itself out character-by-
 * character. A "Listen to tutor" button lets the user hear the greeting
 * narrated via xAI TTS (opt-in, never autoplays). Clicking "Start session"
 * fires `onPlay` which the parent wires to fetch the opening probe.
 */
export function TutorWelcome({
  tutorName,
  variant = "ile",
  onPlay,
  isStarting = false,
  instant = false,
  compactMobile = false,
  sessionId,
  ttsLanguage,
}: TutorWelcomeProps) {
  const { locale: uiLocale } = useI18n();
  const avatarInitial = (tutorName || "unsys").charAt(0).toUpperCase();
  const keyPrefix = variant === "tap" ? "tap.welcome" : "welcome";

  // The welcome surface (typed greeting + button labels) follows the
  // *tutoring* language — the language the tutor will actually speak to
  // the user — rather than the UI chrome language. Falls back to UI
  // locale, then English, via translateWithLocale.
  const lang = ttsLanguage ?? uiLocale;
  const tt = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(lang, key, params);

  // Assembled from three i18n keys so translators can customize each line.
  // Mobile uses a different "panelIntro" line because there is no left/right
  // panel layout — tools and plan live on swipe tabs instead.
  const lines = [
    tt(`${keyPrefix}.greeting`, { name: tutorName }),
    tt(
      variant === "tap"
        ? `${keyPrefix}.panelIntro`
        : compactMobile
          ? `${keyPrefix}.panelIntroMobile`
          : `${keyPrefix}.panelIntro`,
    ),
    tt(`${keyPrefix}.callToAction`),
  ];
  const fullText = lines.join("\n\n");

  const [typingDone, setTypingDone] = useState(instant);
  // ~60 ms/char ≈ 16 chars/sec, close to natural speaking pace.
  const { displayed, skip } = useTypewriter(fullText, {
    instant,
    speedMs: 60,
    onDone: () => setTypingDone(true),
  });

  const playLabel = isStarting ? tt(`${keyPrefix}.starting`) : tt(`${keyPrefix}.play`);

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center">
        <div className="relative">
          <div
            className={`${
              compactMobile ? "w-24 h-24" : "w-28 h-28"
            } rounded-full bg-gradient-to-br from-neutral-800/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden`}
          >
            <span
              className={`${
                compactMobile ? "text-2xl" : "text-3xl"
              } font-serif text-neutral-200`}
            >
              {avatarInitial}
            </span>
          </div>
          <div className="absolute inset-0 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.08)] pointer-events-none" />
        </div>
        <div className="mt-2">
          <span className="text-sm font-medium text-neutral-200">
            {tutorName}
          </span>
        </div>
      </div>

      {/* Typed welcome text. Clicking anywhere on the text skips the typing. */}
      <button
        type="button"
        onClick={() => {
          if (!typingDone) skip();
        }}
        aria-label={typingDone ? undefined : tt(`${keyPrefix}.skipTyping`)}
        className="relative w-full max-w-[78ch] cursor-text text-left focus:outline-none px-2"
      >
        <p className="relative text-lg leading-[1.75] tracking-tight text-neutral-200 whitespace-pre-line md:text-xl">
          {displayed}
          {!typingDone && (
            <span
              className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-0.5 bg-neutral-800/80 animate-pulse"
              aria-hidden="true"
            />
          )}
        </p>
      </button>

      {/* "Listen to tutor" — optional TTS narration. User gesture required,
          so there's no autoplay gate; button simply fetches + plays. */}
      {sessionId && (
        <ListenButton
          text={fullText}
          language={ttsLanguage}
          cacheKey={`welcome:${sessionId}`}
          size="md"
          className="-mt-2"
        />
      )}

      {/* Primary start CTA. */}
      <div className="shrink-0 flex flex-wrap items-stretch justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!typingDone) skip();
            onPlay();
          }}
          disabled={isStarting}
          className={`${
            compactMobile ? "py-3.5 px-6" : "py-3 px-6"
          } w-[210px] text-sm font-semibold rounded-full bg-green-500 text-neutral-950 hover:bg-green-400 active:bg-green-400 disabled:opacity-70 disabled:cursor-wait transition-colors flex items-center justify-center gap-2 shadow-[0_0_32px_rgba(34,197,94,0.28)]`}
        >
          {isStarting ? (
            <svg
              className="w-4 h-4 animate-spin shrink-0"
              fill="none"
              viewBox="0 0 24 24"
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
          ) : (
            <svg
              className="w-4 h-4 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          <span>{playLabel}</span>
        </button>
      </div>
    </div>
  );
}
