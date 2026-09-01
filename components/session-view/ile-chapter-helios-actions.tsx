"use client";

import type { ReactNode } from "react";

export type IleChapterHeliosActionsProps = {
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  locale?: string;
  chapterId: string | null;
  chapterIndex: number;
  chapterDescription: string;
  chapterCompleted: boolean;
  activeChapterIndex: number;
  onChapterDone: (opts?: { closeOverride?: boolean }) => void;
  onUpdateChapter: (stepId: string, description: string) => Promise<void>;
  closeReviewBlocked?: boolean;
  closeReviewReason?: string | null;
  onGatherResources?: () => void;
  gatherBusy?: boolean;
  gatherWarning?: string | null;
  onDismissGatherWarning?: () => void;
  /** Spoken-turn close — the only remaining chapter-widget action. */
  doneAnswering?: ReactNode;
};

export function IleChapterHeliosActions({
  doneAnswering,
}: IleChapterHeliosActionsProps) {
  if (!doneAnswering) return null;
  return (
    <div
      data-ile-chapter-actions
      data-ile-chapter-helios-actions
      className="shrink-0 border-t border-neutral-800 pt-2"
    >
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        Actions
      </p>
      {doneAnswering}
    </div>
  );
}
