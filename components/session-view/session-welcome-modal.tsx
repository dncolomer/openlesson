"use client";

import { AestheticPicker } from "@/components/AestheticPicker";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS } from "@/components/ui/console-frame";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { IleStartLoading } from "@/components/session-view/ile-start-loading";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { isIleConfirmSettingsBlocked } from "@/components/session-view/ile-confirm-settings";
import type { SessionWelcomeModalProps } from "@/components/session-view/types";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import {
  ILE_SESSION_CHAPTER_COUNT_DEFAULT,
  ILE_SESSION_CHAPTER_COUNT_MAX,
  ILE_SESSION_CHAPTER_COUNT_MIN,
  capIleSessionChapters,
} from "@/lib/ile-canvas-session";
import { ileWelcomeShowsContinuePreview } from "@/lib/ile-welcome-chapters";
import {
  ILE_LEARN_PRESETS,
  applyIleLearnPreset,
  ileLearnMatchingPresetId,
} from "@/lib/ile-pregame-settings";
import {
  ILE_POW_EXPENSE_DEFAULT,
  ILE_POW_EXPENSE_MAX,
  ILE_POW_EXPENSE_MIN,
  clampIlePowExpense,
} from "@/lib/ile-pow-spend";
import {
  ILE_MIN_INSIGHTS_PER_CHAPTER_CEILING,
  ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  ILE_MIN_INSIGHTS_PER_CHAPTER_MIN,
} from "@/lib/ile-turn-insights";
import {
  ILE_SILENCE_LOCK_MINUTES_DEFAULT,
  ILE_SILENCE_LOCK_MINUTES_DESC,
  ILE_SILENCE_LOCK_MINUTES_LABEL,
  ILE_SILENCE_LOCK_MINUTES_MAX,
  ILE_SILENCE_LOCK_MINUTES_MIN,
  clampIleSilenceLockMinutes,
} from "@/lib/practice-voice-challenge";
import { DEFAULT_DURATION_MINUTES } from "@/lib/tap-score-client-helpers";
import { coerceSpokenLocale } from "@/lib/tutoring-languages";

export function SessionWelcomeModal({
  t,
  languageConfirmed,
  planLoading: _planLoading,
  isPreparing,
  tutoringLanguage,
  onTutoringLanguageChange,
  aestheticPackages,
  selectedAesthetic,
  selectedAestheticId,
  onSelectAesthetic,
  aestheticsLoading,
  chapterPlanStatus,
  regenerateChapters: _regenerateChapters,
  onRegenerateChaptersChange: _onRegenerateChaptersChange,
  initialChapters: _initialChapters,
  onInitialChaptersChange: _onInitialChaptersChange,
  chapterCount = ILE_SESSION_CHAPTER_COUNT_DEFAULT,
  onChapterCountChange,
  mapTypeCatalog: _mapTypeCatalog,
  powExpense = ILE_POW_EXPENSE_DEFAULT,
  onPowExpenseChange,
  insightSlotMax: _insightSlotMax,
  onInsightSlotMaxChange: _onInsightSlotMaxChange,
  gatherMaxPerSession: _gatherMaxPerSession,
  onGatherMaxPerSessionChange: _onGatherMaxPerSessionChange,
  allowThoughtsPoolInsights: _allowThoughtsPoolInsights,
  onAllowThoughtsPoolInsightsChange: _onAllowThoughtsPoolInsightsChange,
  allowParallelWork: _allowParallelWork,
  onAllowParallelWorkChange: _onAllowParallelWorkChange,
  allowGatherResources: _allowGatherResources,
  onAllowGatherResourcesChange: _onAllowGatherResourcesChange,
  minInsightsPerChapter = ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  onMinInsightsPerChapterChange,
  canvasTimerSeconds: _canvasTimerSeconds,
  onCanvasTimerSecondsChange: _onCanvasTimerSecondsChange,
  silenceLockMinutes = ILE_SILENCE_LOCK_MINUTES_DEFAULT,
  onSilenceLockMinutesChange,
  autoAdvance,
  onToggleAutoAdvance,
  localInferenceEnabled: _localInferenceEnabled,
  onToggleLocalInference: _onToggleLocalInference,
  webGPUAvailable: _webGPUAvailable,
  planError,
  modelLoadError,
  modelLoadProgress: _modelLoadProgress,
  prepStage: _prepStage,
  onConfirmSettings,
  onBackToWorkspace,
  onContinueWithoutInference,
  onReadyStart,
  hasSessionPlan: _hasSessionPlan,
  sessionId,
  sessionStartedAt,
  sessionPlan,
  resumeSession = false,
}: SessionWelcomeModalProps) {
  if (isPreparing) {
    return (
      <SessionPageLoading
        data-ile-session-settings
        data-session-welcome-modal=""
        data-ile-start-loading-page
        className="h-screen"
      >
        <IleStartLoading t={t} />
      </SessionPageLoading>
    );
  }

  const isButtonDisabled = isPreparing;
  const confirmBlocked = isIleConfirmSettingsBlocked(chapterPlanStatus, isPreparing);
  const welcomeExtras = {
    resume: resumeSession,
    stepCount: sessionPlan?.steps?.length ?? 0,
  };
  const showContinuePreview = ileWelcomeShowsContinuePreview(chapterPlanStatus, welcomeExtras);
  const statusUnknown = chapterPlanStatus === "unknown";
  const statusFailed = chapterPlanStatus === "failed";
  const completedCount = (sessionPlan?.steps || []).filter((step) => step.status === "completed").length;
  const visibleChapters = capIleSessionChapters(sessionPlan?.steps ?? [], chapterCount);
  const selectedLearnPreset = ileLearnMatchingPresetId({
    chapterCount,
    minInsightsPerChapter,
    silenceLockMinutes,
    powExpense,
  });

  return (
    <div
      data-ile-session-settings
      data-session-welcome-modal=""
      data-console-frame=""
      className="relative flex h-screen min-h-0 w-full flex-col overflow-hidden border border-white/40 bg-black"
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <p data-console-frame-label="" className={`absolute left-3 top-2 z-[4] ${CONSOLE_LABEL_CLASS}`}>
        Set
      </p>
      <div className="relative z-[2] shrink-0 border-b border-white/30 px-5 py-3 sm:px-6">
        <h2 className="text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl">
          {t("session.welcomeTitle")}
        </h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-snug text-neutral-400">
          {t("session.welcomeMessage")}
        </p>
      </div>

      <div className="relative z-[2] flex min-h-0 flex-1 flex-col">
        {!languageConfirmed ? (
          <div className="grid h-full min-h-0 w-full flex-1 overflow-hidden lg:grid-cols-2">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-neutral-800 lg:border-r">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <TapBriefingConfig
                  workspaceTitle="Learn"
                  kicker="Learn"
                  title={t("session.welcomeTitle")}
                  minutes={DEFAULT_DURATION_MINUTES}
                  onMinutesChange={() => {}}
                  conversationLanguage={tutoringLanguage}
                  onConversationLanguageChange={(locale) =>
                    onTutoringLanguageChange(coerceSpokenLocale(locale))
                  }
                  showDurationPicker={false}
                  disabled={isButtonDisabled}
                />
                <div
                  data-ile-session-chapters
                  className="flex h-full min-h-0 min-w-0 flex-col gap-4 px-5 pb-6 sm:px-8 lg:px-10"
                >
                  <div data-ile-learn-presets>
                    <p className="mb-2 text-sm font-medium text-neutral-100">
                      {t("session.learnPresets")}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {ILE_LEARN_PRESETS.map((preset) => {
                        const selected = selectedLearnPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            data-ile-learn-preset={preset.id}
                            aria-pressed={selected}
                            disabled={isButtonDisabled}
                            onClick={() => {
                              const knobs = applyIleLearnPreset(preset.id);
                              onChapterCountChange?.(knobs.chapterCount);
                              onMinInsightsPerChapterChange?.(knobs.minInsightsPerChapter);
                              onSilenceLockMinutesChange?.(knobs.silenceLockMinutes);
                              onPowExpenseChange?.(knobs.powExpense);
                            }}
                            className={`rounded-none border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              selected
                                ? "border-white bg-white text-neutral-950"
                                : "border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-600"
                            }`}
                          >
                            <span className="block text-sm font-medium">{t(preset.labelKey)}</span>
                            <span
                              className={`mt-1 block text-[12px] leading-snug ${
                                selected ? "text-neutral-700" : "text-neutral-400"
                              }`}
                            >
                              {t(preset.descKey)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div data-ile-session-chapter-count>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium text-neutral-100">
                        {t("session.chapterCount")}
                      </label>
                      <span className="font-mono text-[11px] text-neutral-300">{chapterCount}</span>
                    </div>
                    <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                      {t("session.chapterCountDesc")}
                    </p>
                    <input
                      type="range"
                      min={ILE_SESSION_CHAPTER_COUNT_MIN}
                      max={ILE_SESSION_CHAPTER_COUNT_MAX}
                      step={1}
                      value={chapterCount}
                      disabled={isButtonDisabled}
                      onChange={(e) => onChapterCountChange?.(Number(e.target.value))}
                      className="w-full accent-white"
                      aria-valuemin={ILE_SESSION_CHAPTER_COUNT_MIN}
                      aria-valuemax={ILE_SESSION_CHAPTER_COUNT_MAX}
                      aria-valuenow={chapterCount}
                    />
                    <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      <span>{t("session.chapterCountFew")}</span>
                      <span>{t("session.chapterCountMany")}</span>
                    </div>
                  </div>
                  <div data-ile-min-insights-slider data-ile-session-insight-goal>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium text-neutral-100">
                        {t("session.minInsightsPerChapter")}
                      </label>
                      <span className="font-mono text-[11px] text-neutral-300">
                        {minInsightsPerChapter}
                      </span>
                    </div>
                    <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                      {t("session.minInsightsPerChapterDesc")}
                    </p>
                    <input
                      type="range"
                      min={ILE_MIN_INSIGHTS_PER_CHAPTER_MIN}
                      max={ILE_MIN_INSIGHTS_PER_CHAPTER_CEILING}
                      step={1}
                      value={minInsightsPerChapter}
                      disabled={isButtonDisabled}
                      onChange={(e) => onMinInsightsPerChapterChange?.(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                  </div>
                  <div data-ile-silence-lock-minutes>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium text-neutral-100">
                        {ILE_SILENCE_LOCK_MINUTES_LABEL}
                      </label>
                      <span className="font-mono text-[11px] text-neutral-300">
                        {silenceLockMinutes}m
                      </span>
                    </div>
                    <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                      {ILE_SILENCE_LOCK_MINUTES_DESC}
                    </p>
                    <input
                      type="range"
                      min={ILE_SILENCE_LOCK_MINUTES_MIN}
                      max={ILE_SILENCE_LOCK_MINUTES_MAX}
                      step={1}
                      value={silenceLockMinutes}
                      disabled={isButtonDisabled}
                      onChange={(e) =>
                        onSilenceLockMinutesChange?.(clampIleSilenceLockMinutes(Number(e.target.value)))
                      }
                      className="w-full accent-white"
                    />
                  </div>
                  <div data-ile-pow-expense-slider>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium text-neutral-100">
                        {t("session.powExpense")}
                      </label>
                      <span className="font-mono text-[11px] text-neutral-300">{powExpense}</span>
                    </div>
                    <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                      {t("session.powExpenseDesc")}
                    </p>
                    <input
                      type="range"
                      min={ILE_POW_EXPENSE_MIN}
                      max={ILE_POW_EXPENSE_MAX}
                      step={1}
                      value={powExpense}
                      disabled={isButtonDisabled}
                      onChange={(e) =>
                        onPowExpenseChange?.(clampIlePowExpense(Number(e.target.value)))
                      }
                      className="w-full accent-white"
                      aria-valuemin={ILE_POW_EXPENSE_MIN}
                      aria-valuemax={ILE_POW_EXPENSE_MAX}
                      aria-valuenow={powExpense}
                    />
                    <div className="mt-1 flex justify-between gap-2 text-[10px] leading-snug text-neutral-500">
                      <span>{t("session.powExpenseCheap")}</span>
                      <span>{t("session.powExpenseExpensive")}</span>
                    </div>
                  </div>
                  {showContinuePreview ? (
                    <div
                      data-ile-continue-welcome
                      className="rounded-none border border-neutral-800/80 bg-neutral-950/40 p-4"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                        {t("session.continueSession")}
                      </p>
                      <p className="mt-2 text-[12px] leading-snug text-neutral-400">
                        {t("session.continueSessionDesc")}
                      </p>
                      <dl className="mt-3 space-y-1.5 text-[11px]">
                        <div className="flex justify-between gap-2">
                          <dt className="text-neutral-500">{t("session.continueSessionId")}</dt>
                          <dd data-continue-session-id className="truncate font-mono text-neutral-300">
                            {sessionId || sessionPlan?.sessionId || ""}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-neutral-500">{t("session.continueSessionStarted")}</dt>
                          <dd data-continue-session-started className="text-neutral-300">
                            {sessionStartedAt || ""}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-neutral-500">{t("session.continueSessionChapters")}</dt>
                          <dd data-ile-continue-chapter-count className="text-neutral-300">
                            {visibleChapters.length}
                            {completedCount > 0 ? ` · ${completedCount} done` : ""}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                  {statusUnknown ? (
                    <p className="text-[11px] text-neutral-500">{t("session.initialChaptersChecking")}</p>
                  ) : null}
                  {statusFailed ? (
                    <p className="text-[11px] text-neutral-500">{t("session.initialChaptersFailed")}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => !isButtonDisabled && onToggleAutoAdvance()}
                    disabled={isButtonDisabled}
                    aria-hidden="true"
                    tabIndex={-1}
                    className="hidden"
                  >
                    {autoAdvance ? t("session.autoAdvanceOn") : t("session.manualMode")}
                  </button>
                </div>
              </div>
              <div
                data-ile-confirm-settings-footer
                className="mt-auto shrink-0 border-t border-neutral-800 p-3"
              >
                {(planError || modelLoadError) && (
                  <div className="mb-2 border border-red-500/20 bg-red-500/5 px-2 py-2">
                    <p className="text-[11px] leading-relaxed text-red-400">
                      {planError || modelLoadError}
                    </p>
                  </div>
                )}
                {modelLoadError && (
                  <button
                    type="button"
                    onClick={onContinueWithoutInference}
                    className="mb-2 w-full py-1.5 text-left text-[11px] text-neutral-400 transition-colors hover:text-neutral-200"
                  >
                    {t("session.continueWithoutBrowserInference")}
                  </button>
                )}
                {onBackToWorkspace ? (
                  <button
                    type="button"
                    data-ile-back-to-workspace
                    onClick={() => onBackToWorkspace()}
                    className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-none border border-neutral-800 bg-black px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-950 hover:text-white"
                  >
                    {t("session.backToDashboard")}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-ile-confirm-settings
                  onClick={() => {
                    if (isIleConfirmSettingsBlocked(chapterPlanStatus, isPreparing)) {
                      return;
                    }
                    void onConfirmSettings();
                  }}
                  disabled={confirmBlocked}
                  aria-busy={chapterPlanStatus === "unknown" || isButtonDisabled}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-none bg-neutral-100 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {isButtonDisabled ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    t("session.confirmSettings")
                  )}
                </button>
              </div>
            </div>
            <TapAestheticSection bgImage={selectedAesthetic?.previewImage ?? null} kind="shortcuts">
              <AestheticPicker
                packages={aestheticPackages}
                selectedId={selectedAesthetic?.id ?? selectedAestheticId}
                onSelect={onSelectAesthetic}
                disabled={isButtonDisabled}
                loading={aestheticsLoading}
                fillHeight
              />
            </TapAestheticSection>
          </div>
        ) : (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 px-6 py-6 text-center sm:min-h-[14rem] sm:px-8">
            <p className="max-w-lg text-sm leading-relaxed text-neutral-400">
              {t("session.welcomeMessage")}
            </p>
            <button
              onClick={() => void onReadyStart()}
              className="min-w-[14rem] rounded-none bg-neutral-100 px-8 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white"
            >
              {t("session.getStarted")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
