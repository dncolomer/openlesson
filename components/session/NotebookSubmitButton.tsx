"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * Small inline button for the notebook footer. Owns its own `isSubmitting`
 * state so SessionView does not bloat further.
 */
export function NotebookSubmitButton({
  onSubmit,
  disabled,
  disabledReason,
}: {
  onSubmit: () => Promise<void> | void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleClick = async () => {
    if (isSubmitting || disabled) return;
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting || disabled}
      title={disabled ? (disabledReason ?? "") : t("whiteboard.submitHint")}
      aria-label={t("whiteboard.submitToHelios")}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-white bg-white/10 border border-white/30 hover:bg-white/20 hover:border-white/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
    >
      {isSubmitting ? (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
        </svg>
      )}
      <span>{isSubmitting ? t("whiteboard.submitting") : t("whiteboard.submitToHelios")}</span>
    </button>
  );
}
