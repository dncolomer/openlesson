"use client";

import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { VoiceBarUtilityRow, type Tool } from "@/components/ToolsPanel";
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
  return (
    <div
      data-ile-voice-bar
      data-ile-transcription-region
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 w-full rounded-none border-t border-neutral-800 bg-neutral-950/95"
    >
      <div
        data-ile-transcription-box
        className="flex w-full min-w-0 items-center gap-2 px-3 pt-2"
      >
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-none border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300">
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
            className="shrink-0 rounded-none border border-neutral-600/40 bg-neutral-800/10 px-2 py-1 text-[10px] font-medium text-neutral-300 transition hover:border-neutral-500/60 hover:bg-neutral-800/20"
          >
            {thought.speechError ? "Retry" : "Start"}
          </button>
        ) : null}
      </div>
      <div className="px-3 pb-2 pt-1.5">
        <VoiceBarUtilityRow
          activeTool={activeTool}
          onToolChange={onToolChange}
          onBackToDashboard={onBackToDashboard}
          errorNotification={errorNotification}
        />
      </div>
    </div>
  );
}
