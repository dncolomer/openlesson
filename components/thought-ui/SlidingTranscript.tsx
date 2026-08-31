"use client";

import { useEffect, useRef, useState } from "react";

interface SlidingTranscriptProps {
  text: string;
  className?: string;
}

/** Live speech line: newest text stays in view; earlier words scroll off to the left. */
export function SlidingTranscript({ text, className = "" }: SlidingTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTextRef = useRef("");
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      if (text !== prevTextRef.current) {
        el.scrollLeft = el.scrollWidth;
        prevTextRef.current = text;
      }
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className={`relative min-w-0 overflow-hidden ${className}`}>
      <div
        ref={scrollRef}
        className="scrollbar-hide min-w-0 overflow-x-auto overflow-y-hidden"
      >
        <span className="inline-block whitespace-nowrap text-left">{text || "\u00a0"}</span>
      </div>
      {overflowing ? (
        <div
          data-ile-transcript-fade
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-black via-black/55 to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  );
}