"use client";

import { useState } from "react";
import { AestheticPicker } from "@/components/AestheticPicker";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { IleStartLoading } from "@/components/session-view/ile-start-loading";
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
  ILE_GATHER_MAX_PER_SESSION,
  ILE_GATHER_MAX_PER_SESSION_CEILING,
  ILE_GATHER_MAX_PER_SESSION_MIN,
  clampIleGatherMaxPerSession,
} from "@/lib/ile-gather-resources";
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
  ILE_CANVAS_TIMER_SECONDS_CEILING,
  ILE_CANVAS_TIMER_SECONDS_DEFAULT,
  ILE_CANVAS_TIMER_SECONDS_MIN,
  ILE_CANVAS_TIMER_SECONDS_STEP,
} from "@/lib/ile-work-canvas";
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
  gatherMaxPerSession = ILE_GATHER_MAX_PER_SESSION,
  onGatherMaxPerSessionChange,
  allowThoughtsPoolInsights: _allowThoughtsPoolInsights,
  onAllowThoughtsPoolInsightsChange: _onAllowThoughtsPoolInsightsChange,
  allowParallelWork = true,
  onAllowParallelWorkChange,
  allowGatherResources = true,
  onAllowGatherResourcesChange,
  minInsightsPerChapter = ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  onMinInsightsPerChapterChange,
  canvasTimerSeconds = ILE_CANVAS_TIMER_SECONDS_DEFAULT,
  onCanvasTimerSecondsChange,
  silenceLockMinutes = ILE_SILENCE_LOCK_MINUTES_DEFAULT,
  onSilenceLockMinutesChange,
  autoAdvance,
  onToggleAutoAdvance,
  localInferenceEnabled,
  onToggleLocalInference,
  webGPUAvailable,
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
  // Shared TAP duration choices. Learn has no session-length clock, so these minutes stay on the card.
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_DURATION_MINUTES);
  if (isPreparing) {
    return (
      <div
        data-ile-session-settings
        data-session-welcome-modal=""
        data-ile-start-loading-page
        className="flex h-screen min-h-0 w-full flex-col bg-[#0a0a0a]"
      >
        <IleStartLoading t={t} />
      </div>
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

  return (
    <div
      data-ile-session-settings
      data-session-welcome-modal=""
      className="flex h-screen min-h-0 w-full flex-col bg-[#0a0a0a]"
    >
      <div className="shrink-0 border-b border-neutral-800/70 px-5 py-3 sm:px-6">
        <h2 className="text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl">
          {t("session.welcomeTitle")}
        </h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-snug text-neutral-400">
          {t("session.welcomeMessage")}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {!languageConfirmed ? (
          <div className="grid h-full min-h-0 w-full flex-1 overflow-hidden lg:grid-cols-2">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-neutral-800 lg:border-r">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <TapBriefingConfig
                  workspaceTitle="Learn"
                  kicker="Learn"
                  title={t("session.welcomeTitle")}
                  minutes={sessionMinutes}
                  onMinutesChange={setSessionMinutes}
                  conversationLanguage={tutoringLanguage}
                  onConversationLanguageChange={(locale) =>
                    onTutoringLanguageChange(coerceSpokenLocale(locale))
                  }
                  showDurationPicker
                  disabled={isButtonDisabled}
                />
                <div
                  data-ile-session-chapters
                  className="flex h-full min-h-0 min-w-0 flex-col gap-4 px-5 pb-6 sm:px-8 lg:px-10"
                >
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
                  <div data-ile-canvas-timer-slider>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium text-neutral-100">
                        {t("session.canvasTimer")}
                      </label>
                      <span className="font-mono text-[11px] text-neutral-300">
                        {Math.round(canvasTimerSeconds / 60)}m
                      </span>
                    </div>
                    <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                      {t("session.canvasTimerDesc")}
                    </p>
                    <input
                      type="range"
                      min={ILE_CANVAS_TIMER_SECONDS_MIN}
                      max={ILE_CANVAS_TIMER_SECONDS_CEILING}
                      step={ILE_CANVAS_TIMER_SECONDS_STEP}
                      value={canvasTimerSeconds}
                      disabled={isButtonDisabled}
                      onChange={(e) => onCanvasTimerSecondsChange?.(Number(e.target.value))}
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
                  <div data-ile-gather-max-slider>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium text-neutral-100">
                        {t("session.gatherMax")}
                      </label>
                      <span className="font-mono text-[11px] text-neutral-300">
                        {gatherMaxPerSession}
                      </span>
                    </div>
                    <p className="mb-2 text-[12px] leading-snug text-neutral-400">
                      {t("session.gatherMaxDesc")}
                    </p>
                    <input
                      type="range"
                      min={ILE_GATHER_MAX_PER_SESSION_MIN}
                      max={ILE_GATHER_MAX_PER_SESSION_CEILING}
                      step={1}
                      value={gatherMaxPerSession}
                      disabled={isButtonDisabled}
                      onChange={(e) =>
                        onGatherMaxPerSessionChange?.(
                          clampIleGatherMaxPerSession(Number(e.target.value)),
                        )
                      }
                      className="w-full accent-white"
                      aria-valuemin={ILE_GATHER_MAX_PER_SESSION_MIN}
                      aria-valuemax={ILE_GATHER_MAX_PER_SESSION_CEILING}
                      aria-valuenow={gatherMaxPerSession}
                    />
                    <div className="mt-1 flex justify-between gap-2 text-[10px] leading-snug text-neutral-500">
                      <span>{t("session.gatherMaxCheap")}</span>
                      <span>{t("session.gatherMaxExpensive")}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-ile-pregame-difficulty-toggle="parallel-work"
                    aria-pressed={allowParallelWork}
                    disabled={isButtonDisabled}
                    onClick={() => onAllowParallelWorkChange?.(!allowParallelWork)}
                    className="flex w-full items-start gap-3 rounded-none border border-neutral-800 bg-neutral-950 px-3 py-3 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      aria-hidden
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full ${
                        allowParallelWork ? "bg-white" : "bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-neutral-950 shadow transition-transform ${
                          allowParallelWork ? "translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-100">
                        {t("session.difficultyParallelWork")}
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug text-neutral-400">
                        {t("session.difficultyParallelWorkDesc")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-ile-pregame-difficulty-toggle="gather"
                    aria-pressed={allowGatherResources}
                    disabled={isButtonDisabled}
                    onClick={() => onAllowGatherResourcesChange?.(!allowGatherResources)}
                    className="flex w-full items-start gap-3 rounded-none border border-neutral-800 bg-neutral-950 px-3 py-3 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      aria-hidden
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full ${
                        allowGatherResources ? "bg-white" : "bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-neutral-950 shadow transition-transform ${
                          allowGatherResources ? "translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-100">
                        {t("session.difficultyGather")}
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug text-neutral-400">
                        {t("session.difficultyGatherDesc")}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-ile-browser-inference
                    aria-pressed={localInferenceEnabled}
                    disabled={!webGPUAvailable || isButtonDisabled}
                    onClick={() => {
                      if (!webGPUAvailable || isButtonDisabled) return;
                      onToggleLocalInference();
                    }}
                    className="flex w-full items-start gap-3 rounded-none border border-neutral-800 bg-neutral-950 px-3 py-3 text-left transition hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full ${
                        localInferenceEnabled ? "bg-white" : "bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-neutral-950 shadow transition-transform ${
                          localInferenceEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-100">
                        {localInferenceEnabled
                          ? t("session.browserInferenceOn")
                          : t("session.browserInference")}
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug text-neutral-400">
                        {webGPUAvailable
                          ? t("session.browserInferenceDesc")
                          : t("session.webGPUNotAvailable")}
                      </span>
                    </span>
                  </button>
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
