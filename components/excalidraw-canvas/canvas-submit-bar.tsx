"use client";

export function CanvasSubmitBar({
  t,
  handleSubmitToHelios,
  isSubmittingToHelios,
  canSubmitToHelios,
  submitButtonLabel,
}: {
  t: (key: string) => string;
  handleSubmitToHelios: () => void;
  isSubmittingToHelios: boolean;
  canSubmitToHelios: boolean;
  submitButtonLabel: string;
}) {
  return (
      <div className="flex items-center justify-end gap-2 p-2 border-b border-neutral-800 bg-neutral-900/30">
          <button
            onClick={handleSubmitToHelios}
            disabled={isSubmittingToHelios || !canSubmitToHelios}
            title={
              canSubmitToHelios
                ? t("whiteboard.submitHint")
                : t("whiteboard.alreadySubmitted")
            }
            aria-label={submitButtonLabel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-black bg-white border border-white hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-none transition-colors"
          >
            {isSubmittingToHelios ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12l5 5L20 7"
                />
              </svg>
            )}
            <span className="whitespace-nowrap">
              {isSubmittingToHelios
                ? t("whiteboard.submitting")
                : submitButtonLabel}
            </span>
          </button>
      </div>
  );
}
