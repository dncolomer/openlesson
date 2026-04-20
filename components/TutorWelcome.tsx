"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { ListenButton } from "./ListenButton";

interface TutorWelcomeProps {
  /** Tutor display name (used for the avatar monogram & greeting). */
  tutorName: string;
  /** Fired when the user clicks the Play button. */
  onPlay: () => void;
  /** Fired when the user clicks the "Open Session Plan" button. */
  onOpenSessionPlan?: () => void;
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
  onPlay,
  onOpenSessionPlan,
  isStarting = false,
  instant = false,
  compactMobile = false,
  sessionId,
  ttsLanguage,
}: TutorWelcomeProps) {
  const { t } = useI18n();
  const avatarInitial = (tutorName || "Helios").charAt(0).toUpperCase();

  // Assembled from three i18n keys so translators can customize each line.
  // Mobile uses a different "panelIntro" line because there is no left/right
  // panel layout — tools and plan live on swipe tabs instead.
  const lines = [
    t("welcome.greeting", { name: tutorName }),
    t(compactMobile ? "welcome.panelIntroMobile" : "welcome.panelIntro"),
    t("welcome.callToAction"),
  ];
  const fullText = lines.join("\n\n");

  const [typingDone, setTypingDone] = useState(instant);
  // ~60 ms/char ≈ 16 chars/sec, close to natural speaking pace.
  const { displayed, skip } = useTypewriter(fullText, {
    instant,
    speedMs: 60,
    onDone: () => setTypingDone(true),
  });

  const playLabel = isStarting ? t("welcome.starting") : t("welcome.play");

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center">
        <div className="relative">
          <div
            className={`${
              compactMobile ? "w-24 h-24" : "w-28 h-28"
            } rounded-full bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden`}
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
        aria-label={typingDone ? undefined : t("welcome.skipTyping")}
        className="relative max-w-[52ch] cursor-text text-left focus:outline-none"
      >
        <p className="relative text-lg leading-relaxed tracking-tight text-neutral-200 whitespace-pre-line">
          {displayed}
          {!typingDone && (
            <span
              className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-0.5 bg-amber-400/80 animate-pulse"
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

      {/* Action buttons */}
      <div className="shrink-0 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!typingDone) skip();
            onPlay();
          }}
          disabled={isStarting}
          className={`${
            compactMobile ? "py-3.5 px-6" : "py-3 px-6"
          } text-sm font-semibold rounded-full bg-green-500 text-neutral-950 hover:bg-green-400 active:bg-green-400 disabled:opacity-70 disabled:cursor-wait transition-colors flex items-center gap-2 shadow-[0_0_32px_rgba(34,197,94,0.25)]`}
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

        {onOpenSessionPlan && (
          <button
            type="button"
            onClick={() => {
              if (!typingDone) skip();
              onOpenSessionPlan();
            }}
            className={`${
              compactMobile ? "py-3.5 px-5" : "py-3 px-5"
            } text-sm font-medium rounded-full bg-neutral-900 text-neutral-200 border border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white active:bg-neutral-800 transition-colors flex items-center gap-2`}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span>{t("welcome.openSessionPlan")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
