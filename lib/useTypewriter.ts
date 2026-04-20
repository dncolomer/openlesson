"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Progressive character-by-character reveal of a string.
 *
 * - Returns the currently-visible prefix of `text` plus an `isDone` flag.
 * - When `instant` is true, the full text is returned immediately with
 *   `isDone` true. This is used when revisiting already-seen content so
 *   the animation plays only the first time.
 * - Calling `skip()` completes the animation early.
 *
 * The animation resets whenever `text` changes.
 */
export function useTypewriter(
  text: string,
  options?: {
    speedMs?: number;
    instant?: boolean;
    enabled?: boolean;
    onDone?: () => void;
  },
) {
  const { speedMs = 25, instant = false, enabled = true, onDone } = options ?? {};
  const [index, setIndex] = useState(() => (instant ? text.length : 0));
  const onDoneRef = useRef(onDone);

  // Keep latest onDone in a ref so we don't need to restart the interval
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Reset whenever the text changes
    if (instant || !enabled) {
      setIndex(text.length);
      // Fire onDone asynchronously when we skip the animation
      if (text.length > 0) {
        const id = window.setTimeout(() => onDoneRef.current?.(), 0);
        return () => window.clearTimeout(id);
      }
      return;
    }

    setIndex(0);
    if (!text) return;

    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setIndex(i);
      if (i >= text.length) {
        window.clearInterval(interval);
        onDoneRef.current?.();
      }
    }, speedMs);

    return () => window.clearInterval(interval);
  }, [text, speedMs, instant, enabled]);

  const displayed = text.slice(0, index);
  const isDone = index >= text.length;

  const skip = () => {
    setIndex(text.length);
    if (text.length > 0) onDoneRef.current?.();
  };

  return { displayed, isDone, skip };
}
