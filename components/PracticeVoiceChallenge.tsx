"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { IleInsightTrophyIcon } from "@/components/session-view/ile-insight-trophies";
import {
  ILE_SAMPLE_INSIGHT_LABEL,
  PRACTICE_VOICE_CHALLENGE_READ_CUE,
  PRACTICE_VOICE_CHALLENGE_READ_CUE_REST,
  PRACTICE_VOICE_CHALLENGE_READ_NOTE,
  PRACTICE_VOICE_CHALLENGE_RETRY,
  VOICE_CHALLENGE_START_DELAY_MS,
  latchVoiceChallengePass,
  mergeVoiceChallengeHeard,
  retryVoiceChallenge,
  voiceChallengeFillRatio,
  voiceChallengeReadMarks,
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
 * The learner reads the script aloud. Words fill in as they are heard.
 * A click does not pass, and nothing is read to them.
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
  /** ILE adds a sample card. Prepare and Drill add a second sentence about that flow. */
  variant?: VoiceChallengeVariant;
  /** BCP-47 tag. The rest screen must match the session recognizer it just released. */
  lang?: string | null;
}) {
  const onPassRef = useRef(onPass);
  onPassRef.current = onPass;
  const [transcript, setTranscript] = useState("");
  const [listenAttempt, setListenAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const committedRef = useRef("");
  const latestRef = useRef("");
  const passedRef = useRef(false);
  const script = voiceChallengeScriptFor(variant);
  const marks = voiceChallengeReadMarks({ script, transcript });
  const sentences = joinOpeningSentences(splitMarksAtSentences(marks));
  const fill = voiceChallengeFillRatio(marks);
  const cue =
    framing === "rest"
      ? PRACTICE_VOICE_CHALLENGE_READ_CUE_REST
      : PRACTICE_VOICE_CHALLENGE_READ_CUE;

  useEffect(() => {
    const Ctor = speechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
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
      const decision = latchVoiceChallengePass({
        alreadyPassed: passedRef.current,
        transcript: heard,
        variant,
      });
      passedRef.current = decision.passed;
      if (!decision.shouldStart) return;
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      setStarting(true);
      window.setTimeout(() => onPassRef.current(), VOICE_CHALLENGE_START_DELAY_MS);
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
      kickoffTimers.forEach((id) => window.clearTimeout(id));
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [lang, listenAttempt, variant]);

  function retry() {
    const decision = retryVoiceChallenge({ alreadyPassed: passedRef.current });
    if (!decision.reset || decision.shouldStart) return;
    committedRef.current = "";
    latestRef.current = "";
    setTranscript("");
    setListenAttempt((attempt) => attempt + 1);
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
                    data-heard={mark.heard ? "true" : "false"}
                    className={
                      mark.heard
                        ? "text-white transition-colors duration-300"
                        : "text-neutral-600 transition-colors duration-300"
                    }
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
              className="flex items-start gap-3 border border-amber-200/80 bg-amber-300 px-3 py-3 text-neutral-950"
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
        <div
          data-practice-voice-track=""
          className="mt-6 h-px w-full bg-neutral-800"
          aria-hidden
        >
          <div
            data-practice-voice-fill=""
            className="h-px bg-white transition-[width] duration-300"
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </div>
        <button
          type="button"
          data-practice-voice-retry=""
          onClick={retry}
          className="mt-5 inline-flex border border-white/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-300 transition hover:border-white/40 hover:text-white"
        >
          {PRACTICE_VOICE_CHALLENGE_RETRY}
        </button>
      </div>
    </section>
  );
}
