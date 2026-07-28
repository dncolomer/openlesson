"use client";

/**
 * Shared TAP briefing config column (workspace label, duration, language, shortcuts).
 * Used by conversational TapScoreClient and ExerciseTapClient intro screens.
 */
import { useI18n } from "@/lib/i18n";
import {
  ThoughtButton,
  ThoughtShortcutChord,
} from "@/components/thought-ui/ThoughtUi";
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
  /**
   * When set, replaces default keyboard shortcut rows (Exercise may omit Helios-send).
   */
  shortcutRows,
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
  shortcutRows?: { keys: string[]; label: string }[];
}) {
  const { t } = useI18n();

  const rows: { keys: string[]; label: string }[] = shortcutRows ?? [
    { keys: ["Enter"], label: t("tap.briefing.shortcutSend") },
    { keys: ["Del"], label: t("tap.briefing.shortcutStash") },
    { keys: ["E"], label: t("tap.briefing.shortcutEdit") },
    { keys: ["1", "2", "3"], label: t("tap.briefing.shortcutSendStashed") },
    { keys: ["5s"], label: t("tap.briefing.shortcutSilence") },
  ];

  return (
    <div
      data-tap-briefing-config
      className="flex min-h-0 flex-1 flex-col justify-center gap-8 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10"
    >
      <div>
        {kicker ? (
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-amber-200/80">{kicker}</p>
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
          <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
            {DURATIONS.map((duration) => (
              <ThoughtButton
                key={duration}
                size="lg"
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

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">
          {t("tap.briefing.keyboardShortcuts")}
        </p>
        <ul className="mt-3 space-y-2.5 text-sm text-neutral-400">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-wrap items-center gap-2">
              <ThoughtShortcutChord keys={row.keys} />
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
