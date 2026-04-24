"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmVariant } from "@/components/ui/ConfirmDialog";

/**
 * `useConfirm()` — promise-based drop-in replacement for `window.confirm()`.
 *
 * Usage:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   // ...
 *   const ok = await confirm({
 *     title: "Delete this plan?",
 *     description: "This cannot be undone.",
 *     variant: "destructive",
 *     confirmLabel: "Delete",
 *   });
 *   if (!ok) return;
 *
 *   // Render the dialog somewhere in your JSX (once per hook instance):
 *   return <>...{confirmDialog}</>;
 *
 * Why a hook and not an imperative global `confirm()`? Using React state
 * keeps the dialog fully controlled, testable, and avoids portals to a
 * DOM mounted outside the app tree. The ergonomics are near-identical to
 * `window.confirm()` at call sites — just `await`-able.
 */

interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: ConfirmVariant;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  confirmTone?: "destructive" | "primary" | "warning" | "info";
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" });
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={open}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      title={opts.title}
      description={opts.description}
      variant={opts.variant ?? "destructive"}
      confirmLabel={opts.confirmLabel ?? "Confirm"}
      cancelLabel={opts.cancelLabel ?? "Cancel"}
      confirmTone={opts.confirmTone}
    />
  );

  return { confirm, confirmDialog };
}
