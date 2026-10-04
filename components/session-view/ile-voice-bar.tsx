"use client";

import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import {
  ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS,
  ILE_VOICE_BAR_HEIGHT_CLASS,
} from "@/lib/ile-map-chrome";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";

export function IleVoiceBar({ thought }: { thought: SessionThoughtInterface }) {
  return (
    <div
      data-ile-voice-bar
      data-ile-transcription-region
      className={`pointer-events-auto relative flex w-full shrink-0 flex-col gap-1 overflow-hidden rounded-none border-t border-white/25 bg-black/92 px-1.5 py-1 ${ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS}`}
    >
      <div className={`flex ${ILE_VOICE_BAR_HEIGHT_CLASS} w-full min-w-0 items-center gap-1`}>
        <div
          data-ile-transcription-box
          className="flex h-7 min-w-0 flex-1 items-center rounded-none border border-white/30 bg-black px-2 font-mono text-[11px] tracking-wide text-white/80"
        >
          <SlidingTranscript
            text={formatSpeechTranscriptDisplay({
              text: thought.crystallizableText,
              speechError: thought.speechError,
              speechSupported: thought.speechSupported,
              isListening: thought.isListening,
              enabled: thought.speechEnabled,
            })}
            className={`w-full ${thought.speechError ? "text-neutral-300/90" : "text-neutral-300"}`}
          />
        </div>
        {thought.speechEnabled &&
        thought.speechSupported !== false &&
        !thought.isListening ? (
          <button
            type="button"
            onClick={() => void thought.retryMicrophone()}
            className="h-7 shrink-0 rounded-none border border-white/70 bg-black px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white hover:bg-white hover:text-black"
          >
            {thought.speechError ? "Retry" : "Start"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Exit. Mounted in the sidebar actions row, under the transcript. */
export function IleVoiceBarActions({
  onBackToDashboard,
  showSave = true,
}: {
  onBackToDashboard?: () => void;
  /** Section flag from `sessionSidebarHasSection`. */
  showSave?: boolean;
}) {
  if (!(showSave && onBackToDashboard)) return null;

  return (
    <div data-ile-voice-bar-actions className="flex w-full min-w-0 items-center gap-1">
      <button
        type="button"
        data-ile-bar-save
        data-save-and-exit
        onClick={onBackToDashboard}
        className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} flex-1`}
      >
        Exit
      </button>
    </div>
  );
}
