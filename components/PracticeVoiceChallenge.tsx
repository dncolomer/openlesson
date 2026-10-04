"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { IleInsightTrophyIcon } from "@/components/session-view/ile-insight-trophies";
import { SessionAudioMonitor } from "@/components/session-view/session-data-card";
import {
  ILE_SAMPLE_INSIGHT_LABEL,
  PRACTICE_VOICE_CHALLENGE_ACCEPTED,
  PRACTICE_VOICE_CHALLENGE_CHECK,
  PRACTICE_VOICE_CHALLENGE_CHECK_REST,
  PRACTICE_VOICE_CHALLENGE_LOCAL_SKIP,
  PRACTICE_VOICE_CHALLENGE_READ_CUE,
  PRACTICE_VOICE_CHALLENGE_READ_CUE_REST,
  PRACTICE_VOICE_CHALLENGE_READ_NOTE,
  PRACTICE_VOICE_CHALLENGE_REJECTED,
  PRACTICE_VOICE_CHALLENGE_RETRY,
  PRACTICE_VOICE_CHALLENGE_UNCHECKED,
  VOICE_CHALLENGE_START_DELAY_MS,
  judgeVoiceChallengeReading,
  mergeVoiceChallengeHeard,
  voiceChallengeReadMarks,
  practiceVoiceChallengeLocalSkipAllowed,
  retryVoiceChallenge,
  voiceChallengeScriptFor,
  type VoiceChallengeMark,
  type VoiceChallengeVariant,
} from "@/lib/practice-voice-challenge";

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

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * The learner says the lines, then presses the button. That click compares
 * the captured reading with the script and shows Accepted or Rejected.
 * Nothing is read to them, and a mic result does not pass by itself.
 */
function splitMarksAtSentences(marks: readonly VoiceChallengeMark[]): VoiceChallengeMark[][] {
  const groups: VoiceChallengeMark[][] = [];
  let current: VoiceChallengeMark[] = [];
  for (const mark of marks) {
    current.push(mark);
    if (mark.kind === "punct" && mark.text.includes(".")) {
      groups.push(current);
      current = [];
    }
  }
  if (current.some((mark) => mark.text.trim())) groups.push(current);
  return groups;
}

/** Keep the speak-aloud pair in one paragraph. A later "In this session" line stays its own. */
function joinOpeningSentences(groups: VoiceChallengeMark[][]): VoiceChallengeMark[][] {
  const paragraphs: VoiceChallengeMark[][] = [];
  const opening: VoiceChallengeMark[] = [];
  let sessionLine = false;
  for (const group of groups) {
    const text = group.map((mark) => mark.text).join("");
    if (!sessionLine && !/in this session/i.test(text)) {
      opening.push(...group);
      continue;
    }
    if (!sessionLine && opening.length > 0) paragraphs.push(opening);
    sessionLine = true;
    paragraphs.push(group);
  }
  if (!sessionLine && opening.length > 0) paragraphs.push(opening);
  return paragraphs;
}

export function PracticeVoiceChallenge({
  onPass,
  framing = "start",
  variant = "tap",
  lang,
}: {
  onPass: () => void;
  framing?: "start" | "rest";
  /** TAP Learning adds a sample card. Prepare and Drill add a second sentence about that flow. */
  variant?: VoiceChallengeVariant;
  /** BCP-47 tag. The rest screen must match the session recognizer it just released. */
  lang?: string | null;
}) {
  const onPassRef = useRef(onPass);
  onPassRef.current = onPass;
  const [transcript, setTranscript] = useState("");
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [listenAttempt, setListenAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [light, setLight] = useState<"idle" | "green" | "red">("idle");
  const committedRef = useRef("");
  const latestRef = useRef("");
  const passedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const devBuild = process.env.NODE_ENV === "development";
  const [localSkip, setLocalSkip] = useState(false);

  useEffect(() => {
    if (!devBuild) {
      setLocalSkip(false);
      return;
    }
    setLocalSkip(
      practiceVoiceChallengeLocalSkipAllowed({
        nodeEnv: process.env.NODE_ENV,
        hostname: window.location.hostname,
      }),
    );
  }, [devBuild]);
  const script = voiceChallengeScriptFor(variant);
  const marks = voiceChallengeReadMarks({ script, transcript: "" });
  const sentences = joinOpeningSentences(splitMarksAtSentences(marks));
  const cue =
    framing === "rest"
      ? PRACTICE_VOICE_CHALLENGE_READ_CUE_REST
      : PRACTICE_VOICE_CHALLENGE_READ_CUE;

  useEffect(() => {
    const Ctor = speechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    if (lang) recognition.lang = lang;
    let stopped = false;
    let heardResult = false;
    recognition.onresult = (event) => {
      heardResult = true;
      const sessionResults: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        sessionResults.push(event.results[i]?.[0]?.transcript ?? "");
      }
      const heard = mergeVoiceChallengeHeard({
        committedText: committedRef.current,
        sessionResults,
      });
      latestRef.current = heard;
      setTranscript(heard);
    };
    recognition.onend = () => {
      if (stopped || passedRef.current) return;
      committedRef.current = latestRef.current;
      try {
        recognition.start();
      } catch {
        /* already running */
      }
    };
    const kickoffTimers: number[] = [];
    const startListening = () => {
      if (stopped || heardResult) return;
      try {
        recognition.start();
      } catch {
        /* The session recognizer may still be releasing the mic. */
      }
    };
    startListening();
    for (const delay of [200, 600, 1200]) {
      kickoffTimers.push(window.setTimeout(startListening, delay));
    }
    return () => {
      stopped = true;
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      kickoffTimers.forEach((id) => window.clearTimeout(id));
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [lang, listenAttempt, variant]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let owned: MediaStream | null = null;
    void navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
        video: false,
      })
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
  }, [listenAttempt]);

  function retry() {
    const decision = retryVoiceChallenge({ alreadyPassed: passedRef.current });
    if (!decision.reset || decision.shouldStart) return;
    committedRef.current = "";
    latestRef.current = "";
    setTranscript("");
    setLight("idle");
    setListenAttempt((attempt) => attempt + 1);
  }

  function skipLocally() {
    const allowed = practiceVoiceChallengeLocalSkipAllowed({
      nodeEnv: process.env.NODE_ENV,
      hostname: typeof window === "undefined" ? "" : window.location.hostname,
    });
    if (!allowed || passedRef.current) return;
    passedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setStarting(true);
    window.setTimeout(() => onPassRef.current(), VOICE_CHALLENGE_START_DELAY_MS);
  }

  function checkReading() {
    if (passedRef.current) return;
    const verdict = judgeVoiceChallengeReading({
      transcript: latestRef.current,
      variant,
    });
    if (verdict !== "pass") {
      setLight("red");
      return;
    }
    passedRef.current = true;
    setLight("green");
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    window.setTimeout(() => {
      setStarting(true);
      onPassRef.current();
    }, VOICE_CHALLENGE_START_DELAY_MS);
  }

  if (starting) {
    return (
      <section
        data-practice-voice-challenge=""
        data-practice-voice-loading=""
        data-practice-voice-variant={variant}
        className="flex min-h-52 flex-col items-center justify-center gap-4 border border-white/15 bg-neutral-950 px-6 py-10"
      >
        <LoadingStatusMessage
          message={framing === "rest" ? "Continuing" : "Starting the session"}
        />
      </section>
    );
  }

  return (
    <section
      data-practice-voice-challenge=""
      data-practice-voice-variant={variant}
      data-practice-voice-framing={framing}
      className="overflow-hidden border border-white/15 bg-neutral-950"
    >
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          {cue}
        </p>
        <h2 className="mt-2 text-lg font-medium tracking-tight text-white">
          Say these lines out loud
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400">
          {PRACTICE_VOICE_CHALLENGE_READ_NOTE}
        </p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <div data-practice-voice-audio="" className="mb-5">
          <SessionAudioMonitor stream={micStream} />
        </div>
        <div data-practice-voice-script="" className="flex flex-col gap-4">
          {sentences.map((sentence, sentenceIndex) => (
            <p
              key={sentenceIndex}
              data-practice-voice-sentence={sentenceIndex + 1}
              className="text-lg leading-relaxed tracking-tight sm:text-xl"
            >
              {sentence.map((mark, index) =>
                mark.kind === "space" ? (
                  <span key={index}>{mark.text}</span>
                ) : (
                  <span
                    key={index}
                    data-practice-voice-word=""
                    className="text-white"
                  >
                    {mark.text}
                  </span>
                ),
              )}
            </p>
          ))}
          {variant === "ile" ? (
            <article
              data-ile-sample-insight-card=""
              className="flex items-start gap-3 border border-white/80 bg-amber-300 px-3 py-3 text-neutral-950"
            >
              <IleInsightTrophyIcon className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 w-full flex-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider">
                  {ILE_SAMPLE_INSIGHT_LABEL}
                </p>
                <span
                  data-ile-sample-insight-bar=""
                  aria-hidden
                  className="mt-2 block h-2.5 w-full bg-amber-700"
                />
              </div>
            </article>
          ) : null}
        </div>
        <p
          data-practice-voice-captured=""
          className="mt-6 min-h-6 text-sm leading-relaxed text-neutral-400"
        >
          {transcript || "Nothing captured yet."}
        </p>
        <div className="mt-4 flex items-center gap-3" data-practice-voice-result="">
          <span
            data-practice-voice-light={light}
            aria-label={
              light === "green"
                ? PRACTICE_VOICE_CHALLENGE_ACCEPTED
                : light === "red"
                  ? PRACTICE_VOICE_CHALLENGE_REJECTED
                  : PRACTICE_VOICE_CHALLENGE_UNCHECKED
            }
            className={
              light === "green"
                ? "inline-block size-3 rounded-full bg-green-500"
                : light === "red"
                  ? "inline-block size-3 rounded-full bg-red-500"
                  : "inline-block size-3 rounded-full bg-neutral-700"
            }
          />
          <span
            data-practice-voice-verdict=""
            className={
              light === "green"
                ? "font-mono text-[10px] uppercase tracking-[0.14em] text-green-400"
                : light === "red"
                  ? "font-mono text-[10px] uppercase tracking-[0.14em] text-red-400"
                  : "font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400"
            }
          >
            {light === "green"
              ? PRACTICE_VOICE_CHALLENGE_ACCEPTED
              : light === "red"
                ? PRACTICE_VOICE_CHALLENGE_REJECTED
                : PRACTICE_VOICE_CHALLENGE_UNCHECKED}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-practice-voice-check=""
            onClick={checkReading}
            className="inline-flex bg-white px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-950 transition hover:bg-neutral-200"
          >
            {framing === "rest" ? PRACTICE_VOICE_CHALLENGE_CHECK_REST : PRACTICE_VOICE_CHALLENGE_CHECK}
          </button>
          <button
            type="button"
            data-practice-voice-retry=""
            onClick={retry}
            className="inline-flex border border-white/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-300 transition hover:border-white/40 hover:text-white"
          >
            {PRACTICE_VOICE_CHALLENGE_RETRY}
          </button>
          {devBuild && localSkip ? (
            <button
              type="button"
              data-practice-voice-local-skip=""
              onClick={skipLocally}
              className="inline-flex border border-white/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-300 transition hover:border-white/40 hover:text-white"
            >
              {PRACTICE_VOICE_CHALLENGE_LOCAL_SKIP}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
