"use client";

/**
 * Shared TAP briefing config column (workspace label, duration, language).
 * Used by conversational TapScoreClient and ExerciseTapClient intro screens.
 */
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
   * Optional kicker above the title (e.g. "Exercise TAP").
   * Default omits kicker for conversational TAP.
   */
  kicker,
  /**
   * When set, replaces the default conversational briefing intro paragraph.
   */
  intro,
}: {
  workspaceTitle: string;
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  conversationLanguage: SpokenLocale;
  onConversationLanguageChange: (locale: SpokenLocale) => void;
  showDurationPicker: boolean;
  disabled?: boolean;
  kicker?: string;
  intro?: string;
}) {
  const { t } = useI18n();

  return (
    <div
      data-tap-briefing-config
      className="flex min-h-0 flex-1 flex-col justify-center gap-8 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10"
    >
      <div>
        {kicker ? (
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-300/80">{kicker}</p>
        ) : null}
        <p
          className={`font-mono text-[10px] uppercase tracking-[2px] text-neutral-500 ${kicker ? "mt-1" : ""}`}
        >
          {workspaceTitle}
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-neutral-100 sm:text-3xl">
          {THINK_ALOUD_PROTOCOL_LABEL}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          {intro ?? t("tap.briefing.intro")}
        </p>
      </div>

      {showDurationPicker ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">
            {t("tap.briefing.sessionLength")}
          </p>
          <div className="mt-2 grid max-w-sm grid-cols-3 gap-1.5 sm:grid-cols-4">
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
        <div className="mt-2 grid max-w-xs grid-cols-3 gap-2">
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
    </div>
  );
}
