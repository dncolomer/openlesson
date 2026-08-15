"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  buildIleThoughtMemoryRecord,
  normalizeIleFormingText,
  type IleThoughtMemoryRecord,
} from "@/lib/ile-context-auto-stash";


export interface SessionThought {
  id: string;
  text: string;
  timestamp: number;
  chainId: string;
}

export type SessionTraceType = "system1" | "system2";
export type SessionSystem1Action = "crystallize" | "pause_finalize" | "auto_stash";
export type SessionSystem2Action =
  | "send"
  | "skip"
  | "select"
  | "deselect"
  | "resend"
  | "edit"
  | "remove";

export type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
};
export type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: SpeechRecognitionResultLike };
};
export type SpeechRecognitionErrorEventLike = Event & { readonly error?: string };
export type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Test-only override so node vitest can exercise the real start/stop path. */
let speechRecognitionCtorForTests: SpeechRecognitionConstructor | null | undefined;

export function setSpeechRecognitionConstructorForTests(
  ctor: SpeechRecognitionConstructor | null | undefined,
) {
  speechRecognitionCtorForTests = ctor;
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (speechRecognitionCtorForTests !== undefined) {
    return speechRecognitionCtorForTests;
  }
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * ILE thought-interface speech is armed only while the learner is in an
 * active monitoring session (recording, not paused, onboarding not covering Helios).
 */
export function isIleSpeechCaptureEnabled(input: {
  isRecording: boolean;
  isPaused: boolean;
  showWelcomePanel: boolean;
}): boolean {
  return input.isRecording && !input.isPaused && !input.showWelcomePanel;
}

/** Exported for lifecycle unit tests (Chrome needs a beat before re-start). */
export const SPEECH_RESTART_DELAY_MS_FOR_TESTS = 280;

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/** Errors that end a turn but should not surface as permanent mic failures. */
const BENIGN_SPEECH_RECOGNITION_ERRORS = new Set(["aborted", "no-speech"]);

/** Delay before restarting after onend — Chrome often rejects immediate start(). */
const SPEECH_RESTART_DELAY_MS = SPEECH_RESTART_DELAY_MS_FOR_TESTS;

export function shouldReportSpeechRecognitionError(error?: string) {
  return !!error && !BENIGN_SPEECH_RECOGNITION_ERRORS.has(error);
}

export function isFatalSpeechRecognitionError(error?: string) {
  return error === "not-allowed" || error === "service-not-allowed" || error === "language-not-supported";
}

export function formatSpeechTranscriptDisplay({
  text,
  speechError,
  speechSupported,
  isListening,
  enabled = true,
}: {
  text: string;
  speechError: string | null;
  speechSupported: boolean | null;
  isListening: boolean;
  /** When false, speech capture is intentionally off (session paused / not started). */
  enabled?: boolean;
}) {
  if (text) return text;
  if (speechSupported === false) {
    return "Speech recognition is not supported in this browser.";
  }
  if (speechError === "not-allowed") {
    return "Microphone blocked — allow access for this site, then click Start.";
  }
  if (speechError === "unsupported") {
    return "Speech recognition is not supported in this browser.";
  }
  if (speechError) {
    return `Microphone error: ${speechError}`;
  }
  if (speechSupported === null) return "Starting microphone…";
  if (!enabled) return "Speech capture off — start the session to listen";
  if (isListening) return "Listening…";
  return "Mic idle — click Start to listen";
}

export function useSpeechSupported() {
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionConstructor());
  }, []);
  return speechSupported;
}

export type LiveSpeechRecognitionBindings = {
  recognitionRef: MutableRefObject<SpeechRecognitionLike | null>;
  shouldListenRef: MutableRefObject<boolean>;
  /** Pending delayed restart after onend (Chrome needs a beat before start()). */
  restartTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  /** BCP-47 language for recreating the recognizer after a hard failure. */
  langRef: MutableRefObject<string>;
  onResult: (event: SpeechRecognitionEventLike) => void;
  onListeningChange: (listening: boolean) => void;
  onError: (error: string | null) => void;
};

function clearSpeechRestartTimer(bindings: LiveSpeechRecognitionBindings) {
  if (bindings.restartTimerRef.current != null) {
    clearTimeout(bindings.restartTimerRef.current);
    bindings.restartTimerRef.current = null;
  }
}

function scheduleSpeechRestart(bindings: LiveSpeechRecognitionBindings, recognition: SpeechRecognitionLike) {
  clearSpeechRestartTimer(bindings);
  bindings.restartTimerRef.current = setTimeout(() => {
    bindings.restartTimerRef.current = null;
    if (!bindings.shouldListenRef.current) return;
    if (bindings.recognitionRef.current !== recognition) return;
    try {
      recognition.start();
      // isListening flips true in onstart; do not optimistically set it here.
    } catch (err) {
      const message = String(err);
      if (/already\s+started/i.test(message)) {
        bindings.onListeningChange(true);
        bindings.onError(null);
        return;
      }
      // Instance may be dead — rebuild a fresh recognizer.
      disposeSpeechRecognition(recognition, bindings);
      if (bindings.shouldListenRef.current) {
        startLiveSpeechRecognition(bindings, bindings.langRef.current);
      }
    }
  }, SPEECH_RESTART_DELAY_MS);
}

function attachLiveSpeechRecognitionHandlers(
  recognition: SpeechRecognitionLike,
  bindings: LiveSpeechRecognitionBindings,
) {
  recognition.onresult = bindings.onResult;
  recognition.onstart = () => {
    if (bindings.recognitionRef.current !== recognition) return;
    bindings.onListeningChange(true);
    bindings.onError(null);
  };
  recognition.onerror = (event) => {
    const error = event.error || "speech-recognition-error";
    if (isFatalSpeechRecognitionError(error)) {
      bindings.shouldListenRef.current = false;
    }
    if (shouldReportSpeechRecognitionError(error)) {
      bindings.onError(error);
    }
  };
  recognition.onend = () => {
    if (bindings.recognitionRef.current !== recognition) return;
    bindings.onListeningChange(false);
    if (!bindings.shouldListenRef.current) return;
    scheduleSpeechRestart(bindings, recognition);
  };
}

function tryStartRecognition(recognition: SpeechRecognitionLike, bindings: LiveSpeechRecognitionBindings) {
  try {
    recognition.start();
    // Wait for onstart before claiming we are listening.
  } catch (err) {
    const message = String(err);
    if (/already\s+started/i.test(message)) {
      bindings.onListeningChange(true);
      bindings.onError(null);
      return true;
    }
    bindings.onError(message);
    bindings.onListeningChange(false);
    if (isFatalSpeechRecognitionError(message)) {
      bindings.shouldListenRef.current = false;
    }
    return false;
  }
  return true;
}

/** Start or resume a single continuous SpeechRecognition session. Prefer calling from a user gesture. */
export function startLiveSpeechRecognition(
  bindings: LiveSpeechRecognitionBindings,
  lang: string,
): SpeechRecognitionLike | null {
  const ctor = getSpeechRecognitionConstructor();
  if (!ctor) {
    bindings.onError("unsupported");
    return null;
  }

  bindings.shouldListenRef.current = true;
  bindings.langRef.current = lang;
  clearSpeechRestartTimer(bindings);

  const existing = bindings.recognitionRef.current;
  if (existing) {
    existing.lang = lang;
    attachLiveSpeechRecognitionHandlers(existing, bindings);
    tryStartRecognition(existing, bindings);
    return existing;
  }

  const recognition = new ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  attachLiveSpeechRecognitionHandlers(recognition, bindings);
  bindings.recognitionRef.current = recognition;
  tryStartRecognition(recognition, bindings);
  return recognition;
}

export function restartLiveSpeechRecognition(bindings: LiveSpeechRecognitionBindings) {
  const recognition = bindings.recognitionRef.current;
  if (!recognition || !bindings.shouldListenRef.current) return;
  clearSpeechRestartTimer(bindings);
  try {
    recognition.abort();
  } catch {}
  // onend → scheduleSpeechRestart will call start() after a short delay.
}

export function stopLiveSpeechRecognition(bindings: LiveSpeechRecognitionBindings) {
  bindings.shouldListenRef.current = false;
  clearSpeechRestartTimer(bindings);
  if (bindings.recognitionRef.current) {
    disposeSpeechRecognition(bindings.recognitionRef.current, bindings);
  }
  bindings.onListeningChange(false);
}

export function disposeSpeechRecognition(
  recognition: SpeechRecognitionLike,
  bindingsOrRef: LiveSpeechRecognitionBindings | MutableRefObject<SpeechRecognitionLike | null>,
) {
  const recognitionRef =
    "recognitionRef" in bindingsOrRef ? bindingsOrRef.recognitionRef : bindingsOrRef;
  if ("restartTimerRef" in bindingsOrRef) {
    clearSpeechRestartTimer(bindingsOrRef);
  }
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onstart = null;
  recognition.onend = null;
  try {
    recognition.abort();
  } catch {}
  if (recognitionRef.current === recognition) {
    recognitionRef.current = null;
  }
}

export interface SessionThoughtTracePayload {
  traceType: SessionTraceType;
  action: SessionSystem1Action | SessionSystem2Action;
  thoughtId?: string;
  thoughtIds?: string[];
  chainId?: string;
  text?: string;
  originalText?: string;
  combined?: boolean;
  timestampMs?: number;
}

const THOUGHT_HISTORY_LIMIT = 50;

function loadStoredThoughts(sessionId: string): SessionThought[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(`uncertain-systems:${sessionId}:thought-history`);
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SessionThought =>
          typeof item?.id === "string" &&
          typeof item?.text === "string" &&
          typeof item?.timestamp === "number",
      )
      .slice(-THOUGHT_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

interface UseSessionThoughtInterfaceOptions {
  enabled: boolean;
  speechLang?: string;
  sessionId?: string;
  onLogTrace: (payload: SessionThoughtTracePayload) => void;
  onSendToProbe: (text: string, thoughtIds: string[]) => Promise<void>;
  onSpeechTranscript?: (text: string) => void;
  onUserActivity?: () => void;
  /** ILE default: capture Enter/Del. TAP shells keep their own keys. */
  captureKeys?: boolean;
}

export function useSessionThoughtInterface({
  enabled,
  speechLang = "en-US",
  sessionId,
  onLogTrace,
  onSendToProbe,
  onSpeechTranscript,
  onUserActivity,
  captureKeys = true,
}: UseSessionThoughtInterfaceOptions) {
  const onSpeechTranscriptRef = useRef(onSpeechTranscript);
  const onUserActivityRef = useRef(onUserActivity);

  useEffect(() => {
    onSpeechTranscriptRef.current = onSpeechTranscript;
  }, [onSpeechTranscript]);

  useEffect(() => {
    onUserActivityRef.current = onUserActivity;
  }, [onUserActivity]);
  const [thoughts, setThoughts] = useState<SessionThought[]>([]);
  const [interimText, setInterimText] = useState("");
  const [crystallizableText, setCrystallizableText] = useState("");
  const crystallizableTextRef = useRef("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [memoryThoughtIds, setMemoryThoughtIds] = useState<Set<string>>(new Set());
  const [sentThoughtIds, setSentThoughtIds] = useState<Set<string>>(new Set());
  const [editingTranscription, setEditingTranscription] = useState<{ draft: string; originalText: string } | null>(null);
  const speechSupported = useSpeechSupported();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(speechLang);
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechResultsLengthRef = useRef(0);
  const consumedResultsIndexRef = useRef(0);
  const isListeningRef = useRef(false);

  useEffect(() => {
    langRef.current = speechLang;
  }, [speechLang]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if (!sessionId) return;
    setThoughts(loadStoredThoughts(sessionId));
    setMemoryThoughtIds(new Set());
    setSentThoughtIds(new Set());
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    window.localStorage.setItem(
      `uncertain-systems:${sessionId}:thought-history`,
      JSON.stringify(thoughts.slice(-THOUGHT_HISTORY_LIMIT)),
    );
  }, [sessionId, thoughts]);

  const stashedThoughts = useMemo(
    () => thoughts.filter((thought) => !memoryThoughtIds.has(thought.id) && !sentThoughtIds.has(thought.id)),
    [thoughts, memoryThoughtIds, sentThoughtIds],
  );
  const latestThoughts = useMemo(() => stashedThoughts.slice(-3).reverse(), [stashedThoughts]);

  function buildThoughtRecord(text: string, currentThoughts: SessionThought[]): SessionThought | null {
    return buildIleThoughtMemoryRecord(text, currentThoughts as IleThoughtMemoryRecord[]) as SessionThought | null;
  }

  function addThought(text: string, system1Action: SessionSystem1Action = "pause_finalize") {
    onUserActivityRef.current?.();
    const thought = buildThoughtRecord(text, thoughts);
    if (!thought) return;
    const already = thoughts.some((t) => t.id === thought.id);
    if (already) return;
    setThoughts((current) => {
      if (current.some((t) => t.id === thought.id)) return current;
      return [...current, thought];
    });
    onLogTrace({
      traceType: "system1",
      action: system1Action,
      thoughtId: thought.id,
      chainId: thought.chainId,
      text: thought.text,
      timestampMs: thought.timestamp,
    });
  }

  function markSpeechConsumed() {
    consumedResultsIndexRef.current = speechResultsLengthRef.current;
  }

  function clearTranscriptionDisplay() {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    finalBufferRef.current = [];
    setInterimText("");
    crystallizableTextRef.current = "";
    setCrystallizableText("");
  }

  const speechBindings = useMemo<LiveSpeechRecognitionBindings>(
    () => ({
      recognitionRef,
      shouldListenRef,
      restartTimerRef,
      langRef,
      onResult: (event) => {
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
        crystallizableTextRef.current = displayText;
        setCrystallizableText(displayText);
        onSpeechTranscriptRef.current?.(displayText);
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
    if (sessionReset) resetSpeechResultCursor();
    return Math.max(resultIndex, consumedResultsIndexRef.current);
  }

  function flushFinalBuffer() {
    const text = normalize(finalBufferRef.current.join(" "));
    finalBufferRef.current = [];
    crystallizableTextRef.current = "";
    setCrystallizableText("");
    markSpeechConsumed();
    if (text) addThought(text);
  }

  const getFormingText = useCallback(() => {
    return normalizeIleFormingText(crystallizableTextRef.current || crystallizableText);
  }, [crystallizableText]);

  const stashCurrentTranscription = useCallback((providedText?: string) => {
    const text = normalizeIleFormingText(
      providedText ?? (crystallizableTextRef.current || crystallizableText),
    );
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
    if (text) addThought(text, providedText ? "auto_stash" : "pause_finalize");
  }, [crystallizableText, restartSpeechRecognitionSession]);

  const ingestStashedThought = useCallback((thought: SessionThought) => {
    onUserActivityRef.current?.();
    let alreadyPresent = false;
    setThoughts((current) => {
      if (current.some((t) => t.id === thought.id)) {
        alreadyPresent = true;
        return current;
      }
      return [...current, thought];
    });
    if (alreadyPresent) return;
    onLogTrace({
      traceType: "system1",
      action: "auto_stash",
      thoughtId: thought.id,
      chainId: thought.chainId,
      text: thought.text,
      timestampMs: thought.timestamp,
    });
  }, [onLogTrace]);

  /** Clear live speech bar without stashing or logging (e.g. Project Mode dual-list path). */
  const clearCurrentTranscription = useCallback(() => {
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
  }, [restartSpeechRecognitionSession]);

  useEffect(() => {
    if (!enabled) {
      stopLiveSpeechRecognition(speechBindings);
      return;
    }
    startLiveSpeechRecognition(speechBindings, speechLang);

    // Auto-recover if start() never reaches onstart (common when kickoff
    // happens outside a user gesture right after session Play).
    const recoverTimers = [400, 1200, 2500].map((ms) =>
      window.setTimeout(() => {
        if (!shouldListenRef.current || isListeningRef.current) return;
        startLiveSpeechRecognition(speechBindings, speechLang);
      }, ms),
    );

    return () => {
      recoverTimers.forEach((id) => window.clearTimeout(id));
      stopLiveSpeechRecognition(speechBindings);
    };
  }, [enabled, speechLang, speechBindings]);

  const sendThought = useCallback(
    async (text: string, thoughtIds: string[] = []) => {
      const clean = normalize(text);
      if (!clean || isSending) return;
      const isResend = thoughtIds.length > 0 && thoughtIds.every((id) => sentThoughtIds.has(id));
      onLogTrace({
        traceType: "system2",
        action: isResend ? "resend" : "send",
        thoughtIds,
        thoughtId: thoughtIds.length === 1 ? thoughtIds[0] : undefined,
        text: clean,
        combined: thoughtIds.length > 1,
      });
      onUserActivityRef.current?.();
      setIsSending(true);
      setSendError("");
      setSentThoughtIds((current) => new Set([...current, ...thoughtIds]));
      setMemoryThoughtIds((current) => {
        const next = new Set(current);
        thoughtIds.forEach((id) => next.delete(id));
        return next;
      });
      try {
        await onSendToProbe(clean, thoughtIds);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Could not reach Helios");
      } finally {
        setIsSending(false);
      }
    },
    [isSending, onLogTrace, onSendToProbe, sentThoughtIds],
  );

  const sendCurrentTranscription = useCallback(async () => {
    const text = normalize(crystallizableText);
    if (!text) return;
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
    await sendThought(text, []);
  }, [crystallizableText, restartSpeechRecognitionSession, sendThought]);

  const beginEditTranscription = useCallback(() => {
    const text = normalize(crystallizableText);
    if (!text) return;
    onUserActivityRef.current?.();
    setEditingTranscription({ draft: text, originalText: text });
  }, [crystallizableText]);

  const cancelEditTranscription = useCallback(() => {
    setEditingTranscription(null);
  }, []);

  const updateEditDraft = useCallback((draft: string) => {
    setEditingTranscription((current) => (current ? { ...current, draft } : null));
  }, []);

  const submitEditedTranscription = useCallback(async () => {
    if (!editingTranscription) return;
    const draft = normalize(editingTranscription.draft);
    if (!draft) return;
    onLogTrace({
      traceType: "system2",
      action: "edit",
      originalText: editingTranscription.originalText,
      text: draft,
    });
    setEditingTranscription(null);
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
    await sendThought(draft, []);
  }, [editingTranscription, onLogTrace, restartSpeechRecognitionSession, sendThought]);

  const retryMicrophone = useCallback(() => {
    // Prefer calling from a click so browsers attach recognition under a gesture.
    setSpeechError(null);
    if (!enabled) return;
    // Hard reset: drop the old instance so a user click can fully re-arm the mic.
    stopLiveSpeechRecognition(speechBindings);
    startLiveSpeechRecognition(speechBindings, speechLang);
  }, [enabled, speechBindings, speechLang]);

  useEffect(() => {
    if (!enabled || !captureKeys) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape" && editingTranscription) {
        event.preventDefault();
        cancelEditTranscription();
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
  }, [
    enabled,
    captureKeys,
    latestThoughts,
    stashCurrentTranscription,
    sendCurrentTranscription,
    sendThought,
    beginEditTranscription,
    cancelEditTranscription,
    editingTranscription,
  ]);

  return {
    thoughts,
    interimText,
    crystallizableText,
    isListening,
    /** Mirrors the hook `enabled` flag — false when session is paused / not started. */
    speechEnabled: enabled,
    speechError,
    isSending,
    sendError,
    stashedThoughts,
    latestThoughts,
    sentThoughtIds,
    memoryThoughtIds,
    speechSupported,
    getFormingText,
    ingestStashedThought,
    stashCurrentTranscription,
    clearCurrentTranscription,
    sendCurrentTranscription,
    sendThought,
    beginEditTranscription,
    cancelEditTranscription,
    updateEditDraft,
    submitEditedTranscription,
    retryMicrophone,
    editingTranscription,
  };
}

export type SessionThoughtInterface = ReturnType<typeof useSessionThoughtInterface>;