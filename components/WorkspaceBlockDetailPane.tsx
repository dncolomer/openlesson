"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Right-column chrome for open block detail (replaces notes/files surface).
 * Not a map-covering modal — lives in the workspace right pane only.
 */
export function WorkspaceBlockDetailPane({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div
      data-workspace-right-pane="block-detail"
      data-workspace-block-detail-pane
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-950/90 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800/70 px-3 py-2.5 sm:px-4">
        <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
          {title || t("sessionList.sessions")}
        </p>
        <button
          type="button"
          data-block-detail-close
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700/80 bg-neutral-900/80 text-neutral-300 transition-colors hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
          title={t("common.close")}
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 sm:p-4">
        {children}
      </div>
    </div>
  );
}
