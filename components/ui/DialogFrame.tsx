"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS } from "@/components/ui/console-frame";

/**
 * Shared modal shell: portaled, screen-centered overlay + panel.
 * ConfirmDialog and TAP Learning form/welcome dialogs all render through this so
 * stacking, dismiss, and chrome stay one framework.
 */
export type DialogSize = "md" | "lg" | "xl" | "full";

const DIALOG_SIZE: Record<DialogSize, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-5xl",
  full: "max-w-[min(72rem,calc(100vw-1.5rem))]",
};

export type DialogFrameProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: DialogSize;
  labelledBy?: string;
  describedBy?: string;
  panelClassName?: string;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  /** Header ✕. Overlay click and Escape already dismiss through onClose. */
  headerClose?: boolean;
  /** When false, render in-tree (needed for Document PiP). Default true. */
  portal?: boolean;
  /** Becomes `data-{testId}` on the dialog root. */
  testId?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DialogFrame({
  open,
  onClose,
  children,
  size = "md",
  labelledBy,
  describedBy,
  panelClassName,
  closeOnOverlay = true,
  closeOnEscape = true,
  headerClose = false,
  portal = true,
  testId,
}: DialogFrameProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusable[0] ?? panel;
      first.focus();
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Tab" && panel) {
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey) {
          if (!active || active === first || !panel.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !panel.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === "function" && prev.isConnected) {
        prev.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-dialog-frame=""
      {...(testId ? { [`data-${testId}`]: "" } : {})}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        data-console-frame=""
        className={`relative z-10 w-full ${DIALOG_SIZE[size]} overflow-hidden rounded-none border border-white/40 bg-black shadow-2xl focus:outline-none ${panelClassName ?? ""}`}
      >
        <SessionConsoleScan />
        <SessionConsoleMarks />
        <p data-console-frame-label="" className={`relative z-[2] px-3 pt-2 ${CONSOLE_LABEL_CLASS}`}>
          Note
        </p>
        <div className="relative z-[2]">
          {headerClose ? (
            <button
              type="button"
              data-dialog-header-close=""
              aria-label="Close"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 rounded-none px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 hover:bg-white hover:text-black"
            >
              Close
            </button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );

  if (!portal || typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
