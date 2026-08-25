"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";

type Shot = (typeof HARNESS_PRODUCT_COPY.screenshots)[number];

export function HarnessScreenshotCarousel({
  screenshots,
}: {
  screenshots: readonly Shot[];
}) {
  const [index, setIndex] = useState(0);
  const count = screenshots.length;
  const shot = screenshots[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!shot) return null;

  return (
    <figure
      className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
      data-harness-screenshot-carousel
      role="region"
      aria-roledescription="carousel"
      aria-label="Learning Harness screenshots"
    >
      <div className="relative aspect-[16/9] w-full">
        {screenshots.map((item, i) => (
          <div
            key={item.src}
            className={`absolute inset-0 transition-opacity duration-300 ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            data-harness-screenshot={item.src}
            aria-hidden={i !== index}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              className="object-cover object-top"
              sizes="(max-width: 1152px) 100vw, 1152px"
              priority={i === 0}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-zinc-700 bg-black/70 text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          aria-label="Previous screenshot"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-zinc-700 bg-black/70 text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          aria-label="Next screenshot"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-zinc-800/90 px-4 py-3 sm:px-5 sm:py-3.5">
        <figcaption className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-500">
            {shot.caption}
          </p>
          <p className="mt-1.5 max-w-5xl text-sm leading-relaxed text-zinc-400">{shot.body}</p>
        </figcaption>
        <div className="flex shrink-0 items-center gap-1.5 pt-1" role="tablist" aria-label="Screenshot slides">
          {screenshots.map((item, i) => (
            <button
              key={item.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show screenshot ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 w-6 transition ${
                i === index ? "bg-white" : "bg-zinc-700 hover:bg-zinc-500"
              }`}
            />
          ))}
        </div>
      </div>
    </figure>
  );
}
