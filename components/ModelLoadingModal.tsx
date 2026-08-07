"use client";

import { InitProgress } from "@/lib/local-inference";
import { useI18n } from "@/lib/i18n";

export type PrepStage = "plan" | "model" | "done";

interface SessionPrepModalProps {
  /** Current stage of preparation */
  stage: PrepStage;
  /** Plan prep is loading */
  planLoading: boolean;
  /** Plan prep error */
  planError: string | null;
  /** Model loading progress (only relevant when stage === "model") */
  modelProgress: InitProgress | null;
  /** Model loading error */
  modelError: string | null;
  /** Whether local inference is enabled (shows model stage) */
  localInferenceEnabled: boolean;
  /** Cancel everything */
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function SessionPrepModal({
  stage,
  planLoading,
  planError,
  modelProgress,
  modelError,
  localInferenceEnabled,
  onCancel,
}: SessionPrepModalProps) {
  const { t } = useI18n();
  const error = planError || modelError;
  const isPlanDone = stage !== "plan";
  const isModelDone = stage === "done";
  const modelPct = modelProgress?.progress ?? 0;

  // Overall progress: plan = 0-30%, model = 30-100% (or plan = 0-100% if no local inference)
  let overallPct = 0;
  if (!localInferenceEnabled) {
    overallPct = isPlanDone ? 100 : planLoading ? 50 : 0;
  } else {
    if (stage === "plan") {
      overallPct = planLoading ? 15 : 0;
    } else if (stage === "model") {
      overallPct = 30 + Math.round(modelPct * 0.7);
    } else {
      overallPct = 100;
    }
  }

  const statusText =
    stage === "plan"
      ? t('modelLoading.preparingPlan')
      : stage === "model"
        ? modelProgress?.status === "loading-processor"
          ? t('modelLoading.loadingProcessor')
          : modelProgress?.status === "loading-model"
            ? t('modelLoading.downloadingModel')
            : t('modelLoading.initializingModel')
        : t('modelLoading.ready');

  const sizeText =
    stage === "model" && modelProgress?.loaded && modelProgress?.total
      ? `${formatBytes(modelProgress.loaded)} / ${formatBytes(modelProgress.total)}`
      : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            localInferenceEnabled 
              ? 'bg-gradient-to-br from-neutral-700 to-neutral-700'
              : 'bg-gradient-to-br from-neutral-700 to-neutral-700'
          }`}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-100">{t('modelLoading.preparingSession')}</h3>
            <p className="text-xs text-neutral-400">
              {localInferenceEnabled ? t('modelLoading.planPlusModel') : t('modelLoading.creatingSessionPlan')}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-6">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button
              onClick={onCancel}
              className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-300 text-sm font-medium rounded-lg transition-colors"
            >
              {localInferenceEnabled ? t('modelLoading.cancelUseApi') : t('modelLoading.cancel')}
            </button>
          </div>
        ) : (
          <>
            {/* Step indicators */}
            <div className="mb-5 space-y-3">
              {/* Step 1: Plan prep */}
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  isPlanDone 
                    ? 'bg-green-500 text-black' 
                    : 'bg-neutral-800/20 text-neutral-300 border border-neutral-600/30'
                }`}>
                  {isPlanDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : '1'}
                </div>
                <span className={`text-sm ${isPlanDone ? 'text-neutral-500' : 'text-neutral-200'}`}>
                  {isPlanDone ? t('modelLoading.sessionPlanReady') : t('modelLoading.sessionPlan')}
                </span>
                {stage === "plan" && planLoading && (
                  <div className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin ml-auto" />
                )}
              </div>

              {/* Step 2: Model loading (only if local inference) */}
              {localInferenceEnabled && (
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                    isModelDone
                      ? 'bg-green-500 text-black'
                      : stage === "model"
                        ? 'bg-neutral-800/20 text-neutral-300 border border-neutral-600/30'
                        : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                  }`}>
                    {isModelDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : '2'}
                  </div>
                  <span className={`text-sm ${
                    isModelDone ? 'text-neutral-500' : stage === "model" ? 'text-neutral-200' : 'text-neutral-600'
                  }`}>
                    {isModelDone ? t('modelLoading.localModelLoaded') : t('modelLoading.localModel')}
                  </span>
                  {stage === "model" && !modelProgress && (
                    <div className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin ml-auto" />
                  )}
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm text-neutral-300">{statusText}</span>
                <span className="text-sm text-neutral-500">{overallPct}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    localInferenceEnabled && stage === "model"
                      ? 'bg-gradient-to-r from-neutral-700 to-neutral-700'
                      : 'bg-gradient-to-r from-neutral-700 to-neutral-700'
                  }`}
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              {sizeText && (
                <p className="text-xs text-neutral-500 mt-1.5">{sizeText}</p>
              )}
              {stage === "model" && modelProgress?.file && (
                <p className="text-xs text-neutral-600 mt-0.5 truncate">{modelProgress.file}</p>
              )}
            </div>

            {localInferenceEnabled && (
              <p className="text-xs text-neutral-500 mt-3 mb-3">
                {t('modelLoading.firstLoadNote')}
              </p>
            )}

            <button
              onClick={onCancel}
              className="w-full py-2 mt-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-400 text-xs font-medium rounded-lg transition-colors"
            >
              {localInferenceEnabled ? t('modelLoading.cancelUseApi') : t('modelLoading.cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
