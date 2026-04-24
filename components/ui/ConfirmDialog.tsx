"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * ── ConfirmDialog ──────────────────────────────────────────────────────
 *
 * Single source of truth for all "Are you sure?" modals across the app.
 * Replaces both native `window.confirm()` and hand-rolled JSX dialogs so
 * every destructive/confirmatory action shares the same visual language
 * and keyboard/a11y affordances.
 *
 * The reference style is lifted from `SessionView`'s end-session modal:
 *   • fullscreen dark overlay with backdrop blur, click-to-dismiss
 *   • centered panel: `bg-neutral-900 border-neutral-800 rounded-2xl`
 *   • optional icon pill in the header (destructive/warning/info/success)
 *   • configurable footer: primary + cancel, with an optional tertiary
 *     action rendered full-width above the primary/cancel row (used by
 *     end-session for "Pause and leave")
 *
 * The component is purely presentational — parents own open state and
 * side effects. For a promise-based drop-in replacement of `confirm()`
 * see the companion `useConfirm()` hook in `lib/useConfirm.tsx`.
 *
 * Keyboard:
 *   • `Esc` fires `onCancel`
 *   • `Enter` fires `onConfirm` (unless focus is in a textarea/input)
 *   • Primary action is auto-focused on open
 */

export type ConfirmVariant = "destructive" | "warning" | "info" | "success" | "neutral";

interface ConfirmDialogProps {
  open: boolean;
  /** Fired when the user cancels (overlay click, Esc, cancel button). */
  onCancel: () => void;
  /** Fired when the user confirms the primary action. */
  onConfirm: () => void;
  /** Optional third action rendered full-width above the primary/cancel row. */
  onTertiary?: () => void;

  title: ReactNode;
  /** Primary description text. Accepts ReactNode so callers can interpolate. */
  description?: ReactNode;

  /** Icon variant — drives the colored pill in the header. */
  variant?: ConfirmVariant;
  /** Override the default icon for the variant. */
  icon?: ReactNode;

  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  tertiaryLabel?: ReactNode;
  /** Icon rendered inside the tertiary button (left of the label). */
  tertiaryIcon?: ReactNode;

  /** Visual treatment for the confirm button. Defaults to match `variant`. */
  confirmTone?: "destructive" | "primary" | "warning" | "info";

  /** Disable the confirm button (e.g. while the action is in flight). */
  confirmDisabled?: boolean;
  /** Optional busy state — swaps the confirm button label for a spinner. */
  confirmBusy?: boolean;

  /** Hide the cancel button entirely (for terminal/celebratory dialogs). */
  hideCancel?: boolean;

  /** Arbitrary custom body rendered between the description and the footer. */
  children?: ReactNode;
}

// ── Variant visuals ─────────────────────────────────────────────────────

const ICON_PILL: Record<ConfirmVariant, string> = {
  destructive: "bg-red-500/15 border border-red-500/30 text-red-400",
  warning: "bg-amber-500/20 border border-amber-500/30 text-amber-400",
  info: "bg-cyan-500/20 border border-cyan-500/30 text-cyan-400",
  success: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400",
  neutral: "bg-neutral-800 border border-neutral-700 text-neutral-200",
};

function DefaultIcon({ variant }: { variant: ConfirmVariant }) {
  // Destructive & warning → exclamation triangle.
  // Info → circular arrow (regenerate-style).
  // Success → check.
  // Neutral → check (used by "Plan complete").
  if (variant === "info") {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  }
  if (variant === "success" || variant === "neutral") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  // destructive + warning share the exclamation triangle
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// Confirm button tone. Destructive uses the `bg-red-500/10 border-red-500/30`
// translucent pattern from SessionView, NOT the old `bg-red-600` solid —
// solid red is reserved for marketing / destructive-final states elsewhere.
const CONFIRM_TONE: Record<NonNullable<ConfirmDialogProps["confirmTone"]>, string> = {
  destructive:
    "text-red-300 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:text-red-200 active:bg-red-500/20 active:text-red-200",
  primary:
    "text-neutral-900 bg-neutral-100 hover:bg-white active:bg-white border border-transparent",
  warning:
    "text-amber-200 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 active:bg-amber-500/25",
  info:
    "text-cyan-200 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 active:bg-cyan-500/25",
};

function resolveConfirmTone(
  tone: ConfirmDialogProps["confirmTone"],
  variant: ConfirmVariant,
): NonNullable<ConfirmDialogProps["confirmTone"]> {
  if (tone) return tone;
  if (variant === "destructive") return "destructive";
  if (variant === "warning") return "warning";
  if (variant === "info") return "info";
  return "primary";
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  onTertiary,
  title,
  description,
  variant = "destructive",
  icon,
  confirmLabel,
  cancelLabel = "Cancel",
  tertiaryLabel,
  tertiaryIcon,
  confirmTone,
  confirmDisabled = false,
  confirmBusy = false,
  hideCancel = false,
  children,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus the confirm button on open so Enter submits immediately.
  // Focusing the destructive button is intentional — the parent opts into
  // this component precisely to prompt the user, not to cause an
  // accidental click (Enter on a freshly-rendered button still requires
  // an explicit user keystroke).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Esc closes; Enter submits (when a non-text target is focused).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        const isTextInput =
          tag === "textarea" ||
          (tag === "input" && (t as HTMLInputElement).type !== "button" && (t as HTMLInputElement).type !== "submit");
        if (!isTextInput && !confirmDisabled && !confirmBusy) {
          e.preventDefault();
          onConfirm();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel, onConfirm, confirmDisabled, confirmBusy]);

  if (!open) return null;

  const tone = resolveConfirmTone(confirmTone, variant);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay — click to dismiss */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-neutral-800/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ICON_PILL[variant]}`}
              aria-hidden="true"
            >
              {icon ?? <DefaultIcon variant={variant} />}
            </div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
          </div>
          {description && (
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-400 whitespace-pre-line">
              {description}
            </p>
          )}
          {children && (
            <div className="mt-4">{children}</div>
          )}
        </div>

        <div className="px-6 py-4 flex flex-col gap-2">
          {onTertiary && tertiaryLabel && (
            <button
              type="button"
              onClick={onTertiary}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-neutral-100 text-neutral-900 hover:bg-white active:bg-white transition-colors flex items-center justify-center gap-2"
            >
              {tertiaryIcon}
              {tertiaryLabel}
            </button>
          )}
          <div className={hideCancel ? "flex" : "flex gap-2"}>
            {!hideCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white active:bg-neutral-800 active:border-neutral-700 active:text-white rounded-xl transition-colors"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled || confirmBusy}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${CONFIRM_TONE[tone]}`}
            >
              {confirmBusy && <Spinner />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
