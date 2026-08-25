"use client";

import { useEffect, useState } from "react";
import {
  closeIleImDoneAnswering,
  collectUnflaggedIleDoneAnsweringPow,
  type IleEndOfChainOfThoughtEvent,
  type IleImDoneAnsweringThought,
} from "@/lib/ile-im-done-answering";

/**
 * Standard white spoken close. Distinct outline from compact Del/Edit chips.
 * Not a semicircle-bump / SVG shape.
 */
export function ImDoneAnsweringButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-ile-im-done-answering
      data-im-done-answering
      aria-label="I'm done answering"
      title="I'm done answering"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-sm border-2 border-neutral-900 bg-white px-4 py-2.5 text-[13px] font-semibold tracking-[0.04em] text-neutral-900 outline outline-1 outline-offset-2 outline-white/70 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      I'm done answering
    </button>
  );
}

export function ImDoneAnsweringControl({
  thoughts,
  formingText,
  sendThought,
  logEndOfChainOfThought,
  onClearForming,
  disabled,
  sessionId,
}: {
  thoughts: readonly IleImDoneAnsweringThought[];
  formingText?: string | null;
  sendThought: (text: string, thoughtIds: string[]) => void | Promise<void>;
  logEndOfChainOfThought: (event: IleEndOfChainOfThoughtEvent) => void;
  onClearForming?: () => void;
  disabled?: boolean;
  sessionId?: string;
}) {
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const unflagged = collectUnflaggedIleDoneAnsweringPow({
    thoughts,
    flaggedIds,
    formingText,
  });

  useEffect(() => {
    setFlaggedIds(new Set());
  }, [sessionId]);

  return (
    <ImDoneAnsweringButton
      disabled={disabled || !unflagged.text}
      onClick={() => {
        void closeIleImDoneAnswering({
          thoughts,
          flaggedIds,
          formingText,
          sendThought,
          logEndOfChainOfThought,
          onClearForming,
        }).then((result) => {
          setFlaggedIds(result.flaggedIds);
        });
      }}
    />
  );
}
