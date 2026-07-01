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
      <div
        className="absolute inset-0 z-20 bg-black/45"
        onClick={onClose}
      />
      <aside
        className="absolute bottom-0 right-0 top-0 z-30 flex w-[min(440px,92%)] flex-col border-l border-neutral-800/80 bg-[#0b0b0b] shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800/60 px-3 py-2.5">
          <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            {title || t("sessionList.sessions")}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white"
            title={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
    </>
  );
}