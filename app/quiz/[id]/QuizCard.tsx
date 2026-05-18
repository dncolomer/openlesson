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
  "9:16": "min-h-[min(92vh,860px)] w-full max-w-[484px] sm:aspect-[9/16] sm:w-auto sm:max-w-none",
  "3:2": "aspect-[3/2] w-full max-w-5xl",
  "16:9": "aspect-video w-full max-w-6xl",
  "1:1": "aspect-square w-full max-w-[860px]",
};

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
  const animatedMessage = `Notice what the question is really testing: ${question.explanation} Before choosing, say the idea in your own words, then match it to the option that keeps that meaning intact.`;

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
    }, 24);

    return () => window.clearInterval(interval);
  }, [activeView, animatedMessage]);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/70 ${aspectClasses[aspect]}`}>
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-neutral-950/72 backdrop-blur-[3px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(239,68,68,0.16),transparent_24%),linear-gradient(to_bottom,rgba(0,0,0,0.28),rgba(0,0,0,0.08)_36%,rgba(0,0,0,0.55))]" />

      <div className="relative z-10 flex h-full min-h-0 flex-col px-7 py-7 sm:px-10">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
        {activeView === "helios" && (
          <div className="flex w-full flex-col items-center justify-center text-center">
            <p className="mb-5 font-mono text-[12px] font-semibold uppercase tracking-[0.32em] text-rose-50/90">
              {question.chapter}
            </p>

            <div className="mb-4 flex items-center gap-3">
              <Link
                href={`/quiz/${question.id === 1 ? 10 : question.id - 1}`}
                aria-label="Previous question"
                className="flex size-10 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500/10 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              <div className="relative flex size-28 items-center justify-center rounded-full border border-rose-500/85 bg-neutral-950/20 shadow-[0_0_0_4px_rgba(225,29,72,0.18),0_0_44px_rgba(225,29,72,0.2)] sm:size-32">
                <div className="absolute inset-1 rounded-full border border-rose-500/55" />
                <span className="font-serif text-4xl text-neutral-100">H</span>
              </div>

              <Link
                href={`/quiz/${question.id === 10 ? 1 : question.id + 1}`}
                aria-label="Next question"
                className="flex size-10 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500/10 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <div className="mb-3 text-sm font-medium text-neutral-100">Helios Quiz</div>
            <div className="mb-7 h-1 w-8 rounded-full bg-rose-400" />

            <div className="relative max-w-[31ch]">
              <h1 className="text-balance text-2xl font-normal leading-[1.24] tracking-[-0.05em] text-neutral-100 sm:text-[28px]">
                {question.question}
              </h1>
            </div>

            <div className="mt-7 grid w-full max-w-sm gap-3">
              {question.options.map((option, index) => {
                const isSelected = selected === index;
                const isCorrect = question.answerIndex === index;
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
                    onClick={() => setSelected(index)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${stateClass}`}
                  >
                    <span className="mr-3 font-mono text-[11px] text-neutral-500">{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                );
              })}
            </div>

            <div className={`mt-6 w-full max-w-sm rounded-2xl border p-4 transition ${answered ? "opacity-100" : "pointer-events-none opacity-0"} ${correct ? "border-emerald-300/35 bg-emerald-400/10" : "border-rose-300/35 bg-rose-500/10"}`}>
              <p className="text-base font-semibold text-white">
                {correct ? "Correct. You already had the intuition." : "Close. The useful idea is simpler than it looks."}
              </p>
              <p className="mt-2 text-sm leading-5 text-neutral-300">{question.explanation}</p>
              <Link
                href="/register?offer=10-free-lessons"
                className="mt-4 flex h-12 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                Claim 10 free lessons
              </Link>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Social launch offer
              </p>
            </div>
          </div>
        )}

        {activeView === "chat" && (
          <div className="flex h-full w-full flex-col text-left">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex size-11 items-center justify-center rounded-full border border-rose-400/60 bg-rose-500/10 font-serif text-lg text-rose-50">
                H
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Helios Chat</p>
                <p className="text-xs text-neutral-400">A guided thread for {question.topic}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-white/10 bg-neutral-950/65 p-4 text-sm leading-6 text-neutral-200">
                This quiz is about {question.topic}. I will help you reason toward the answer without turning it into a lecture.
              </div>
              <div className="ml-auto max-w-[86%] rounded-2xl rounded-tr-sm bg-white px-4 py-3 text-sm leading-6 text-neutral-950">
                The question asks: "{question.question}" I am not sure which clue matters most.
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-white/10 bg-neutral-950/65 p-4 text-sm leading-6 text-neutral-200">
                First separate the surface story from the principle. Which option names the principle rather than a distracting detail?
              </div>
              <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-rose-300/30 bg-rose-500/10 p-4 text-sm leading-6 text-rose-50 shadow-[0_0_32px_rgba(244,63,94,0.14)]">
                {typedText}
                <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-rose-200" />
              </div>
            </div>
          </div>
        )}

        {activeView === "canvas" && (
          <div className="flex h-full w-full flex-col text-left">
            <div className="border-b border-white/10 pb-4">
              <p className="text-sm font-semibold text-white">Excalidraw Canvas</p>
              <p className="mt-1 text-xs text-neutral-400">Empty workspace for sketching your quiz reasoning.</p>
            </div>
            <div className="mt-5 min-h-[560px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
              <Excalidraw theme="dark" />
            </div>
          </div>
        )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-neutral-950/55 p-1.5 backdrop-blur">
          {quizViews.map((view) => {
            const selectedView = activeView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition ${selectedView ? "bg-white text-neutral-950" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}
                aria-pressed={selectedView}
              >
                {view.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-neutral-950/55 p-1.5 backdrop-blur">
          {aspectOptions.map((option) => {
            const selectedAspect = aspect === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAspect(option.id)}
                className={`rounded-xl px-2 py-2.5 font-mono text-[11px] font-semibold transition ${selectedAspect ? "bg-rose-100 text-neutral-950" : "text-neutral-400 hover:bg-white/10 hover:text-white"}`}
                aria-pressed={selectedAspect}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
