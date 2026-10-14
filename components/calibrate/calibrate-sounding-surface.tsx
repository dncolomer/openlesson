"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SessionAudioMonitor } from "@/components/session-view/session-data-card";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import {
  SOUNDING_CANT_TELL_LABEL,
  SOUNDING_CONTINUE_LABEL,
  soundingProgress,
  type SoundingState,
} from "@/lib/calibrate-sounding";

export function CalibrateSoundingSurface({
  sounding,
  error,
  clock,
  actions,
  bgImage,
  proofBusy = false,
  onCommitTaps,
  onSubmitProof,
}: {
  sounding: SoundingState;
  error?: string;
  clock?: ReactNode;
  actions?: ReactNode;
  bgImage?: string | null;
  proofBusy?: boolean;
  onCommitTaps: (tappedIds: readonly string[]) => void;
  onSubmitProof: (transcript: string) => void;
}) {
  const [tapped, setTapped] = useState<string[]>([]);
  const screenKey = sounding.current?.stills.map((still) => still.id).join("|") ?? sounding.phase;
  const progress = soundingProgress(sounding);

  useEffect(() => {
    setTapped([]);
  }, [screenKey]);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#0b0b0b] text-white"
      data-calibrate-sounding=""
      data-sounding-phase={sounding.phase}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
        <div className="min-w-0 flex-1">{clock}</div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(7rem,28vh)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-2">
        <TapAestheticSection
          kind="sounding"
          bgImage={bgImage}
          className="min-h-[7rem] lg:order-2"
        />
        <div className="min-h-0 overflow-y-auto lg:order-1">
          {sounding.phase === "expert-proof" && sounding.proof ? (
            <SoundingVoiceStep
              stillText={sounding.proof.stillText}
              progress={progress}
              error={error}
              busy={proofBusy}
              onSubmit={onSubmitProof}
            />
          ) : (
            <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-6 py-10">
              <SoundingProgressHeader progress={progress} />
              <ul className="flex flex-col gap-3" data-sounding-stills="">
                {(sounding.current?.stills ?? []).map((still) => {
                  const selected = tapped.includes(still.id);
                  return (
                    <li key={still.id}>
                      <button
                        type="button"
                        data-sounding-still={still.id}
                        aria-pressed={selected}
                        onClick={() => {
                          setTapped((current) =>
                            current.includes(still.id)
                              ? current.filter((id) => id !== still.id)
                              : [...current, still.id],
                          );
                        }}
                        className={`w-full border px-4 py-4 text-left text-base leading-relaxed ${
                          selected
                            ? "border-white bg-white text-neutral-950"
                            : "border-white/30 bg-black text-white hover:border-white/70"
                        }`}
                      >
                        {still.text}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <button
                type="button"
                data-sounding-continue=""
                onClick={() => onCommitTaps(tapped)}
                className="bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-neutral-950"
              >
                {SOUNDING_CONTINUE_LABEL}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SpeechRecognitionResultLike = {
  readonly [index: number]: { readonly transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function SoundingVoiceStep({
  stillText,
  progress,
  error,
  busy,
  onSubmit,
}: {
  stillText: string;
  progress: ReturnType<typeof soundingProgress>;
  error?: string;
  busy: boolean;
  onSubmit: (transcript: string) => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [typed, setTyped] = useState("");
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const latestRef = useRef("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor = speechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i += 1) {
        heard += event.results[i]?.[0]?.transcript ?? "";
      }
      const next = heard.replace(/\s+/g, " ").trim();
      latestRef.current = next;
      setTranscript(next);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* no mic */
    }
    return () => {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let owned: MediaStream | null = null;
    void navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        owned = next;
        setMicStream(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      owned?.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    };
  }, []);

  const spoken = typed.trim() || transcript.trim();

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-6 py-10"
      data-sounding-proof=""
      data-sounding-voice=""
    >
      <SoundingProgressHeader progress={progress} />
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">A gap you marked</p>
      <p className="text-sm text-neutral-300" data-sounding-proof-still="">
        {stillText}
      </p>
      <div data-sounding-voice-audio="">
        <SessionAudioMonitor stream={micStream} />
      </div>
      {transcript ? (
        <p className="text-sm leading-relaxed text-neutral-200" data-sounding-voice-transcript="">
          {transcript}
        </p>
      ) : null}
      <textarea
        data-sounding-voice-typed=""
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        rows={4}
        placeholder="Or type what is uncertain, and how you would look next to fill it."
        className="w-full resize-none border border-white/30 bg-black px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-500"
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        data-sounding-proof-submit=""
        disabled={busy || !spoken}
        onClick={() => {
          if (busy || !spoken) return;
          onSubmit(spoken);
        }}
        className="bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Reading" : SOUNDING_CONTINUE_LABEL}
      </button>
      <button
        type="button"
        data-sounding-cant-tell=""
        disabled={busy}
        onClick={() => {
          if (busy) return;
          onSubmit("");
        }}
        className="border border-white/20 px-4 py-3 text-left text-sm text-neutral-400 hover:border-white/50 hover:text-white disabled:opacity-40"
      >
        {SOUNDING_CANT_TELL_LABEL}
      </button>
    </div>
  );
}

function SoundingProgressHeader({
  progress,
}: {
  progress: ReturnType<typeof soundingProgress>;
}) {
  return (
    <div data-sounding-progress="" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          {progress.label}
        </p>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: progress.passes }, (_, index) => {
            const filled = index < progress.pass;
            const current = index + 1 === progress.pass;
            return (
              <span
                key={index}
                data-sounding-pass={index + 1}
                className={`h-1.5 w-6 ${
                  filled
                    ? "bg-white"
                    : current
                      ? "bg-white/50"
                      : "border border-white/30 bg-transparent"
                }`}
              />
            );
          })}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-neutral-300">{progress.hint}</p>
    </div>
  );
}
