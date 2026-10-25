"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getIlePostSessionPath } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { type HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { fetchAestheticPackages } from "@/lib/aesthetics";
import { useTapPredictiveInterruption } from "@/lib/useTapPredictiveInterruption";
import { useTapIdleProofOfWork } from "@/lib/useTapIdleProofOfWork";
import { useTapSpeechProofOfWork } from "@/lib/useTapSpeechProofOfWork";
import {
  emptySessionPolicySnapshot,
  type SessionPolicySnapshot,
} from "@/components/session-view/session-policy-context";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import {
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  shouldAutoStashOnContextFull,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";
import { MobileBlockScreen } from "@/components/MobileBlockScreen";
import { isSmartphoneClient } from "@/lib/is-smartphone";
import { useI18n } from "@/lib/i18n";
import type { TapStartingTopic } from "@/lib/tap-score";

import type { SessionSidebarMode } from "@/lib/session-sidebar";
import {
  useSessionThoughtInterface,
  useSpeechSupported,
} from "@/lib/useSessionThoughtInterface";
import { decideSpokenCaptureKeyAction } from "@/lib/spoken-thought-shortcut";
import {
  toSpeechBcp47,
  type SpokenLocale,
} from "@/lib/tutoring-languages";

import {
  type Phase,
  type Thought,
  type TapInitialSession,
  type TapTraceType,
  type TapSystem1Action,
  type TapSystem2Action,
  type TapChatMessage as ChatMessage,
  CHAIN_GAP_MS,
  pickTapBackgroundImage,
  getDialogueStorageKey,
  clearDialogueMessages,
  resolveInitialMinutes,
  normalize,
  advanceTapLiveClockPause,
  tapLiveClockRemainingSeconds,
} from "@/lib/tap-score-client-helpers";
import {
  tapTracePayload,
  isTapLiveThoughtSpeechEnabled,
  tapHookFormingText,
  type TapProductKind,
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
import {
  applyTapThoughtLocalDelete,
  applyTapThoughtLocalEdit,
  composeTapThoughtDeletePow,
  composeTapThoughtEditPow,
} from "@/lib/tap-thought-memory";

interface TapScoreClientProps {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  initialSession?: TapInitialSession;
  showEndSession?: boolean;
  entryQueryParams?: Record<string, string | string[]>;
  participantIdentity?: PowParticipantIdentity | null;
  initialMinutes?: number;
  lockDuration?: boolean;
  presetStartingTopics?: TapStartingTopic[];
  localOpening?: boolean;
  onLocalProof?: (input: {
    prompt: string;
    practice: boolean;
    questionId: string | null;
    policy?: {
      model: NonNullable<SessionPolicySnapshot["model"]>;
      sequence: SessionPolicySnapshot["sequence"];
    } | null;
  }) => Promise<void> | void;
  sidebarMode?: Extract<SessionSidebarMode, "tap" | "verification-tap">;
  verificationToken?: string | null;
}

/** Resolve whether End Session UI should show (default yes). */
export function resolveTapShowEndSession(input: {
  showEndSession?: boolean;
  initialSession?: Pick<TapInitialSession, "show_end_session"> | null;
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
  presetStartingTopics,
  localOpening = false,
  onLocalProof,
  sidebarMode = "tap",
  verificationToken = null,
}: TapScoreClientProps) {
  const showEndSession = resolveTapShowEndSession({
    showEndSession: showEndSessionProp,
    initialSession,
  });
  const kind: TapProductKind =
    sidebarMode === "verification-tap" || localOpening ? "verify" : "scored";
  const entryQueryParamsRef = useRef(entryQueryParams);
  const policyRef = useRef(emptySessionPolicySnapshot());
  useEffect(() => {
    entryQueryParamsRef.current = entryQueryParams;
  }, [entryQueryParams]);
  const router = useRouter();
  const { t } = useI18n();
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
  const postSession = initialSession?.post_session || "redirect_workspace";
  const configuredRedirectUrl =
    typeof initialSession?.redirect_url === "string" ? initialSession.redirect_url : null;
  const [resultsError, setResultsError] = useState("");
  const [workspaceTitle] = useState(initialSession?.workspaceTitle || "Workspace");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [interimText, setInterimText] = useState("");
  const [crystallizableText, setCrystallizableText] = useState("");
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
  const userInitial = "Y";
  const [tapSessionId, setTapSessionId] = useState<string | null>(initialSession?.id ?? null);
  const tapSessionIdRef = useRef<string | null>(initialSession?.id ?? null);
  const workCanvasSceneRef = useRef<IleWorkCanvasScene | null>(null);
  const resolvedWorkspaceId = workspaceId || initialSession?.workspace_id || undefined;
  const [sessionPurity, setSessionPurity] = useState(TAP_SESSION_PURITY_MAX);
  const [transcriptSilenceMs, setTranscriptSilenceMs] = useState(0);
  const [sessionEndedImpure, setSessionEndedImpure] = useState(false);
  const [liveMinutes, setLiveMinutes] = useState(resolvedLaunchMinutes);
  const [clockWaiting, setClockWaiting] = useState(false);
  const localQuestionIdRef = useRef<string | null>(null);
  const onLocalProofRef = useRef(onLocalProof);
  onLocalProofRef.current = onLocalProof;

  const isEndingRef = useRef(false);
  const isSendingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const liveMinutesRef = useRef(liveMinutes);
  const clockWaitingRef = useRef(false);
  const pauseStartedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const clockSessionRef = useRef<number | null>(null);
  startedAtRef.current = startedAt;
  liveMinutesRef.current = liveMinutes;
  isSendingRef.current = isSending;
  const canvasLoadingRef = useRef(true);
  const xaiReplyWaitRef = useRef(false);
  const imDoneBusyRef = useRef(false);
  const endAndScoreRef = useRef<(options?: { impure?: boolean }) => void>(() => {});
  const autoStashInFlightRef = useRef(false);
  const contextStashInFlightRef = useRef(false);
  const lastSpeechActivityAtRef = useRef(Date.now());
  const crystallizableTextRef = useRef("");

  useEffect(() => {
    tapSessionIdRef.current = tapSessionId;
  }, [tapSessionId]);

  useEffect(() => {
    let cancelled = false;
    fetchAestheticPackages()
      .then((packages) => {
        if (!cancelled) setBgImage(pickTapBackgroundImage(packages));
      })
      .catch(() => {
        if (!cancelled) setBgImage(pickTapBackgroundImage([]));
      });
    return () => {
      cancelled = true;
    };
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
    }),
    [workspaceId, blockId, sessionId, privateToken, tapSessionId, entryQueryParams],
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
      setTranscriptSilenceMs(0);
      crystallizableTextRef.current = text;
      setCrystallizableText(text);
      setInterimText(text);
      notifySpeechResultRef.current(text);
    },
  });

  const dialogueStorageKey = useMemo(
    () => getDialogueStorageKey({ workspaceId, sessionId, blockId, privateToken }),
    [workspaceId, sessionId, blockId, privateToken],
  );

  const lastAssistantTurn = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") return message;
    }
    return null;
  }, [messages]);

  const speechSupported = useSpeechSupported();

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
    autoStashInFlightRef.current = false;
  }, [dialogueStorageKey, clearPendingInterruption, resetIdleTracking, resetSpeechTracking]);

  useEffect(() => {
    if (phase !== "briefing") return;
    if (presetStartingTopics) {
      setStartingTopics(presetStartingTopics);
      setTopicsError("");
      return;
    }

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
  }, [phase, workspaceId, blockId, sessionId, privateToken, minutes, conversationLanguage, presetStartingTopics]);

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

  function editStashedThought(thought: Thought, nextText: string) {
    const result = applyTapThoughtLocalEdit(thoughts, thought.id, nextText);
    if (!result.next) return;
    logTapTrace(composeTapThoughtEditPow({
      thoughtId: thought.id,
      originalText: result.previous?.text || thought.text,
      text: result.next.text,
    }));
    setThoughts(result.thoughts);
  }

  function deleteStashedThought(thought: Thought) {
    const result = applyTapThoughtLocalDelete(thoughts, thought.id);
    if (!result.removed) return;
    logTapTrace(composeTapThoughtDeletePow({
      thoughtId: thought.id,
      text: result.removed.text,
    }));
    setThoughts(result.thoughts);
  }

  function addThought(text: string, system1Action: TapSystem1Action = "pause_finalize") {
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

  function clearTranscriptionDisplay() {
    setInterimText("");
    setCrystallizableText("");
    crystallizableTextRef.current = "";
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

  function flushFinalBuffer() {
    const text = tapHookFormingText(tapThoughtSpeech);
    clearTranscriptionDisplay();
    if (text) addThought(text);
  }

  const stashCurrentTranscription = useCallback(
    (options?: { auto?: boolean; fromContext?: boolean }) => {
      const text = tapHookFormingText(tapThoughtSpeech);
      clearTranscriptionDisplay();
      if (!text) {
        autoStashInFlightRef.current = false;
        contextStashInFlightRef.current = false;
        return;
      }
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
    [applyPurityHit],
  );

  const syncLiveClock = useCallback((waiting: boolean, now = Date.now()) => {
    const next = advanceTapLiveClockPause({
      waiting,
      nowMs: now,
      pauseStartedAtMs: pauseStartedAtRef.current,
      pausedMs: pausedMsRef.current,
    });
    pauseStartedAtRef.current = next.pauseStartedAtMs;
    pausedMsRef.current = next.pausedMs;
    if (clockWaitingRef.current !== waiting) {
      clockWaitingRef.current = waiting;
      setClockWaiting(waiting);
    }
    const started = startedAtRef.current;
    if (started == null) return;
    setRemainingSeconds(
      tapLiveClockRemainingSeconds({
        nowMs: now,
        startedAtMs: started,
        durationSeconds: liveMinutesRef.current * 60,
        pausedMs: next.pausedMs,
        pauseStartedAtMs: next.pauseStartedAtMs,
      }),
    );
  }, []);

  useEffect(() => {
    isSendingRef.current = isSending;
    if (isSending) {
      lastSpeechActivityAtRef.current = Date.now();
      setTranscriptSilenceMs(0);
      autoStashInFlightRef.current = false;
    }
    syncLiveClock(isSending || xaiReplyWaitRef.current);
  }, [isSending, syncLiveClock]);

  useEffect(() => {
    if (phase !== "live") {
      setTranscriptSilenceMs(0);
      autoStashInFlightRef.current = false;
      return;
    }

    const liveEnteredAt = Date.now();
    lastSpeechActivityAtRef.current = liveEnteredAt;
    canvasLoadingRef.current = true;
    setTranscriptSilenceMs(0);

    const tick = window.setInterval(() => {
      if (isEndingRef.current) return;
      if (isWithinTapPurityGrace(liveEnteredAt)) {
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        return;
      }
      if (!shouldEvaluateSessionPurity({
        waitingForHelios: isSendingRef.current,
        canvasLoading: canvasLoadingRef.current,
        waitingForXaiReply: xaiReplyWaitRef.current,
        imDoneAnsweringBusy: imDoneBusyRef.current,
      })) {
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        autoStashInFlightRef.current = false;
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
        autoStashInFlightRef.current = true;
        applyPurityHit();
        lastSpeechActivityAtRef.current = Date.now();
        setTranscriptSilenceMs(0);
        autoStashInFlightRef.current = false;
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [phase, stashCurrentTranscription, applyPurityHit]);

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
    if (isTapLiveThoughtSpeechEnabled(phase)) return;
    tapThoughtSpeech.pauseLiveSpeech();
  }, [phase, tapThoughtSpeech]);

  const applyTapSession = useCallback((patch: import("@/components/tap-score/use-tap-score-flow").TapScoreSessionPatch) => {
    if (patch.isSending !== undefined) setIsSending(patch.isSending);
    if (patch.heliosTurnMode !== undefined) setHeliosTurnMode(patch.heliosTurnMode);
    if (patch.error !== undefined) setError(patch.error);
    if (patch.messages !== undefined) setMessages(patch.messages);
    if (patch.sentThoughtIds !== undefined) setSentThoughtIds(patch.sentThoughtIds);
    if (patch.memoryThoughtIds !== undefined) setMemoryThoughtIds(patch.memoryThoughtIds);
    if (patch.isStartingSession !== undefined) setIsStartingSession(patch.isStartingSession);
    if (patch.startingTopicId !== undefined) setStartingTopicId(patch.startingTopicId);
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
    if (patch.resultsError !== undefined) setResultsError(patch.resultsError);
    if (patch.interimText !== undefined) setInterimText(patch.interimText);
    if (patch.crystallizableText !== undefined) setCrystallizableText(patch.crystallizableText);
    if (patch.editingTranscription !== undefined) setEditingTranscription(patch.editingTranscription);
  }, []);
  const {
    sendThought, sendCanvasAsk, sendCurrentTranscription, retryMicrophone, startSession, endSession,
  } = useTapScoreSession({
    isSending, sentThoughtIds, messages, workspaceId, blockId, sessionId, privateToken,
    conversationLanguage, liveMinutes, minutes, startedAt, postSession, configuredRedirectUrl,
    resolvedWorkspaceId, dialogueStorageKey, phase, router, entryQueryParamsRef, tapSessionIdRef,
    isEndingRef,
    autoStashInFlightRef, tapThoughtSpeech, logTapTrace, bumpUserActivity,
    handlePowInterruption, clearPendingInterruption, resetIdleTracking, resetSpeechTracking,
    flushSpeechSegment, flushFinalBuffer, clearTranscriptionDisplay,
    workCanvasSceneRef,
    apply: applyTapSession,
    kind,
    workspaceTitle,
    verificationToken,
    startingTopics,
    localOpening,
    localQuestionIdRef,
    policyRef,
    onLocalProof: (input) => onLocalProofRef.current?.(input),
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
    if (clockSessionRef.current !== startedAt) {
      clockSessionRef.current = startedAt;
      pauseStartedAtRef.current = null;
      pausedMsRef.current = 0;
      clockWaitingRef.current = false;
      setClockWaiting(false);
    }
    if (phase !== "live" || !startedAt) return;

    const tick = () => {
      const now = Date.now();
      const waiting = isSendingRef.current || xaiReplyWaitRef.current;
      syncLiveClock(waiting, now);
      if (
        tapLiveClockRemainingSeconds({
          nowMs: now,
          startedAtMs: startedAt,
          durationSeconds: liveMinutes * 60,
          pausedMs: pausedMsRef.current,
          pauseStartedAtMs: pauseStartedAtRef.current,
        }) <= 0 &&
        pauseStartedAtRef.current == null
      ) {
        endAndScoreRef.current();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [phase, startedAt, liveMinutes, syncLiveClock]);

  function beginEditTranscription() {
    const text = tapHookFormingText(tapThoughtSpeech);
    if (!text) return;
    bumpUserActivity();
    setEditingTranscription({ draft: text, originalText: text });
  }

  const holdSilenceForWait = useCallback((waiting: boolean) => {
    if (!waiting) return;
    lastSpeechActivityAtRef.current = Date.now();
    setTranscriptSilenceMs(0);
    autoStashInFlightRef.current = false;
  }, []);

  const onLearnerWaitChange = useCallback((wait: {
    canvasLoading: boolean;
    waitingForXaiReply: boolean;
  }) => {
    canvasLoadingRef.current = wait.canvasLoading;
    xaiReplyWaitRef.current = wait.waitingForXaiReply;
    holdSilenceForWait(wait.canvasLoading || wait.waitingForXaiReply);
    syncLiveClock(isSendingRef.current || wait.waitingForXaiReply);
  }, [holdSilenceForWait, syncLiveClock]);

  const onImDoneBusyChange = useCallback((busy: boolean) => {
    imDoneBusyRef.current = busy;
    holdSilenceForWait(busy);
  }, [holdSilenceForWait]);

  const onBackToWorkspace = useCallback(() => {
    if (resolvedWorkspaceId) {
      router.push(getIlePostSessionPath({ metadata: { workspace_id: resolvedWorkspaceId } }));
      return;
    }
    router.push("/dashboard");
  }, [resolvedWorkspaceId, router]);

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
      kind={kind}
      verificationToken={verificationToken}
      policyRef={policyRef}
      durationLocked={durationLocked}
      isStartingSession={isStartingSession}
      startingTopics={startingTopics}
      startingTopicId={startingTopicId}
      topicsError={topicsError}
      error={error}
      startSession={startSession}
      participantIdentity={participantIdentity}
      lastAssistantTurn={lastAssistantTurn}
      messages={messages}
      isSending={isSending}
      heliosTurnMode={heliosTurnMode}
      userInitial={userInitial}
      remainingSeconds={remainingSeconds}
      clockPaused={clockWaiting || isSending}
      sessionPurity={sessionPurity}
      crystallizableText={crystallizableText}
      showEndSession={showEndSession}
      endSession={endSession}
      speechError={tapThoughtSpeech.speechError ?? speechError}
      speechSupported={speechSupported}
      isListening={tapThoughtSpeech.isListening}
      transcriptSilenceMs={transcriptSilenceMs}
      retryMicrophone={retryMicrophone}
      sendCurrentTranscription={sendCurrentTranscription}
      stashCurrentTranscription={stashCurrentTranscription}
      beginEditTranscription={beginEditTranscription}
      stashedThoughts={stashedThoughts}
      sendThought={sendThought}
      onEditThought={editStashedThought}
      onDeleteThought={deleteStashedThought}
      thoughtHistory={thoughtHistory}
      workspaceId={workspaceId}
      onBackToWorkspace={
        resolvedWorkspaceId && !privateToken && !localOpening ? onBackToWorkspace : undefined
      }
      blockId={blockId}
      sessionId={sessionId}
      resultsError={resultsError}
      sessionEndedImpure={sessionEndedImpure}
      setPhase={setPhase}
      editingTranscription={editingTranscription}
      setEditingTranscription={setEditingTranscription}
      logTapTrace={logTapTrace}
      clearTranscriptionDisplay={clearTranscriptionDisplay}
      tapSessionId={tapSessionId}
      entryQueryParams={entryQueryParamsRef.current}
      workCanvasSceneRef={workCanvasSceneRef}
      sendCanvasAsk={sendCanvasAsk}
      onLearnerWaitChange={onLearnerWaitChange}
      onImDoneBusyChange={onImDoneBusyChange}
    />
  );
}
