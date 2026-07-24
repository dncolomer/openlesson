"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getIlePostSessionPath } from "@/lib/storage";
import { DialogueSplit, ThoughtCompactAction, type HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { useTapPredictiveInterruption } from "@/lib/useTapPredictiveInterruption";
import { useTapIdleProofOfWork } from "@/lib/useTapIdleProofOfWork";
import { useTapSpeechProofOfWork } from "@/lib/useTapSpeechProofOfWork";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import { ActiveThoughtSlots } from "@/components/thought-ui/ActiveThoughtSlots";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { useI18n } from "@/lib/i18n";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { TapPostSessionMode } from "@/lib/pow-api/tap-link-config";
import { TAP_LINK_MAX_MINUTES, TAP_LINK_MIN_MINUTES } from "@/lib/pow-api/tap-link-config";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import {
  formatSpeechTranscriptDisplay,
  restartLiveSpeechRecognition,
  startLiveSpeechRecognition,
  stopLiveSpeechRecognition,
  useSpeechSupported,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";

import {
  type Phase,
  type Thought,
  type TapTraceType,
  type TapSystem1Action,
  type TapSystem2Action,
  type TapChatMessage as ChatMessage,
  OPENING_MESSAGE_ID,
  THINK_ALOUD_PROTOCOL_LABEL,
  CHAIN_GAP_MS,
  DURATIONS,
  BACKGROUND_IMAGES,
  getDialogueStorageKey,
  clearDialogueMessages,
  resolveInitialMinutes,
  normalize,
  formatCountdown,
  thoughtButtonClasses,
  type ThoughtButtonSize,
  type ThoughtButtonVariant,
} from "@/lib/tap-score-client-helpers";

interface TapScoreClientProps {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  initialSession?: any;
  /** When false, hide End Session control. Default true. */
  showEndSession?: boolean;
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

function ThoughtButton({
  size = "md",
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ThoughtButtonSize;
  variant?: ThoughtButtonVariant;
}) {
  return <button className={thoughtButtonClasses({ size, variant, className })} {...props} />;
}

function ThoughtKeyHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center justify-center rounded border border-neutral-600 bg-black/55 px-1.5 font-mono text-[10px] font-medium leading-none text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </span>
  );
}

function ThoughtShortcutChord({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, index) => (
        <ThoughtKeyHint key={`${key}-${index}`}>{key}</ThoughtKeyHint>
      ))}
    </span>
  );
}

function ThoughtButtonLabel({
  shortcut,
  children,
}: {
  shortcut?: ReactNode | string[];
  children: ReactNode;
}) {
  const shortcutNode =
    shortcut == null ? null : Array.isArray(shortcut) ? (
      <ThoughtShortcutChord keys={shortcut} />
    ) : typeof shortcut === "string" ? (
      <ThoughtKeyHint>{shortcut}</ThoughtKeyHint>
    ) : (
      shortcut
    );

  return (
    <span className="inline-flex items-center gap-2">
      {shortcutNode}
      <span>{children}</span>
    </span>
  );
}

function TapBriefingConfig({
  workspaceTitle,
  minutes,
  onMinutesChange,
  showDurationPicker,
  disabled,
}: {
  workspaceTitle: string;
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  showDurationPicker: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();

  const shortcutRows: { keys: string[]; label: string }[] = [
    { keys: ["Enter"], label: t("tap.briefing.shortcutSend") },
    { keys: ["Del"], label: t("tap.briefing.shortcutStash") },
    { keys: ["E"], label: t("tap.briefing.shortcutEdit") },
    { keys: ["1", "2", "3"], label: t("tap.briefing.shortcutSendStashed") },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-8 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{workspaceTitle}</p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-neutral-100 sm:text-3xl">
          {THINK_ALOUD_PROTOCOL_LABEL}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">{t("tap.briefing.intro")}</p>
      </div>

      {showDurationPicker ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">{t("tap.briefing.sessionLength")}</p>
          <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
            {DURATIONS.map((duration) => (
              <ThoughtButton
                key={duration}
                size="lg"
                variant={minutes === duration ? "toggleOn" : "toggleOff"}
                className="w-full"
                disabled={disabled}
                onClick={() => onMinutesChange(duration)}
              >
                {t("tap.briefing.minutes", { minutes: duration })}
              </ThoughtButton>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">{t("tap.briefing.keyboardShortcuts")}</p>
        <ul className="mt-3 space-y-2.5 text-sm text-neutral-400">
          {shortcutRows.map((row) => (
            <li key={row.label} className="flex flex-wrap items-center gap-2">
              <ThoughtShortcutChord keys={row.keys} />
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}



export function TapScoreClient({
  workspaceId,
  blockId,
  sessionId,
  privateToken,
  initialSession,
  showEndSession: showEndSessionProp,
}: TapScoreClientProps) {
  const showEndSession = resolveTapShowEndSession({
    showEndSession: showEndSessionProp,
    initialSession,
  });
  const router = useRouter();
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("briefing");
  const [minutes, setMinutes] = useState(resolveInitialMinutes(initialSession?.requested_duration_seconds));
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

  const isEndingRef = useRef(false);
  const endAndScoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    tapSessionIdRef.current = tapSessionId;
  }, [tapSessionId]);

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  const { applyInterruption, clearPendingInterruption } = useTapPredictiveInterruption(
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
  );

  const handlePowInterruption = useCallback(
    (interruption: ProofOfWorkApiInterruption | undefined) => {
      if (interruption === undefined) return;
      applyInterruption(interruption);
    },
    [applyInterruption],
  );

  const idlePowContext = useMemo(
    () => ({
      workspaceId,
      blockId,
      sessionId,
      privateToken,
      tapSessionId,
    }),
    [workspaceId, blockId, sessionId, privateToken, tapSessionId],
  );

  const {
    isTranscriptionActive,
    notifySpeechResult,
    flushSpeechSegment,
    resetSpeechTracking,
  } = useTapSpeechProofOfWork(phase === "live", idlePowContext, handlePowInterruption);

  const { bumpUserActivity, resetIdleTracking } = useTapIdleProofOfWork(
    phase === "live",
    idlePowContext,
    handlePowInterruption,
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
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId: activeTapSessionId,
          ...input,
        }),
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
  const langRef = useRef("en-US");
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechResultsLengthRef = useRef(0);
  const consumedResultsIndexRef = useRef(0);

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
            minutes,
            tapSessionId: tapSessionIdRef.current,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load starting topics");
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
  }, [phase, workspaceId, blockId, sessionId, privateToken, minutes]);

  const stashedThoughts = useMemo(
    () => thoughts.filter((thought) => !memoryThoughtIds.has(thought.id) && !sentThoughtIds.has(thought.id)),
    [thoughts, memoryThoughtIds, sentThoughtIds],
  );
  const latestThoughts = useMemo(() => stashedThoughts.slice(-3).reverse(), [stashedThoughts]);
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
    bumpUserActivity();
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
  }

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
        setInterimText(interim);
        setCrystallizableText(displayText);
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
    restartLiveSpeechRecognition(speechBindings);
  }, [speechBindings]);

  function clearTranscriptionBuffers() {
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
  }

  function flushFinalBuffer() {
    const text = normalize(finalBufferRef.current.join(" "));
    clearTranscriptionBuffers();
    if (text) addThought(text);
  }

  const stashCurrentTranscription = useCallback(() => {
    const text = normalize(crystallizableText);
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
    if (text) addThought(text);
  }, [crystallizableText, restartSpeechRecognitionSession]);

  useEffect(() => {
    if (phase !== "live") {
      if (phase === "briefing" || phase === "saving" || phase === "results" || phase === "error") {
        stopLiveSpeechRecognition(speechBindings);
      }
      return;
    }
    // Always (re)arm recognition when entering/staying live so a dead mic
    // after pause-like transitions does not leave TAP stuck idle.
    startLiveSpeechRecognition(speechBindings, "en-US");
  }, [phase, speechBindings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase !== "live" || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape" && editingTranscription) {
        event.preventDefault();
        setEditingTranscription(null);
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        void sendCurrentTranscription();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        stashCurrentTranscription();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        beginEditTranscription();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && ["1", "2", "3"].includes(event.key)) {
        const thought = latestThoughts[Number(event.key) - 1];
        if (!thought) return;
        event.preventDefault();
        void sendThought(thought.text, [thought.id]);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, latestThoughts, stashCurrentTranscription, sendCurrentTranscription, editingTranscription, crystallizableText]);

  async function sendThought(text: string, thoughtIds: string[] = []) {
    const clean = normalize(text);
    if (!clean || isSending) return;
    const isResend = thoughtIds.length > 0 && thoughtIds.every((id) => sentThoughtIds.has(id));
    logTapTrace({
      traceType: "system2",
      action: isResend ? "resend" : "send",
      thoughtIds,
      thoughtId: thoughtIds.length === 1 ? thoughtIds[0] : undefined,
      text: clean,
      combined: thoughtIds.length > 1,
    });
    bumpUserActivity();
    setIsSending(true);
    setHeliosTurnMode("idle");
    setError("");
    const userMessage: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: clean, at: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setSentThoughtIds((current) => new Set([...current, ...thoughtIds]));
    setMemoryThoughtIds((current) => {
      const next = new Set(current);
      thoughtIds.forEach((id) => next.delete(id));
      return next;
    });
    try {
      const response = await fetch("/api/workspace-tap-score/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId: tapSessionIdRef.current,
          minutes,
          thought: clean,
          messages: nextMessages,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not get TAP response");
      const assistant: ChatMessage = { id: `a_${Date.now()}`, role: "assistant", content: payload.message, at: new Date().toISOString() };
      setMessages((current) => [...current, assistant]);
      handlePowInterruption(payload.interruption ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get TAP response");
    } finally {
      setIsSending(false);
    }
  }

  async function sendCurrentTranscription() {
    const text = normalize(crystallizableText);
    if (!text) return;
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
    await sendThought(text, []);
  }

  function retryMicrophone() {
    if (phase !== "live") return;
    setSpeechError(null);
    stopLiveSpeechRecognition(speechBindings);
    startLiveSpeechRecognition(speechBindings, "en-US");
  }

  async function startSession(topic?: TapStartingTopic) {
    isEndingRef.current = false;
    clearPendingInterruption();
    resetIdleTracking();
    resetSpeechTracking();
    setHeliosTurnMode("idle");
    setIsStartingSession(true);
    setStartingTopicId(topic?.id ?? null);
    setError("");
    setSpeechError(null);
    speechResultsLengthRef.current = 0;
    consumedResultsIndexRef.current = 0;
    finalBufferRef.current = [];
    setThoughts([]);
    setMemoryThoughtIds(new Set());
    setSentThoughtIds(new Set());
    clearDialogueMessages(dialogueStorageKey);
    startLiveSpeechRecognition(speechBindings, "en-US");

    try {
      const response = await fetch("/api/workspace-tap-score/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          minutes,
          tapSessionId: tapSessionIdRef.current,
          openingQuestion: topic?.openingQuestion,
          topicId: topic?.id,
          topicTitle: topic?.title,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start TAP session");
      if (payload.tapSessionId) {
        tapSessionIdRef.current = payload.tapSessionId;
        setTapSessionId(payload.tapSessionId);
      }

      const openingQuestion = String(payload.openingQuestion || "").trim();
      if (!openingQuestion) throw new Error("Could not generate opening question");

      const started = Date.now();
      setStartedAt(started);
      setRemainingSeconds(minutes * 60);
      setMessages([
        {
          id: OPENING_MESSAGE_ID,
          role: "assistant",
          content: openingQuestion,
          at: new Date().toISOString(),
        },
      ]);
      resetIdleTracking();
      resetSpeechTracking();
      setPhase("live");
    } catch (err) {
      stopLiveSpeechRecognition(speechBindings);
      setError(err instanceof Error ? err.message : "Could not start TAP session");
    } finally {
      setIsStartingSession(false);
      setStartingTopicId(null);
    }
  }

  async function endSession() {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    clearPendingInterruption();
    flushSpeechSegment();
    resetIdleTracking();
    resetSpeechTracking();
    setHeliosTurnMode("idle");
    flushFinalBuffer();
    setPhase("saving");
    stopLiveSpeechRecognition(speechBindings);
    try {
      const durationSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const transcript = messages.map((message) => ({ role: message.role, text: message.content, at: message.at }));
      const response = await fetch("/api/workspace-tap-score/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          tapSessionId: tapSessionIdRef.current,
          transcript,
          durationSeconds,
          requestedDurationSeconds: minutes * 60,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save TAP session");

      // Private session links: thank-you only (no redirect / results scorecard).
      // LWM Snapshot remains manual (Knowledge UI / Snapshot API) for owners.
      if (privateToken) {
        setPerformanceReport(null);
        setPhase("results");
        return;
      }

      const resolvedPostSession = (payload.postSession as TapPostSessionMode) || postSession;
      const resolvedRedirectUrl =
        typeof payload.redirectUrl === "string" ? payload.redirectUrl : configuredRedirectUrl;

      if (resolvedPostSession === "show_results") {
        setPerformanceReport(null);
        setPhase("results");
        return;
      }

      if (resolvedPostSession === "redirect_url" && resolvedRedirectUrl) {
        window.location.href = resolvedRedirectUrl;
        return;
      }

      const targetWorkspaceId = payload.workspaceId || resolvedWorkspaceId;
      if (targetWorkspaceId) {
        router.push(getIlePostSessionPath({ metadata: { workspace_id: targetWorkspaceId } }));
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save TAP session");
      setPhase("error");
      isEndingRef.current = false;
    }
  }

  endAndScoreRef.current = endSession;

  useEffect(() => {
    if (phase !== "live" || !startedAt) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, minutes * 60 - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        endAndScoreRef.current();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [phase, startedAt, minutes]);

  function beginEditTranscription() {
    const text = normalize(crystallizableText);
    if (!text) return;
    bumpUserActivity();
    setEditingTranscription({ draft: text, originalText: text });
  }

  return (
    <main className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0a0a0a] text-white selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      {bgImage && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/82" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.18),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.55),transparent_32%)]" />

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6">
        {phase === "briefing" && (
          <section className="relative flex min-h-[calc(100vh-2.5rem)] flex-1 py-4">
            <div className="grid min-h-0 w-full flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
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
                        loadingLabel={t("tap.briefing.topicsLoading")}
                        startLabel={t("onboardingGuide.tap.step3.start")}
                        startingLabel={t("onboardingGuide.tap.step3.starting")}
                      />
                      {topicsError ? (
                        <p className="mt-2 text-center text-xs text-amber-300/90">{topicsError}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 backdrop-blur-md">
                <TapBriefingConfig
                  workspaceTitle={workspaceTitle}
                  minutes={minutes}
                  onMinutesChange={setMinutes}
                  showDurationPicker={!privateToken}
                  disabled={isStartingSession}
                />
              </div>
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
            <div className="grid h-full min-h-0 gap-4 grid-rows-[minmax(0,1fr)_minmax(0,24rem)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)]">
              <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden lg:row-span-1">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                    <DialogueSplit
                      layout="tap"
                      lastUserTurn={lastUserTurn}
                      lastAssistantTurn={lastAssistantTurn}
                      promptText=""
                      isSending={isSending || (isStartingSession && !lastAssistantTurn)}
                      heliosTurnMode={
                        heliosTurnMode === "interruption" ? "interruption" : isSending ? "responding" : "idle"
                      }
                      error={error}
                      userInitial={userInitial}
                    />
                  </div>
                </div>

                <div className="shrink-0 min-w-0 overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
                <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 border-b border-neutral-900/80 pb-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Time left</div>
                    <div
                      className={`font-mono text-lg tabular-nums tracking-tight ${
                        remainingSeconds <= 60 ? "text-amber-300" : "text-white"
                      }`}
                    >
                      {formatCountdown(remainingSeconds)}
                    </div>
                  </div>
                  {showEndSession ? (
                    <div className="flex flex-wrap items-center gap-2" data-tap-end-session>
                      <ThoughtButton size="sm" variant="primary" onClick={endSession}>
                        End session
                      </ThoughtButton>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300">
                    <SlidingTranscript
                      text={formatSpeechTranscriptDisplay({
                        text: crystallizableText,
                        speechError,
                        speechSupported,
                        isListening,
                        // Speech strip only mounts in live phase; keep enabled tied to it.
                        enabled: phase === "live",
                      })}
                      className={`w-full ${speechError ? "text-amber-300/90" : "text-neutral-300"}`}
                    />
                  </div>
                  {speechSupported !== false && !isListening ? (
                    <ThoughtButton size="sm" variant="primary" onClick={() => void retryMicrophone()}>
                      {speechError ? "Retry" : "Start"}
                    </ThoughtButton>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ThoughtCompactAction
                      shortcut="↵"
                      label="Send"
                      disabled={!crystallizableText || isSending}
                      onClick={() => void sendCurrentTranscription()}
                    />
                    <ThoughtCompactAction
                      shortcut="Del"
                      label="Stash"
                      disabled={!crystallizableText}
                      onClick={stashCurrentTranscription}
                    />
                    <ThoughtCompactAction
                      shortcut="E"
                      label="Edit"
                      disabled={!crystallizableText}
                      onClick={beginEditTranscription}
                    />
                  </div>
                </div>

                <div className="mt-3 border-t border-neutral-900/80 pt-3">
                  <p className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-600">Stashed thoughts</p>
                  <ActiveThoughtSlots
                    thoughts={latestThoughts}
                    isSending={isSending}
                    onSendThought={(text, thoughtId) => void sendThought(text, [thoughtId])}
                  />
                </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-col overflow-hidden lg:h-full">
                <ThoughtMemoryPanel
                  className="flex h-full min-h-0 max-h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 p-4 backdrop-blur-sm"
                  listClassName="pr-1"
                  thoughts={thoughtHistory}
                  workspaceId={workspaceId}
                  blockId={blockId}
                  sessionId={sessionId}
                  insightSurface="tap"
                  allowInsightGeneration={false}
                />
              </div>
            </div>
          </section>
        )}

        {phase === "saving" && (
          <section className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage
              tone="muted"
              message={t("tap.postSession.savingAndReturning")}
            />
          </section>
        )}
        {phase === "results" ? (
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
                className="mt-8 inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                {t("tap.postSession.exploreUncertainSystems")}
              </a>
            </section>
          ) : (
            <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto py-6">
              <h1 className="text-2xl font-medium text-neutral-100">{t("tap.postSession.resultsTitle")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">{t("tap.postSession.resultsHint")}</p>
              {performanceReport ? (
                <div className="mt-6 min-h-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 md:p-5">
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
            <ThoughtButton size="md" variant="primary" className="mt-6" onClick={() => setPhase("briefing")}>
              Try again
            </ThoughtButton>
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
