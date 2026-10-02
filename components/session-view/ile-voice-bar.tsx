"use client";

import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import type { Tool } from "@/components/ToolsPanel";
import {
  ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS,
  ILE_VOICE_BAR_HEIGHT_CLASS,
} from "@/lib/ile-map-chrome";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";

export function IleVoiceBar({
  thought,
  activeTool,
  onToolChange,
  onBackToDashboard,
  errorNotification = false,
}: {
  thought: SessionThoughtInterface;
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onBackToDashboard?: () => void;
  errorNotification?: boolean;
}) {
  const buttonClass =
    "pointer-events-auto h-7 shrink-0 rounded-none border border-neutral-600 bg-neutral-900 px-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-100 hover:border-white hover:text-white";

  return (
    <div
      data-ile-voice-bar
      data-ile-transcription-region
      className={`pointer-events-auto absolute inset-x-0 bottom-0 ${ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS} w-full overflow-hidden rounded-none border-t border-neutral-800 bg-black`}
    >
      <div className={`flex ${ILE_VOICE_BAR_HEIGHT_CLASS} w-full min-w-0 items-center gap-2 px-2`}>
        <div
          data-ile-transcription-box
          className="flex h-7 min-w-0 flex-1 items-center rounded-none border border-neutral-900 bg-black/70 px-2 text-xs text-neutral-300"
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
            className="h-7 shrink-0 rounded-none border border-neutral-700 px-2 text-[10px] text-neutral-300"
          >
            {thought.speechError ? "Retry" : "Start"}
          </button>
        ) : null}
        <button
          type="button"
          data-ile-bar-data
          aria-pressed={activeTool === "data-input"}
          onClick={() => onToolChange("data-input")}
          className={buttonClass}
        >
          Data
        </button>
        <button
          type="button"
          data-ile-bar-logs
          aria-pressed={activeTool === "logs"}
          onClick={() => onToolChange("logs")}
          className={buttonClass}
        >
          Logs
          {errorNotification ? (
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
          ) : null}
        </button>
        {onBackToDashboard ? (
          <button
            type="button"
            data-ile-bar-save
            data-save-and-exit
            onClick={onBackToDashboard}
            className={`${buttonClass} border-white bg-white text-neutral-950 hover:bg-neutral-200`}
          >
            Save
          </button>
        ) : null}
      </div>
    </div>
  );
}
