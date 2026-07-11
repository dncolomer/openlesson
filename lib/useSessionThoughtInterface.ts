"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

export interface SessionThought {
  id: string;
  text: string;
  timestamp: number;
  chainId: string;
}

export type SessionTraceType = "system1" | "system2";
export type SessionSystem1Action = "crystallize" | "pause_finalize";
export type SessionSystem2Action = "send" | "skip" | "select" | "deselect" | "resend" | "edit";

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

const CHAIN_GAP_MS = 2600;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

const BENIGN_SPEECH_RECOGNITION_ERRORS = new Set(["aborted"]);

export function shouldReportSpeechRecognitionError(error?: string) {
  return !!error && !BENIGN_SPEECH_RECOGNITION_ERRORS.has(error);
}

export function isFatalSpeechRecognitionError(error?: string) {
  return error === "not-allowed" || error === "service-not-allowed" || error === "language-not-supported";
}

/** Prime browser mic permission during a user gesture before SpeechRecognition starts. */
export async function requestMicrophoneForSpeech(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function formatSpeechTranscriptDisplay({
  text,
  speechError,
  speechApiReady,
  recognitionAvailable,
  isListening,
}: {
  text: string;
  speechError: string | null;
  speechApiReady: boolean;
  recognitionAvailable: boolean;
  isListening: boolean;
}) {
  if (text) return text;
  if (speechApiReady && !recognitionAvailable) {
    return "Speech recognition is not supported in this browser.";
  }
  if (speechError === "not-allowed") {
    return "Microphone blocked — allow access for this site, then click Retry.";
  }
  if (speechError && speechError !== "unsupported") {
    return `Microphone error: ${speechError}`;
  }
  if (!speechApiReady || !recognitionAvailable) return "Starting microphone…";
  if (!isListening) return "Waiting for microphone…";
  return "";
}

/** Resolve SpeechRecognition on the client — useMemo(…) caches null from SSR and never recovers. */
export function useClientSpeechRecognitionConstructor() {
  const recognitionCtorRef = useRef<SpeechRecognitionConstructor | null>(null);
  const [speechApiReady, setSpeechApiReady] = useState(false);

  useEffect(() => {
    recognitionCtorRef.current = getSpeechRecognitionConstructor();
    setSpeechApiReady(true);
  }, []);

  // Keep the ctor in a ref — React 19 treats functions passed to setState as updaters
  // and would invoke SpeechRecognition() without `new`.
  return {
    recognitionCtor: speechApiReady ? recognitionCtorRef.current : null,
    speechApiReady,
  };
}

export function disposeSpeechRecognition(
  recognition: SpeechRecognitionLike,
  recognitionRef: MutableRefObject<SpeechRecognitionLike | null>,
) {
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.abort();
  } catch {}
  if (recognitionRef.current === recognition) {
    recognitionRef.current = null;
  }
}

export function tryStartSpeechRecognition(
  recognition: SpeechRecognitionLike,
  recognitionRef: MutableRefObject<SpeechRecognitionLike | null>,
  shouldListenRef: MutableRefObject<boolean>,
  onListening: (listening: boolean) => void,
  onError: (error: string | null) => void,
  delayMs = 0,
) {
  const run = () => {
    if (recognitionRef.current !== recognition || !shouldListenRef.current) return;
    try {
      recognition.start();
      onListening(true);
      onError(null);
    } catch (err) {
      const message = String(err);
      onError(message);
      onListening(false);
      if (isFatalSpeechRecognitionError(message)) {
        shouldListenRef.current = false;
      }
    }
  };

  if (delayMs > 0) {
    window.setTimeout(run, delayMs);
  } else {
    run();
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
    const stored = window.localStorage.getItem(`openlesson:${sessionId}:thought-history`);
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
}

export function useSessionThoughtInterface({
  enabled,
  speechLang = "en-US",
  sessionId,
  onLogTrace,
  onSendToProbe,
}: UseSessionThoughtInterfaceOptions) {
  const [thoughts, setThoughts] = useState<SessionThought[]>([]);
  const [interimText, setInterimText] = useState("");
  const [crystallizableText, setCrystallizableText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [memoryThoughtIds, setMemoryThoughtIds] = useState<Set<string>>(new Set());
  const [sentThoughtIds, setSentThoughtIds] = useState<Set<string>>(new Set());
  const [editingTranscription, setEditingTranscription] = useState<{ draft: string; originalText: string } | null>(null);
  const [speechSessionEpoch, setSpeechSessionEpoch] = useState(0);

  const { recognitionCtor, speechApiReady } = useClientSpeechRecognitionConstructor();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechResultsLengthRef = useRef(0);
  const consumedResultsIndexRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;
    setThoughts(loadStoredThoughts(sessionId));
    setMemoryThoughtIds(new Set());
    setSentThoughtIds(new Set());
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    window.localStorage.setItem(
      `openlesson:${sessionId}:thought-history`,
      JSON.stringify(thoughts.slice(-THOUGHT_HISTORY_LIMIT)),
    );
  }, [sessionId, thoughts]);

  const activeThoughts = useMemo(
    () => thoughts.filter((thought) => !memoryThoughtIds.has(thought.id) && !sentThoughtIds.has(thought.id)),
    [thoughts, memoryThoughtIds, sentThoughtIds],
  );
  const latestThoughts = useMemo(() => activeThoughts.slice(-3).reverse(), [activeThoughts]);

  function buildThoughtRecord(text: string, currentThoughts: SessionThought[]): SessionThought | null {
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

  function addThought(text: string, system1Action: SessionSystem1Action = "pause_finalize") {
    setThoughts((current) => {
      const thought = buildThoughtRecord(text, current);
      if (!thought) return current;
      onLogTrace({
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

  function clearTranscriptionDisplay() {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    finalBufferRef.current = [];
    setInterimText("");
    setCrystallizableText("");
  }

  const restartSpeechRecognitionSession = useCallback(() => {
    consumedResultsIndexRef.current = 0;
    speechResultsLengthRef.current = 0;
    if (!shouldListenRef.current) return;
    setSpeechSessionEpoch((epoch) => epoch + 1);
  }, []);

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
    setCrystallizableText("");
    markSpeechConsumed();
    if (text) addThought(text);
  }

  const crystallizeCurrentTranscription = useCallback(() => {
    const text = normalize(crystallizableText);
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
    if (text) addThought(text, "crystallize");
  }, [crystallizableText, restartSpeechRecognitionSession]);

  useEffect(() => {
    if (!speechApiReady || !enabled || !recognitionCtor) {
      if (speechApiReady && enabled && !recognitionCtor) {
        setSpeechError("unsupported");
      }
      return;
    }

    shouldListenRef.current = true;
    const recognition = new recognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;
    recognition.onresult = (event) => {
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
      setInterimText(interim);
      setCrystallizableText(normalize(`${finals.join(" ")} ${interim}`.trim()));
    };
    recognition.onerror = (event) => {
      const error = event.error || "speech-recognition-error";
      if (isFatalSpeechRecognitionError(error)) {
        shouldListenRef.current = false;
      }
      if (shouldReportSpeechRecognitionError(error)) {
        setSpeechError(error);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      setIsListening(false);
      if (shouldListenRef.current) {
        tryStartSpeechRecognition(
          recognition,
          recognitionRef,
          shouldListenRef,
          setIsListening,
          setSpeechError,
          50,
        );
      }
    };
    recognitionRef.current = recognition;
    setSpeechError(null);
    tryStartSpeechRecognition(
      recognition,
      recognitionRef,
      shouldListenRef,
      setIsListening,
      setSpeechError,
      speechSessionEpoch > 0 ? 80 : 0,
    );

    return () => {
      shouldListenRef.current = false;
      disposeSpeechRecognition(recognition, recognitionRef);
      setIsListening(false);
    };
  }, [enabled, recognitionCtor, speechApiReady, speechLang, speechSessionEpoch]);

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

  const beginEditTranscription = useCallback(() => {
    const text = normalize(crystallizableText);
    if (!text) return;
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

  const clearTranscription = useCallback(() => {
    setEditingTranscription(null);
    clearTranscriptionDisplay();
    restartSpeechRecognitionSession();
  }, [restartSpeechRecognitionSession]);

  const retryMicrophone = useCallback(async () => {
    const granted = await requestMicrophoneForSpeech();
    if (!granted) {
      setSpeechError("not-allowed");
      return;
    }
    setSpeechError(null);
    if (!enabled) return;
    shouldListenRef.current = true;
    restartSpeechRecognitionSession();
  }, [enabled, restartSpeechRecognitionSession]);

  const clearActiveThoughts = useCallback(() => {
    setEditingTranscription(null);
    if (activeThoughts.length > 0) {
      activeThoughts.forEach((thought) => {
        onLogTrace({
          traceType: "system2",
          action: "skip",
          thoughtId: thought.id,
          chainId: thought.chainId,
          text: thought.text,
          timestampMs: thought.timestamp,
        });
      });
      setMemoryThoughtIds((current) => new Set([...current, ...activeThoughts.map((thought) => thought.id)]));
    }
    clearTranscriptionBuffers();
  }, [activeThoughts, onLogTrace]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (editingTranscription) {
          cancelEditTranscription();
          return;
        }
        clearActiveThoughts();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        crystallizeCurrentTranscription();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        beginEditTranscription();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        clearTranscription();
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
    latestThoughts,
    crystallizeCurrentTranscription,
    sendThought,
    beginEditTranscription,
    cancelEditTranscription,
    clearActiveThoughts,
    clearTranscription,
    editingTranscription,
  ]);

  return {
    thoughts,
    interimText,
    crystallizableText,
    isListening,
    speechError,
    isSending,
    sendError,
    activeThoughts,
    latestThoughts,
    sentThoughtIds,
    memoryThoughtIds,
    recognitionCtor,
    speechApiReady,
    crystallizeCurrentTranscription,
    sendThought,
    beginEditTranscription,
    cancelEditTranscription,
    updateEditDraft,
    submitEditedTranscription,
    clearActiveThoughts,
    clearTranscription,
    retryMicrophone,
    editingTranscription,
  };
}

export type SessionThoughtInterface = ReturnType<typeof useSessionThoughtInterface>;