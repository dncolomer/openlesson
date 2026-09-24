"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import {
  ILE_SESSION_IMPURITY_BODY,
  ILE_SESSION_IMPURITY_KICKER,
  ILE_SESSION_IMPURITY_LOG_OFF,
  ILE_SESSION_IMPURITY_SAVE,
  ILE_SESSION_IMPURITY_TITLE,
  ILE_SILENCE_REST_BODY,
  ILE_SILENCE_REST_SAVE_AND_LEAVE,
  ILE_SILENCE_REST_TITLE,
  ileImpurityExitPlan,
  ileRestUnlock,
} from "@/lib/practice-voice-challenge";

/** Paint above the session. A fixed layer inside the flex stage gets clipped. */
export function mountIleSilenceScreen(node: ReactNode): ReactNode {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export function IleSilenceRestScreen({
  lockCount,
  onUnlock,
  onSaveAndLeave,
}: {
  lockCount: number;
  onUnlock: () => void;
  onSaveAndLeave: () => void;
}) {
  return (
    <div
      data-ile-silence-rest=""
      data-ile-silence-lock-count={lockCount}
      className="fixed inset-0 z-[180] flex flex-col items-center justify-center bg-neutral-950 px-6 text-white"
    >
      <div className="w-full max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          {ILE_SILENCE_REST_TITLE}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{ILE_SILENCE_REST_TITLE}</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{ILE_SILENCE_REST_BODY}</p>
        <PracticeVoiceChallenge
          variant="ile"
          framing="rest"
          onPass={() => {
            if (ileRestUnlock({ challengePassed: true, lockCount }).locked) return;
            onUnlock();
          }}
        />
        <button
          type="button"
          data-ile-silence-save-and-leave=""
          onClick={() => {
            const plan = ileImpurityExitPlan("save");
            if (!plan.persistSession || !plan.leave) return;
            onSaveAndLeave();
          }}
          className="mt-4 inline-flex w-full items-center justify-center border border-white/20 px-4 py-3 text-sm font-semibold text-white"
        >
          {ILE_SILENCE_REST_SAVE_AND_LEAVE}
        </button>
      </div>
    </div>
  );
}

export function IleSessionImpurityScreen({
  lockCount,
  onSave,
  onLogOff,
}: {
  lockCount: number;
  onSave: () => void;
  onLogOff: () => void;
}) {
  return (
    <div
      data-ile-session-impurity=""
      data-ile-silence-lock-count={lockCount}
      className="fixed inset-0 z-[180] flex flex-col items-center justify-center bg-neutral-950 px-6 text-white"
    >
      <div className="w-full max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          {ILE_SESSION_IMPURITY_KICKER}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{ILE_SESSION_IMPURITY_TITLE}</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{ILE_SESSION_IMPURITY_BODY}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            data-ile-impurity-save=""
            onClick={() => {
              const plan = ileImpurityExitPlan("save");
              if (!plan.persistSession) return;
              onSave();
            }}
            className="inline-flex flex-1 items-center justify-center bg-white px-4 py-3 text-sm font-semibold text-neutral-950"
          >
            {ILE_SESSION_IMPURITY_SAVE}
          </button>
          <button
            type="button"
            data-ile-impurity-logoff=""
            onClick={() => {
              const plan = ileImpurityExitPlan("logoff");
              if (!plan.leave) return;
              onLogOff();
            }}
            className="inline-flex flex-1 items-center justify-center border border-white/20 px-4 py-3 text-sm font-semibold text-white"
          >
            {ILE_SESSION_IMPURITY_LOG_OFF}
          </button>
        </div>
      </div>
    </div>
  );
}
