"use client";

import { AestheticPicker } from "@/components/AestheticPicker";
import type { SessionWelcomeModalProps } from "@/components/session-view/types";
import { INITIAL_CHAPTERS_LEVELS } from "@/lib/initial-chapters";
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
  autoAdvance,
  onToggleAutoAdvance,
  localInferenceEnabled,
  onToggleLocalInference,
  webGPUAvailable,
  planError,
  modelLoadError,
  modelLoadProgress,
  prepStage,
  onConfirmSettings,
  onContinueWithoutInference,
  onReadyStart,
  hasSessionPlan,
}: SessionWelcomeModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      data-session-welcome-modal
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative z-10 flex max-h-[min(92vh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-none border border-neutral-800 bg-neutral-900 shadow-[0_32px_100px_rgba(0,0,0,0.65)]">
        <div className="shrink-0 border-b border-neutral-800/70 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-neutral-800 bg-gradient-to-br from-neutral-800/15 via-neutral-800 to-neutral-900 sm:h-16 sm:w-16">
                <span className="font-serif text-2xl text-neutral-200 sm:text-3xl">H</span>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_28px_rgba(245,158,11,0.1)]" />
            </div>
            <div className="flex min-w-0 flex-col">
              <h2 className="text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
                {t("session.welcomeTitle")}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-400">
                {t("session.welcomeMessage")}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5 sm:px-8 sm:py-6">
        {(() => {
          const isSessionReady = hasSessionPlan && !planLoading;

          // Phase 1: Language selection (before confirmation)
          if (!languageConfirmed) {
            const isButtonDisabled = planLoading || isPreparing;

            return (
              <>
                <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-start">
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
                  <div className="min-w-0 flex flex-col">
                {/* Initial chapters — interactive only when no chapter set exists
                    (or user opts in to regenerate). Status is persisted-plan aware
                    so the regenerate checkbox does not flicker/disappear. */}
                {(() => {
                  const hasExistingChapters = chapterPlanStatus === "exists";
                  const statusUnknown = chapterPlanStatus === "unknown";
                  const chaptersLocked =
                    statusUnknown || (hasExistingChapters && !regenerateChapters);
                  const chaptersDisabled = isButtonDisabled || chaptersLocked;

                  return (
                    <div
                      className={`mb-5 transition-colors ${
                        chaptersLocked
                          ? "rounded-none border border-neutral-800/80 bg-neutral-950/40 p-4"
                          : ""
                      }`}
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <label
                          className={`block text-[11px] font-medium uppercase tracking-[0.12em] ${
                            chaptersLocked ? "text-neutral-600" : "text-neutral-500"
                          }`}
                        >
                          {t("session.initialChapters")}
                        </label>
                        {statusUnknown ? (
                          <span className="text-[10px] text-neutral-600">
                            {t("session.initialChaptersChecking")}
                          </span>
                        ) : hasExistingChapters ? (
                          <span className="text-[10px] text-neutral-600">
                            {t("session.initialChaptersExisting")}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={`grid grid-cols-3 gap-2.5 ${chaptersLocked ? "opacity-40 pointer-events-none" : ""}`}
                      >
                        {INITIAL_CHAPTERS_LEVELS.map((level) => {
                          const selected = initialChapters === level;
                          const titleKey =
                            level === "narrow"
                              ? "session.initialChaptersNarrow"
                              : level === "mid"
                                ? "session.initialChaptersMid"
                                : "session.initialChaptersBroad";
                          const descKey =
                            level === "narrow"
                              ? "session.initialChaptersNarrowDesc"
                              : level === "mid"
                                ? "session.initialChaptersMidDesc"
                                : "session.initialChaptersBroadDesc";
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => onInitialChaptersChange(level)}
                              disabled={chaptersDisabled}
                              className={`rounded-none border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                                selected && !chaptersLocked
                                  ? "border-neutral-200 bg-neutral-800 ring-1 ring-neutral-200/40"
                                  : "border-neutral-800 bg-neutral-950 hover:border-neutral-600 disabled:hover:border-neutral-800"
                              } ${isButtonDisabled && !chaptersLocked ? "opacity-50" : ""}`}
                            >
                              <span
                                className={`block text-xs font-medium leading-tight ${
                                  chaptersLocked ? "text-neutral-500" : "text-neutral-200"
                                }`}
                              >
                                {t(titleKey)}
                              </span>
                              <span className="mt-1.5 block text-[11px] leading-snug text-neutral-500">
                                {t(descKey)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
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
                      {hasExistingChapters && (
                        <label
                          className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-none border border-neutral-800 bg-neutral-900/70 px-3 py-2.5 transition-colors hover:border-neutral-700 ${
                            isButtonDisabled ? "pointer-events-none opacity-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={regenerateChapters}
                            disabled={isButtonDisabled}
                            onChange={(e) => onRegenerateChaptersChange(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-none border-neutral-600 bg-neutral-950 text-white focus:ring-1 focus:ring-neutral-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-neutral-200 leading-tight">
                              {t("session.regenerateChapters")}
                            </span>
                            <span className="block text-[10px] text-neutral-500 leading-snug mt-0.5">
                              {t("session.regenerateChaptersDesc")}
                            </span>
                          </span>
                        </label>
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

                {planError && !isPreparing && (
                  <div className="mb-3 px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-none">
                    <p className="text-xs text-red-400 leading-relaxed">{planError}</p>
                  </div>
                )}

                <div className="mt-auto space-y-3">
                <button
                  onClick={() => void onConfirmSettings()}
                                disabled={isButtonDisabled}
                  className="flex w-full items-center justify-center gap-2 rounded-none bg-neutral-100 px-4 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  {isButtonDisabled ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('session.preparing')}
                    </>
                  ) : t('session.confirmSettings')}
                </button>

                {/* Inline loading progress */}
                {isPreparing && (
                  <div className="space-y-2">
                    {/* Plan prep row */}
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-none bg-neutral-950 border border-neutral-800">
                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums ${
                        prepStage !== "plan"
                          ? 'bg-neutral-100 text-neutral-900'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}>
                        {prepStage !== "plan" ? (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : '01'}
                      </div>
                      <span className={`flex-1 text-xs ${prepStage !== "plan" ? 'text-neutral-500' : 'text-neutral-300'}`}>
                        {prepStage === "plan" ? t('session.preparingPlan') : t('session.planReady')}
                      </span>
                      {prepStage === "plan" && (
                        <div className="w-3.5 h-3.5 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                      )}
                    </div>

                    {localInferenceEnabled && (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-none bg-neutral-950 border border-neutral-800">
                        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums ${
                          prepStage === "done"
                            ? 'bg-neutral-100 text-neutral-900'
                            : prepStage === "model"
                              ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                              : 'bg-neutral-900 text-neutral-600 border border-neutral-800'
                        }`}>
                          {prepStage === "done" ? (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : '02'}
                        </div>
                        <span className={`flex-1 text-xs ${
                          prepStage === "done" ? 'text-neutral-500' : prepStage === "model" ? 'text-neutral-300' : 'text-neutral-600'
                        }`}>
                          {prepStage === "done" ? t('session.localModelLoaded') : prepStage === "model" ? t('session.loadingLocalModel') : t('session.loadLocalModel')}
                        </span>
                        {prepStage === "model" && !modelLoadProgress && (
                          <div className="w-3.5 h-3.5 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                        )}
                      </div>
                    )}

                    {/* Progress bar (only during model download) */}
                    {prepStage === "model" && modelLoadProgress && (
                      <div className="px-3 pt-1">
                        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-300 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${modelLoadProgress.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-neutral-500">
                            {modelLoadProgress.loaded && modelLoadProgress.total
                              ? `${(modelLoadProgress.loaded / 1024 / 1024).toFixed(0)} / ${(modelLoadProgress.total / 1024 / 1024).toFixed(0)} MB`
                              : t('session.downloading')}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{modelLoadProgress.progress}%</span>
                        </div>
                      </div>
                    )}

                    {/* Errors */}
                    {(planError || modelLoadError) && (
                      <div className="px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-none">
                        <p className="text-xs text-red-400 leading-relaxed">{planError || modelLoadError}</p>
                      </div>
                    )}

                    {/* Cancel for model loading errors */}
                    {modelLoadError && (
                      <button
                        onClick={onContinueWithoutInference}
                        className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                      >
                        {t('session.continueWithoutBrowserInference')}
                      </button>
                    )}
                  </div>
                )}
                </div>
                  </div>
                </div>
              </>
            );
          }

          // Phase 2: Ready (already confirmed before, e.g. page refresh).
          // If the user has never clicked Play on this session we drop
          // them into the in-panel tutor welcome. Otherwise arm capture
          // immediately so Helios speech is not stuck "off".
          return (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 py-6 text-center sm:min-h-[14rem]">
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
      </div>
    </div>
  );
}
