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
  capIleSessionChapters,
} from "@/lib/ile-canvas-session";
import { ileWelcomeShowsContinuePreview } from "@/lib/ile-welcome-chapters";
import { ILE_POW_EXPENSE_DEFAULT } from "@/lib/ile-pow-spend";
import { ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT } from "@/lib/ile-turn-insights";
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
  languageConfirmed: _languageConfirmed,
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
  onChapterCountChange: _onChapterCountChange,
  mapTypeCatalog: _mapTypeCatalog,
  powExpense: _powExpense = ILE_POW_EXPENSE_DEFAULT,
  onPowExpenseChange: _onPowExpenseChange,
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
  minInsightsPerChapter: _minInsightsPerChapter = ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  onMinInsightsPerChapterChange: _onMinInsightsPerChapterChange,
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
  onReadyStart: _onReadyStart,
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
        <IleStartLoading t={t} fieldStatus="preparing" />
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
          <div className="grid h-full min-h-0 w-full flex-1 overflow-hidden lg:grid-cols-2">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-neutral-800 lg:border-r">
              <div className="min-h-0 flex-1">
                <TapBriefingConfig
                  workspaceTitle="Learn"
                  title={t("session.welcomeTitle")}
                  minutes={DEFAULT_DURATION_MINUTES}
                  onMinutesChange={() => {}}
                  conversationLanguage={tutoringLanguage}
                  onConversationLanguageChange={(locale) =>
                    onTutoringLanguageChange(coerceSpokenLocale(locale))
                  }
                  showDurationPicker={false}
                  wideLanguage
                  disabled={isButtonDisabled}
                />
                <div
                  data-ile-session-chapters
                  className="flex min-h-0 min-w-0 flex-col gap-4 px-5 pb-6 sm:px-8 lg:px-10"
                >
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
      </div>
    </div>
  );
}
