"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThoughtCompactAction, type HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { ImDoneAnsweringControl } from "@/components/thought-ui/ImDoneAnsweringButton";
import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import {
  TAP_IM_DONE_CONFIRM_BODY,
  TAP_IM_DONE_CONFIRM_CANCEL,
  TAP_IM_DONE_CONFIRM_CONFIRM,
  TAP_IM_DONE_CONFIRM_TITLE,
} from "@/lib/tap-thought-memory";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import {
  releaseVoiceChallengeStartLatch,
  scoredTapBriefingStep,
  voiceChallengeStartSucceeded,
} from "@/lib/practice-voice-challenge";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import { TapPracticePill } from "@/components/tap-score/tap-practice-pill";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import type { SessionSidebarMode } from "@/lib/session-sidebar";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import {
  type Phase,
  type Thought,
  type TapChatMessage as ChatMessage,
  normalize,
} from "@/lib/tap-score-client-helpers";
import {
  applyTapAssistantTurnsToWorkCanvas,
  applyTapHeliosReplyToWorkCanvas,
  buildTapCanvasSnapshotUploadItem,
  buildTapWorkCanvasActionUploadItem,
  emptyTapWorkCanvasScene,
  serializeTapWorkCanvasScene,
  tapHeliosCanvasBusy,
  tapWorkCanvasBoardId,
  tapWorkCanvasElementContentFingerprint,
  tapWorkCanvasShouldAcceptSceneUpdate,
  uploadTapWorkCanvasPow,
} from "@/lib/tap-work-canvas";
import type { IleWorkCanvasPowEvent } from "@/lib/ile-work-canvas-pow";
import { ILE_POW_DEBOUNCE_MS } from "@/lib/ile-realtime-pow";
import {
  buildIleWorkCanvasCommandUserMessage,
  type IleWorkCanvasAskKind,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/ile-work-canvas";
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
  /** Verification runs end on the same thank-you screen as a guest TAP link. */
  localOpening?: boolean;
  /** Verification uses the verification-tap sidebar. Scored TAP uses tap. */
  sidebarMode?: Extract<SessionSidebarMode, "tap" | "verification-tap">;
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
  /** Helios/XAI is answering. The countdown stays put and shows a pause icon. */
  clockPaused?: boolean;
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
  }) => Promise<{
    text: string;
    elements?: IleWorkCanvasSkeleton[] | null;
    origin?: { x?: number; y?: number } | null;
  }>;
  onLearnerWaitChange?: (wait: { canvasLoading: boolean; waitingForXaiReply: boolean }) => void;
  onImDoneBusyChange?: (busy: boolean) => void;
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
    localOpening = false,
    sidebarMode = "tap",
    durationLocked,
    isStartingSession,
    startingTopics,
    startingTopicId,
    topicsError,
    error,
    startSession,
    participantIdentity: _participantIdentity,
    isPracticeMode,
    lastAssistantTurn,
    messages,
    isSending,
    remainingSeconds,
    clockPaused = false,
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
    onLearnerWaitChange,
    onImDoneBusyChange,
  } = props;

  const [pendingStart, setPendingStart] = useState<
    | { kind: "topic"; topic: TapStartingTopic }
    | { kind: "practice" }
    | null
  >(null);
  const passGuard = useRef(false);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [workCanvasScene, setWorkCanvasScene] = useState<IleWorkCanvasScene>(() =>
    emptyTapWorkCanvasScene(),
  );
  const [canvasApplyElements, setCanvasApplyElements] = useState<IleWorkCanvasElement[]>([]);
  const [canvasApplyNonce, setCanvasApplyNonce] = useState(0);
  const sceneRef = useRef(workCanvasScene);
  const appliedAssistantIdsRef = useRef<Set<string>>(new Set());
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
    if (phase !== "briefing") {
      setPendingStart(null);
      passGuard.current = false;
    }
  }, [phase]);

  function chooseTopic(topic: TapStartingTopic) {
    const step = scoredTapBriefingStep({ choice: "topic", challengePassed: false });
    if (step === "challenge") setPendingStart({ kind: "topic", topic });
  }

  function choosePractice() {
    const step = scoredTapBriefingStep({ choice: "practice", challengePassed: false });
    if (step === "challenge") setPendingStart({ kind: "practice" });
  }

  function passTapChallenge() {
    if (!pendingStart || passGuard.current) return;
    const step = scoredTapBriefingStep({
      choice: pendingStart.kind,
      challengePassed: true,
    });
    if (step !== "live") return;
    passGuard.current = true;
    const run =
      pendingStart.kind === "practice"
        ? startSession({ practice: true })
        : startSession(pendingStart.topic);
    void Promise.resolve(run).then((result) => {
      const release = releaseVoiceChallengeStartLatch({
        startSucceeded: voiceChallengeStartSucceeded(result),
      });
      if (!release.release) return;
      passGuard.current = false;
      setChallengeAttempt((attempt) => attempt + 1);
    });
  }

  const briefingStep = scoredTapBriefingStep({
    choice: pendingStart?.kind ?? null,
    challengePassed: false,
  });

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
    if (!missing.length) return;
    const boardEmpty = !sceneRef.current.elements.some((el) => !el.isDeleted);
    const prevIds = new Set(sceneRef.current.elements.map((el) => el.id));
    const next =
      boardEmpty && missing.length === assistantTurns.length
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

  const handleCanvasPowActions = useCallback(
    (events: IleWorkCanvasPowEvent[]) => {
      const sessionKey = String(tapSessionId || sessionId || "").trim();
      if (!sessionKey) return;
      for (const event of events) {
        const item = buildTapWorkCanvasActionUploadItem(sessionKey, {
          ...event,
          metadata: { ...event.metadata, product: "tap" },
        });
        if (!item) continue;
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
      }
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
      const fingerprint = tapWorkCanvasElementContentFingerprint(scene);
      if (!fingerprint || fingerprint === lastCanvasPowHashRef.current) return;
      if (canvasPowTimerRef.current) clearTimeout(canvasPowTimerRef.current);
      canvasPowTimerRef.current = setTimeout(() => {
        lastCanvasPowHashRef.current = fingerprint;
        const item = buildTapCanvasSnapshotUploadItem(sessionKey, JSON.stringify(scene));
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
      kind?: IleWorkCanvasAskKind;
    }) => {
      const userText = buildIleWorkCanvasCommandUserMessage({
        kind: input.kind,
        prompt: input.prompt,
        selectedElements: input.selectedElements,
        scene: input.scene,
        workspace: { workspaceTitle },
      });
      return sendCanvasAsk({
        prompt: userText,
        selectedElements: input.selectedElements,
        scene: input.scene,
      });
    },
    [sendCanvasAsk, workspaceTitle],
  );

  return (
    <main className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white selection:bg-zinc-700">
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && isStartingSession ? (
          <SessionPageLoading
            message={
              isPracticeMode ? t("tap.practice.starting") : t("session.startLoading")
            }
          />
        ) : null}

        {phase === "briefing" && !isStartingSession && briefingStep === "challenge" && pendingStart ? (
          <section
            className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0b] px-6"
            data-tap-voice-challenge=""
            data-tap-briefing-step="challenge"
          >
            <div className="w-full max-w-xl">
              <PracticeVoiceChallenge key={challengeAttempt} onPass={passTapChallenge} />
              {error ? (
                <p className="mt-4 text-center text-sm text-red-300">{error}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {phase === "briefing" && !isStartingSession && briefingStep === "pick" && (
          <section className="relative flex min-h-0 flex-1" data-tap-briefing-layout="sections" data-tap-briefing-step="pick">
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
                <SessionOnboardingGuide
                  variant="tap"
                  omitIntroSlide
                  hideStep3Quote
                  renderStep3Action={() => (
                    <>
                      <TapStartingTopicCards
                        topics={startingTopics}
                        isStarting={isStartingSession}
                        startingTopicId={startingTopicId}
                        onStartTopic={chooseTopic}
                        onPracticeFirst={choosePractice}
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
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-tap-convo-live>
            <SessionWorkSurface
              mode={sidebarMode}
              counts={{ chapters: thoughtHistory.length }}
              sectionLabels={{ chapters: "Thoughts" }}
              stage={
                <div
                  data-tap-convo-work-canvas-pane
                  className="relative h-full min-h-0 min-w-0 overflow-hidden"
                >
                  <WorkCanvas
                    key={`tap-work-canvas:${phase}`}
                    boardId={tapWorkCanvasBoardId(tapSessionId || sessionId)}
                    initialSceneData={workCanvasScene}
                    applyElements={canvasApplyElements}
                    applyElementsNonce={canvasApplyNonce}
                    heliosBusy={heliosBusy}
                    onLearnerWaitChange={onLearnerWaitChange}
                    onSceneChange={handleSceneChange}
                    onCanvasPowActions={handleCanvasPowActions}
                    onAskSelected={handleAskSelected}
                    dictateTranscript={crystallizableText}
                  />
                  {error ? (
                    <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 px-3 text-center text-xs text-red-300">
                      {error}
                    </p>
                  ) : null}
                </div>
              }
              clock={
                <div
                  className="flex w-full min-w-0 flex-col gap-2 px-1 py-1"
                  data-tap-live-control-strip
                >
                  <TapLiveClock
                    label="Time left"
                    remainingSeconds={remainingSeconds}
                    waiting={clockPaused}
                    listening={isListening}
                  />
                  {isPracticeMode ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <TapPracticePill label={t("tap.practice.bannerKicker")} />
                    </div>
                  ) : null}
                </div>
              }
              actions={
                showEndSession ? (
                  <div className="flex w-full min-w-0" data-tap-end-session>
                    <button
                      type="button"
                      onClick={() => void endSession()}
                      className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} w-full`}
                    >
                      End session
                    </button>
                  </div>
                ) : null
              }
              transcript={
                <div
                  data-tap-transcript-container
                  className="shrink-0 border-t border-neutral-800/60 bg-black/35 p-2.5"
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
              }
              chapters={
                <>
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
                      onBusyChange={onImDoneBusyChange}
                      confirmClose={{
                        title: TAP_IM_DONE_CONFIRM_TITLE,
                        body: TAP_IM_DONE_CONFIRM_BODY,
                        confirmLabel: TAP_IM_DONE_CONFIRM_CONFIRM,
                        cancelLabel: TAP_IM_DONE_CONFIRM_CANCEL,
                      }}
                    />
                  </div>
                  <div
                    className="min-h-0 overflow-hidden bg-black/35 px-2 py-2"
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
                </>
              }
            />
          </section>
        )}

        {phase === "saving" && (
          <SessionPageLoading
            message={
              isPracticeMode
                ? t("tap.practice.saving")
                : t("tap.postSession.savingAndReturning")
            }
          />
        )}
        {phase === "practice_done" && !sessionEndedImpure ? (
          <SessionFinishedScreen
            data-tap-practice-done=""
            kicker={t("tap.practice.doneKicker")}
            title={t("tap.practice.doneTitle")}
            body={t("tap.practice.doneBody")}
            actions={
              <TapThoughtButton
                size="md"
                variant="primary"
                data-tap-practice-restart
                onClick={restartBriefingFlow}
              >
                {t("tap.practice.restart")}
              </TapThoughtButton>
            }
          />
        ) : null}
        {(phase === "results" || phase === "practice_done") && sessionEndedImpure ? (
          <SessionFinishedScreen
            data-tap-session-impure=""
            title={t("tap.postSession.impureTitle")}
            body={t("tap.postSession.impureBody")}
            actions={
              <TapThoughtButton
                size="md"
                variant="primary"
                data-tap-impure-retry
                onClick={
                  phase === "practice_done"
                    ? restartBriefingFlow
                    : () => window.location.reload()
                }
              >
                {t("tap.postSession.impureTryAgain")}
              </TapThoughtButton>
            }
          />
        ) : phase === "results" ? (
          privateToken || localOpening ? (
            <SessionFinishedScreen
              data-tap-session-thank-you=""
              title={t("tap.postSession.thankYouTitle")}
              body={t("tap.postSession.thankYouBody")}
              actions={
                <a
                  href="/"
                  data-tap-explore-uncertain-systems
                  className="inline-flex items-center justify-center rounded-none bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  {t("tap.postSession.exploreUncertainSystems")}
                </a>
              }
            />
          ) : (
            <SessionFinishedScreen
              wide
              title={t("tap.postSession.resultsTitle")}
              body={t("tap.postSession.resultsHint")}
            >
              {performanceReport ? (
                <div className="mt-6 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border border-neutral-800 bg-neutral-950/50 p-4 md:p-5">
                  <PerformanceReportCard
                    report={performanceReport}
                    layout="spacious"
                    fillHeight
                    label={t("tap.postSession.verificationResultsTitle")}
                  />
                </div>
              ) : null}
            </SessionFinishedScreen>
          )
        ) : null}
        {phase === "error" && (
          <SessionFinishedScreen
            title="Could not end TAP session"
            body={resultsError || error}
            actions={
              <TapThoughtButton size="md" variant="primary" onClick={() => setPhase("briefing")}>
                Try again
              </TapThoughtButton>
            }
          />
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
