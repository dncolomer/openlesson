"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "setup" | "connecting" | "live" | "reflecting" | "done" | "error";
type TeachBackMode = "curious" | "skeptical" | "practical" | "fast";

interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  at: string;
}

interface TeachBackClientProps {
  planId: string;
}

const durations = [5, 10, 20, 30];
const modes: Array<{ id: TeachBackMode; label: string; description: string }> = [
  { id: "curious", label: "Curious beginner", description: "Asks simple clarifying questions." },
  { id: "skeptical", label: "Skeptical friend", description: "Pushes on vague claims." },
  { id: "practical", label: "Practical learner", description: "Asks for examples and use cases." },
  { id: "fast", label: "Fast learner", description: "Moves quickly into connections." },
];

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToFloat32PCM(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
  return float32;
}

function float32ToBase64PCM16(input: Float32Array) {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return bytesToBase64(new Uint8Array(pcm16.buffer));
}

export function TeachBackClient({ planId }: TeachBackClientProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [minutes, setMinutes] = useState(10);
  const [mode, setMode] = useState<TeachBackMode>("curious");
  const [voice, setVoice] = useState("ara");
  const [workspaceTitle, setWorkspaceTitle] = useState("Workspace");
  const [status, setStatus] = useState("Teach this workspace to a curious listener.");
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [reflection, setReflection] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioRef = useRef<AudioContext | null>(null);
  const outputAudioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!startedAt || phase !== "live") return;
    const interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [phase, startedAt]);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    wsRef.current?.close();
    wsRef.current = null;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    inputAudioRef.current?.close().catch(() => {});
    outputAudioRef.current?.close().catch(() => {});
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    inputAudioRef.current = null;
    outputAudioRef.current = null;
  }

  function addTranscript(role: TranscriptEntry["role"], text: string) {
    const clean = text.trim();
    if (!clean) return;
    setTranscript((prev) => [...prev, { role, text: clean, at: new Date().toISOString() }]);
  }

  function playAudioDelta(delta: string) {
    const audioContext = outputAudioRef.current;
    if (!audioContext) return;
    const samples = base64ToFloat32PCM(delta);
    const buffer = audioContext.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    const startAt = Math.max(audioContext.currentTime, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
  }

  async function startTeachBack() {
    setPhase("connecting");
    setError("");
    setTranscript([]);
    setReflection(null);
    setStatus("Preparing your Teach Back listener...");

    try {
      const tokenRes = await fetch("/api/workspace-teach-back/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, minutes, mode, voice }),
      });
      const tokenPayload = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenPayload.error || "Could not start Teach Back");

      setWorkspaceTitle(tokenPayload.workspaceTitle || "Workspace");
      setStatus("Opening microphone...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      const inputAudio = new AudioContext({ sampleRate: 24000 });
      const outputAudio = new AudioContext({ sampleRate: 24000 });
      inputAudioRef.current = inputAudio;
      outputAudioRef.current = outputAudio;
      nextPlaybackTimeRef.current = outputAudio.currentTime;

      const ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(tokenPayload.model || "grok-voice-latest")}`, [
        `xai-client-secret.${tokenPayload.token}`,
      ]);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            voice: tokenPayload.voice || voice,
            instructions: tokenPayload.instructions,
            turn_detection: { type: "server_vad", silence_duration_ms: 900, idle_timeout_ms: 12000 },
            resumption: { enabled: true },
            audio: {
              input: { format: { type: "audio/pcm", rate: 24000 } },
              output: { format: { type: "audio/pcm", rate: 24000 } },
            },
          },
        }));

        ws.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "force_message",
            role: "assistant",
            interruptible: false,
            content: [{ type: "output_text", text: "I'm new to this. Can you teach me what this workspace is about?" }],
          },
        }));

        const source = inputAudio.createMediaStreamSource(stream);
        const processor = inputAudio.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(inputAudio.destination);
        sourceRef.current = source;
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = event.inputBuffer.getChannelData(0);
          ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: float32ToBase64PCM16(input) }));
        };

        setStartedAt(Date.now());
        setElapsed(0);
        setPhase("live");
        setStatus("Teach the workspace out loud. The listener will ask clarifying questions.");
      };

      ws.onmessage = (message) => {
        const event = JSON.parse(message.data);
        if (event.type === "conversation.created") {
          conversationIdRef.current = event.conversation?.id || null;
        }
        if (event.type === "response.output_audio.delta" && event.delta) {
          playAudioDelta(event.delta);
        }
        if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
          addTranscript("user", event.transcript);
        }
        if ((event.type === "response.output_text.done" || event.type === "response.text.done") && event.text) {
          addTranscript("assistant", event.text);
        }
        if (event.type === "error") {
          setError(event.error?.message || "Voice session error");
        }
      };

      ws.onerror = () => {
        setError("Voice connection failed");
        setPhase("error");
      };
    } catch (err) {
      cleanup();
      setError(err instanceof Error ? err.message : "Could not start Teach Back");
      setPhase("error");
    }
  }

  async function endAndReflect() {
    const durationSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : elapsed;
    setPhase("reflecting");
    setStatus("Generating your Teach Back Reflection...");
    cleanup();

    try {
      const finalTranscript = transcriptRef.current.length > 0
        ? transcriptRef.current
        : [{ role: "user" as const, text: "Teach Back ended before a transcript was available.", at: new Date().toISOString() }];
      const response = await fetch("/api/workspace-teach-back/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          transcript: finalTranscript,
          durationSeconds,
          requestedDurationSeconds: minutes * 60,
          mode,
          voice,
          xaiConversationId: conversationIdRef.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not generate reflection");
      setReflection(payload.teachBack?.analysis || null);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate reflection");
      setPhase("error");
    }
  }

  const remaining = Math.max(0, minutes * 60 - elapsed);
  const timer = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <div className="text-center font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">Teach Back</div>

        {phase === "setup" && (
          <section className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto w-full max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-[2px] text-neutral-500">Voice practice</p>
              <h1 className="mt-3 text-4xl font-medium tracking-[-1.5px] sm:text-5xl">Teach this workspace back.</h1>
              <p className="mt-4 max-w-xl text-neutral-400">Explain it to a curious listener who does not know the material yet. They will ask clarifying questions so you can sharpen your understanding.</p>

              <div className="mt-8 space-y-6 rounded-md border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
                <div>
                  <label className="text-sm text-neutral-300">Timebox</label>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {durations.map((value) => (
                      <button key={value} onClick={() => setMinutes(value)} className={`rounded-md border px-3 py-3 text-sm ${minutes === value ? "border-white bg-white text-black" : "border-neutral-800 bg-neutral-900 text-neutral-400"}`}>{value} min</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-neutral-300">Listener style</label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {modes.map((item) => (
                      <button key={item.id} onClick={() => setMode(item.id)} className={`rounded-md border p-3 text-left ${mode === item.id ? "border-white bg-white text-black" : "border-neutral-800 bg-neutral-900 text-neutral-400"}`}>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className={`mt-1 text-xs ${mode === item.id ? "text-black/65" : "text-neutral-500"}`}>{item.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-neutral-300">Voice</label>
                  <select value={voice} onChange={(event) => setVoice(event.target.value)} className="mt-3 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-3 text-sm text-neutral-200 outline-none">
                    <option value="ara">ara - warm</option>
                    <option value="sal">sal - balanced</option>
                    <option value="rex">rex - clear</option>
                    <option value="eve">eve - energetic</option>
                    <option value="leo">leo - direct</option>
                  </select>
                </div>

                <button onClick={startTeachBack} className="w-full rounded-md bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200">Start Teach Back</button>
              </div>
            </div>
          </section>
        )}

        {(phase === "connecting" || phase === "live" || phase === "reflecting") && (
          <section className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <div className="text-sm text-neutral-500">{workspaceTitle}</div>
            <div className="mt-4 font-mono text-4xl tracking-[-1px] text-neutral-200">{phase === "reflecting" ? "Reflecting" : timer}</div>
            <div className="relative mt-10 flex size-48 items-center justify-center rounded-full border border-white/10 bg-neutral-950 shadow-[0_0_80px_rgba(255,255,255,0.08)] sm:size-64">
              <div className={`absolute inset-6 rounded-full bg-white/5 ${phase === "live" ? "animate-pulse" : ""}`} />
              <div className="relative text-center">
                <div className="font-serif text-5xl text-neutral-200">T</div>
                <div className="mt-2 text-xs uppercase tracking-[2px] text-neutral-500">Listener</div>
              </div>
            </div>
            <p className="mt-8 max-w-md text-sm leading-relaxed text-neutral-400">{status}</p>
            {phase === "live" && (
              <button onClick={endAndReflect} className="mt-10 w-full max-w-sm rounded-md bg-white px-5 py-4 text-sm font-medium text-black transition hover:bg-neutral-200">End &amp; Reflect</button>
            )}
          </section>
        )}

        {phase === "done" && reflection && (
          <section className="mx-auto w-full max-w-3xl flex-1 py-10">
            <p className="font-mono text-xs uppercase tracking-[2px] text-neutral-500">Teach Back Reflection</p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-1px]">{reflection.confidence || "Reflection"}</h1>
            <p className="mt-4 text-neutral-300">{reflection.overall_reflection}</p>
            {[
              ["What you taught clearly", reflection.what_was_clear],
              ["Where the explanation needed support", reflection.where_reasoning_was_fuzzy],
              ["Terms to define earlier", reflection.terms_to_define_earlier],
              ["Connections to strengthen", reflection.connections_to_strengthen],
              ["Try teaching this next", reflection.follow_up_prompts],
            ].map(([title, items]) => Array.isArray(items) && items.length > 0 ? (
              <div key={title as string} className="mt-6 rounded-md border border-neutral-800 bg-neutral-950 p-4">
                <h2 className="text-sm font-medium text-neutral-200">{title as string}</h2>
                <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                  {(items as string[]).map((item, index) => <li key={index}>- {item}</li>)}
                </ul>
              </div>
            ) : null)}
            <div className="mt-8">
              <button onClick={() => setPhase("setup")} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200">Start another</button>
            </div>
          </section>
        )}

        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-medium">Teach Back could not start</h1>
            <p className="mt-3 max-w-md text-sm text-red-300">{error}</p>
            <button onClick={() => setPhase("setup")} className="mt-6 rounded-md bg-white px-4 py-2 text-sm font-medium text-black">Try again</button>
          </section>
        )}
      </div>
    </main>
  );
}
