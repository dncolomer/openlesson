"use client";

import { useMemo, useState } from "react";

const TUTOR_BACKGROUNDS = [
  "/tutor-backgrounds/HF0aS-wWQAAv3Jj.jpeg",
  "/tutor-backgrounds/HF4WSpPWIAAe0iD.jpeg",
  "/tutor-backgrounds/HF9M6VnbcAA4U-h.jpeg",
  "/tutor-backgrounds/HF-EhUVWEAA5if8.jpeg",
  "/tutor-backgrounds/HFqZHfCWMAAnAAA.jpeg",
  "/tutor-backgrounds/HFvJQ7Ta8AArf5R.jpeg",
  "/tutor-backgrounds/HFvnuvVbQAA2SDn.jpeg",
  "/tutor-backgrounds/HGbluisWAAAJ0Ph.jpeg",
  "/tutor-backgrounds/HGCA0zubAAEX0no.jpeg",
  "/tutor-backgrounds/HGDMJJrW4AA7PJn.jpeg",
  "/tutor-backgrounds/HGEyY6eXYAEG6n5.jpeg",
  "/tutor-backgrounds/HGG93FKWcAA3LgA.jpeg",
  "/tutor-backgrounds/HGGzQt4XwAAyUsf.jpeg",
  "/tutor-backgrounds/HGHQJOtWgAAOGtm.jpeg",
  "/tutor-backgrounds/HGKAWi6WgAAV7wr.jpeg",
];

/** Pick a random image, optionally avoiding one path so successive
 *  picks don't accidentally repeat. */
function pickRandom(exclude?: string | null): string {
  const pool =
    exclude != null
      ? TUTOR_BACKGROUNDS.filter((p) => p !== exclude)
      : TUTOR_BACKGROUNDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface TutorBackgroundProps {
  /**
   * Reserved for future transition effects tied to speech detection.
   * Currently unused — present so callers don't need to change if/
   * when we reintroduce an animated speech variant.
   */
  isSpeaking?: boolean;
  /**
   * Current session-plan step index.  When this value changes (step
   * advanced / skipped / rolled back) a new random background image
   * is picked so the visual scene subtly refreshes alongside the
   * user's progress through the plan.  The initial value is only
   * used to seed the "previous step" comparator — we never reroll on
   * the very first render.
   */
  stepIndex?: number;
}

/**
 * Random faint, heavily-blurred background photograph behind the
 * tutor panel ("frosted glass" look).  The image is stable for the
 * whole session unless the current plan step changes (advance /
 * skip / rollback) — in which case a new random image is picked
 * synchronously so there's no one-frame flash.
 */
export function TutorBackground({
  stepIndex,
}: TutorBackgroundProps = {}) {
  // Stable initial pick.  useMemo guarantees it's computed exactly
  // once for this component instance.
  const initial = useMemo(() => pickRandom(), []);

  // Source + "last-seen step" kept together in a single state so
  // updating them during render is atomic.  React's "derive state
  // from props during render" idiom: if the observed stepIndex
  // differs from what we rendered last time, we setState from inside
  // render — React will re-render immediately before committing.
  const [state, setState] = useState<{
    src: string;
    lastStep: number | undefined;
  }>({ src: initial, lastStep: stepIndex });

  if (state.lastStep !== stepIndex) {
    // Only reroll on actual step *transitions* — not on undefined →
    // number (plan loaded in after mount) or number → undefined
    // (plan cleared).  Those boundaries aren't meaningful navigation
    // events for the user.
    const isRealTransition =
      state.lastStep !== undefined && stepIndex !== undefined;
    setState({
      src: isRealTransition ? pickRandom(state.src) : state.src,
      lastStep: stepIndex,
    });
  }

  return (
    <div className="tutor-bg" aria-hidden="true">
      <img
        src={state.src}
        alt=""
        // Eager decode — decorative, shouldn't lazy-load since it's
        // immediately visible.
        decoding="async"
        className="tutor-bg-img"
      />
    </div>
  );
}
