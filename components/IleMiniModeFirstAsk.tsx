"use client";

import { ileMiniModeFirstAskCopy } from "@/lib/ile-blur-screenshare";

/**
 * First-time ILE mini-mode ask. Accept must be a real click so PiP/popup
 * can open from a user gesture.
 */
export function IleMiniModeFirstAsk({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const copy = ileMiniModeFirstAskCopy();
  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-6 z-50 mx-auto w-[min(100%-2rem,26rem)] rounded-xl border border-neutral-700 bg-neutral-950/95 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      data-ile-mini-first-ask
      role="dialog"
      aria-labelledby="ile-mini-first-ask-title"
      aria-describedby="ile-mini-first-ask-body"
    >
      <h2
        id="ile-mini-first-ask-title"
        className="text-sm font-semibold text-white"
      >
        {copy.title}
      </h2>
      <p
        id="ile-mini-first-ask-body"
        className="mt-2 text-[13px] leading-relaxed text-neutral-300"
      >
        {copy.body}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-ile-mini-first-ask-decline
          onClick={onDecline}
          className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-300 hover:border-neutral-500 hover:text-white"
        >
          {copy.decline}
        </button>
        <button
          type="button"
          data-ile-mini-first-ask-accept
          onClick={onAccept}
          className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-neutral-200"
        >
          {copy.accept}
        </button>
      </div>
    </div>
  );
}
