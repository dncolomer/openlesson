"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
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
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-[13px] font-semibold tracking-[0.04em] text-neutral-900 outline outline-1 outline-offset-2 outline-white/70 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <MessageCircle className="size-3.5 shrink-0" aria-hidden />
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
  confirmClose,
}: {
  thoughts: readonly IleImDoneAnsweringThought[];
  formingText?: string | null;
  sendThought: (text: string, thoughtIds: string[]) => void | Promise<void>;
  logEndOfChainOfThought: (event: IleEndOfChainOfThoughtEvent) => void;
  onClearForming?: () => void;
  disabled?: boolean;
  sessionId?: string;
  confirmClose?: {
    title: string;
    body: string;
    confirmLabel?: string;
    cancelLabel?: string;
  };
}) {
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const unflagged = collectUnflaggedIleDoneAnsweringPow({
    thoughts,
    flaggedIds,
    formingText,
  });

  useEffect(() => {
    setFlaggedIds(new Set());
  }, [sessionId]);

  const runClose = () => {
    setConfirmOpen(false);
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
  };

  return (
    <>
      <ImDoneAnsweringButton
        disabled={disabled || !unflagged.text}
        onClick={() => {
          if (confirmClose) {
            setConfirmOpen(true);
            return;
          }
          runClose();
        }}
      />
      {confirmOpen && confirmClose ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-tap-im-done-confirm>
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
            aria-label={confirmClose.cancelLabel || "Cancel"}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tap-im-done-confirm-title"
            className="relative z-10 w-full max-w-md rounded-none border border-neutral-800 bg-neutral-950 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
          >
            <p id="tap-im-done-confirm-title" className="text-lg font-medium text-neutral-100">
              {confirmClose.title}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">{confirmClose.body}</p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                data-tap-im-done-confirm-cancel
                onClick={() => setConfirmOpen(false)}
                className="rounded-none border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
              >
                {confirmClose.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                data-tap-im-done-confirm-submit
                onClick={runClose}
                className="rounded-none border border-transparent bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200"
              >
                {confirmClose.confirmLabel || "I'm done answering"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
