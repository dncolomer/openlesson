"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
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
  speechLang,
}: {
  lockCount: number;
  onUnlock: () => void;
  onSaveAndLeave: () => void;
  speechLang?: string | null;
}) {
  return (
    <SessionFinishedScreen
      overlay
      data-ile-silence-rest=""
      data-ile-silence-lock-count={lockCount}
      kicker={ILE_SILENCE_REST_TITLE}
      title={ILE_SILENCE_REST_TITLE}
      body={ILE_SILENCE_REST_BODY}
      actions={
        <button
          type="button"
          data-ile-silence-save-and-leave=""
          onClick={() => {
            const plan = ileImpurityExitPlan("save");
            if (!plan.persistSession || !plan.leave) return;
            onSaveAndLeave();
          }}
          className="inline-flex w-full items-center justify-center border border-white/20 px-4 py-3 text-sm font-semibold text-white"
        >
          {ILE_SILENCE_REST_SAVE_AND_LEAVE}
        </button>
      }
    >
      <PracticeVoiceChallenge
        variant="ile"
        framing="rest"
        lang={speechLang}
        onPass={() => {
          if (ileRestUnlock({ challengePassed: true, lockCount }).locked) return;
          onUnlock();
        }}
      />
    </SessionFinishedScreen>
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
    <SessionFinishedScreen
      overlay
      data-ile-session-impurity=""
      data-ile-silence-lock-count={lockCount}
      kicker={ILE_SESSION_IMPURITY_KICKER}
      title={ILE_SESSION_IMPURITY_TITLE}
      body={ILE_SESSION_IMPURITY_BODY}
      actions={
        <>
          <button
            type="button"
            data-ile-impurity-save=""
            onClick={() => {
              const plan = ileImpurityExitPlan("save");
              if (!plan.persistSession) return;
              onSave();
            }}
            className="inline-flex items-center justify-center bg-white px-4 py-3 text-sm font-semibold text-neutral-950"
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
            className="inline-flex items-center justify-center border border-white/20 px-4 py-3 text-sm font-semibold text-white"
          >
            {ILE_SESSION_IMPURITY_LOG_OFF}
          </button>
        </>
      }
    />
  );
}
