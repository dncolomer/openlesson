"use client";

import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { VoiceBarUtilityRow, type Tool } from "@/components/ToolsPanel";
import { IleVoiceActionPad } from "@/components/session-view/ile-voice-action-pad";
import { ILE_VOICE_BAR_HEIGHT_CLASS } from "@/lib/ile-map-chrome";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import type { IleVoicePadSpec } from "@/lib/block-circular-menu";
import type { BlockCircularMenuActionId } from "@/lib/block-circular-menu";

export function IleVoiceBar({
  thought,
  activeTool,
  onToolChange,
  onBackToDashboard,
  errorNotification = false,
  showOpenPicInPic = false,
  onOpenPicInPic,
  chapterTitle,
  chapterDescription,
  chapterAestheticSrc,
  actionPad = null,
  onActionPad,
}: {
  thought: SessionThoughtInterface;
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onBackToDashboard?: () => void;
  errorNotification?: boolean;
  showOpenPicInPic?: boolean;
  onOpenPicInPic?: () => void;
  chapterTitle?: string | null;
  chapterDescription?: string | null;
  chapterAestheticSrc?: string | null;
  actionPad?: IleVoicePadSpec | null;
  onActionPad?: (id: BlockCircularMenuActionId) => void;
}) {
  const title = String(chapterTitle || "").trim();
  const description = String(chapterDescription || "").trim();
  const aesthetic = String(chapterAestheticSrc || "").trim();
  const hasChapter = Boolean(title || description);

  return (
    <div
      data-ile-voice-bar
      data-ile-transcription-region
      data-ile-voice-chapter={hasChapter ? "true" : undefined}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 w-full overflow-hidden rounded-none border-t border-neutral-800 bg-neutral-950/95"
    >
      {aesthetic ? (
        <>
          <div
            data-ile-voice-aesthetic
            aria-hidden
            className="absolute inset-0 bg-cover bg-left"
            style={{ backgroundImage: `url(${aesthetic})` }}
          />
          <div
            data-ile-voice-aesthetic-fade
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(10,10,10,0.06) 0%, rgba(10,10,10,0.28) 16%, rgba(10,10,10,0.88) 42%, #000 55%, #000 100%)",
            }}
          />
        </>
      ) : null}
      <div className={`relative z-10 flex ${ILE_VOICE_BAR_HEIGHT_CLASS} w-full min-w-0 items-stretch`}>
        <div className="flex min-w-0 flex-1 items-stretch gap-2 px-3 py-2">
          {actionPad && actionPad.actions.length > 0 && onActionPad ? (
            <IleVoiceActionPad
              actions={actionPad.actions}
              disabledIds={actionPad.disabledIds}
              onAction={onActionPad}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-2">
            {hasChapter ? (
              <div
                data-ile-voice-chapter-brief
                className="min-h-0 flex-1 overflow-y-auto rounded-none border border-white/15 bg-black/35 px-3 py-2.5"
              >
                {title ? (
                  <p
                    data-ile-voice-chapter-title
                    className="text-sm font-semibold leading-snug text-white"
                  >
                    {title}
                  </p>
                ) : null}
                {description && description !== title ? (
                  <p
                    data-ile-voice-chapter-description
                    className={`whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-200 ${
                      title ? "mt-1.5" : ""
                    }`}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              data-ile-transcription-box
              className="flex h-8 min-w-0 shrink-0 items-center rounded-none border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300"
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
          </div>
          {thought.speechEnabled &&
          thought.speechSupported !== false &&
          !thought.isListening ? (
            <button
              type="button"
              onClick={() => void thought.retryMicrophone()}
              className="shrink-0 self-end rounded-none border border-neutral-600/40 bg-neutral-800/10 px-2 py-1 text-[10px] font-medium text-neutral-300 transition hover:border-neutral-500/60 hover:bg-neutral-800/20"
            >
              {thought.speechError ? "Retry" : "Start"}
            </button>
          ) : null}
        </div>
        <VoiceBarUtilityRow
          activeTool={activeTool}
          onToolChange={onToolChange}
          onBackToDashboard={onBackToDashboard}
          errorNotification={errorNotification}
          showOpenPicInPic={showOpenPicInPic}
          onOpenPicInPic={onOpenPicInPic}
        />
      </div>
    </div>
  );
}
