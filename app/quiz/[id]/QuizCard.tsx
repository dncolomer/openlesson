"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "@excalidraw/excalidraw/index.css";
import type { QuizQuestion } from "../quiz-data";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-neutral-950 text-sm text-neutral-500">
        Loading canvas...
      </div>
    ),
  },
);

type QuizView = "helios" | "chat" | "canvas";
type QuizAspect = "9:16" | "3:2" | "16:9" | "1:1";

const quizViews: Array<{ id: QuizView; label: string }> = [
  { id: "helios", label: "Helios" },
  { id: "chat", label: "Chat" },
  { id: "canvas", label: "Excalidraw" },
];

const aspectOptions: Array<{ id: QuizAspect; label: string }> = [
  { id: "9:16", label: "9:16" },
  { id: "3:2", label: "3:2" },
  { id: "16:9", label: "16:9" },
  { id: "1:1", label: "1:1" },
];

const aspectClasses: Record<QuizAspect, string> = {
  "9:16": "aspect-[9/16] w-full max-w-[484px]",
  "3:2": "aspect-[3/2] w-full max-w-5xl",
  "16:9": "aspect-video w-full max-w-6xl",
  "1:1": "aspect-square w-full max-w-[860px]",
};

const controlWidthClasses: Record<QuizAspect, string> = {
  "9:16": "w-full max-w-[484px]",
  "3:2": "w-full max-w-5xl",
  "16:9": "w-full max-w-6xl",
  "1:1": "w-full max-w-[860px]",
};

const QUIZ_QUESTION_COUNT = 100;

const studentAttemptFrames = [
  (choice: string, topic: string) => `I think it might be "${choice}" because that sounds connected to ${topic}, but I cannot fully justify it yet.`,
  (choice: string) => `My first instinct is "${choice}". I am picking it because it feels like the most familiar phrase, not because I can prove it.`,
  (choice: string) => `I am leaning toward "${choice}", but I might be matching keywords instead of answering the question.`,
  (choice: string, topic: string) => `Maybe it is "${choice}". In ${topic}, that seems relevant, but I am not sure it explains the situation.`,
  (choice: string) => `I would probably click "${choice}" right now, though I cannot say exactly why the other answers fail.`,
  (choice: string) => `"${choice}" is tempting. I need help checking whether it actually answers the wording of the prompt.`,
];

const tutorOpeningFrames = [
  (questionText: string) => `Let's use the wording as evidence. The question says: "${questionText}". What has to be explained, not merely named?`,
  (questionText: string) => `Before choosing, restate this in plain language: "${questionText}". What would a good answer need to account for?`,
  (questionText: string) => `Slow down on the verb in the prompt: "${questionText}". Is it asking for a cause, a definition, a distinction, or a consequence?`,
  (questionText: string) => `Read the prompt like a test of reasoning, not memory: "${questionText}". What claim would make the whole sentence make sense?`,
  (questionText: string) => `Treat the question as a small argument: "${questionText}". Which missing idea would complete that argument?`,
  (questionText: string) => `Look at the exact situation being described: "${questionText}". Which answer would still fit if the topic label disappeared?`,
];

const tutorFollowupFrames = [
  (studentChoice: string, otherChoice: string) => `Good hesitation. Compare "${studentChoice}" with "${otherChoice}". Which one explains the prompt itself, and which one is only nearby vocabulary?`,
  (studentChoice: string, otherChoice: string) => `Test your pick against a rival: if "${otherChoice}" were true, would it explain the prompt better than "${studentChoice}"?`,
  (studentChoice: string, otherChoice: string) => `Now make the wrong answer work. What would the prompt need to ask for "${studentChoice}" to be right instead of "${otherChoice}"?`,
  (studentChoice: string, otherChoice: string) => `Ask one concrete question: does "${studentChoice}" describe the mechanism in the prompt, or does "${otherChoice}" do that more directly?`,
  (studentChoice: string, otherChoice: string) => `Do not eliminate by vibes. Put "${studentChoice}" and "${otherChoice}" into the sentence and see which creates a coherent explanation.`,
  (studentChoice: string, otherChoice: string) => `Your pick may be plausible. The next move is to say why "${studentChoice}" beats "${otherChoice}" on the exact wording, not on topic familiarity.`,
];

interface QuizCardProps {
  question: QuizQuestion;
  backgroundImage: string | null;
}

export function QuizCard({ question, backgroundImage }: QuizCardProps) {
  const [activeView, setActiveView] = useState<QuizView>("helios");
  const [aspect, setAspect] = useState<QuizAspect>("9:16");
  const [selected, setSelected] = useState<number | null>(null);
  const [typedText, setTypedText] = useState("");
  const answered = selected !== null;
  const correct = selected === question.answerIndex;
  const compactQuiz = aspect === "3:2" || aspect === "16:9";
  const orderedOptions = question.options.map((option, originalIndex) => ({ option, originalIndex }));
  const optionRotation = question.id % orderedOptions.length;
  const displayOptions = [
    ...orderedOptions.slice(optionRotation),
    ...orderedOptions.slice(0, optionRotation),
  ];
  const studentOption = displayOptions.find(({ originalIndex }) => originalIndex !== question.answerIndex) ?? displayOptions[1];
  const comparisonOption = displayOptions.find(
    ({ originalIndex, option }) => originalIndex !== studentOption.originalIndex && option !== studentOption.option,
  ) ?? displayOptions[0];
  const frameIndex = (question.id - 1) % studentAttemptFrames.length;
  const tutorOpening = tutorOpeningFrames[frameIndex](question.question);
  const studentAttempt = studentAttemptFrames[frameIndex](studentOption.option, question.topic);
  const tutorFollowup = tutorFollowupFrames[frameIndex](studentOption.option, comparisonOption.option);
  const animatedMessage = tutorFollowup;

  useEffect(() => {
    if (activeView !== "chat") {
      setTypedText("");
      return;
    }

    setTypedText("");
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedText(animatedMessage.slice(0, index));
      if (index >= animatedMessage.length) window.clearInterval(interval);
    }, 70);

    return () => window.clearInterval(interval);
  }, [activeView, animatedMessage]);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className={`relative overflow-hidden rounded-[3px] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/70 ${aspectClasses[aspect]}`}>
        {backgroundImage && (
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-neutral-950/72 backdrop-blur-[3px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(239,68,68,0.16),transparent_24%),linear-gradient(to_bottom,rgba(0,0,0,0.28),rgba(0,0,0,0.08)_36%,rgba(0,0,0,0.55))]" />

        <div className={`absolute inset-0 z-10 flex min-h-0 flex-col ${activeView === "canvas" ? "p-0" : "px-7 py-7 sm:px-10"}`}>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {activeView === "helios" && (
            <div className={compactQuiz ? "grid h-full w-full grid-cols-2 items-center gap-8 text-center" : "flex w-full flex-col items-center justify-center text-center"}>
              <div className="flex w-full min-w-0 flex-col items-center justify-center">
              <p className={`${compactQuiz ? "mb-2" : "mb-5"} font-mono text-[12px] font-semibold uppercase tracking-[0.32em] text-rose-50/90`}>
                {question.chapter}
              </p>

            <div className={`${compactQuiz ? "mb-2" : "mb-4"} flex items-center gap-3`}>
              <Link
                href={`/quiz/${question.id === 1 ? QUIZ_QUESTION_COUNT : question.id - 1}`}
                aria-label="Previous question"
                className="flex size-10 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500/10 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              <div className={`relative flex ${compactQuiz ? "size-20" : "size-28 sm:size-32"} items-center justify-center rounded-full border border-rose-500/85 bg-neutral-950/20 shadow-[0_0_0_4px_rgba(225,29,72,0.18),0_0_44px_rgba(225,29,72,0.2)]`}>
                <div className="absolute inset-1 rounded-full border border-rose-500/55" />
                <span className="font-serif text-4xl text-neutral-100">H</span>
              </div>

              <Link
                href={`/quiz/${question.id === QUIZ_QUESTION_COUNT ? 1 : question.id + 1}`}
                aria-label="Next question"
                className="flex size-10 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500/10 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <div className="mb-3 text-sm font-medium text-neutral-100">Helios Quiz</div>
            <div className={`${compactQuiz ? "mb-4" : "mb-7"} h-1 w-8 rounded-full bg-rose-400`} />

            <div className={`relative w-full ${compactQuiz ? "max-w-[34ch]" : "max-w-[44ch]"}`}>
              <h1 className="text-balance text-2xl font-normal leading-[1.24] tracking-[-0.05em] text-neutral-100 sm:text-[28px]">
                {question.question}
              </h1>
            </div>
              </div>

              <div className="flex w-full min-w-0 flex-col items-center justify-center">
            <div className={`${compactQuiz ? "mt-0 max-w-sm" : "mt-7 max-w-none"} grid w-full gap-3`}>
              {displayOptions.map(({ option, originalIndex }, index) => {
                const isSelected = selected === originalIndex;
                const isCorrect = question.answerIndex === originalIndex;
                const stateClass = !answered
                  ? "border-white/10 bg-neutral-950/55 text-neutral-200 hover:border-white/25 hover:bg-neutral-900/70"
                  : isCorrect
                    ? "border-emerald-300/60 bg-emerald-400/12 text-emerald-50"
                    : isSelected
                      ? "border-rose-300/60 bg-rose-500/12 text-rose-50"
                      : "border-white/10 bg-neutral-950/35 text-neutral-500";

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelected(originalIndex)}
                    className={`rounded-[3px] border px-4 py-3 text-left text-sm font-medium transition ${stateClass}`}
                  >
                    <span className="mr-3 font-mono text-[11px] text-neutral-500">{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className={`mt-6 w-full ${compactQuiz ? "max-w-sm" : "max-w-none"} rounded-[3px] border p-4 transition ${correct ? "border-emerald-300/35 bg-emerald-400/10" : "border-rose-300/35 bg-rose-500/10"}`}>
                <p className="text-base font-semibold text-white">
                  {correct ? "Correct. That choice preserves the underlying distinction." : "Not quite. Re-test which option explains the mechanism, not just the topic."}
                </p>
                <p className="mt-2 text-sm leading-5 text-neutral-300">{question.explanation}</p>
                <Link
                  href="/register?offer=10-free-lessons"
                  className="mt-4 flex h-12 items-center justify-center rounded-[3px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-neutral-200"
                >
                  Claim 10 free lessons
                </Link>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Social launch offer
                </p>
              </div>
            )}
              </div>
          </div>
          )}

          {activeView === "chat" && (
            <div className="flex h-full w-full flex-col text-left">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex size-12 items-center justify-center rounded-full border border-rose-400/60 bg-rose-500/10 font-serif text-xl text-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.18)]">
                H
              </div>
              <div>
                <p className="text-base font-semibold text-white">Helios Chat</p>
                <p className="text-sm text-neutral-400">Work through the quiz step by step</p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-hidden pt-6">
              <div className="max-w-[88%] rounded-[3px] border border-white/10 bg-neutral-950/75 p-4 text-base leading-7 text-neutral-100 shadow-lg shadow-black/20">
                {tutorOpening}
              </div>
              <div className="ml-auto max-w-[82%] rounded-[3px] bg-white px-4 py-3 text-base leading-7 text-neutral-950 shadow-lg shadow-black/20">
                {studentAttempt}
              </div>
              <div className="max-w-[88%] rounded-[3px] border border-white/10 bg-neutral-950/75 p-4 text-base leading-7 text-neutral-100 shadow-lg shadow-black/20">
                {typedText}
                <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-neutral-200" />
              </div>
            </div>
          </div>
          )}

          {activeView === "canvas" && (
            <div className="h-full w-full overflow-hidden bg-neutral-950/80">
              <Excalidraw theme="dark" />
            </div>
          )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-2 rounded-[3px] border border-white/10 bg-neutral-950/55 p-1.5 backdrop-blur ${controlWidthClasses[aspect]}`}>
          {quizViews.map((view) => {
            const selectedView = activeView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`rounded-[3px] px-2 py-2.5 text-xs font-semibold transition ${selectedView ? "bg-white text-neutral-950" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}
                aria-pressed={selectedView}
              >
                {view.label}
              </button>
            );
          })}
        </div>

      <div className={`grid grid-cols-4 gap-2 rounded-[3px] border border-white/10 bg-neutral-950/55 p-1.5 backdrop-blur ${controlWidthClasses[aspect]}`}>
          {aspectOptions.map((option) => {
            const selectedAspect = aspect === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAspect(option.id)}
                className={`rounded-[3px] px-2 py-2.5 font-mono text-[11px] font-semibold transition ${selectedAspect ? "bg-rose-100 text-neutral-950" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}
                aria-pressed={selectedAspect}
              >
                {option.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
