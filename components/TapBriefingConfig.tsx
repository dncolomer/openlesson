"use client";

/**
 * Shared TAP briefing config column (workspace label, duration, language).
 * Used by conversational TapScoreClient and ExerciseTapClient intro screens.
 */
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { ThoughtButton } from "@/components/thought-ui/ThoughtUi";
import {
  spokenLanguageNames,
  spokenLocales,
  type SpokenLocale,
} from "@/lib/tutoring-languages";
import { DURATIONS, THINK_ALOUD_PROTOCOL_LABEL } from "@/lib/tap-score-client-helpers";

export function TapBriefingConfig({
  workspaceTitle,
  minutes,
  onMinutesChange,
  conversationLanguage,
  onConversationLanguageChange,
  showDurationPicker,
  disabled,
  /**
   * Optional kicker above the title (e.g. "Verify").
   * Default omits kicker for conversational Verify.
   */
  kicker,
  /**
   * When set, replaces the default conversational briefing intro paragraph.
   */
  intro,
  /**
   * When set, replaces the default "Think Aloud Protocol" heading.
   */
  title,
  /**
   * Learn settings sit in a wide column. Spread the language buttons across it.
   * Other modes keep the compact three-column cluster.
   */
  wideLanguage = false,
  /**
   * fill: center the block in the column (Learn, Calibrate).
   * stack: sit at the top when another block (topics) follows.
   */
  layout = "fill",
  children,
}: {
  workspaceTitle?: string;
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  conversationLanguage: SpokenLocale;
  onConversationLanguageChange: (locale: SpokenLocale) => void;
  showDurationPicker: boolean;
  disabled?: boolean;
  kicker?: string;
  intro?: string;
  title?: string;
  wideLanguage?: boolean;
  layout?: "fill" | "stack";
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const heading = (title || THINK_ALOUD_PROTOCOL_LABEL).trim();
  const workspaceLabel = (workspaceTitle ?? "").trim();
  const kickerLabel = (kicker ?? "").trim();
  const showKicker =
    kickerLabel.length > 0 && kickerLabel.toLowerCase() !== heading.toLowerCase();
  const showWorkspace =
    workspaceLabel.length > 0 && workspaceLabel.toLowerCase() !== heading.toLowerCase();

  return (
    <div
      data-tap-briefing-config
      data-tap-briefing-layout={layout}
      className={
        layout === "stack"
          ? "flex shrink-0 flex-col justify-start px-5 pt-8 pb-4 sm:px-8 lg:px-10"
          : "flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-8 sm:px-8 lg:px-10"
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <div>
          {showKicker ? (
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-300/80">
              {kickerLabel}
            </p>
          ) : null}
          {showWorkspace ? (
            <p
              className={`font-mono text-[10px] uppercase tracking-[2px] text-neutral-500 ${showKicker ? "mt-1" : ""}`}
            >
              {workspaceLabel}
            </p>
          ) : null}
          <h2
            className={`text-2xl font-medium tracking-tight text-balance text-neutral-100 sm:text-3xl ${
              showKicker || showWorkspace ? "mt-2" : ""
            }`}
          >
            {heading}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-neutral-400">
            {intro ?? t("tap.briefing.intro")}
          </p>
        </div>

        {showDurationPicker ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">
              {t("tap.briefing.sessionLength")}
            </p>
            <div className="mt-2 grid w-full grid-cols-3 gap-1.5 sm:grid-cols-4">
              {DURATIONS.map((duration) => (
                <ThoughtButton
                  key={duration}
                  size="md"
                  variant={minutes === duration ? "toggleOn" : "toggleOff"}
                  className="w-full"
                  disabled={disabled}
                  onClick={() => onMinutesChange(duration)}
                >
                  {t("tap.briefing.minutes", { minutes: duration })}
                </ThoughtButton>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">
            {t("tap.briefing.conversationLanguage")}
          </p>
          <div
            data-tap-conversation-language
            className={
              wideLanguage
                ? "mt-2 grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
                : "mt-2 grid grid-cols-3 gap-2"
            }
          >
            {spokenLocales.map((locale) => (
              <ThoughtButton
                key={locale}
                size="lg"
                variant={conversationLanguage === locale ? "toggleOn" : "toggleOff"}
                className="w-full"
                disabled={disabled}
                onClick={() => onConversationLanguageChange(locale)}
              >
                {spokenLanguageNames[locale]}
              </ThoughtButton>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
