"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { emitHeliosVoicePlayback } from "@/lib/useHeliosVoicePlayback";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MarkerRadarChart } from "@/components/MarkerRadarChart";
import { GhcDialogueSplit } from "@/components/ghc/GhcUi";
import { ActiveThoughtSlots } from "@/components/ghc/ActiveThoughtSlots";
import { ThoughtMemoryPanel } from "@/components/ghc/ThoughtMemoryPanel";
import { SlidingTranscript } from "@/components/ghc/SlidingTranscript";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { shouldReportSpeechRecognitionError } from "@/lib/useSessionThoughtInterface";

type Phase = "briefing" | "live" | "scoring" | "done" | "error";

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
};
type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionErrorEventLike = Event & { readonly error?: string };
type SpeechRecognitionLike = EventTarget & {
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
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface Thought {
  id: string;
  text: string;
  timestamp: number;
  chainId: string;
}

type GhlTraceType = "system1" | "system2";
type GhlSystem1Action = "crystallize" | "pause_finalize";
type GhlSystem2Action = "send" | "skip" | "select" | "deselect" | "resend";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
}

const OPENING_MESSAGE_ID = "opening";
const THINK_ALOUD_PROTOCOL_LABEL = "Think Aloud Protocol";

type DialogueSnapshot = {
  messages: ChatMessage[];
};

function getDialogueStorageKey({
  workspaceId,
  sessionId,
  blockId,
  privateToken,
}: {
  workspaceId?: string;
  sessionId?: string;
  blockId?: string;
  privateToken?: string;
}) {
  return [
    "openlesson",
    "tap-dialogue",
    workspaceId || "workspace",
    privateToken || sessionId || blockId || "session",
  ].join(":");
}

function loadDialogueMessages(storageKey: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DialogueSnapshot | ChatMessage[];
    if (Array.isArray(parsed)) return parsed;
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

function saveDialogueMessages(storageKey: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const snapshot: DialogueSnapshot = { messages };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // ignore quota / privacy errors
  }
}

function clearDialogueMessages(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

interface MarkerScore {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

interface GhcScoreClientProps {
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  privateToken?: string;
  initialSession?: any;
}

const CHAIN_GAP_MS = 2600;

const DURATIONS = [15, 30];

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function formatCountdown(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

type GhcButtonSize = "sm" | "md" | "lg";
type GhcButtonVariant = "ghost" | "primary" | "toggleOn" | "toggleOff";

function ghcButtonClasses({
  size = "md",
  variant = "ghost",
  className = "",
}: {
  size?: GhcButtonSize;
  variant?: GhcButtonVariant;
  className?: string;
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" && "h-8 px-2.5 text-xs",
    size === "md" && "h-9 px-3.5 text-xs",
    size === "lg" && "h-11 px-4 text-sm",
    variant === "ghost" && "border border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600 hover:text-white",
    variant === "primary" && "border border-transparent bg-white text-black hover:bg-neutral-200",
    variant === "toggleOn" && "border border-white bg-white text-black",
    variant === "toggleOff" && "border border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300",
    className,
  );
}

function GhcButton({
  size = "md",
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: GhcButtonSize;
  variant?: GhcButtonVariant;
}) {
  return <button className={ghcButtonClasses({ size, variant, className })} {...props} />;
}

function GhcKeyHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center justify-center rounded border border-neutral-600 bg-black/55 px-1.5 font-mono text-[10px] font-medium leading-none text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {children}
    </span>
  );
}

function GhcShortcutChord({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((key, index) => (
        <GhcKeyHint key={`${key}-${index}`}>{key}</GhcKeyHint>
      ))}
    </span>
  );
}

function GhcButtonLabel({
  shortcut,
  children,
}: {
  shortcut?: ReactNode | string[];
  children: ReactNode;
}) {
  const shortcutNode =
    shortcut == null ? null : Array.isArray(shortcut) ? (
      <GhcShortcutChord keys={shortcut} />
    ) : typeof shortcut === "string" ? (
      <GhcKeyHint>{shortcut}</GhcKeyHint>
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

const TAP_SHORTCUT_ROWS: { keys: string[]; label: string; altKeys?: string[][] }[] = [
  { keys: ["C"], label: "Crystallize the live transcript into a thought" },
  { keys: ["Esc"], label: "Skip the current thought" },
  { keys: ["1", "2", "3"], label: "Send thought 1, 2, or 3" },
  {
    keys: ["⇧", "1"],
    altKeys: [["⇧", "2"], ["⇧", "3"]],
    label: "Select thoughts for a combined send",
  },
  { keys: ["S"], label: "Send all selected thoughts" },
  { keys: ["V"], label: "Toggle Helios voice playback" },
];

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
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-8 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">{workspaceTitle}</p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-neutral-100 sm:text-3xl">
          {THINK_ALOUD_PROTOCOL_LABEL}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          Browser transcription turns speech into thought traces. Use keyboard shortcuts to stay in flow without reaching
          for the mouse.
        </p>
      </div>

      {showDurationPicker ? (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">Session length</p>
          <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
            {DURATIONS.map((duration) => (
              <GhcButton
                key={duration}
                size="lg"
                variant={minutes === duration ? "toggleOn" : "toggleOff"}
                className="w-full"
                disabled={disabled}
                onClick={() => onMinutesChange(duration)}
              >
                {duration} minutes
              </GhcButton>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">Keyboard shortcuts</p>
        <ul className="mt-3 space-y-2.5 text-sm text-neutral-400">
          {TAP_SHORTCUT_ROWS.map((row) => (
            <li key={row.label} className="flex flex-wrap items-center gap-2">
              <GhcShortcutChord keys={row.keys} />
              {row.altKeys?.map((altKeys, index) => (
                <span key={`${row.label}-alt-${index}`} className="inline-flex items-center gap-2">
                  <span className="text-neutral-600">/</span>
                  <GhcShortcutChord keys={altKeys} />
                </span>
              ))}
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}



function getInitialPhase(initialSession?: GhcScoreClientProps["initialSession"]): Phase {
  if (initialSession?.status === "completed") return "done";
  return "briefing";
}

export function GhcScoreClient({ workspaceId, blockId, sessionId, privateToken, initialSession }: GhcScoreClientProps) {
  const [phase, setPhase] = useState<Phase>(() => getInitialPhase(initialSession));
  const [minutes, setMinutes] = useState(DURATIONS.includes(Number(initialSession?.requested_duration_seconds || 900) / 60) ? Number(initialSession?.requested_duration_seconds || 900) / 60 : 15);
  const [workspaceTitle] = useState(initialSession?.workspaceTitle || "Workspace");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [interimText, setInterimText] = useState("");
  const [crystallizableText, setCrystallizableText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedActiveThoughtIds, setSelectedActiveThoughtIds] = useState<Set<string>>(new Set());
  const [memoryThoughtIds, setMemoryThoughtIds] = useState<Set<string>>(new Set());
  const [sentThoughtIds, setSentThoughtIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<any>(initialSession?.analysis || null);
  const [error, setError] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [bgImage, setBgImage] = useState("");
  const [userInitial, setUserInitial] = useState("Y");
  const [ghlSessionId, setGhlSessionId] = useState<string | null>(initialSession?.id ?? null);
  const ghlSessionIdRef = useRef<string | null>(initialSession?.id ?? null);
  const isEndingRef = useRef(false);
  const endAndScoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    ghlSessionIdRef.current = ghlSessionId;
  }, [ghlSessionId]);

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  const logGhlTrace = useCallback(
    (input: {
      traceType: GhlTraceType;
      action: GhlSystem1Action | GhlSystem2Action;
      thoughtId?: string;
      thoughtIds?: string[];
      chainId?: string;
      text?: string;
      combined?: boolean;
      timestampMs?: number;
    }) => {
      const activeGhlSessionId = ghlSessionIdRef.current;
      if (!activeGhlSessionId) return;
      void fetch("/api/workspace-tap-score/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          sessionId,
          privateToken,
          ghlSessionId: activeGhlSessionId,
          ...input,
        }),
      }).catch(() => {});
    },
    [workspaceId, blockId, sessionId, privateToken],
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

  useEffect(() => {
    const stored = loadDialogueMessages(dialogueStorageKey);
    if (stored.length === 0) return;
    setMessages(stored);
    setPhase((current) => (current === "briefing" ? "live" : current));
  }, [dialogueStorageKey]);

  useEffect(() => {
    if (phase !== "live" || messages.length > 0 || !ghlSessionId || isStartingSession) return;

    let cancelled = false;
    void (async () => {
      setIsStartingSession(true);
      setError("");
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
            ghlSessionId: ghlSessionIdRef.current,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not resume TAP session");
        const openingQuestion = String(payload.openingQuestion || "").trim();
        if (!openingQuestion) throw new Error("Could not generate opening question");
        if (cancelled) return;
        setMessages([
          {
            id: OPENING_MESSAGE_ID,
            role: "assistant",
            content: openingQuestion,
            at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not resume TAP session");
        }
      } finally {
        if (!cancelled) setIsStartingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, messages.length, ghlSessionId, isStartingSession, workspaceId, blockId, sessionId, privateToken, minutes]);

  useEffect(() => {
    if (messages.length === 0) return;
    saveDialogueMessages(dialogueStorageKey, messages);
  }, [messages, dialogueStorageKey]);

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

  const recognitionCtor = useMemo(getSpeechRecognitionConstructor, []);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechResultsLengthRef = useRef(0);
  const consumedResultsIndexRef = useRef(0);
  const activeThoughts = useMemo(
    () => thoughts.filter((thought) => !memoryThoughtIds.has(thought.id) && !sentThoughtIds.has(thought.id)),
    [thoughts, memoryThoughtIds, sentThoughtIds],
  );
  const latestThoughts = useMemo(() => activeThoughts.slice(-3).reverse(), [activeThoughts]);
  const sourceIdRef = useRef(`tap-score-${Math.random().toString(36).slice(2, 10)}`);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const thoughtHistory = useMemo(() => thoughts.slice().reverse(), [thoughts]);
  const selectedActiveThoughts = useMemo(
    () => latestThoughts.slice().reverse().filter((thought) => selectedActiveThoughtIds.has(thought.id)),
    [latestThoughts, selectedActiveThoughtIds]
  );

  useEffect(() => {
    setSelectedActiveThoughtIds((current) => {
      const activeIds = new Set(latestThoughts.map((thought) => thought.id));
      const next = new Set([...current].filter((id) => activeIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [latestThoughts]);

  function stopVoice() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    emitHeliosVoicePlayback(sourceIdRef.current, false);
  }

  async function speak(text: string) {
    if (!voiceEnabled) return;
    stopVoice();
    const response = await fetch("/api/xai-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "auto" }),
    }).catch(() => null);
    if (!response?.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("playing", () => emitHeliosVoicePlayback(sourceIdRef.current, true));
    audio.addEventListener("ended", () => emitHeliosVoicePlayback(sourceIdRef.current, false));
    audio.addEventListener("pause", () => emitHeliosVoicePlayback(sourceIdRef.current, false));
    await audio.play().catch(() => {});
  }

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

  function addThought(text: string, system1Action: GhlSystem1Action = "pause_finalize") {
    setThoughts((current) => {
      const thought = buildThoughtRecord(text, current);
      if (!thought) return current;
      logGhlTrace({
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

  function flushFinalBuffer() {
    const text = normalize(finalBufferRef.current.join(" "));
    finalBufferRef.current = [];
    setCrystallizableText("");
    markSpeechConsumed();
    if (text) addThought(text);
  }

  const crystallizeCurrentTranscription = useCallback(() => {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    const text = normalize(`${finalBufferRef.current.join(" ")} ${interimText}`.trim());
    finalBufferRef.current = [];
    setInterimText("");
    setCrystallizableText("");
    markSpeechConsumed();
    if (text) addThought(text, "crystallize");
  }, [interimText]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopVoice();
  }, []);

  useEffect(() => {
    if (phase !== "live" || !recognitionCtor) return;
    shouldListenRef.current = true;
    const recognition = new recognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      speechResultsLengthRef.current = event.results.length;
      const startIndex = speechResultStartIndex(event);
      let interim = "";
      for (let i = startIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = normalize(result[0]?.transcript || "");
        if (!transcript) continue;
        if (result.isFinal) finalBufferRef.current.push(transcript);
        else interim = normalize(`${interim} ${transcript}`);
      }
      setInterimText(interim);
      setCrystallizableText(normalize(`${finalBufferRef.current.join(" ")} ${interim}`.trim()));
      if (finalBufferRef.current.length > 0) {
        if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = setTimeout(() => {
          finalizeTimerRef.current = null;
          setInterimText("");
          flushFinalBuffer();
        }, 850);
      }
    };
    recognition.onerror = (event) => {
      const error = event.error || "speech-recognition-error";
      if (shouldReportSpeechRecognitionError(error)) {
        setSpeechError(error);
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      if (shouldListenRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {}
      }
    };
    recognitionRef.current = recognition;
    setSpeechError(null);
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setSpeechError(String(err));
    }
    return () => {
      shouldListenRef.current = false;
      recognition.abort();
      setIsListening(false);
    };
  }, [phase, recognitionCtor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase !== "live" || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        skipCurrentThought();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        crystallizeCurrentTranscription();
        return;
      }
      if (["1", "2", "3"].includes(event.key)) {
        const thought = latestThoughts[Number(event.key) - 1];
        if (!thought) return;
        event.preventDefault();
        if (event.shiftKey) toggleActiveThought(thought.id);
        else void sendThought(thought.text, [thought.id]);
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        if (selectedActiveThoughts.length === 0) return;
        event.preventDefault();
        void sendThought(selectedActiveThoughts.map((thought) => thought.text).join("\n"), selectedActiveThoughts.map((thought) => thought.id));
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setVoiceEnabled((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, latestThoughts, thoughts, voiceEnabled, selectedActiveThoughts, crystallizeCurrentTranscription]);

  async function sendThought(text: string, thoughtIds: string[] = []) {
    const clean = normalize(text);
    if (!clean || isSending) return;
    const isResend = thoughtIds.length > 0 && thoughtIds.every((id) => sentThoughtIds.has(id));
    logGhlTrace({
      traceType: "system2",
      action: isResend ? "resend" : "send",
      thoughtIds,
      thoughtId: thoughtIds.length === 1 ? thoughtIds[0] : undefined,
      text: clean,
      combined: thoughtIds.length > 1,
    });
    setIsSending(true);
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
    setSelectedActiveThoughtIds((current) => {
      const next = new Set(current);
      thoughtIds.forEach((id) => next.delete(id));
      return next;
    });

    try {
      const response = await fetch("/api/workspace-tap-score/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, blockId, sessionId, privateToken, minutes, thought: clean, messages: nextMessages }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not get TAP response");
      const assistant: ChatMessage = { id: `a_${Date.now()}`, role: "assistant", content: payload.message, at: new Date().toISOString() };
      setMessages((current) => [...current, assistant]);
      void speak(payload.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get TAP response");
    } finally {
      setIsSending(false);
    }
  }

  async function startSession() {
    isEndingRef.current = false;
    setIsStartingSession(true);
    setError("");
    speechResultsLengthRef.current = 0;
    consumedResultsIndexRef.current = 0;
    finalBufferRef.current = [];
    setThoughts([]);
    setMemoryThoughtIds(new Set());
    setSentThoughtIds(new Set());
    setSelectedActiveThoughtIds(new Set());
    clearDialogueMessages(dialogueStorageKey);

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
          ghlSessionId: ghlSessionIdRef.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start TAP session");
      if (payload.ghlSessionId) {
        ghlSessionIdRef.current = payload.ghlSessionId;
        setGhlSessionId(payload.ghlSessionId);
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
      setPhase("live");
      void speak(openingQuestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start TAP session");
    } finally {
      setIsStartingSession(false);
    }
  }

  async function endAndScore() {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    flushFinalBuffer();
    setPhase("scoring");
    shouldListenRef.current = false;
    recognitionRef.current?.abort();
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
          ghlSessionId: ghlSessionIdRef.current,
          transcript,
          durationSeconds,
          requestedDurationSeconds: minutes * 60,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate TAP score");
      setScore(payload.ghlSession?.analysis || null);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate TAP score");
      setPhase("error");
    }
  }

  endAndScoreRef.current = endAndScore;

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

  const markers = Array.isArray(score?.markers) ? score.markers : [];
  const gapAnalysis = score?.gap_analysis || (Array.isArray(score?.knowledge_gaps) ? { summary: "Learning gaps identified from the demonstration.", gaps: score.knowledge_gaps, next_practice: score.follow_up_prompts || [] } : null);
  const resolvedWorkspaceId = workspaceId || initialSession?.workspace_id;

  function toggleActiveThought(thoughtId: string) {
    const thought = thoughts.find((entry) => entry.id === thoughtId);
    setSelectedActiveThoughtIds((current) => {
      const next = new Set(current);
      const selecting = !next.has(thoughtId);
      if (selecting) next.add(thoughtId);
      else next.delete(thoughtId);
      if (thought) {
        logGhlTrace({
          traceType: "system2",
          action: selecting ? "select" : "deselect",
          thoughtId: thought.id,
          chainId: thought.chainId,
          text: thought.text,
          timestampMs: thought.timestamp,
        });
      }
      return next;
    });
  }

  function skipCurrentThought() {
    flushFinalBuffer();
    const currentThought = activeThoughts[activeThoughts.length - 1];
    if (!currentThought) return;
    logGhlTrace({
      traceType: "system2",
      action: "skip",
      thoughtId: currentThought.id,
      chainId: currentThought.chainId,
      text: currentThought.text,
      timestampMs: currentThought.timestamp,
    });
    setMemoryThoughtIds((current) => new Set(current).add(currentThought.id));
    setSelectedActiveThoughtIds((current) => {
      const next = new Set(current);
      next.delete(currentThought.id);
      return next;
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      {bgImage && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/82" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.18),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.55),transparent_32%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6">
        {phase === "briefing" && (
          <section className="relative flex min-h-[calc(100vh-2.5rem)] flex-1 py-4">
            <div className="grid min-h-0 w-full flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
                <SessionOnboardingGuide
                  variant="tap"
                  showStartAction
                  onStart={() => void startSession()}
                  isStarting={isStartingSession}
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
          <section className="grid min-w-0 flex-1 gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-h-0 min-w-0 flex-col gap-4">
              <div className="flex min-h-[48vh] flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
                <GhcDialogueSplit
                  layout="ghl"
                  lastUserTurn={lastUserTurn}
                  lastAssistantTurn={lastAssistantTurn}
                  promptText=""
                  isSending={isSending || (isStartingSession && !lastAssistantTurn)}
                  error={error}
                  userInitial={userInitial}
                />
              </div>

              <div className="min-w-0 overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <GhcButton
                      size="sm"
                      variant={voiceEnabled ? "toggleOn" : "toggleOff"}
                      onClick={() => setVoiceEnabled((value) => !value)}
                    >
                      <GhcButtonLabel shortcut="V">voice</GhcButtonLabel>
                    </GhcButton>
                    <GhcButton size="sm" variant="primary" onClick={endAndScore}>
                      End & Score
                    </GhcButton>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2 overflow-hidden">
                  <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300">
                    <SlidingTranscript text={interimText} className="w-full" />
                  </div>
                  <GhcButton size="sm" disabled={!crystallizableText} onClick={crystallizeCurrentTranscription}>
                    <GhcButtonLabel shortcut="C">crystallize</GhcButtonLabel>
                  </GhcButton>
                  <GhcButton
                    size="sm"
                    disabled={selectedActiveThoughts.length < 2}
                    onClick={() =>
                      void sendThought(
                        selectedActiveThoughts.map((thought) => thought.text).join("\n"),
                        selectedActiveThoughts.map((thought) => thought.id),
                      )
                    }
                  >
                    <GhcButtonLabel shortcut="S">send ({selectedActiveThoughts.length})</GhcButtonLabel>
                  </GhcButton>
                  <GhcButton size="sm" disabled={activeThoughts.length === 0} onClick={skipCurrentThought}>
                    <GhcButtonLabel shortcut="Esc">skip</GhcButtonLabel>
                  </GhcButton>
                </div>

                <div className="mt-3 border-t border-neutral-900/80 pt-3">
                  <p className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-600">Active thoughts</p>
                  <ActiveThoughtSlots
                    thoughts={latestThoughts}
                    selectedThoughtIds={selectedActiveThoughtIds}
                    onToggleSelect={toggleActiveThought}
                    onSendThought={(text, thoughtId) => void sendThought(text, [thoughtId])}
                  />
                </div>
              </div>
            </div>
            <ThoughtMemoryPanel
              className="min-h-0 w-80 shrink-0 rounded-2xl border border-neutral-900 bg-neutral-950/65 p-4 backdrop-blur-sm"
              listClassName="max-h-[72vh] overflow-y-auto pr-1"
              thoughts={thoughtHistory}
              sentThoughtIds={sentThoughtIds}
              skippedThoughtIds={memoryThoughtIds}
              workspaceId={workspaceId}
              blockId={blockId}
              sessionId={sessionId}
              onSendThought={sendThought}
            />
          </section>
        )}

        {phase === "scoring" && <section className="flex flex-1 items-center justify-center text-neutral-400">Generating your TAP score...</section>}
        {phase === "done" && score && (
          <section className="flex-1 py-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[2px] text-neutral-500">TAP Score Result</p>
                <div className="mt-2 flex flex-wrap items-end gap-6">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">Learning</div>
                    <h1 className="text-4xl font-medium tracking-[-1.5px] sm:text-5xl">
                      {score.overall_score ?? "--"}
                      <span className="text-2xl text-neutral-500">/100</span>
                    </h1>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-600">Conversion</div>
                    <h1 className="text-4xl font-medium tracking-[-1.5px] sm:text-5xl">
                      {score.conversion_score ?? "--"}
                      <span className="text-2xl text-neutral-500">%</span>
                    </h1>
                  </div>
                </div>
                {score.conversion_goal ? (
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">{score.conversion_goal}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {resolvedWorkspaceId && (
                  <Link href={`/workspace/${resolvedWorkspaceId}`} className={ghcButtonClasses({ size: "md", variant: "ghost" })}>
                    Back to workspace
                  </Link>
                )}
                {!privateToken && (
                  <Link href="/dashboard" className={ghcButtonClasses({ size: "md", variant: "primary" })}>
                    Dashboard
                  </Link>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-900 bg-neutral-950/45 px-4 py-6 sm:px-8">
              <p className="text-center font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Marker profile</p>
              <MarkerRadarChart markers={markers} ariaLabel="TAP marker scores" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                {score.overall_reflection && (
                  <div className="rounded-2xl border border-neutral-900 bg-neutral-950/45 p-5">
                    <h2 className="text-sm font-medium text-white">Overall reflection</h2>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">{score.overall_reflection}</p>
                  </div>
                )}
                {gapAnalysis && (
                  <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-5">
                    <h2 className="text-sm font-medium text-white">Gap analysis</h2>
                    {gapAnalysis.summary && (
                      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{gapAnalysis.summary}</p>
                    )}
                    <div className="mt-4 space-y-3">
                      {Array.isArray(gapAnalysis.gaps) &&
                        gapAnalysis.gaps.map((gap: any, index: number) => (
                          <div key={index} className="rounded-xl border border-neutral-800 bg-black p-3">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-medium text-neutral-200">{gap.title}</h3>
                              <span className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                                {gap.severity}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-neutral-500">{gap.proof_of_work}</p>
                            <p className="mt-2 text-xs leading-relaxed text-neutral-300">Repair: {gap.suggested_repair}</p>
                          </div>
                        ))}
                    </div>
                    {Array.isArray(gapAnalysis.next_practice) && gapAnalysis.next_practice.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-neutral-500">Next practice</h3>
                        <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                          {gapAnalysis.next_practice.map((item: string, index: number) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Marker breakdown</h2>
                {markers.map((marker: MarkerScore) => (
                  <div key={marker.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-neutral-200">{marker.label}</h3>
                      <span className="font-mono text-lg text-white">{marker.score}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-500">{marker.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-medium">TAP scoring failed</h1>
            <p className="mt-3 max-w-md text-sm text-red-300">{error}</p>
            <GhcButton size="md" variant="primary" className="mt-6" onClick={() => setPhase("briefing")}>
              Try again
            </GhcButton>
          </section>
        )}
      </div>
    </main>
  );
}
