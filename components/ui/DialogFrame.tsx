"use client";

import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Shared modal shell: portaled, screen-centered overlay + panel.
 * ConfirmDialog and ILE form/welcome dialogs all render through this so
 * stacking, dismiss, and chrome stay one framework.
 */
export type DialogSize = "md" | "lg" | "xl";

const DIALOG_SIZE: Record<DialogSize, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-5xl",
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
  /** Becomes `data-{testId}` on the dialog root. */
  testId?: string;
};

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
  testId,
}: DialogFrameProps) {
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
        className={`relative z-10 w-full ${DIALOG_SIZE[size]} bg-neutral-900 border border-neutral-800 rounded-none shadow-2xl overflow-hidden ${panelClassName ?? ""}`}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
