"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { emitHeliosVoicePlayback } from "@/lib/useHeliosVoicePlayback";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Phase = "setup" | "live" | "scoring" | "done" | "error";

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

const WELCOME_MESSAGE_ID = "welcome";

type DialogueSnapshot = {
  messages: ChatMessage[];
};

function getDialogueStorageKey({
  planId,
  sessionId,
  planNodeId,
  privateToken,
}: {
  planId?: string;
  sessionId?: string;
  planNodeId?: string;
  privateToken?: string;
}) {
  return [
    "openlesson",
    "ghl-dialogue",
    planId || "workspace",
    privateToken || sessionId || planNodeId || "session",
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
  planId?: string;
  planNodeId?: string;
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

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
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

function HeliosProbeAvatar() {
  return (
    <div className="relative shrink-0">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-neutral-800 bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900">
        <span className="font-serif text-3xl text-neutral-200">H</span>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.08)]" />
    </div>
  );
}

function LearnerThoughtAvatar({ initial }: { initial: string }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-cyan-500/25 bg-gradient-to-br from-cyan-500/20 via-neutral-800 to-neutral-900">
        <span className="font-serif text-3xl text-neutral-100">{initial}</span>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.12)]" />
    </div>
  );
}

function GhcDialogueSplit({
  lastUserTurn,
  lastAssistantTurn,
  promptText,
  isSending,
  error,
  userInitial,
}: {
  lastUserTurn: ChatMessage | null;
  lastAssistantTurn: ChatMessage | null;
  promptText: string;
  isSending: boolean;
  error: string;
  userInitial: string;
}) {
  const userLines = lastUserTurn ? lastUserTurn.content.split("\n").map((line) => line.trim()).filter(Boolean) : [];

  const dialogueTextClass = "text-base leading-relaxed md:text-lg md:leading-relaxed";

  return (
    <div className="flex min-h-0 flex-1 divide-x divide-neutral-900">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="shrink-0 px-6 pt-5 text-center font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">
          Your thought
        </p>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-6">
          <div className="my-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
            <LearnerThoughtAvatar initial={userInitial} />
            {userLines.length > 0 ? (
              <div className="space-y-4">
                {userLines.map((line, index) => (
                  <p key={`${lastUserTurn?.id}-${index}`} className={`${dialogueTextClass} text-neutral-100`}>
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className={`${dialogueTextClass} text-neutral-600`}>
                Send a thought to surface your latest submission here.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="shrink-0 px-6 pt-5 text-center font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">
          GHL probe
        </p>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-6">
          <div className="my-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
            <HeliosProbeAvatar />
            {isSending ? (
              <div className="flex justify-center gap-1.5 py-1">
                <div className="size-2.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="size-2.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="size-2.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : lastAssistantTurn ? (
              <p className={`${dialogueTextClass} text-neutral-200`}>{lastAssistantTurn.content}</p>
            ) : (
              <p className={`${dialogueTextClass} text-neutral-500`}>{promptText}</p>
            )}
          </div>
        </div>
        {error && <p className="shrink-0 px-6 pb-4 text-center text-xs text-red-300">{error}</p>}
      </section>
    </div>
  );
}

function RadarChart({ markers }: { markers: MarkerScore[] }) {
  if (!markers.length) return null;
  const size = 360;
  const center = size / 2;
  const radius = 100;
  const points = markers.map((marker, index) => {
    const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
    const score = Math.max(0, Math.min(100, Number(marker.score) || 0));
    const value = score / 100;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center + cos * radius * value,
      y: center + sin * radius * value,
      labelX: center + cos * (radius + 42),
      labelY: center + sin * (radius + 42),
      scoreX: center + cos * (radius * value + 14),
      scoreY: center + sin * (radius * value + 14),
      textAnchor: (Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end",
      score,
      marker,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto size-full max-w-md overflow-visible" role="img" aria-label="GHL marker scores">
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <g key={level}>
          <polygon
            points={markers.map((_, index) => {
              const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
              return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
          />
          <text
            x={center + 4}
            y={center - radius * level + (level === 1 ? -6 : 4)}
            className="fill-neutral-500 text-[9px] font-mono"
          >
            {Math.round(level * 100)}
          </text>
        </g>
      ))}
      {markers.map((_, index) => {
        const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
        return (
          <line
            key={`axis-${index}`}
            x1={center}
            y1={center}
            x2={center + Math.cos(angle) * radius}
            y2={center + Math.sin(angle) * radius}
            stroke="rgba(255,255,255,0.08)"
          />
        );
      })}
      <polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="rgba(255,255,255,0.16)" stroke="white" strokeWidth="2" />
      {points.map((point) => (
        <g key={point.marker.id}>
          <circle cx={point.x} cy={point.y} r="4" fill="white" />
          <text
            x={point.scoreX}
            y={point.scoreY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className="fill-white text-[10px] font-mono font-medium"
          >
            {point.score}
          </text>
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className="fill-neutral-400 text-[9px]"
          >
            {point.marker.label}
          </text>
        </g>
      ))}
      <text x={center} y={center + 4} textAnchor="middle" className="fill-neutral-600 text-[8px] font-mono">
        0
      </text>
    </svg>
  );
}

export function GhcScoreClient({ planId, planNodeId, sessionId, privateToken, initialSession }: GhcScoreClientProps) {
  const [phase, setPhase] = useState<Phase>(initialSession?.status === "completed" ? "done" : "setup");
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
      void fetch("/api/workspace-ghl-score/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          planNodeId,
          sessionId,
          privateToken,
          ghlSessionId: activeGhlSessionId,
          ...input,
        }),
      }).catch(() => {});
    },
    [planId, planNodeId, sessionId, privateToken],
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
    () => getDialogueStorageKey({ planId, sessionId, planNodeId, privateToken }),
    [planId, sessionId, planNodeId, privateToken],
  );

  useEffect(() => {
    const stored = loadDialogueMessages(dialogueStorageKey);
    if (stored.length > 0) setMessages(stored);
  }, [dialogueStorageKey]);

  useEffect(() => {
    if (messages.length === 0) return;
    saveDialogueMessages(dialogueStorageKey, messages);
  }, [messages, dialogueStorageKey]);

  const welcomePrompt =
    messages.find((message) => message.id === WELCOME_MESSAGE_ID)?.content ||
    "Start demonstrating what you learned. Submit a thought to receive a Socratic probe.";

  const lastUserTurn = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return messages[index];
    }
    return null;
  }, [messages]);

  const lastAssistantTurn = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant" && message.id !== WELCOME_MESSAGE_ID) return message;
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
  const sourceIdRef = useRef(`ghl-score-${Math.random().toString(36).slice(2, 10)}`);
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
    recognition.onerror = (event) => setSpeechError(event.error || "speech-recognition-error");
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
      const response = await fetch("/api/workspace-ghl-score/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, planNodeId, sessionId, privateToken, minutes, thought: clean, messages: nextMessages }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not get GHL response");
      const assistant: ChatMessage = { id: `a_${Date.now()}`, role: "assistant", content: payload.message, at: new Date().toISOString() };
      setMessages((current) => [...current, assistant]);
      void speak(payload.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get GHL response");
    } finally {
      setIsSending(false);
    }
  }

  async function startSession() {
    isEndingRef.current = false;
    const started = Date.now();
    setStartedAt(started);
    setRemainingSeconds(minutes * 60);
    speechResultsLengthRef.current = 0;
    consumedResultsIndexRef.current = 0;
    finalBufferRef.current = [];
    setThoughts([]);
    setMemoryThoughtIds(new Set());
    setSentThoughtIds(new Set());
    setSelectedActiveThoughtIds(new Set());
    clearDialogueMessages(dialogueStorageKey);
    setMessages([
      {
        id: WELCOME_MESSAGE_ID,
        role: "assistant",
        content: "Start demonstrating what you learned. Submit a thought to receive a Socratic probe.",
        at: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/workspace-ghl-score/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          planNodeId,
          sessionId,
          privateToken,
          minutes,
          ghlSessionId: ghlSessionIdRef.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start GHL session");
      if (payload.ghlSessionId) {
        ghlSessionIdRef.current = payload.ghlSessionId;
        setGhlSessionId(payload.ghlSessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start GHL session");
      return;
    }

    setPhase("live");
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
      const response = await fetch("/api/workspace-ghl-score/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          planNodeId,
          sessionId,
          privateToken,
          ghlSessionId: ghlSessionIdRef.current,
          transcript,
          durationSeconds,
          requestedDurationSeconds: minutes * 60,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate GHL Score");
      setScore(payload.ghlSession?.analysis || null);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate GHL Score");
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
  const workspaceId = planId || initialSession?.plan_id;

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
        <header className="flex items-center justify-between border-b border-neutral-900 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">GHL Score</p>
            <h1 className="mt-1 text-xl font-medium tracking-[-0.5px]">Learning Demonstration</h1>
          </div>
          {phase === "live" && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Time left</div>
                <div
                  className={`font-mono text-xl tabular-nums tracking-tight ${
                    remainingSeconds <= 60 ? "text-amber-300" : "text-white"
                  }`}
                >
                  {formatCountdown(remainingSeconds)}
                </div>
              </div>
              <GhcButton
                size="md"
                variant={voiceEnabled ? "toggleOn" : "toggleOff"}
                onClick={() => setVoiceEnabled((value) => !value)}
              >
                <GhcButtonLabel shortcut="V">voice</GhcButtonLabel>
              </GhcButton>
              <GhcButton size="md" variant="primary" onClick={endAndScore}>
                End & Score
              </GhcButton>
            </div>
          )}
        </header>

        {phase === "setup" && (
          <section className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-2xl rounded-2xl border border-neutral-900 bg-neutral-950/70 p-6 backdrop-blur-sm">
              <p className="font-mono text-xs uppercase tracking-[2px] text-neutral-500">{workspaceTitle}</p>
              <h2 className="mt-3 text-4xl font-medium tracking-[-1.5px]">Demonstrate what you learned.</h2>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                Browser transcription turns speech into thought traces. Use keyboard shortcuts to stay in flow without reaching for the mouse.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-400">
                <li className="flex flex-wrap items-center gap-2">
                  <GhcShortcutChord keys={["C"]} />
                  <span>Crystallize the live transcript into a thought</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <GhcShortcutChord keys={["Esc"]} />
                  <span>Skip the current thought</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <GhcShortcutChord keys={["1", "2", "3"]} />
                  <span>Send thought 1, 2, or 3</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <GhcShortcutChord keys={["⇧", "1"]} />
                  <span className="text-neutral-500">/</span>
                  <GhcShortcutChord keys={["⇧", "2"]} />
                  <span className="text-neutral-500">/</span>
                  <GhcShortcutChord keys={["⇧", "3"]} />
                  <span>Select thoughts for a combined send</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <GhcShortcutChord keys={["S"]} />
                  <span>Send all selected thoughts</span>
                </li>
                <li className="flex flex-wrap items-center gap-2">
                  <GhcShortcutChord keys={["V"]} />
                  <span>Toggle probe voice playback</span>
                </li>
              </ul>
              {!privateToken && (
                <div className="mt-6 grid grid-cols-2 gap-2">
                  {DURATIONS.map((duration) => (
                    <GhcButton
                      key={duration}
                      size="lg"
                      variant={minutes === duration ? "toggleOn" : "toggleOff"}
                      className="w-full"
                      onClick={() => setMinutes(duration)}
                    >
                      {duration} minutes
                    </GhcButton>
                  ))}
                </div>
              )}
              <GhcButton size="lg" variant="primary" className="mt-8 w-full" onClick={startSession}>
                Start GHL Score
              </GhcButton>
            </div>
          </section>
        )}

        {phase === "live" && (
          <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[1fr_22rem]">
            <div className="flex min-h-[70vh] flex-col rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
              <div className="border-b border-neutral-900 px-4 py-3">
                <div className="text-xs text-neutral-500">
                  {isListening ? "Listening live" : recognitionCtor ? "Waiting for microphone" : "Speech recognition unavailable"}
                </div>
              </div>
              <GhcDialogueSplit
                lastUserTurn={lastUserTurn}
                lastAssistantTurn={lastAssistantTurn}
                promptText={welcomePrompt}
                isSending={isSending}
                error={error}
                userInitial={userInitial}
              />
              <div className="border-t border-neutral-900 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black px-3 text-sm text-neutral-300">
                    {interimText || <span className="text-neutral-700">live transcription appears here...</span>}
                  </div>
                  <GhcButton size="md" disabled={!crystallizableText} onClick={crystallizeCurrentTranscription}>
                    <GhcButtonLabel shortcut="C">crystallize</GhcButtonLabel>
                  </GhcButton>
                  <GhcButton size="md" disabled={activeThoughts.length === 0} onClick={skipCurrentThought}>
                    <GhcButtonLabel shortcut="Esc">skip</GhcButtonLabel>
                  </GhcButton>
                </div>
                {speechError && <p className="mt-2 text-xs text-red-300">Speech recognition: {speechError}</p>}
              </div>
              <div className="border-t border-neutral-900 p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[10px] uppercase tracking-[2px] text-neutral-600">Active thoughts</div>
                  <GhcButton
                    size="md"
                    disabled={selectedActiveThoughts.length < 2}
                    onClick={() =>
                      sendThought(
                        selectedActiveThoughts.map((thought) => thought.text).join("\n"),
                        selectedActiveThoughts.map((thought) => thought.id),
                      )
                    }
                  >
                    <GhcButtonLabel shortcut="S">send selected ({selectedActiveThoughts.length})</GhcButtonLabel>
                  </GhcButton>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                {latestThoughts.map((thought, index) => (
                  <div
                    key={thought.id}
                    className={`group flex min-h-36 flex-col gap-3 rounded-xl border bg-black p-4 text-left transition hover:border-white/50 ${
                      selectedActiveThoughtIds.has(thought.id) ? "border-white/70" : "border-neutral-800"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[1.8px] text-neutral-500">Thought {index + 1}</p>
                    <p className="flex-1 text-sm leading-relaxed text-neutral-200">{thought.text}</p>
                    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-900 pt-3">
                      <GhcButton
                        size="sm"
                        variant={selectedActiveThoughtIds.has(thought.id) ? "toggleOn" : "toggleOff"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleActiveThought(thought.id);
                        }}
                      >
                        {selectedActiveThoughtIds.has(thought.id) ? (
                          "selected"
                        ) : (
                          <GhcButtonLabel shortcut={["⇧", String(index + 1)]}>select</GhcButtonLabel>
                        )}
                      </GhcButton>
                      <GhcButton size="sm" onClick={() => sendThought(thought.text, [thought.id])}>
                        <GhcButtonLabel shortcut={index + 1}>send</GhcButtonLabel>
                      </GhcButton>
                    </div>
                  </div>
                ))}
                {latestThoughts.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-neutral-800 bg-black p-6 text-center text-sm text-neutral-600">Speak to create thought traces.</div>}
                </div>
              </div>
            </div>
            <aside className="rounded-2xl border border-neutral-900 bg-neutral-950/65 p-4 backdrop-blur-sm">
              <div className="mb-4">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Thought Memory</p>
                <p className="mt-1 text-xs text-neutral-500">Full history of every thought trace. Send any entry back into the dialogue.</p>
              </div>
              <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
                {thoughtHistory.map((thought) => {
                  const isSent = sentThoughtIds.has(thought.id);
                  const isSkipped = memoryThoughtIds.has(thought.id);
                  const statusLabel = isSent ? "sent" : isSkipped ? "skipped" : "active";
                  return (
                    <div key={thought.id} className="rounded-xl border border-neutral-900 bg-black p-3">
                      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-neutral-600">
                        <span>{formatTime(thought.timestamp)}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded border px-2 py-0.5 uppercase tracking-[1px] ${
                              isSent
                                ? "border-emerald-900/60 text-emerald-400"
                                : isSkipped
                                  ? "border-neutral-800 text-neutral-500"
                                  : "border-cyan-900/60 text-cyan-300"
                            }`}
                          >
                            {statusLabel}
                          </span>
                          <GhcButton size="sm" onClick={() => sendThought(thought.text, [thought.id])}>
                            {isSent ? "resend" : "send"}
                          </GhcButton>
                        </div>
                      </div>
                      <button
                        onClick={() => sendThought(thought.text, [thought.id])}
                        className="w-full rounded-lg border border-neutral-900 bg-neutral-950 px-3 py-2 text-left text-xs leading-relaxed text-neutral-300 hover:border-neutral-700"
                      >
                        {thought.text}
                      </button>
                    </div>
                  );
                })}
                {thoughtHistory.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-800 bg-black p-4 text-center text-xs text-neutral-600">
                    Speak or press C to crystallize thoughts. Every trace appears here.
                  </div>
                )}
              </div>
            </aside>
          </section>
        )}

        {phase === "scoring" && <section className="flex flex-1 items-center justify-center text-neutral-400">Generating your GHL Score...</section>}
        {phase === "done" && score && (
          <section className="flex-1 py-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[2px] text-neutral-500">GHL Score Result</p>
                <h1 className="mt-2 text-4xl font-medium tracking-[-1.5px] sm:text-5xl">
                  {score.overall_score ?? "--"}
                  <span className="text-2xl text-neutral-500">/100</span>
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {workspaceId && (
                  <Link href={`/workspace/${workspaceId}`} className={ghcButtonClasses({ size: "md", variant: "ghost" })}>
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
              <RadarChart markers={markers} />
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
                            <p className="mt-2 text-xs leading-relaxed text-neutral-500">{gap.evidence}</p>
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
            <h1 className="text-2xl font-medium">GHL Score failed</h1>
            <p className="mt-3 max-w-md text-sm text-red-300">{error}</p>
            <GhcButton size="md" variant="primary" className="mt-6" onClick={() => setPhase("setup")}>
              Try again
            </GhcButton>
          </section>
        )}
      </div>
    </main>
  );
}
