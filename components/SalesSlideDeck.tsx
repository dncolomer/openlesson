"use client";

import { useCallback, useEffect, useState } from "react";
import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";

type SalesSlideDeckProps = {
  deck: SolutionSlideDeck;
};

function SlideContent({ slide }: { slide: SalesSlide }) {
  if (slide.layout === "title") {
    return (
      <div className="flex h-full flex-col justify-center">
        {slide.kicker && (
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">{slide.kicker}</p>
        )}
        <h1 className="max-w-5xl text-5xl font-semibold leading-[1.08] tracking-tight text-white md:text-6xl lg:text-7xl">
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-neutral-300 md:text-2xl">{slide.subtitle}</p>
        )}
      </div>
    );
  }

  if (slide.layout === "statement") {
    return (
      <div className="flex h-full flex-col justify-center">
        {slide.kicker && (
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">{slide.kicker}</p>
        )}
        <h2 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="mt-6 max-w-4xl text-lg leading-relaxed text-neutral-300 md:text-xl">{slide.subtitle}</p>
        )}
        {slide.bullets && (
          <ul className="mt-10 max-w-4xl space-y-4">
            {slide.bullets.map((item) => (
              <li key={item} className="flex gap-4 text-lg leading-relaxed text-neutral-200 md:text-xl">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (slide.layout === "bullets") {
    return (
      <div className="flex h-full flex-col justify-center">
        {slide.kicker && (
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">{slide.kicker}</p>
        )}
        <h2 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          {slide.title}
        </h2>
        {slide.bullets && (
          <ul className="mt-10 max-w-4xl space-y-5">
            {slide.bullets.map((item) => (
              <li key={item} className="flex gap-4 text-xl leading-relaxed text-neutral-100 md:text-2xl">
                <span className="mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full bg-white/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (slide.layout === "split") {
    return (
      <div className="flex h-full flex-col justify-center">
        {slide.kicker && (
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">{slide.kicker}</p>
        )}
        <h2 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
          {slide.title}
        </h2>
        <div className="mt-10 grid max-w-6xl gap-8 md:grid-cols-2 md:gap-12">
          {[slide.left, slide.right].map(
            (column) =>
              column && (
                <div
                  key={column.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8"
                >
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    {column.label}
                  </p>
                  <ul className="space-y-4">
                    {column.items.map((item) => (
                      <li key={item} className="flex gap-3 text-base leading-relaxed text-neutral-200 md:text-lg">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center">
      {slide.kicker && (
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">{slide.kicker}</p>
      )}
      <h2 className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
        {slide.title}
      </h2>
      {slide.bullets && (
        <ul className="mt-10 max-w-4xl space-y-5">
          {slide.bullets.map((item, bulletIndex) => (
            <li key={item} className="flex gap-4 text-xl leading-relaxed text-neutral-100 md:text-2xl">
              <span className="font-mono text-sm text-emerald-400/80">{bulletIndex + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {slide.footnote && (
        <p className="mt-12 max-w-3xl border-t border-white/10 pt-6 text-base leading-relaxed text-neutral-400">
          {slide.footnote}
        </p>
      )}
    </div>
  );
}

export function SalesSlideDeck({ deck }: SalesSlideDeckProps) {
  const [index, setIndex] = useState(0);
  const total = deck.slides.length;
  const slide = deck.slides[index];
  const progress = ((index + 1) / total) * 100;

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => Math.min(total - 1, Math.max(0, current + delta)));
    },
    [total],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        setIndex(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setIndex(total - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, total]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#070707] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,255,255,0.04), transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="text-sm font-medium tracking-wide text-neutral-400">
          open<span className="text-white">Lesson</span>
          <span className="mx-2 text-neutral-600">·</span>
          {deck.label}
        </div>
        <div className="font-mono text-sm tabular-nums text-neutral-500">
          {index + 1} / {total}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-6 pb-24 pt-4 md:px-10 md:pb-28 md:pt-8">
        <div key={index} className="sales-slide-enter flex flex-1">
          <SlideContent slide={slide} />
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-6 md:px-10">
        <div className="mb-4 h-0.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500/80 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-neutral-600">Confidential · For live presentation</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-white/25 hover:text-white disabled:opacity-30"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === total - 1}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-white/25 hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-neutral-700 md:text-left">
          Arrow keys · Space · Page Up/Down · Home/End
        </p>
      </footer>

    </div>
  );
}