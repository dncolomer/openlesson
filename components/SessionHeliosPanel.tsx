"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import {
  GhcBackgroundLayers,
  GhcButton,
  GhcButtonLabel,
  GhcDialogueSplit,
  type GhcDialogueMessage,
  GHC_BACKGROUND_IMAGES,
} from "@/components/ghc/GhcUi";
import { TutorWelcome } from "@/components/TutorWelcome";

interface SessionHeliosPanelProps {
  lastUserTurn: GhcDialogueMessage | null;
  lastAssistantTurn: GhcDialogueMessage | null;
  isAssistantPending?: boolean;
  chapterPrompt: string;
  userInitial: string;
  isSessionActive: boolean;
  isInitializing?: boolean;
  isGeneratingProbe?: boolean;
  isChapterLoading?: boolean;
  loadingChapterLabel?: string | null;
  stuckCheckText?: string | null;
  showWelcome?: boolean;
  onWelcomePlay?: () => void;
  isStartingSession?: boolean;
  sessionId: string;
  ttsLanguage?: string;
  tutorName?: string;
  aestheticImages?: string[];
  aestheticName?: string;
  sessionControls?: ReactNode;
  thought: SessionThoughtInterface;
  hasPlanSteps?: boolean;
}

export function SessionHeliosPanel({
  lastUserTurn,
  lastAssistantTurn,
  isAssistantPending = false,
  chapterPrompt,
  userInitial,
  isSessionActive,
  isInitializing = false,
  isGeneratingProbe = false,
  isChapterLoading = false,
  loadingChapterLabel = null,
  stuckCheckText = null,
  showWelcome = false,
  onWelcomePlay,
  isStartingSession = false,
  sessionId,
  ttsLanguage,
  tutorName = "Helios",
  aestheticImages,
  aestheticName,
  sessionControls,
  thought,
  hasPlanSteps = true,
}: SessionHeliosPanelProps) {
  const { t } = useI18n();

  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    const pool = aestheticImages?.length ? aestheticImages : GHC_BACKGROUND_IMAGES;
    setBgImage(pool[Math.floor(Math.random() * pool.length)]);
  }, [aestheticImages, sessionId]);

  if (showWelcome) {
    return (
      <div className="relative h-full overflow-hidden bg-[#0a0a0a]">
        <GhcBackgroundLayers bgImage={bgImage} dimStrength="medium" />
        <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden">
          <TutorWelcome
            tutorName={tutorName}
            onPlay={() => onWelcomePlay?.()}
            isStarting={isStartingSession}
            sessionId={sessionId}
            ttsLanguage={ttsLanguage}
          />
        </div>
        {aestheticName && <div className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700">{aestheticName}</div>}
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#0a0a0a]">
      <GhcBackgroundLayers bgImage={bgImage} dimStrength="medium" />

      {isChapterLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a]/88 backdrop-blur-md">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-500/80" />
            <div className="absolute inset-0 animate-ping rounded-full border border-amber-500/20" />
          </div>
          <p className="mt-5 text-sm font-medium text-neutral-300">{t("chapterMap.loadingChapter")}</p>
          {loadingChapterLabel && (
            <p className="mt-2 max-w-md px-6 text-center text-base leading-relaxed text-neutral-400">{loadingChapterLabel}</p>
          )}
        </div>
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-3 p-3">
        {isInitializing && !hasPlanSteps ? (
          <div className="rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
            {sessionControls && (
              <div className="mb-3 flex w-full flex-col items-center gap-2 border-b border-neutral-900/80 pb-3">
                {sessionControls}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="h-6 w-6 animate-spin rounded-full border border-neutral-800 border-t-amber-500/70" />
              <p className="text-xs text-neutral-500">{t("probes.preparing")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-h-[42vh] flex-1 flex-col">
              <GhcDialogueSplit
                lastUserTurn={lastUserTurn}
                lastAssistantTurn={lastAssistantTurn}
                promptText={chapterPrompt}
                isSending={thought.isSending || isAssistantPending}
                error={thought.sendError}
                userInitial={userInitial}
                emptyUserTurnText={t("session.emptyUserTurn")}
              />
            </div>

            <div className="rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
              {sessionControls && (
                <div className="mb-3 flex w-full flex-col items-center gap-2 border-b border-neutral-900/80 pb-3">
                  {sessionControls}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300">
                  <span className="min-w-0 truncate">
                    {thought.interimText}
                  </span>
                </div>
                <GhcButton size="sm" disabled={!thought.crystallizableText} onClick={thought.crystallizeCurrentTranscription}>
                  <GhcButtonLabel shortcut="C">crystallize</GhcButtonLabel>
                </GhcButton>
                <GhcButton
                  size="sm"
                  disabled={thought.selectedActiveThoughts.length < 2}
                  onClick={() =>
                    void thought.sendThought(
                      thought.selectedActiveThoughts.map((entry) => entry.text).join("\n"),
                      thought.selectedActiveThoughts.map((entry) => entry.id),
                    )
                  }
                >
                  <GhcButtonLabel shortcut="S">send ({thought.selectedActiveThoughts.length})</GhcButtonLabel>
                </GhcButton>
                <GhcButton size="sm" disabled={thought.activeThoughts.length === 0} onClick={thought.skipCurrentThought}>
                  <GhcButtonLabel shortcut="Esc">skip</GhcButtonLabel>
                </GhcButton>
              </div>

              <div className="mt-3 border-t border-neutral-900/80 pt-3">
                <p className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-600">{t("probes.activeThoughts")}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {thought.latestThoughts.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`group flex h-32 max-h-32 flex-col gap-1.5 overflow-hidden rounded-xl border bg-black/70 p-3 text-left transition hover:border-white/50 ${
                        thought.selectedActiveThoughtIds.has(entry.id) ? "border-white/70" : "border-neutral-800"
                      }`}
                    >
                      <p className="shrink-0 text-[10px] uppercase tracking-[1.8px] text-neutral-500">Thought {index + 1}</p>
                      <p className="min-h-0 flex-1 overflow-hidden text-sm leading-relaxed text-neutral-200 line-clamp-3" title={entry.text}>
                        {entry.text}
                      </p>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-neutral-900 pt-2">
                        <GhcButton
                          size="sm"
                          variant={thought.selectedActiveThoughtIds.has(entry.id) ? "toggleOn" : "toggleOff"}
                          onClick={(event) => {
                            event.stopPropagation();
                            thought.toggleActiveThought(entry.id);
                          }}
                        >
                          {thought.selectedActiveThoughtIds.has(entry.id) ? (
                            "selected"
                          ) : (
                            <GhcButtonLabel shortcut={["⇧", String(index + 1)]}>select</GhcButtonLabel>
                          )}
                        </GhcButton>
                        <GhcButton size="sm" onClick={() => void thought.sendThought(entry.text, [entry.id])}>
                          <GhcButtonLabel shortcut={index + 1}>send</GhcButtonLabel>
                        </GhcButton>
                      </div>
                    </div>
                  ))}
                  {thought.latestThoughts.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-neutral-800 bg-black/70 p-4 text-center text-xs text-neutral-600">
                      {t("probes.speakToCreateThoughts")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {aestheticName && <div className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700">{aestheticName}</div>}
    </div>
  );
}