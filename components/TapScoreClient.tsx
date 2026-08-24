"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { useTapPredictiveInterruption } from "@/lib/useTapPredictiveInterruption";
import { useTapIdleProofOfWork } from "@/lib/useTapIdleProofOfWork";
import { useTapSpeechProofOfWork } from "@/lib/useTapSpeechProofOfWork";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import {
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  shouldAutoStashOnContextFull,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";
import { MobileBlockScreen } from "@/components/MobileBlockScreen";
import { isSmartphoneClient } from "@/lib/is-smartphone";
import { useI18n } from "@/lib/i18n";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { TapPostSessionMode } from "@/lib/pow-api/tap-link-config";
import { TAP_LINK_MAX_MINUTES, TAP_LINK_MIN_MINUTES } from "@/lib/pow-api/tap-link-config";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import {
  restartLiveSpeechRecognition,
  stopLiveSpeechRecognition,
  useSessionThoughtInterface,
  useSpeechSupported,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";
import { decideSpokenCaptureKeyAction } from "@/lib/spoken-thought-shortcut";
import {
  toSpeechBcp47,
  type SpokenLocale,
} from "@/lib/tutoring-languages";

import {
  type Phase,
  type Thought,
  type TapTraceType,
  type TapSystem1Action,
  type TapSystem2Action,
  type TapChatMessage as ChatMessage,
  CHAIN_GAP_MS,
  BACKGROUND_IMAGES,
  getDialogueStorageKey,
  clearDialogueMessages,
  resolveInitialMinutes,
  normalize,
} from "@/lib/tap-score-client-helpers";
import {
  tapTracePayload,
  isTapLiveThoughtSpeechEnabled,
  shouldRestartLocalTapSpeechBindings,
  tapLiveSpeechFlushText,
  tapHookFormingText,
} from "@/lib/tap-session-runtime";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { TapScorePhases } from "@/components/tap-score/tap-score-phases";
import { useTapScoreSession } from "@/components/tap-score/use-tap-score-flow";
import {
  TAP_SESSION_PURITY_MAX,
  TAP_SILENCE_AUTO_STASH_MS,
  isSessionPurityDepleted,
  isWithinTapPurityGrace,
  nextSessionPurityAfterAutoStash,
  shouldAutoStashOnSilence,
  shouldEvaluateSessionPurity,
  shouldPenalizeEmptyBarSilence,
} from "@/lib/tap-session-purity";
import {
  buildPowParticipantIdentity,
  type PowParticipantIdentity,
} from "@/lib/session-participant-identity";

interface TapScoreClientProps {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  initialSession?: any;
  /** When false, hide End Session control. Default true. */
  showEndSession?: boolean;
  /**
   * Query params from the share URL. Same names+values (any order) map PoW to the
   * same guest subject; different params → different guests.
   */
  entryQueryParams?: Record<string, string | string[]>;
  /** Server-resolved participant for guest links; map UI resolves signed-in user client-side. */
  participantIdentity?: PowParticipantIdentity | null;
  /**
   * Pre-selected duration from workspace launch (minutes).
   * Wins over session requested_duration when set.
   */
  initialMinutes?: number;
  /**
   * When true, hide the briefing duration picker (duration already chosen upstream).
   */
  lockDuration?: boolean;
}

/** Resolve whether End Session UI should show (default yes). */
export function resolveTapShowEndSession(input: {
  showEndSession?: boolean;
  initialSession?: { show_end_session?: boolean | null } | null;
}): boolean {
  if (typeof input.showEndSession === "boolean") return input.showEndSession;
  if (input.initialSession && input.initialSession.show_end_session === false) return false;
  return true;
}

export function TapScoreClient({
  workspaceId,
  blockId,
  sessionId,
  privateToken,
  initialSession,
  showEndSession: showEndSessionProp,
  entryQueryParams = {},
  participantIdentity: participantIdentityProp = null,
  initialMinutes,
  lockDuration = false,
}: TapScoreClientProps) {
  const showEndSession = resolveTapShowEndSession({
    showEndSession: showEndSessionProp,
    initialSession,
  });
  const entryQueryParamsRef = useRef(entryQueryParams);
  useEffect(() => {
    entryQueryParamsRef.current = entryQueryParams;
  }, [entryQueryParams]);
  const router = useRouter();
  const { t } = useI18n();
  // Smartphone → desktop-only gate (same product rule as ILE SessionView)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(isSmartphoneClient());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [participantIdentity, setParticipantIdentity] = useState<PowParticipantIdentity | null>(
    () => {
      if (participantIdentityProp) return participantIdentityProp;
      if (privateToken && initialSession) {
        return buildPowParticipantIdentity({
          guestUserId: initialSession.guest_user_id ?? null,
          assignedUserId: initialSession.assigned_user_id ?? null,
        });
      }
      return null;
    },
  );

  useEffect(() => {
    if (participantIdentityProp) {
      setParticipantIdentity(participantIdentityProp);
      return;
    }
    // Map UI (no private token): attribute to signed-in user.
    if (privateToken) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }: { data: { user: { id?: string } | null } }) => {
      if (cancelled) return;
      const id = data.user?.id ?? null;
      if (id) {
        setParticipantIdentity(buildPowParticipantIdentity({ userId: id }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [participantIdentityProp, privateToken]);
  const [phase, setPhase] = useState<Phase>("briefing");
  const resolvedLaunchMinutes =
    typeof initialMinutes === "number" && Number.isFinite(initialMinutes)
      ? resolveInitialMinutes(initialMinutes * 60)
      : resolveInitialMinutes(initialSession?.requested_duration_seconds);
  const [minutes, setMinutes] = useState(resolvedLaunchMinutes);
  const [conversationLanguage, setConversationLanguage] = useState<SpokenLocale>("en");
  const speechLang = toSpeechBcp47(conversationLanguage);
  const postSession = (initialSession?.post_session as TapPostSessionMode) || "redirect_workspace";
  const configuredRedirectUrl =
    typeof initialSession?.redirect_url === "string" ? initialSession.redirect_url : null;
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [resultsError, setResultsError] = useState("");
  const [workspaceTitle] = useState(initialSession?.workspaceTitle || "Workspace");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [interimText, setInterimText] = useState("");
  const [crystallizableText, setCrystallizableText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const durationLocked = lockDuration || typeof initialMinutes === "number";
  const [heliosTurnMode, setHeliosTurnMode] = useState<HeliosTurnMode>("idle");
  const [memoryThoughtIds, setMemoryThoughtIds] = useState<Set<string>>(new Set());
  const [sentThoughtIds, setSentThoughtIds] = useState<Set<string>>(new Set());
  const [editingTranscription, setEditingTranscription] = useState<{ draft: string; originalText: string } | null>(null);
  const [error, setError] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startingTopics, setStartingTopics] = useState<TapStartingTopic[]>([]);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [topicsError, setTopicsError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [bgImage, setBgImage] = useState("");
  const [userInitial, setUserInitial] = useState("Y");
  const [tapSessionId, setTapSessionId] = useState<string | null>(initialSession?.id ?? null);
  const tapSessionIdRef = useRef<string | null>(initialSession?.id ?? null);
  const resolvedWorkspaceId = workspaceId || initialSession?.workspace_id;
  const [sessionPurity, setSessionPurity] = useState(TAP_SESSION_PURITY_MAX);
  const [transcriptSilenceMs, setTranscriptSilenceMs] = useState(0);
  const [sessionEndedImpure, setSessionEndedImpure] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  /** Duration for the active live run (practice is always the warm-up length). */
  const [liveMinutes, setLiveMinutes] = useState(resolvedLaunchMinutes);
  const isPracticeModeRef = useRef(false);

  const isEndingRef = useRef(false);
  /** True while Helios chat is in flight — purity silence checks must not run. */
  const isSendingRef = useRef(false);
  const endAndScoreRef = useRef<(options?: { impure?: boolean }) => void>(() => {});
  const autoStashInFlightRef = useRef(false);
  /** Guard context-capacity auto-stash (no purity). */
  const contextStashInFlightRef = useRef(false);
  /** Last non-empty speech OR intentional clear (stash/send) — drives silence clock. */
  const lastSpeechActivityAtRef = useRef(Date.now());
  const crystallizableTextRef = useRef("");
  /**
   * After intentional clear, empty recognition results may keep the bar empty.
   * Otherwise empty onResult (recognition restart) must not wipe text mid-fade.
   */
  const acceptEmptyTranscriptRef = useRef(true);

  useEffect(() => {
    tapSessionIdRef.current = tapSessionId;
  }, [tapSessionId]);

  useEffect(() => {
    isPracticeModeRef.current = isPracticeMode;
  }, [isPracticeMode]);

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  const isTranscriptionActiveRef = useRef(false);

  const getFormingThought = useCallback(
    () => ({
      hasPendingTranscription: Boolean(normalize(crystallizableTextRef.current)),
      isTranscriptionActive: isTranscriptionActiveRef.current,
    }),
    [],
  );

  const {
    applyInterruption,
    clearPendingInterruption,
    clearPendingSilenceInterruption,
  } = useTapPredictiveInterruption(
    useCallback(({ message }) => {
      const assistant: ChatMessage = {
        id: `int_${Date.now()}`,
        role: "assistant",
        content: message,
        at: new Date().toISOString(),
      };
      setMessages((current) => [...current, assistant]);
      setHeliosTurnMode("interruption");
    }, []),
    getFormingThought,
  );

  const handlePowInterruption = useCallback(
    (
      interruption: ProofOfWorkApiInterruption | undefined,
      origin: "idle" | "speech" | "other" = "other",
    ) => {
      if (interruption === undefined) return;
      applyInterruption(interruption, { origin });
    },
    [applyInterruption],
  );

  const handleIdleInterruption = useCallback(
    (interruption: ProofOfWorkApiInterruption) => {
      handlePowInterruption(interruption, "idle");
    },
    [handlePowInterruption],
  );

  const handleSpeechInterruption = useCallback(
    (interruption: ProofOfWorkApiInterruption) => {
      handlePowInterruption(interruption, "speech");
    },
    [handlePowInterruption],
  );

  const idlePowContext = useMemo(
    () => ({
      workspaceId,
      blockId,
      sessionId,
      privateToken,
      tapSessionId,
      entryQueryParams,
      practice: isPracticeMode,
    }),
    [workspaceId, blockId, sessionId, privateToken, tapSessionId, entryQueryParams, isPracticeMode],
  );

  const {
    isTranscriptionActive,
    notifySpeechResult,
    flushSpeechSegment,
    resetSpeechTracking,
  } = useTapSpeechProofOfWork(phase === "live", idlePowContext, handleSpeechInterruption);

  useEffect(() => {
    isTranscriptionActiveRef.current = isTranscriptionActive;
    // Cancel silence-scheduled interventions once the learner starts speaking again.
    if (isTranscriptionActive) {
      clearPendingSilenceInterruption();
    }
  }, [isTranscriptionActive, clearPendingSilenceInterruption]);

  useEffect(() => {
    if (normalize(crystallizableText)) {
      clearPendingSilenceInterruption();
    }
  }, [crystallizableText, clearPendingSilenceInterruption]);

  const { bumpUserActivity, resetIdleTracking } = useTapIdleProofOfWork(
    phase === "live",
    idlePowContext,
    handleIdleInterruption,
    { speechText: crystallizableText, isTranscriptionActive },
  );

  const notifySpeechResultRef = useRef(notifySpeechResult);
  useEffect(() => {
    notifySpeechResultRef.current = notifySpeechResult;
  }, [notifySpeechResult]);

  const logTapTrace = useCallback(
    (input: {
      traceType: TapTraceType;
      action: TapSystem1Action | TapSystem2Action;
      thoughtId?: string;
      thoughtIds?: string[];
      chainId?: string;
      text?: string;
      originalText?: string;
      combined?: boolean;
      timestampMs?: number;
    }) => {
      const activeTapSessionId = tapSessionIdRef.current;
      if (!activeTapSessionId) return;
      void fetch("/api/workspace-tap-score/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tapTracePayload({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId: activeTapSessionId,
          entryQueryParams: entryQueryParamsRef.current,
          practice: isPracticeModeRef.current,
          ...input,
        })),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) return;
          handlePowInterruption(payload.interruption ?? null);
        })
        .catch(() => {});
    },
    [workspaceId, blockId, sessionId, privateToken, handlePowInterruption],
  );

  const tapThoughtSpeech = useSessionThoughtInterface({
    enabled: isTapLiveThoughtSpeechEnabled(phase),
    speechLang,
    sessionId: tapSessionId || sessionId || undefined,
    captureKeys: false,
    onLogTrace: () => {},
    onSendToProbe: async () => {},
    onSpeechTranscript: (text) => {
      lastSpeechActivityAtRef.current = Date.now();
      crystallizableTextRef.current = text;
      setCrystallizableText(text);
      setInterimText(text);
    },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string | null; user_metadata?: Record<string, unknown> } | null } }) => {
      const user = data.user;
      if (!user) return;
      const name =
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
        user.email?.split("@")[0] ||
        "";
      const initial = name.charAt(0).toUpperCase();
      if (initial) setUserInitial(initial);
    });
  }, []);

  const dialogueStorageKey = useMemo(
    () => getDialogueStorageKey({ workspaceId, sessionId, blockId, privateToken }),
    [workspaceId, sessionId, blockId, privateToken],
  );

  const lastUserTurn = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return messages[index];
    }
    return null;
  }, [messages]);

  const lastAssistantTurn = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") return message;
    }
    return null;
  }, [messages]);

  const speechSupported = useSpeechSupported();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(speechLang);
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechResultsLengthRef = useRef(0);
  const consumedResultsIndexRef = useRef(0);

  useEffect(() => {
    langRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    clearDialogueMessages(dialogueStorageKey);
    isEndingRef.current = false;
    setPhase("briefing");
    setMessages([]);
    setThoughts([]);
    setInterimText("");
    setCrystallizableText("");
    setMemoryThoughtIds(new Set());
    setSentThoughtIds(new Set());
    setEditingTranscription(null);
    setHeliosTurnMode("idle");
    clearPendingInterruption();
    resetIdleTracking();
    resetSpeechTracking();
    setStartedAt(null);
    setRemainingSeconds(0);
    setError("");
    setIsStartingSession(false);
    setStartingTopics([]);
    setStartingTopicId(null);
    setTopicsError("");
    setSessionPurity(TAP_SESSION_PURITY_MAX);
    setTranscriptSilenceMs(0);
    setSessionEndedImpure(false);
    setIsPracticeMode(false);
    autoStashInFlightRef.current = false;
    speechResultsLengthRef.current = 0;
    consumedResultsIndexRef.current = 0;
    finalBufferRef.current = [];
  }, [dialogueStorageKey, clearPendingInterruption, resetIdleTracking, resetSpeechTracking]);

  useEffect(() => {
    if (phase !== "briefing") return;

    let cancelled = false;
    setStartingTopics([]);
    setTopicsError("");

    void (async () => {
      try {
        const response = await fetch("/api/workspace-tap-score/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            blockId,
            sessionId,
            privateToken,
          entryQueryParams: entryQueryParamsRef.current,
            minutes,
            tapSessionId: tapSessionIdRef.current,
            conversationLanguage,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(errorMessageFromBody(payload, "Could not load starting topics"));
        if (cancelled) return;
        setStartingTopics(Array.isArray(payload.topics) ? payload.topics : []);
      } catch (err) {
        if (cancelled) return;
        setTopicsError(err instanceof Error ? err.message : "Could not load starting topics");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, workspaceId, blockId, sessionId, privateToken, minutes, conversationLanguage]);

  const stashedThoughts = useMemo(
    () => thoughts.filter((thought) => !memoryThoughtIds.has(thought.id) && !sentThoughtIds.has(thought.id)),
    [thoughts, memoryThoughtIds, sentThoughtIds],
  );
  const thoughtHistory = useMemo(() => thoughts.slice().reverse(), [thoughts]);
  function buildThoughtRecord(text: string, currentThoughts: Thought[]): Thought | null {
    const clean = normalize(text);
    if (!clean) return null;
    const last = currentThoughts[currentThoughts.length - 1];
    const chainId =
      last && Date.now() - last.timestamp <= CHAIN_GAP_MS
        ? last.chainId
        : `chain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: clean,
      timestamp: Date.now(),
      chainId,
    };
  }

  function addThought(text: string, system1Action: TapSystem1Action = "pause_finalize") {
    // Auto-stash is silence-driven; do not treat it as positive user activity for idle PoW.
    if (system1Action !== "auto_stash") {
      bumpUserActivity();
    }
    setThoughts((current) => {
      const thought = buildThoughtRecord(text, current);
      if (!thought) return current;
      logTapTrace({
        traceType: "system1",
        action: system1Action,
        thoughtId: thought.id,
        chainId: thought.chainId,
        text: thought.text,
        timestampMs: thought.timestamp,
      });
      return [...current, thought];
    });
  }

  function markSpeechConsumed() {
    consumedResultsIndexRef.current = speechResultsLengthRef.current;
  }

  function resetSpeechResultCursor() {
    consumedResultsIndexRef.current = 0;
    speechResultsLengthRef.current = 0;
  }

  function speechResultStartIndex(event: SpeechRecognitionEventLike) {
    const consumed = consumedResultsIndexRef.current;
    const { resultIndex, results } = event;
    const sessionReset =
      consumed > 0 &&
      (results.length === 0 || consumed > results.length || (resultIndex === 0 && results.length < consumed));
    if (sessionReset) {
      resetSpeechResultCursor();
    }
    return Math.max(resultIndex, consumedResultsIndexRef.current);
  }

  function clearTranscriptionDisplay() {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    finalBufferRef.current = [];
    setInterimText("");
    setCrystallizableText("");
    crystallizableTextRef.current = "";
    // Intentional clear: allow empty bar + start silence clock for post-stash purity.
    acceptEmptyTranscriptRef.current = true;
    lastSpeechActivityAtRef.current = Date.now();
    setTranscriptSilenceMs(0);
    tapThoughtSpeech.clearCurrentTranscription();
  }

  const applyPurityHit = useCallback(() => {
    setSessionPurity((current) => {
      const next = nextSessionPurityAfterAutoStash(current);
      if (isSessionPurityDepleted(next)) {
        window.setTimeout(() => {
          endAndScoreRef.current({ impure: true });
        }, 0);
      }
      return next;
    });
  }, []);

  const speechBindings = useMemo<LiveSpeechRecognitionBindings>(
    () => ({
      recognitionRef,
      shouldListenRef,
      restartTimerRef,
      langRef,
      onResult: (event: SpeechRecognitionEventLike) => {
        speechResultsLengthRef.current = event.results.length;
        const finals: string[] = [];
        let interim = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = normalize(result[0]?.transcript || "");
          if (!transcript) continue;
          if (result.isFinal) finals.push(transcript);
          else if (i >= event.resultIndex) interim = normalize(`${interim} ${transcript}`);
        }
        finalBufferRef.current = finals;
        const displayText = normalize(`${finals.join(" ")} ${interim}`.trim());

        // Empty recognition frames (common on Chrome restart) must not wipe a held
        // live transcript mid-silence-fade — unless we intentionally cleared.
        if (!displayText) {
          if (!acceptEmptyTranscriptRef.current && crystallizableTextRef.current) {
            return;
          }
          setInterimText("");
          setCrystallizableText("");
          crystallizableTextRef.current = "";
          return;
        }

        acceptEmptyTranscriptRef.current = false;
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        setInterimText(interim);
        setCrystallizableText(displayText);
        crystallizableTextRef.current = displayText;
        notifySpeechResultRef.current(displayText);
      },
      onListeningChange: setIsListening,
      onError: setSpeechError,
    }),
    [],
  );

  const restartSpeechRecognitionSession = useCallback(() => {
    consumedResultsIndexRef.current = 0;
    speechResultsLengthRef.current = 0;
    if (!shouldRestartLocalTapSpeechBindings(phase)) return;
    restartLiveSpeechRecognition(speechBindings);
  }, [phase, speechBindings]);

  function clearTranscriptionBuffers() {
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
  }

  function flushFinalBuffer() {
    const text = tapHookFormingText(tapThoughtSpeech);
    clearTranscriptionBuffers();
    if (text) addThought(text);
  }

  const stashCurrentTranscription = useCallback(
    (options?: { auto?: boolean; fromContext?: boolean }) => {
      const text = tapHookFormingText(tapThoughtSpeech);
      clearTranscriptionDisplay();
      restartSpeechRecognitionSession();
      if (!text) {
        autoStashInFlightRef.current = false;
        contextStashInFlightRef.current = false;
        return;
      }
      // Context-full auto-stash: same stash outcome as deliberate, no purity hit.
      if (options?.fromContext) {
        addThought(text, "pause_finalize");
        contextStashInFlightRef.current = false;
        return;
      }
      addThought(text, options?.auto ? "auto_stash" : "pause_finalize");
      if (options?.auto) {
        applyPurityHit();
      }
      autoStashInFlightRef.current = false;
    },
    [crystallizableText, restartSpeechRecognitionSession, applyPurityHit],
  );

  // Keep purity interval off the stale isSending closure; reset silence when Helios starts.
  useEffect(() => {
    isSendingRef.current = isSending;
    if (isSending) {
      lastSpeechActivityAtRef.current = Date.now();
      setTranscriptSilenceMs(0);
      autoStashInFlightRef.current = false;
    }
  }, [isSending]);

  // TAP-only: silence clock while live — with text → fade + auto-stash;
  // empty bar after stash/submit → fade Listening… + purity hit if still silent.
  // Disabled entirely while waiting for Helios so wait latency is not a purity hit.
  // Grace after live entry avoids burning purity on briefing time / UI settle.
  useEffect(() => {
    if (phase !== "live") {
      setTranscriptSilenceMs(0);
      autoStashInFlightRef.current = false;
      return;
    }

    const liveEnteredAt = Date.now();
    lastSpeechActivityAtRef.current = liveEnteredAt;
    setTranscriptSilenceMs(0);

    const tick = window.setInterval(() => {
      if (isEndingRef.current) return;
      // Post-entry grace: keep silence clock frozen until UI/mic settle.
      if (isWithinTapPurityGrace(liveEnteredAt)) {
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        return;
      }
      // Helios in flight: freeze silence clock; do not auto-stash or empty-bar penalize.
      if (!shouldEvaluateSessionPurity({ waitingForHelios: isSendingRef.current })) {
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        return;
      }
      const silenceMs = Date.now() - lastSpeechActivityAtRef.current;
      setTranscriptSilenceMs(silenceMs);
      const hasTranscript = Boolean(tapHookFormingText(tapThoughtSpeech));

      if (
        shouldAutoStashOnSilence(silenceMs, hasTranscript, TAP_SILENCE_AUTO_STASH_MS) &&
        !autoStashInFlightRef.current
      ) {
        autoStashInFlightRef.current = true;
        stashCurrentTranscription({ auto: true });
        return;
      }

      if (
        shouldPenalizeEmptyBarSilence(silenceMs, hasTranscript, TAP_SILENCE_AUTO_STASH_MS) &&
        !autoStashInFlightRef.current
      ) {
        // Empty-bar silence after stash/submit (Listening… with no new speech).
        autoStashInFlightRef.current = true;
        applyPurityHit();
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        autoStashInFlightRef.current = false;
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [phase, stashCurrentTranscription, applyPurityHit]);

  // Thought context capacity: auto-stash at max chars — does NOT affect purity.
  useEffect(() => {
    if (phase !== "live") {
      contextStashInFlightRef.current = false;
      return;
    }
    if (isEndingRef.current) return;
    const forming = tapHookFormingText(tapThoughtSpeech);
    const ratio = thoughtContextFillRatio(
      forming,
      THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
    );
    if (
      shouldAutoStashOnContextFull(ratio) &&
      !contextStashInFlightRef.current &&
      forming
    ) {
      contextStashInFlightRef.current = true;
      stashCurrentTranscription({ fromContext: true });
    }
  }, [phase, crystallizableText, stashCurrentTranscription]);

  useEffect(() => {
    if (phase !== "live") {
      if (
        phase === "briefing" ||
        phase === "saving" ||
        phase === "results" ||
        phase === "practice_done" ||
        phase === "error"
      ) {
        stopLiveSpeechRecognition(speechBindings);
      }
      return;
    }
    // Always (re)arm recognition when entering/staying live so a dead mic
    // after pause-like transitions does not leave TAP stuck idle.
    if (isTapLiveThoughtSpeechEnabled(phase)) {
      stopLiveSpeechRecognition(speechBindings);
      return;
    }
  }, [phase, speechBindings, speechLang]);

  const applyTapSession = useCallback((patch: import("@/components/tap-score/use-tap-score-flow").TapScoreSessionPatch) => {
    if (patch.isSending !== undefined) setIsSending(patch.isSending);
    if (patch.heliosTurnMode !== undefined) setHeliosTurnMode(patch.heliosTurnMode);
    if (patch.error !== undefined) setError(patch.error);
    if (patch.messages !== undefined) setMessages(patch.messages);
    if (patch.sentThoughtIds !== undefined) setSentThoughtIds(patch.sentThoughtIds);
    if (patch.memoryThoughtIds !== undefined) setMemoryThoughtIds(patch.memoryThoughtIds);
    if (patch.isStartingSession !== undefined) setIsStartingSession(patch.isStartingSession);
    if (patch.startingTopicId !== undefined) setStartingTopicId(patch.startingTopicId);
    if (patch.isPracticeMode !== undefined) setIsPracticeMode(patch.isPracticeMode);
    if (patch.liveMinutes !== undefined) setLiveMinutes(patch.liveMinutes);
    if (patch.speechError !== undefined) setSpeechError(patch.speechError);
    if (patch.thoughts !== undefined) setThoughts(patch.thoughts);
    if (patch.sessionPurity !== undefined) setSessionPurity(patch.sessionPurity);
    if (patch.transcriptSilenceMs !== undefined) setTranscriptSilenceMs(patch.transcriptSilenceMs);
    if (patch.sessionEndedImpure !== undefined) setSessionEndedImpure(patch.sessionEndedImpure);
    if (patch.tapSessionId !== undefined) setTapSessionId(patch.tapSessionId);
    if (patch.startedAt !== undefined) setStartedAt(patch.startedAt);
    if (patch.remainingSeconds !== undefined) setRemainingSeconds(patch.remainingSeconds);
    if (patch.phase !== undefined) setPhase(patch.phase);
    if (patch.performanceReport !== undefined) setPerformanceReport(patch.performanceReport);
    if (patch.resultsError !== undefined) setResultsError(patch.resultsError);
    if (patch.interimText !== undefined) setInterimText(patch.interimText);
    if (patch.crystallizableText !== undefined) setCrystallizableText(patch.crystallizableText);
    if (patch.editingTranscription !== undefined) setEditingTranscription(patch.editingTranscription);
  }, []);
  const {
    sendThought, sendCurrentTranscription, retryMicrophone, startSession, restartBriefingFlow, endSession,
  } = useTapScoreSession({
    isSending, sentThoughtIds, messages, workspaceId, blockId, sessionId, privateToken,
    conversationLanguage, liveMinutes, minutes, startedAt, postSession, configuredRedirectUrl,
    resolvedWorkspaceId, dialogueStorageKey, phase, router, entryQueryParamsRef, tapSessionIdRef,
    isPracticeModeRef, isEndingRef, speechResultsLengthRef, consumedResultsIndexRef, finalBufferRef,
    autoStashInFlightRef, speechBindings, tapThoughtSpeech, logTapTrace, bumpUserActivity,
    handlePowInterruption, clearPendingInterruption, resetIdleTracking, resetSpeechTracking,
    flushSpeechSegment, flushFinalBuffer, clearTranscriptionDisplay, restartSpeechRecognitionSession,
    apply: applyTapSession,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase !== "live" || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const spoken = decideSpokenCaptureKeyAction(event);
      if (spoken === "cancel_edit" && editingTranscription) {
        event.preventDefault();
        setEditingTranscription(null);
        return;
      }
      if (spoken === "stash") {
        event.preventDefault();
        stashCurrentTranscription();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, stashCurrentTranscription, editingTranscription]);

  endAndScoreRef.current = endSession;

  useEffect(() => {
    if (phase !== "live" || !startedAt) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, liveMinutes * 60 - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        endAndScoreRef.current();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [phase, startedAt, liveMinutes]);

  function beginEditTranscription() {
    const text = tapHookFormingText(tapThoughtSpeech);
    if (!text) return;
    bumpUserActivity();
    setEditingTranscription({ draft: text, originalText: text });
  }


  if (isMobile) {
    return (
      <MobileBlockScreen
        product="tap"
        showDashboardLink={!privateToken}
      />
    );
  }

  return (
    <TapScorePhases
      phase={phase}
      bgImage={bgImage}
      t={t}
      workspaceTitle={workspaceTitle}
      minutes={minutes}
      setMinutes={setMinutes}
      conversationLanguage={conversationLanguage}
      setConversationLanguage={setConversationLanguage}
      privateToken={privateToken}
      durationLocked={durationLocked}
      isStartingSession={isStartingSession}
      startingTopics={startingTopics}
      startingTopicId={startingTopicId}
      topicsError={topicsError}
      error={error}
      startSession={startSession}
      participantIdentity={participantIdentity}
      isPracticeMode={isPracticeMode}
      lastUserTurn={lastUserTurn}
      lastAssistantTurn={lastAssistantTurn}
      messages={messages}
      isSending={isSending}
      heliosTurnMode={heliosTurnMode}
      userInitial={userInitial}
      remainingSeconds={remainingSeconds}
      sessionPurity={sessionPurity}
      crystallizableText={crystallizableText}
      showEndSession={showEndSession}
      endSession={endSession}
      speechError={speechError}
      speechSupported={speechSupported}
      isListening={isListening}
      transcriptSilenceMs={transcriptSilenceMs}
      retryMicrophone={retryMicrophone}
      sendCurrentTranscription={sendCurrentTranscription}
      stashCurrentTranscription={stashCurrentTranscription}
      beginEditTranscription={beginEditTranscription}
      stashedThoughts={stashedThoughts}
      sendThought={sendThought}
      thoughtHistory={thoughtHistory}
      workspaceId={workspaceId}
      blockId={blockId}
      sessionId={sessionId}
      resultsError={resultsError}
      performanceReport={performanceReport}
      sessionEndedImpure={sessionEndedImpure}
      restartBriefingFlow={restartBriefingFlow}
      setPhase={setPhase}
      editingTranscription={editingTranscription}
      setEditingTranscription={setEditingTranscription}
      logTapTrace={logTapTrace}
      clearTranscriptionDisplay={clearTranscriptionDisplay}
      restartSpeechRecognitionSession={restartSpeechRecognitionSession}
    />
  );
}
