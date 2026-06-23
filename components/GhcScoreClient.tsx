"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { emitHeliosVoicePlayback } from "@/lib/useHeliosVoicePlayback";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
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
const THOUGHT_HISTORY_LIMIT = 80;
const DURATIONS = [15, 30];

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

function GhcAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full border border-neutral-700 bg-gradient-to-br from-white/10 via-neutral-800 to-neutral-950 flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-serif text-neutral-200" style={{ fontSize: size * 0.5 }}>G</span>
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
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedActiveThoughtIds, setSelectedActiveThoughtIds] = useState<Set<string>>(new Set());
  const [memoryThoughtIds, setMemoryThoughtIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<any>(initialSession?.analysis || null);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const recognitionCtor = useMemo(getSpeechRecognitionConstructor, []);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const finalBufferRef = useRef<string[]>([]);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeThoughts = useMemo(() => thoughts.filter((thought) => !memoryThoughtIds.has(thought.id)), [thoughts, memoryThoughtIds]);
  const latestThoughts = useMemo(() => activeThoughts.slice(-3).reverse(), [activeThoughts]);
  const sourceIdRef = useRef(`ghl-score-${Math.random().toString(36).slice(2, 10)}`);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const memoryThoughts = useMemo(() => thoughts.filter((thought) => memoryThoughtIds.has(thought.id)).slice().reverse(), [thoughts, memoryThoughtIds]);
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

  function addThought(text: string) {
    const clean = normalize(text);
    if (!clean) return;
    setThoughts((current) => {
      const last = current[current.length - 1];
      const chainId = last && Date.now() - last.timestamp <= CHAIN_GAP_MS ? last.chainId : `chain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      return [...current, { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text: clean, timestamp: Date.now(), chainId }].slice(-THOUGHT_HISTORY_LIMIT);
    });
  }

  function flushFinalBuffer() {
    const text = normalize(finalBufferRef.current.join(" "));
    finalBufferRef.current = [];
    if (text) addThought(text);
  }

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
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = normalize(result[0]?.transcript || "");
        if (!transcript) continue;
        if (result.isFinal) finalBufferRef.current.push(transcript);
        else interim = normalize(`${interim} ${transcript}`);
      }
      setInterimText(interim);
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
      if (["1", "2", "3"].includes(event.key)) {
        const thought = latestThoughts[Number(event.key) - 1];
        if (!thought) return;
        event.preventDefault();
        if (event.metaKey || event.ctrlKey) toggleActiveThought(thought.id);
        else void sendThought(thought.text, [thought.id]);
        return;
      }
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "s") {
        if (selectedActiveThoughts.length === 0) return;
        event.preventDefault();
        void sendThought(selectedActiveThoughts.map((thought) => thought.text).join("\n"), selectedActiveThoughts.map((thought) => thought.id));
      }
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setVoiceEnabled((value) => !value);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, latestThoughts, thoughts, voiceEnabled, selectedActiveThoughts]);

  async function sendThought(text: string, thoughtIds: string[] = []) {
    const clean = normalize(text);
    if (!clean || isSending) return;
    setIsSending(true);
    setError("");
    const userMessage: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: clean, at: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setThoughts((current) => current.filter((thought) => !thoughtIds.includes(thought.id)));
    setMemoryThoughtIds((current) => new Set([...current].filter((id) => !thoughtIds.includes(id))));
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

  function startSession() {
    setStartedAt(Date.now());
    setPhase("live");
    setMessages([{ id: "welcome", role: "assistant", content: "Start demonstrating what you learned. I will respond Socratically when you choose a thought to explore.", at: new Date().toISOString() }]);
  }

  async function endAndScore() {
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
        body: JSON.stringify({ planId, planNodeId, sessionId, privateToken, transcript, durationSeconds, requestedDurationSeconds: minutes * 60 }),
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

  const markers = Array.isArray(score?.markers) ? score.markers : [];
  const gapAnalysis = score?.gap_analysis || (Array.isArray(score?.knowledge_gaps) ? { summary: "Learning gaps identified from the demonstration.", gaps: score.knowledge_gaps, next_practice: score.follow_up_prompts || [] } : null);
  const workspaceId = planId || initialSession?.plan_id;

  function toggleActiveThought(thoughtId: string) {
    setSelectedActiveThoughtIds((current) => {
      const next = new Set(current);
      if (next.has(thoughtId)) next.delete(thoughtId);
      else next.add(thoughtId);
      return next;
    });
  }

  function skipCurrentThought() {
    flushFinalBuffer();
    const currentThought = activeThoughts[activeThoughts.length - 1];
    if (!currentThought) return;
    setMemoryThoughtIds((current) => new Set(current).add(currentThought.id));
    setSelectedActiveThoughtIds((current) => {
      const next = new Set(current);
      next.delete(currentThought.id);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6">
        <header className="flex items-center justify-between border-b border-neutral-900 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">GHL Score</p>
            <h1 className="mt-1 text-xl font-medium tracking-[-0.5px]">Learning Demonstration</h1>
          </div>
          {phase === "live" && (
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <button onClick={() => setVoiceEnabled((value) => !value)} className={`rounded-md border px-2 py-1 ${voiceEnabled ? "border-white bg-white text-black" : "border-neutral-800 bg-neutral-950"}`}>V voice</button>
            </div>
          )}
        </header>

        {phase === "setup" && (
          <section className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-2xl rounded-2xl border border-neutral-900 bg-neutral-950/60 p-6">
              <p className="font-mono text-xs uppercase tracking-[2px] text-neutral-500">{workspaceTitle}</p>
              <h2 className="mt-3 text-4xl font-medium tracking-[-1.5px]">Demonstrate what you learned.</h2>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">Browser transcription turns speech into thought traces. Send individual thoughts into the GHL dialogue, or use Ctrl/Cmd plus a number to select multiple thoughts. The score reflects your demonstrated learning for this block or the whole workspace.</p>
              {!privateToken && <div className="mt-6 grid grid-cols-2 gap-2">{DURATIONS.map((duration) => <button key={duration} onClick={() => setMinutes(duration)} className={`rounded-md border px-3 py-3 text-sm ${minutes === duration ? "border-white bg-white text-black" : "border-neutral-800 bg-black text-neutral-400"}`}>{duration} minutes</button>)}</div>}
              <button onClick={startSession} className="mt-8 w-full rounded-md bg-white px-4 py-3 text-sm font-medium text-black hover:bg-neutral-200">Start GHL Score</button>
            </div>
          </section>
        )}

        {phase === "live" && (
          <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[1fr_22rem]">
            <div className="flex min-h-[70vh] flex-col rounded-2xl border border-neutral-900 bg-neutral-950/45">
              <div className="flex items-center justify-between border-b border-neutral-900 px-4 py-3">
                <div className="text-xs text-neutral-500">{isListening ? "Listening live" : recognitionCtor ? "Waiting for microphone" : "Speech recognition unavailable"}</div>
                <button onClick={endAndScore} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black">End & Score</button>
              </div>
              <div className="border-b border-neutral-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[2px] text-neutral-600">Active thoughts</div>
                  <button
                    disabled={selectedActiveThoughts.length < 2}
                    onClick={() => sendThought(selectedActiveThoughts.map((thought) => thought.text).join("\n"), selectedActiveThoughts.map((thought) => thought.id))}
                    className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-[11px] text-neutral-300 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="font-mono">S</span> send selected thoughts ({selectedActiveThoughts.length})
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                {latestThoughts.map((thought, index) => (
                  <div key={thought.id} className={`group relative min-h-32 rounded-xl border bg-black p-3 pt-14 text-left transition hover:border-white/50 ${selectedActiveThoughtIds.has(thought.id) ? "border-white/70" : "border-neutral-800"}`}>
                    <div className="absolute left-3 right-3 top-3 flex h-7 items-start justify-between text-[10px] uppercase tracking-[1.8px] text-neutral-500">
                      <span>Thought {index + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(event) => { event.stopPropagation(); toggleActiveThought(thought.id); }}
                          className={`rounded border px-2 py-1 text-[10px] ${selectedActiveThoughtIds.has(thought.id) ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-400"}`}
                        >
                          {selectedActiveThoughtIds.has(thought.id) ? "selected" : "ctrl/cmd"}
                        </button>
                        <kbd className="rounded border border-neutral-700 px-2 py-1 text-neutral-300">{index + 1}</kbd>
                      </div>
                    </div>
                    <button onClick={() => sendThought(thought.text, [thought.id])} className="block w-full text-left">
                      <p className="text-sm leading-relaxed text-neutral-200">{thought.text}</p>
                    </button>
                  </div>
                ))}
                {latestThoughts.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-neutral-800 bg-black p-6 text-center text-sm text-neutral-600">Speak to create thought traces.</div>}
                </div>
              </div>
              <div className="border-b border-neutral-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-h-12 flex-1 rounded-xl border border-neutral-900 bg-black px-3 py-2 text-sm text-neutral-300">{interimText || <span className="text-neutral-700">live transcription appears here...</span>}</div>
                  <button disabled={activeThoughts.length === 0} onClick={skipCurrentThought} className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-neutral-300 disabled:opacity-40"><span className="font-mono">Esc</span> skip current</button>
                </div>
                {speechError && <p className="mt-2 text-xs text-red-300">Speech recognition: {speechError}</p>}
              </div>
              <div className="border-b border-neutral-900 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <GhcAvatar size={26} />
                  <div>
                    <h2 className="text-sm font-medium text-white">GHL Dialogue</h2>
                    <p className="text-[11px] text-neutral-500">Submit thoughts to continue a Socratic assessment dialogue.</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.map((message) => <div key={message.id} className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "assistant" && <GhcAvatar size={28} />}<div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-white text-black" : "bg-neutral-900 text-neutral-200"}`}>{message.content}</div></div>)}
                {isSending && <div className="flex items-start gap-2"><GhcAvatar size={28} /><div className="rounded-xl bg-neutral-900 px-4 py-3"><div className="flex gap-1"><div className="size-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} /><div className="size-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} /><div className="size-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>}
                {error && <div className="text-sm text-red-300">{error}</div>}
              </div>
            </div>
            <aside className="rounded-2xl border border-neutral-900 bg-neutral-950/45 p-4">
              <div className="mb-4"><p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Thought Memory</p><p className="mt-1 text-xs text-neutral-500">Skipped thoughts stay here. Send one back into the dialogue when it becomes useful.</p></div>
              <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
                {memoryThoughts.map((thought) => <div key={thought.id} className="rounded-xl border border-neutral-900 bg-black p-3"><div className="mb-2 flex items-center justify-between text-[10px] text-neutral-600"><span>{formatTime(thought.timestamp)}</span><button onClick={() => sendThought(thought.text, [thought.id])} className="rounded border border-neutral-800 px-2 py-1 text-neutral-400 hover:text-white">send</button></div><button onClick={() => sendThought(thought.text, [thought.id])} className="w-full rounded-lg border border-neutral-900 bg-neutral-950 px-3 py-2 text-left text-xs leading-relaxed text-neutral-300 hover:border-neutral-700">{thought.text}</button></div>)}
                {memoryThoughts.length === 0 && <div className="rounded-xl border border-dashed border-neutral-800 bg-black p-4 text-center text-xs text-neutral-600">Press Esc to move the current thought here.</div>}
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
                  <Link
                    href={`/workspace/${workspaceId}`}
                    className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 hover:text-white"
                  >
                    Back to workspace
                  </Link>
                )}
                {!privateToken && (
                  <Link
                    href="/dashboard"
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200"
                  >
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
        {phase === "error" && <section className="flex flex-1 flex-col items-center justify-center text-center"><h1 className="text-2xl font-medium">GHL Score failed</h1><p className="mt-3 max-w-md text-sm text-red-300">{error}</p><button onClick={() => setPhase("setup")} className="mt-6 rounded-md bg-white px-4 py-2 text-sm font-medium text-black">Try again</button></section>}
      </div>
    </main>
  );
}
