"use client";

import { AestheticPicker } from "@/components/AestheticPicker";
import { InitialChaptersPicker } from "@/components/InitialChaptersPicker";
import { IleContinueMapPreview } from "@/components/session-view/ile-continue-map-preview";
import { isIleConfirmSettingsBlocked } from "@/components/session-view/ile-confirm-settings";
import type { SessionWelcomeModalProps } from "@/components/session-view/types";
import { DialogFrame } from "@/components/ui/DialogFrame";
import {
  ileWelcomeShowsContinuePreview,
  ileWelcomeShowsRegenerate,
  ileWelcomeShowsSizePicker,
} from "@/lib/ile-welcome-chapters";
import {
  coerceSpokenLocale,
  spokenLanguageNames,
  spokenLocales,
} from "@/lib/tutoring-languages";

export function SessionWelcomeModal({
  t,
  languageConfirmed,
  planLoading,
  isPreparing,
  tutoringLanguage,
  onTutoringLanguageChange,
  aestheticPackages,
  selectedAesthetic,
  selectedAestheticId,
  onSelectAesthetic,
  aestheticsLoading,
  chapterPlanStatus,
  regenerateChapters,
  onRegenerateChaptersChange,
  initialChapters,
  onInitialChaptersChange,
  mapTypeCatalog,
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
  onContinueWithoutInference,
  onReadyStart,
  hasSessionPlan,
  sessionId,
  sessionStartedAt,
  sessionPlan,
  resumeSession = false,
}: SessionWelcomeModalProps) {
  return (
    <DialogFrame
      open
      onClose={() => {}}
      closeOnOverlay={false}
      closeOnEscape={false}
      size="xl"
      testId="session-welcome-modal"
      panelClassName="flex max-h-[min(92vh,52rem)] flex-col"
    >
        <div className="shrink-0 border-b border-neutral-800/70 px-6 py-5 sm:px-8 sm:py-6">
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
            {t("session.welcomeTitle")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-400">
            {t("session.welcomeMessage")}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
        {(() => {
          const isSessionReady = hasSessionPlan && !planLoading;

          // Phase 1: Language selection (before confirmation)
          if (!languageConfirmed) {
            const isButtonDisabled = isPreparing;
            const confirmBlocked = isIleConfirmSettingsBlocked(
              chapterPlanStatus,
              isPreparing,
            );

            return (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5 sm:px-8 sm:py-6">
                <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-stretch">
                  {/* Left column: language + aesthetics */}
                  <div className="min-w-0 space-y-5">
                    <div>
                      <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                        {t("session.tutorLanguage")}
                      </label>
                      <select
                        value={tutoringLanguage}
                        onChange={(e) => {
                          onTutoringLanguageChange(coerceSpokenLocale(e.target.value));
                        }}
                        disabled={isButtonDisabled}
                        className="w-full rounded-none border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm text-white transition-colors hover:border-neutral-700 focus:border-neutral-600 focus:outline-none disabled:opacity-50"
                      >
                        {spokenLocales.map((loc) => (
                          <option key={loc} value={loc}>
                            {spokenLanguageNames[loc]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <AestheticPicker
                      packages={aestheticPackages}
                      selectedId={selectedAesthetic?.id ?? selectedAestheticId}
                      onSelect={onSelectAesthetic}
                      disabled={isButtonDisabled}
                      loading={aestheticsLoading}
                      wide
                    />
                  </div>

                  {/* Right column: chapter map size + primary CTA */}
                  <div className="flex min-h-0 min-w-0 flex-col lg:h-full">
                {/* Initial chapters — interactive only when no chapter set exists
                    (or user opts in to regenerate). Status is persisted-plan aware
                    so the regenerate checkbox does not flicker/disappear. */}
                {(() => {
                  const welcomeExtras = {
                    resume: resumeSession,
                    stepCount: sessionPlan?.steps?.length ?? 0,
                  };
                  const showSizePicker = ileWelcomeShowsSizePicker(
                    chapterPlanStatus,
                    welcomeExtras,
                  );
                  const showContinuePreview = ileWelcomeShowsContinuePreview(
                    chapterPlanStatus,
                    welcomeExtras,
                  );
                  const showRegenerate = ileWelcomeShowsRegenerate(
                    chapterPlanStatus,
                    welcomeExtras,
                  );
                  const statusUnknown = chapterPlanStatus === "unknown";
                  const statusFailed = chapterPlanStatus === "failed";
                  const completedCount = (sessionPlan?.steps || []).filter(
                    (step) => step.status === "completed",
                  ).length;

                  return (
                    <div
                      className={
                        showContinuePreview || showSizePicker
                          ? "flex min-h-0 flex-1 flex-col"
                          : "mb-5"
                      }
                    >
                      {showContinuePreview ? (
                        <div
                          data-ile-continue-welcome
                          className="flex min-h-0 flex-1 flex-col"
                        >
                          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                            {t("session.continueSession")}
                          </label>
                          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-neutral-800/80 bg-neutral-950/40 p-4 pb-0">
                          <p className="text-[11px] leading-relaxed text-neutral-400">
                            {t("session.continueSessionDesc")}
                          </p>
                          <dl className="mt-3 shrink-0 space-y-1.5 text-[11px]">
                            <div className="flex justify-between gap-2">
                              <dt className="text-neutral-500">
                                {t("session.continueSessionId")}
                              </dt>
                              <dd
                                data-continue-session-id
                                className="truncate font-mono text-neutral-300"
                              >
                                {sessionId || sessionPlan?.sessionId || ""}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-neutral-500">
                                {t("session.continueSessionStarted")}
                              </dt>
                              <dd data-continue-session-started className="text-neutral-300">
                                {sessionStartedAt || ""}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-neutral-500">
                                {t("session.continueSessionChapters")}
                              </dt>
                              <dd className="text-neutral-300">
                                {sessionPlan?.steps?.length ?? 0}
                                {completedCount > 0 ? ` · ${completedCount} done` : ""}
                              </dd>
                            </div>
                          </dl>
                          <div
                            data-ile-continue-map-align="aesthetics"
                            className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col max-lg:min-h-[min(14rem,28vh)]"
                          >
                            <IleContinueMapPreview steps={sessionPlan?.steps} />
                          </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`transition-colors ${
                            !showSizePicker
                              ? "rounded-none border border-neutral-800/80 bg-neutral-950/40 p-4"
                              : ""
                          }`}
                        >
                          <div className="mb-2.5 flex items-center justify-between gap-2">
                            <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                              {t("session.initialChapters")}
                            </label>
                            {statusUnknown ? (
                              <span className="text-[10px] text-neutral-600">
                                {t("session.initialChaptersChecking")}
                              </span>
                            ) : statusFailed ? (
                              <span className="text-[10px] text-neutral-600">
                                {t("session.initialChaptersFailed")}
                              </span>
                            ) : null}
                          </div>
                          {showSizePicker ? (
                            <div
                              data-ile-map-type-align="aesthetics"
                              className="min-h-0 flex-1"
                            >
                              <InitialChaptersPicker
                                value={initialChapters}
                                onChange={onInitialChaptersChange}
                                disabled={isButtonDisabled}
                                t={t}
                                i18nPrefix="session"
                                fillHeight
                                catalog={mapTypeCatalog}
                              />
                            </div>
                          ) : null}
                          {statusUnknown && (
                            <div
                              className="mt-3 flex items-center gap-2.5 rounded-none border border-neutral-800 bg-neutral-900/70 px-3 py-2.5"
                              role="status"
                              aria-live="polite"
                            >
                              <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-neutral-600 border-t-neutral-300" />
                              <span className="min-w-0">
                                <span className="block text-xs font-medium text-neutral-300 leading-tight">
                                  {t("session.initialChaptersLoading")}
                                </span>
                                <span className="block text-[10px] text-neutral-500 leading-snug mt-0.5">
                                  {t("session.initialChaptersLoadingDesc")}
                                </span>
                              </span>
                            </div>
                          )}
                          {statusFailed && (
                            <div
                              className="mt-3 flex items-center gap-2.5 rounded-none border border-neutral-800 bg-neutral-900/70 px-3 py-2.5"
                              role="status"
                            >
                              <span className="min-w-0">
                                <span className="block text-xs font-medium text-neutral-300 leading-tight">
                                  {t("session.initialChaptersFailed")}
                                </span>
                                <span className="block text-[10px] text-neutral-500 leading-snug mt-0.5">
                                  {t("session.initialChaptersFailedDesc")}
                                </span>
                              </span>
                            </div>
                          )}
                          {showRegenerate ? (
                            <label
                              className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-none border border-neutral-800 bg-neutral-900/70 px-3 py-2.5 ${
                                isButtonDisabled ? "pointer-events-none opacity-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={regenerateChapters}
                                disabled={isButtonDisabled}
                                onChange={(e) =>
                                  onRegenerateChaptersChange(e.target.checked)
                                }
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-none border-neutral-600 bg-neutral-950 text-white focus:ring-1 focus:ring-neutral-500"
                              />
                              <span className="min-w-0">
                                <span className="block text-xs font-medium text-neutral-200 leading-tight">
                                  {t("session.regenerateChapters")}
                                </span>
                              </span>
                            </label>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Auto-advance toggle — hidden in UI (manual mode is the
                    default). Underlying state remains wired; remove the
                    `hidden` wrapper to bring the toggle back. */}
                <button
                  type="button"
                  onClick={() => !isButtonDisabled && onToggleAutoAdvance()}
                  disabled={isButtonDisabled}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="hidden w-full mb-3 p-3 rounded-none border bg-neutral-900 border-neutral-800 hover:bg-neutral-800/60 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors items-center gap-3 text-left"
                >
                  <div className="relative shrink-0 w-9 h-5 rounded-full bg-neutral-700">
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-100 shadow transition-transform ${autoAdvance ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-neutral-200 leading-tight">
                      {autoAdvance ? t('session.autoAdvanceOn') : t('session.manualMode')}
                    </span>
                    <span className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                      {autoAdvance
                        ? t('session.aiDecidesMoveForward')
                        : t('session.youClickToAdvance')}
                    </span>
                  </div>
                </button>

                {/* Browser Inference Toggle — hidden in UI while we
                    stabilise the feature, but the underlying state &
                    downstream logic remain wired so we can bring it
                    back by removing the `hidden` wrapper. */}
                <button
                  type="button"
                  onClick={() => webGPUAvailable && !isButtonDisabled && onToggleLocalInference()}
                  disabled={!webGPUAvailable || isButtonDisabled}
                  aria-hidden="true"
                  tabIndex={-1}
                  className="hidden w-full mb-5 p-3 rounded-none border bg-neutral-900 border-neutral-800 enabled:hover:bg-neutral-800/60 enabled:hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors items-center gap-3 text-left"
                >
                  <div className="relative shrink-0 w-9 h-5 rounded-full bg-neutral-700">
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-100 shadow transition-transform ${localInferenceEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-neutral-200 leading-tight">
                      {localInferenceEnabled ? t('session.browserInferenceOn') : t('session.browserInference')}
                    </span>
                    <span className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                      {!webGPUAvailable
                        ? t('session.webGPUNotAvailable')
                        : t('session.browserInferenceDesc')}
                    </span>
                  </div>
                </button>

                  </div>
                </div>
                </div>
                <div
                  data-ile-confirm-settings-footer
                  className="shrink-0 border-t border-neutral-800/70 px-6 py-4 sm:px-8"
                >
                {(planError || modelLoadError) && (
                  <div className="mb-3 px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-none">
                    <p className="text-xs text-red-400 leading-relaxed">{planError || modelLoadError}</p>
                  </div>
                )}
                {modelLoadError && (
                  <button
                    type="button"
                    onClick={onContinueWithoutInference}
                    className="mb-3 w-full py-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    {t("session.continueWithoutBrowserInference")}
                  </button>
                )}
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
                  className="flex w-full items-center justify-center gap-2 rounded-none bg-neutral-100 px-4 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {isButtonDisabled ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : t("session.confirmSettings")}
                </button>
                </div>
              </>
            );
          }

          // Phase 2: Ready (already confirmed before, e.g. page refresh).
          // If the user has never clicked Play on this session we drop
          // them into the in-panel tutor welcome. Otherwise arm capture
          // immediately so Helios speech is not stuck "off".
          return (
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
          );
        })()}
        </div>
    </DialogFrame>
  );
}
