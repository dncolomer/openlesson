"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface BlockDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BlockDetailDrawer({ open, onClose, title, children }: BlockDetailDrawerProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/55 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || t("sessionList.sessions")}
          className="flex w-full max-w-5xl flex-col overflow-hidden rounded-none border border-neutral-800/90 bg-[#0b0b0b] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800/60 px-4 py-2.5">
            <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              {title || t("sessionList.sessions")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-none text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white"
              title={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-hidden p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </>
  );
}