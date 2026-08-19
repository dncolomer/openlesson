import { useMemo, useRef, type MutableRefObject } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getIlePostSessionPath } from "@/lib/storage";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  postTutoringSessionComplete,
  postTutoringSessionStart,
} from "@/lib/tutoring-client";
import { tapHookFormingText } from "@/lib/tap-session-runtime";
import { TAP_PRACTICE_DURATION_SECONDS, resolveTapLiveMinutes } from "@/lib/tap-practice";
import { TAP_SESSION_PURITY_MAX } from "@/lib/tap-session-purity";
import {
  OPENING_MESSAGE_ID,
  clearDialogueMessages,
  normalize,
  type Phase,
  type Thought,
  type TapChatMessage as ChatMessage,
  type TapSystem1Action,
  type TapSystem2Action,
  type TapTraceType,
} from "@/lib/tap-score-client-helpers";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { TapPostSessionMode } from "@/lib/pow-api/tap-link-config";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { stopLiveSpeechRecognition, type LiveSpeechRecognitionBindings } from "@/lib/useSessionThoughtInterface";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";

/** Live TAP dialog session — data + one apply, not a setter-host bag. */
export type TapScoreSession = {
  isSending: boolean;
  sentThoughtIds: Set<string>;
  messages: ChatMessage[];
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  conversationLanguage: string;
  liveMinutes: number;
  minutes: number;
  startedAt: number | null;
  postSession: TapPostSessionMode;
  configuredRedirectUrl: string | null;
  resolvedWorkspaceId?: string;
  dialogueStorageKey: string;
  phase: Phase;
  router: AppRouterInstance;
  entryQueryParamsRef: MutableRefObject<Record<string, string | string[]>>;
  tapSessionIdRef: MutableRefObject<string | null>;
  isPracticeModeRef: MutableRefObject<boolean>;
  isEndingRef: MutableRefObject<boolean>;
  speechResultsLengthRef: MutableRefObject<number>;
  consumedResultsIndexRef: MutableRefObject<number>;
  finalBufferRef: MutableRefObject<string[]>;
  autoStashInFlightRef: MutableRefObject<boolean>;
  speechBindings: LiveSpeechRecognitionBindings;
  tapThoughtSpeech: { retryMicrophone: () => void; getFormingText?: () => string };
  logTapTrace: (input: {
    traceType: TapTraceType;
    action: TapSystem1Action | TapSystem2Action;
    thoughtId?: string;
    thoughtIds?: string[];
    chainId?: string;
    text?: string;
    originalText?: string;
    combined?: boolean;
    timestampMs?: number;
  }) => void;
  bumpUserActivity: () => void;
  handlePowInterruption: (
    interruption: ProofOfWorkApiInterruption | undefined,
    origin?: "idle" | "speech" | "other",
  ) => void;
  clearPendingInterruption: () => void;
  resetIdleTracking: () => void;
  resetSpeechTracking: () => void;
  flushSpeechSegment: () => void;
  flushFinalBuffer: () => void;
  clearTranscriptionDisplay: () => void;
  restartSpeechRecognitionSession: () => void;
  apply: (patch: TapScoreSessionPatch) => void;
};

export type TapScoreSessionPatch = {
  isSending?: boolean;
  heliosTurnMode?: HeliosTurnMode;
  error?: string;
  messages?: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[]);
  sentThoughtIds?: Set<string> | ((current: Set<string>) => Set<string>);
  memoryThoughtIds?: Set<string> | ((current: Set<string>) => Set<string>);
  isStartingSession?: boolean;
  startingTopicId?: string | null;
  isPracticeMode?: boolean;
  liveMinutes?: number;
  speechError?: string | null;
  thoughts?: Thought[];
  sessionPurity?: number;
  transcriptSilenceMs?: number;
  sessionEndedImpure?: boolean;
  tapSessionId?: string;
  startedAt?: number | null;
  remainingSeconds?: number;
  phase?: Phase;
  performanceReport?: PerformanceReport | null;
  resultsError?: string;
  interimText?: string;
  crystallizableText?: string;
  editingTranscription?: { draft: string; originalText: string } | null;
};

export function useTapScoreSession(session: TapScoreSession) {
  const sessionRef = useRef(session);
  sessionRef.current = session;
  return useMemo(() => createTapScoreSessionActions(() => sessionRef.current), []);
}

function createTapScoreSessionActions(current: () => TapScoreSession) {
  async function sendThought(text: string, thoughtIds: string[] = []) {
    const s = current();
    const clean = normalize(text);
    if (!clean || s.isSending) return;
    const isResend = thoughtIds.length > 0 && thoughtIds.every((id) => s.sentThoughtIds.has(id));
    s.logTapTrace({
      traceType: "system2",
      action: isResend ? "resend" : "send",
      thoughtIds,
      thoughtId: thoughtIds.length === 1 ? thoughtIds[0] : undefined,
      text: clean,
      combined: thoughtIds.length > 1,
    });
    s.bumpUserActivity();
    s.apply({ isSending: true });
    s.apply({ heliosTurnMode: "idle" });
    s.apply({ error: "" });
    const userMessage: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: clean, at: new Date().toISOString() };
    const nextMessages = [...s.messages, userMessage];
    s.apply({ messages: nextMessages });
    s.apply({ sentThoughtIds: (current) => new Set([...current, ...thoughtIds]) });
    s.apply({
      memoryThoughtIds: (current) => {
        const next = new Set(current);
        thoughtIds.forEach((id) => next.delete(id));
        return next;
      },
    });
    try {
      const response = await fetch("/api/workspace-tap-score/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: s.workspaceId,
          blockId: s.blockId,
          sessionId: s.sessionId,
          privateToken: s.privateToken,
          entryQueryParams: s.entryQueryParamsRef.current,
          tapSessionId: s.tapSessionIdRef.current,
          minutes: s.liveMinutes,
          practice: s.isPracticeModeRef.current,
          thought: clean,
          messages: nextMessages,
          conversationLanguage: s.conversationLanguage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not get TAP response"));
      const assistant: ChatMessage = { id: `a_${Date.now()}`, role: "assistant", content: payload.message, at: new Date().toISOString() };
      s.apply({ messages: (current) => [...current, assistant] });
      s.handlePowInterruption(payload.interruption ?? null);
    } catch (err) {
      s.apply({ error: err instanceof Error ? err.message : "Could not get TAP response" });
    } finally {
      s.apply({ isSending: false });
    }
  }

  async function sendCurrentTranscription() {
    const s = current();
    const text = tapHookFormingText(s.tapThoughtSpeech);
    if (!text) return;
    s.clearTranscriptionDisplay();
    s.restartSpeechRecognitionSession();
    await sendThought(text, []);
  }

  function retryMicrophone() {
    const s = current();
    if (s.phase !== "live") return;
    s.apply({ speechError: null });
    s.tapThoughtSpeech.retryMicrophone();
  }

  async function startSession(topicOrOptions?: TapStartingTopic | { practice?: boolean; topic?: TapStartingTopic }) {
    const s = current();
    const practice =
      !!topicOrOptions &&
      "practice" in topicOrOptions &&
      topicOrOptions.practice === true;
    const topic =
      topicOrOptions && "practice" in topicOrOptions
        ? topicOrOptions.topic
        : (topicOrOptions as TapStartingTopic | undefined);

    s.isEndingRef.current = false;
    s.clearPendingInterruption();
    s.resetIdleTracking();
    s.resetSpeechTracking();
    s.apply({ heliosTurnMode: "idle" });
    s.apply({ isStartingSession: true });
    s.apply({ startingTopicId: practice ? "practice" : topic?.id ?? null });
    s.apply({ isPracticeMode: practice });
    s.isPracticeModeRef.current = practice;
    const sessionMinutes = resolveTapLiveMinutes({ practice, minutes: s.minutes });
    s.apply({ liveMinutes: sessionMinutes });
    s.apply({ error: "" });
    s.apply({ speechError: null });
    s.speechResultsLengthRef.current = 0;
    s.consumedResultsIndexRef.current = 0;
    s.finalBufferRef.current = [];
    s.apply({ thoughts: [] });
    s.apply({ memoryThoughtIds: new Set() });
    s.apply({ sentThoughtIds: new Set() });
    s.apply({ sessionPurity: TAP_SESSION_PURITY_MAX });
    s.apply({ transcriptSilenceMs: 0 });
    s.apply({ sessionEndedImpure: false });
    s.autoStashInFlightRef.current = false;
    clearDialogueMessages(s.dialogueStorageKey);

    try {
      const { ok, payload } = await postTutoringSessionStart({
        workspaceId: s.workspaceId,
        blockId: s.blockId,
        sessionId: s.sessionId,
        privateToken: s.privateToken,
        entryQueryParams: s.entryQueryParamsRef.current,
        minutes: sessionMinutes,
        practice,
        tapSessionId: s.tapSessionIdRef.current,
        openingQuestion: topic?.openingQuestion,
        topicId: topic?.id,
        topicTitle: topic?.title,
        conversationLanguage: s.conversationLanguage,
      });
      if (!ok) throw new Error(errorMessageFromBody(payload, "Could not start TAP session"));
      if (payload.tapSessionId) {
        s.tapSessionIdRef.current = String(payload.tapSessionId);
        s.apply({ tapSessionId: String(payload.tapSessionId) });
      }

      const openingQuestion = String(payload.openingQuestion || "").trim();
      if (!openingQuestion) throw new Error("Could not generate opening question");

      const started = Date.now();
      s.apply({ startedAt: started });
      s.apply({ remainingSeconds: sessionMinutes * 60 });
      s.apply({
        messages: [
          {
            id: OPENING_MESSAGE_ID,
            role: "assistant",
            content: openingQuestion,
            at: new Date().toISOString(),
          },
        ],
      });
      s.resetIdleTracking();
      s.resetSpeechTracking();
      s.apply({ phase: "live" });
    } catch (err) {
      stopLiveSpeechRecognition(s.speechBindings);
      s.apply({ isPracticeMode: false });
      s.isPracticeModeRef.current = false;
      s.apply({ error: err instanceof Error ? err.message : "Could not start TAP session" });
    } finally {
      s.apply({ isStartingSession: false });
      s.apply({ startingTopicId: null });
    }
  }

  function restartBriefingFlow() {
    const s = current();
    s.isEndingRef.current = false;
    s.apply({ isPracticeMode: false });
    s.isPracticeModeRef.current = false;
    s.apply({ sessionEndedImpure: false });
    s.apply({ performanceReport: null });
    s.apply({ resultsError: "" });
    s.apply({ error: "" });
    s.apply({ messages: [] });
    s.apply({ thoughts: [] });
    s.apply({ interimText: "" });
    s.apply({ crystallizableText: "" });
    s.apply({ memoryThoughtIds: new Set() });
    s.apply({ sentThoughtIds: new Set() });
    s.apply({ editingTranscription: null });
    s.apply({ heliosTurnMode: "idle" });
    s.apply({ sessionPurity: TAP_SESSION_PURITY_MAX });
    s.apply({ transcriptSilenceMs: 0 });
    s.apply({ startedAt: null });
    s.apply({ remainingSeconds: 0 });
    s.apply({ liveMinutes: s.minutes });
    s.autoStashInFlightRef.current = false;
    s.clearPendingInterruption();
    s.resetIdleTracking();
    s.resetSpeechTracking();
    clearDialogueMessages(s.dialogueStorageKey);
    s.apply({ phase: "briefing" });
  }

  async function endSession(options?: { impure?: boolean }) {
    const s = current();
    if (s.isEndingRef.current) return;
    s.isEndingRef.current = true;
    const impure = options?.impure === true;
    const practice = s.isPracticeModeRef.current;
    s.apply({ sessionEndedImpure: impure });
    s.clearPendingInterruption();
    s.flushSpeechSegment();
    s.resetIdleTracking();
    s.resetSpeechTracking();
    s.apply({ heliosTurnMode: "idle" });
    if (!impure) {
      s.flushFinalBuffer();
    } else {
      s.clearTranscriptionDisplay();
    }
    s.apply({ phase: "saving" });
    stopLiveSpeechRecognition(s.speechBindings);
    try {
      const durationSeconds = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0;
      const transcript = s.messages.map((message) => ({ role: message.role, text: message.content, at: message.at }));
      const safeTranscript =
        transcript.length > 0
          ? transcript
          : [{ role: "assistant", text: "Practice session", at: new Date().toISOString() }];
      const { ok, payload } = await postTutoringSessionComplete({
        workspaceId: s.workspaceId,
        blockId: s.blockId,
        sessionId: s.sessionId,
        privateToken: s.privateToken,
        entryQueryParams: s.entryQueryParamsRef.current,
        tapSessionId: s.tapSessionIdRef.current,
        transcript: safeTranscript,
        durationSeconds,
        requestedDurationSeconds: practice ? TAP_PRACTICE_DURATION_SECONDS : s.liveMinutes * 60,
        sessionQuality: impure ? "impure" : "pure",
        impure,
        practice,
      });
      if (!ok) throw new Error(errorMessageFromBody(payload, "Could not save TAP session"));

      if (practice) {
        s.apply({ performanceReport: null });
        s.apply({ phase: "practice_done" });
        return;
      }
      if (impure) {
        s.apply({ performanceReport: null });
        s.apply({ phase: "results" });
        return;
      }
      // Private session links: thank-you only (no redirect / results scorecard).
      // LWM Snapshot remains manual (Knowledge UI / Snapshot API) — not auto-run on TAP end.
      if (s.privateToken) {
        s.apply({ performanceReport: null });
        s.apply({ phase: "results" });
        return;
      }

      const resolvedPostSession = (payload.postSession as TapPostSessionMode) || s.postSession;
      const resolvedRedirectUrl =
        typeof payload.redirectUrl === "string" ? payload.redirectUrl : s.configuredRedirectUrl;

      if (resolvedPostSession === "show_results") {
        s.apply({ performanceReport: null });
        s.apply({ phase: "results" });
        return;
      }
      if (resolvedPostSession === "redirect_url" && resolvedRedirectUrl) {
        window.location.href = resolvedRedirectUrl;
        return;
      }
      const targetWorkspaceId = payload.workspaceId || s.resolvedWorkspaceId;
      if (targetWorkspaceId) {
        s.router.push(getIlePostSessionPath({ metadata: { workspace_id: String(targetWorkspaceId) } }));
        return;
      }
      s.router.push("/dashboard");
    } catch (err) {
      s.apply({ error: err instanceof Error ? err.message : "Could not save TAP session" });
      s.apply({ phase: "error" });
      s.isEndingRef.current = false;
    }
  }

  return {
    sendThought,
    sendCurrentTranscription,
    retryMicrophone,
    startSession,
    restartBriefingFlow,
    endSession,
  };
}
