"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThoughtCompactAction, type HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { ImDoneAnsweringControl } from "@/components/thought-ui/ImDoneAnsweringButton";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import {
  TAP_IM_DONE_CONFIRM_BODY,
  TAP_IM_DONE_CONFIRM_CANCEL,
  TAP_IM_DONE_CONFIRM_CONFIRM,
  TAP_IM_DONE_CONFIRM_TITLE,
} from "@/lib/tap-thought-memory";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionIdentityBadge } from "@/components/SessionIdentityBadge";
import { TapPracticePill } from "@/components/tap-score/tap-practice-pill";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import {
  type Phase,
  type Thought,
  type TapChatMessage as ChatMessage,
  formatCountdown,
  normalize,
} from "@/lib/tap-score-client-helpers";
import {
  applyTapAssistantTurnsToWorkCanvas,
  applyTapHeliosReplyToWorkCanvas,
  buildTapCanvasSnapshotUploadItem,
  buildTapExcalidrawToolUploadItem,
  emptyTapWorkCanvasScene,
  serializeTapWorkCanvasScene,
  tapHeliosCanvasBusy,
  tapWorkCanvasAskUserMessage,
  tapWorkCanvasBoardId,
  tapWorkCanvasShouldAcceptSceneUpdate,
  uploadTapWorkCanvasPow,
} from "@/lib/tap-work-canvas";
import { ILE_POW_DEBOUNCE_MS } from "@/lib/ile-realtime-pow";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";
import type { MutableRefObject } from "react";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function TapScorePhases(props: {
  phase: Phase;
  bgImage: string | null;
  t: Translate;
  workspaceTitle: string;
  minutes: number;
  setMinutes: (n: number) => void;
  conversationLanguage: SpokenLocale;
  setConversationLanguage: (locale: SpokenLocale) => void;
  privateToken?: string;
  durationLocked: boolean;
  isStartingSession: boolean;
  startingTopics: TapStartingTopic[];
  startingTopicId: string | null;
  topicsError: string;
  error: string;
  startSession: (topicOrOptions?: TapStartingTopic | { practice: true; topic?: TapStartingTopic }) => void;
  participantIdentity: PowParticipantIdentity | null;
  isPracticeMode: boolean;
  lastUserTurn: ChatMessage | null;
  lastAssistantTurn: ChatMessage | null;
  messages: ChatMessage[];
  isSending: boolean;
  heliosTurnMode: HeliosTurnMode;
  userInitial: string;
  remainingSeconds: number;
  sessionPurity: number;
  crystallizableText: string;
  showEndSession: boolean;
  endSession: () => void;
  speechError: string | null;
  speechSupported: boolean | null;
  isListening: boolean;
  transcriptSilenceMs: number;
  retryMicrophone: () => void;
  sendCurrentTranscription: () => void;
  stashCurrentTranscription: () => void;
  beginEditTranscription: () => void;
  stashedThoughts: Thought[];
  sendThought: (text: string, thoughtIds: string[]) => void;
  onEditThought: (thought: Thought, nextText: string) => void;
  onDeleteThought: (thought: Thought) => void;
  thoughtHistory: Thought[];
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  resultsError: string;
  performanceReport: PerformanceReport | null;
  sessionEndedImpure: boolean;
  restartBriefingFlow: () => void;
  setPhase: (phase: Phase) => void;
  editingTranscription: { draft: string; originalText: string } | null;
  setEditingTranscription: (
    next:
      | { draft: string; originalText: string }
      | null
      | ((current: { draft: string; originalText: string } | null) => {
          draft: string;
          originalText: string;
        } | null),
  ) => void;
  logTapTrace: (input: {
    traceType: "system1" | "system2";
    action: "crystallize" | "pause_finalize" | "auto_stash" | "send" | "skip" | "select" | "deselect" | "resend" | "edit" | "remove" | "end_of_chain_of_thought";
    thoughtId?: string;
    thoughtIds?: string[];
    originalText?: string;
    text?: string;
    combined?: boolean;
  }) => void;
  clearTranscriptionDisplay: () => void;
  restartSpeechRecognitionSession: () => void;
  tapSessionId?: string | null;
  entryQueryParams?: Record<string, string | string[]>;
  workCanvasSceneRef: MutableRefObject<IleWorkCanvasScene | null>;
  sendCanvasAsk: (input: {
    prompt: string;
    selectedElements?: readonly IleWorkCanvasElement[] | null;
    scene: IleWorkCanvasScene;
  }) => Promise<{ text: string; elements?: unknown[] | null }>;
}) {
  const {
    phase,
    bgImage,
    t,
    workspaceTitle,
    minutes,
    setMinutes,
    conversationLanguage,
    setConversationLanguage,
    privateToken,
    durationLocked,
    isStartingSession,
    startingTopics,
    startingTopicId,
    topicsError,
    error,
    startSession,
    participantIdentity,
    isPracticeMode,
    lastAssistantTurn,
    messages,
    isSending,
    remainingSeconds,
    crystallizableText,
    showEndSession,
    endSession,
    speechError,
    speechSupported,
    isListening,
    retryMicrophone,
    stashCurrentTranscription,
    stashedThoughts,
    sendThought,
    onEditThought,
    onDeleteThought,
    thoughtHistory,
    workspaceId,
    blockId,
    sessionId,
    resultsError,
    performanceReport,
    sessionEndedImpure,
    restartBriefingFlow,
    setPhase,
    editingTranscription,
    setEditingTranscription,
    logTapTrace,
    clearTranscriptionDisplay,
    restartSpeechRecognitionSession,
    tapSessionId,
    entryQueryParams,
    workCanvasSceneRef,
    sendCanvasAsk,
  } = props;

  const [workCanvasScene, setWorkCanvasScene] = useState<IleWorkCanvasScene>(() =>
    emptyTapWorkCanvasScene(),
  );
  const [canvasApplyElements, setCanvasApplyElements] = useState<IleWorkCanvasElement[]>([]);
  const [canvasApplyNonce, setCanvasApplyNonce] = useState(0);
  const sceneRef = useRef(workCanvasScene);
  const appliedAssistantIdsRef = useRef<Set<string>>(new Set());
  const lastExcalidrawPowKeyRef = useRef("");
  const lastCanvasPowHashRef = useRef("");
  const canvasPowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncScene = useCallback(
    (next: IleWorkCanvasScene) => {
      sceneRef.current = next;
      workCanvasSceneRef.current = next;
      setWorkCanvasScene(next);
    },
    [workCanvasSceneRef],
  );

  useEffect(() => {
    sceneRef.current = workCanvasScene;
    workCanvasSceneRef.current = workCanvasScene;
  }, [workCanvasScene, workCanvasSceneRef]);

  useEffect(() => {
    if (phase !== "live") {
      appliedAssistantIdsRef.current = new Set();
      const empty = emptyTapWorkCanvasScene();
      syncScene(empty);
      setCanvasApplyElements([]);
    }
  }, [phase, syncScene]);

  const heliosBusy = tapHeliosCanvasBusy({
    isSending,
    isStartingSession,
    hasAssistantTurn: Boolean(lastAssistantTurn),
  });

  useEffect(() => {
    if (phase !== "live") return;
    const assistantTurns = (messages ?? []).filter(
      (message) => message.role === "assistant" && String(message.content || "").trim(),
    );
    if (!assistantTurns.length) return;
    const missing = assistantTurns.filter((turn) => !appliedAssistantIdsRef.current.has(turn.id));
    const boardEmpty = !sceneRef.current.elements.some((el) => !el.isDeleted);
    if (!missing.length && !boardEmpty) return;
    const prevIds = new Set(sceneRef.current.elements.map((el) => el.id));
    const next = boardEmpty
      ? applyTapAssistantTurnsToWorkCanvas(emptyTapWorkCanvasScene(), assistantTurns)
      : applyTapHeliosReplyToWorkCanvas(
          sceneRef.current,
          lastAssistantTurn?.content,
          null,
          lastAssistantTurn?.id,
        );
    for (const turn of assistantTurns) appliedAssistantIdsRef.current.add(turn.id);
    const added = next.elements.filter((el) => !prevIds.has(el.id));
    if (!added.length && !boardEmpty) return;
    syncScene(next);
    setCanvasApplyElements(added.length ? added : next.elements);
    setCanvasApplyNonce((n) => n + 1);
  }, [lastAssistantTurn?.id, lastAssistantTurn?.content, messages, phase, syncScene]);

  const handleExcalidrawTool = useCallback(
    (input: { activeTool?: string | null; elementType?: string | null }) => {
      const sessionKey = String(tapSessionId || sessionId || "").trim();
      if (!sessionKey) return;
      const item = buildTapExcalidrawToolUploadItem(sessionKey, {
        ...input,
        metadata: { via: "excalidraw", product: "tap" },
      });
      if (!item) return;
      const key = `${item.toolName}:${item.toolAction}`;
      if (lastExcalidrawPowKeyRef.current === key) return;
      lastExcalidrawPowKeyRef.current = key;
      void uploadTapWorkCanvasPow({
        workspaceId,
        blockId,
        sessionId,
        privateToken,
        tapSessionId,
        entryQueryParams,
        practice: isPracticeMode,
        item,
      });
    },
    [
      blockId,
      entryQueryParams,
      isPracticeMode,
      privateToken,
      sessionId,
      tapSessionId,
      workspaceId,
    ],
  );

  const handleSceneChange = useCallback(
    (data: { elements: unknown[]; appState: unknown; files: unknown }) => {
      const scene = serializeTapWorkCanvasScene(data);
      if (!tapWorkCanvasShouldAcceptSceneUpdate(sceneRef.current, scene)) return;
      sceneRef.current = scene;
      workCanvasSceneRef.current = scene;
      setWorkCanvasScene(scene);
      const sessionKey = String(tapSessionId || sessionId || "").trim();
      if (!sessionKey) return;
      const snapshot = JSON.stringify(scene);
      if (snapshot === lastCanvasPowHashRef.current) return;
      if (canvasPowTimerRef.current) clearTimeout(canvasPowTimerRef.current);
      canvasPowTimerRef.current = setTimeout(() => {
        lastCanvasPowHashRef.current = snapshot;
        const item = buildTapCanvasSnapshotUploadItem(sessionKey, snapshot);
        void uploadTapWorkCanvasPow({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId,
          entryQueryParams,
          practice: isPracticeMode,
          item,
        });
      }, ILE_POW_DEBOUNCE_MS);
    },
    [
      blockId,
      entryQueryParams,
      isPracticeMode,
      privateToken,
      sessionId,
      tapSessionId,
      workCanvasSceneRef,
      workspaceId,
    ],
  );

  const handleAskSelected = useCallback(
    async (input: {
      prompt: string;
      selectedElements: IleWorkCanvasElement[];
      scene: IleWorkCanvasScene;
    }) => {
      const userText = tapWorkCanvasAskUserMessage({
        prompt: input.prompt,
        selectedElements: input.selectedElements,
      });
      return sendCanvasAsk({
        prompt: userText,
        selectedElements: input.selectedElements,
        scene: input.scene,
      });
    },
    [sendCanvasAsk],
  );

  return (
    <main className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white selection:bg-zinc-700">
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && (
          <section className="relative flex min-h-0 flex-1" data-tap-briefing-layout="sections">
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
                <SessionOnboardingGuide
                  variant="tap"
                  hideStep3Quote
                  renderStep3Action={() => (
                    <>
                      <TapStartingTopicCards
                        topics={startingTopics}
                        isStarting={isStartingSession}
                        startingTopicId={startingTopicId}
                        onStartTopic={(selectedTopic) => void startSession(selectedTopic)}
                        onPracticeFirst={() => void startSession({ practice: true })}
                        practiceTitle={t("tap.practice.practiceFirst")}
                        practiceSubtitle={t("tap.practice.practiceFirstHint")}
                        practiceStartLabel={t("tap.practice.cardStart")}
                        practiceStartingLabel={t("tap.practice.starting")}
                        loadingLabel={t("tap.briefing.topicsLoading")}
                        startLabel={t("onboardingGuide.tap.step3.start")}
                        startingLabel={t("onboardingGuide.tap.step3.starting")}
                      />
                      {topicsError ? (
                        <p className="mt-2 text-center text-xs text-neutral-300/90">{topicsError}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>
              <TapAestheticSection bgImage={bgImage} kind="shortcuts">
                <TapBriefingConfig
                  workspaceTitle={workspaceTitle}
                  minutes={minutes}
                  onMinutesChange={setMinutes}
                  conversationLanguage={conversationLanguage}
                  onConversationLanguageChange={(locale) =>
                    setConversationLanguage(coerceSpokenLocale(locale))
                  }
                  showDurationPicker={!privateToken && !durationLocked}
                  disabled={isStartingSession}
                />
              </TapAestheticSection>
              {error ? (
                <p className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5 text-center text-sm text-red-300 lg:col-span-2">
                  {error}
                </p>
              ) : null}
            </div>
          </section>
        )}

        {phase === "live" && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              data-tap-convo-live-split
              className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden lg:grid-cols-2 lg:grid-rows-1"
            >
              <div
                data-tap-convo-work-canvas-pane
                className="relative min-h-0 min-w-0 overflow-hidden border-b border-neutral-800/60 lg:border-b-0 lg:border-r"
              >
                <ExcalidrawCanvas
                  key={`tap-work-canvas:${phase}`}
                  boardId={tapWorkCanvasBoardId(tapSessionId || sessionId)}
                  peerId="work"
                  initialSceneData={workCanvasScene}
                  applyElements={canvasApplyElements}
                  applyElementsNonce={canvasApplyNonce}
                  heliosBusy={heliosBusy}
                  onSceneChange={handleSceneChange}
                  onExcalidrawTool={handleExcalidrawTool}
                  onAskSelected={handleAskSelected}
                />
                {error ? (
                  <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 px-3 text-center text-xs text-red-300">
                    {error}
                  </p>
                ) : null}
              </div>

              <TapAestheticSection
                bgImage={bgImage}
                kind="convo-stash"
                className="min-h-0 min-w-0"
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div
                    className="flex w-full shrink-0 items-center gap-3 border-b border-neutral-800/60 bg-black/35 px-3 py-2"
                    data-tap-live-control-strip
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                          Time left
                        </div>
                        <div
                          className={`font-mono text-lg leading-none tabular-nums tracking-tight ${
                            remainingSeconds <= 60 ? "text-neutral-300" : "text-white"
                          }`}
                        >
                          {formatCountdown(remainingSeconds)}
                        </div>
                      </div>
                      {showEndSession ? (
                        <div className="flex shrink-0 items-center" data-tap-end-session>
                          <TapThoughtButton size="sm" variant="primary" onClick={() => void endSession()}>
                            End session
                          </TapThoughtButton>
                        </div>
                      ) : null}
                    </div>
                    {participantIdentity || isPracticeMode ? (
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {isPracticeMode ? (
                          <TapPracticePill label={t("tap.practice.bannerKicker")} />
                        ) : null}
                        <SessionIdentityBadge identity={participantIdentity} />
                      </div>
                    ) : null}
                  </div>
                  <div
                    data-tap-transcript-container
                    className="shrink-0 border-b border-neutral-800/60 bg-black/35 p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                      <div
                        className="flex h-8 min-w-0 flex-1 items-center rounded-none border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300"
                      >
                        <SlidingTranscript
                          text={formatSpeechTranscriptDisplay({
                            text: crystallizableText,
                            speechError,
                            speechSupported,
                            isListening,
                            enabled: phase === "live",
                          })}
                          className={`w-full ${speechError ? "text-neutral-300/90" : "text-neutral-300"}`}
                        />
                      </div>
                      {speechError && speechSupported !== false && !isListening ? (
                        <TapThoughtButton size="sm" variant="primary" onClick={() => void retryMicrophone()}>
                          Retry
                        </TapThoughtButton>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-0.5">
                        <ThoughtCompactAction
                          shortcut="Del"
                          label="Stash"
                          disabled={!crystallizableText}
                          onClick={() => stashCurrentTranscription()}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    data-tap-im-done-slot
                    className="shrink-0 border-b border-neutral-800/60 bg-black/35 px-3 py-2"
                  >
                    <ImDoneAnsweringControl
                      sessionId={sessionId}
                      thoughts={stashedThoughts}
                      formingText={crystallizableText}
                      sendThought={sendThought}
                      logEndOfChainOfThought={(event) =>
                        logTapTrace({
                          traceType: event.traceType,
                          action: event.action,
                          thoughtId: event.thoughtId,
                          thoughtIds: event.thoughtIds,
                          text: event.text,
                          combined: event.combined,
                        })
                      }
                      onClearForming={() => {
                        clearTranscriptionDisplay();
                        restartSpeechRecognitionSession();
                      }}
                      disabled={isSending}
                      confirmClose={{
                        title: TAP_IM_DONE_CONFIRM_TITLE,
                        body: TAP_IM_DONE_CONFIRM_BODY,
                        confirmLabel: TAP_IM_DONE_CONFIRM_CONFIRM,
                        cancelLabel: TAP_IM_DONE_CONFIRM_CANCEL,
                      }}
                    />
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-hidden bg-black/35 px-2 py-2"
                    data-tap-older-thoughts
                    data-tap-thought-memory-always
                  >
                    <ThoughtMemoryPanel
                      className="flex h-full min-h-0 max-h-full flex-col overflow-hidden"
                      listClassName="pr-1"
                      thoughts={thoughtHistory}
                      workspaceId={workspaceId}
                      blockId={blockId}
                      sessionId={sessionId}
                      insightSurface="tap"
                      allowInsightGeneration={false}
                      onEditThought={onEditThought}
                      onDeleteThought={onDeleteThought}
                      emptyMessage="Speak, press Del to stash thoughts, then edit or delete individual thoughts. I'm done answering closes your turn."
                    />
                  </div>
                </div>
              </TapAestheticSection>
            </div>
          </section>
        )}

        {phase === "saving" && (
          <section className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage
              tone="muted"
              message={
                isPracticeMode
                  ? t("tap.practice.saving")
                  : t("tap.postSession.savingAndReturning")
              }
            />
          </section>
        )}
        {phase === "practice_done" && !sessionEndedImpure ? (
          <section
            className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
            data-tap-practice-done
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
              {t("tap.practice.doneKicker")}
            </p>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100 sm:text-3xl">
              {t("tap.practice.doneTitle")}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
              {t("tap.practice.doneBody")}
            </p>
            <TapThoughtButton
              size="md"
              variant="primary"
              className="mt-8"
              data-tap-practice-restart
              onClick={restartBriefingFlow}
            >
              {t("tap.practice.restart")}
            </TapThoughtButton>
          </section>
        ) : null}
        {(phase === "results" || phase === "practice_done") && sessionEndedImpure ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-impure
            >
              <h1 className="text-2xl font-medium text-neutral-100 sm:text-3xl">
                {t("tap.postSession.impureTitle")}
              </h1>
              <p className="mt-4 max-w-lg whitespace-pre-line text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t("tap.postSession.impureBody")}
              </p>
              <TapThoughtButton
                size="md"
                variant="primary"
                className="mt-8"
                data-tap-impure-retry
                onClick={
                  phase === "practice_done"
                    ? restartBriefingFlow
                    : () => window.location.reload()
                }
              >
                {t("tap.postSession.impureTryAgain")}
              </TapThoughtButton>
            </section>
        ) : phase === "results" ? (
          privateToken ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-thank-you
            >
              <h1 className="text-2xl font-medium text-neutral-100 sm:text-3xl">
                {t("tap.postSession.thankYouTitle")}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t("tap.postSession.thankYouBody")}
              </p>
              <a
                href="/"
                data-tap-explore-uncertain-systems
                className="mt-8 inline-flex items-center justify-center rounded-none bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                {t("tap.postSession.exploreUncertainSystems")}
              </a>
            </section>
          ) : (
            <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto py-6">
              <h1 className="text-2xl font-medium text-neutral-100">{t("tap.postSession.resultsTitle")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">{t("tap.postSession.resultsHint")}</p>
              {performanceReport ? (
                <div className="mt-6 min-h-0 flex-1 rounded-none border border-neutral-800 bg-neutral-950/50 p-4 md:p-5">
                  <PerformanceReportCard
                    report={performanceReport}
                    layout="spacious"
                    fillHeight
                    label={t("tap.postSession.verificationResultsTitle")}
                  />
                </div>
              ) : null}
            </section>
          )
        ) : null}
        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-medium">Could not end TAP session</h1>
            <p className="mt-3 max-w-md text-sm text-red-300">{resultsError || error}</p>
            <TapThoughtButton size="md" variant="primary" className="mt-6" onClick={() => setPhase("briefing")}>
              Try again
            </TapThoughtButton>
          </section>
        )}
      </div>

      {editingTranscription ? (
        <ThoughtEditPanel
          draft={editingTranscription.draft}
          onDraftChange={(draft) => setEditingTranscription((current) => (current ? { ...current, draft } : null))}
          onCancel={() => setEditingTranscription(null)}
          onSend={() => {
            const draft = normalize(editingTranscription.draft);
            if (!draft) return;
            logTapTrace({
              traceType: "system2",
              action: "edit",
              originalText: editingTranscription.originalText,
              text: draft,
            });
            setEditingTranscription(null);
            clearTranscriptionDisplay();
            restartSpeechRecognitionSession();
            void sendThought(draft, []);
          }}
          isSending={isSending}
        />
      ) : null}
    </main>
  );
}
