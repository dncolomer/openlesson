"use client";

import { useEffect, useRef } from "react";

interface SlidingTranscriptProps {
  text: string;
  className?: string;
}

/** Live speech line: newest text stays in view; earlier words scroll off to the left. */
export function SlidingTranscript({ text, className = "" }: SlidingTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTextRef = useRef("");

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (text !== prevTextRef.current) {
      el.scrollLeft = el.scrollWidth;
      prevTextRef.current = text;
    }
  }, [text]);

  return (
    <div
      ref={scrollRef}
      className={`min-w-0 overflow-x-auto overflow-y-hidden scrollbar-none ${className}`}
    >
      <span className="inline-block min-w-full whitespace-nowrap text-left">{text || "\u00a0"}</span>
    </div>
  );
}