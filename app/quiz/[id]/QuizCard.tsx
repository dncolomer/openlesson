"use client";

import { useState } from "react";
import Link from "next/link";
import type { QuizQuestion } from "../quiz-data";

interface QuizCardProps {
  question: QuizQuestion;
}

export function QuizCard({ question }: QuizCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const correct = selected === question.answerIndex;

  return (
    <div className="relative z-10 flex min-h-[min(92vh,860px)] flex-col items-center justify-center px-7 py-8 text-center sm:px-10">
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
  );
}
