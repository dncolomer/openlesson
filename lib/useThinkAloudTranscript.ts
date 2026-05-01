"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface ThinkAloudThought {
  id: string;
  text: string;
  timestamp: number;
}

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  readonly error?: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const SPEECH_LANGUAGE_BY_TUTOR_LANGUAGE: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  pl: "pl-PL",
  vi: "vi-VN",
  zh: "zh-CN",
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

const MAX_THOUGHTS = 3;

export function useThinkAloudTranscript({
  enabled,
  tutoringLanguage,
}: {
  enabled: boolean;
  tutoringLanguage?: string;
}) {
  const recognitionCtor = useMemo(getSpeechRecognitionConstructor, []);
  const isSupported = !!recognitionCtor;
  const speechLang = SPEECH_LANGUAGE_BY_TUTOR_LANGUAGE[tutoringLanguage || ""] ?? "en-US";

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [interimText, setInterimText] = useState("");
  const [thoughts, setThoughts] = useState<ThinkAloudThought[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flushFinalBuffer = () => {
    const text = normalizeTranscript(finalBufferRef.current.join(" "));
    finalBufferRef.current = [];
    if (!text) return;
    setThoughts((prev) => [
      ...prev.slice(-(MAX_THOUGHTS - 1)),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        timestamp: Date.now(),
      },
    ]);
  };

  useEffect(() => {
    shouldListenRef.current = enabled;
    if (!recognitionCtor || !enabled) {
      setInterimText("");
      setIsListening(false);
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      flushFinalBuffer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      return;
    }

    const recognition = new recognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = normalizeTranscript(result[0]?.transcript ?? "");
        if (!transcript) continue;
        if (result.isFinal) {
          finalBufferRef.current.push(transcript);
        } else {
          interim = normalizeTranscript(`${interim} ${transcript}`);
        }
      }

      setInterimText(interim);

      if (finalBufferRef.current.length > 0) {
        if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = setTimeout(() => {
          finalizeTimerRef.current = null;
          setInterimText("");
          flushFinalBuffer();
        }, 1000);
      }
    };

    recognition.onerror = (event) => {
      const nextError = event.error || "speech-recognition-error";
      setError(nextError);
      if (nextError === "not-allowed" || nextError === "service-not-allowed" || nextError === "language-not-supported") {
        shouldListenRef.current = false;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (shouldListenRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // Browsers throw if start is called while the recognizer is still settling.
        }
      }
    };

    recognitionRef.current = recognition;
    setError(null);

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setError(String(err));
    }

    return () => {
      shouldListenRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      setIsListening(false);
    };
    // `speechLang` intentionally recreates the recognizer when the tutoring
    // language changes so Web Speech listens in the same language as Helios.
  }, [enabled, recognitionCtor, speechLang]);

  return {
    isSupported,
    isListening: isSupported && enabled && isListening,
    interimText,
    thoughts,
    clearThoughts: () => setThoughts([]),
    error,
  };
}
