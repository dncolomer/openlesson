/**
 * TAP-only session purity: silence auto-stash degrades purity;
 * at 0 the session closes and all session PoW is flagged impure in payload/metadata.
 */

/** Silence on a non-empty live transcript before auto-stash. */
export const TAP_SILENCE_AUTO_STASH_MS = 5_000;

/**
 * After entering live, wait this long before purity silence penalties arm.
 * Covers UI mount, mic permission settle, and opening Helios paint — without
 * burning a charge from briefing time that already elapsed on lastSpeechActivity.
 */
export const TAP_PURITY_GRACE_MS = 3_000;

/**
 * While Helios is answering (send in flight / responding), purity silence
 * checks must not run — waiting is not a learner silence failure.
 */
export function shouldEvaluateSessionPurity(options: {
  waitingForHelios: boolean;
}): boolean {
  return !options.waitingForHelios;
}

/**
 * True during the post-live-entry grace window (purity silence not yet armed).
 * `liveEnteredAtMs` is when phase became live; null → still in grace (not armed).
 */
export function isWithinTapPurityGrace(
  liveEnteredAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  graceMs: number = TAP_PURITY_GRACE_MS,
): boolean {
  if (liveEnteredAtMs == null || !Number.isFinite(liveEnteredAtMs)) return true;
  return nowMs - liveEnteredAtMs < graceMs;
}

/** Starting purity; each auto-stash subtracts one. */
export const TAP_SESSION_PURITY_MAX = 3;

export type TapSessionQuality = "pure" | "impure";

/** Linear fade of live transcript opacity over the silence window (min ~8%). */
export function transcriptFadeOpacity(
  silenceMs: number,
  thresholdMs: number = TAP_SILENCE_AUTO_STASH_MS,
): number {
  if (silenceMs <= 0 || thresholdMs <= 0) return 1;
  const progress = Math.min(1, silenceMs / thresholdMs);
  return Math.max(0.08, 1 - progress * 0.92);
}

export function shouldAutoStashOnSilence(
  silenceMs: number,
  hasTranscript: boolean,
  thresholdMs: number = TAP_SILENCE_AUTO_STASH_MS,
): boolean {
  return hasTranscript && silenceMs >= thresholdMs;
}

/**
 * After stash/submit the bar is empty ("Listening…"). Prolonged silence with no
 * new speech still degrades purity (same threshold as auto-stash).
 */
export function shouldPenalizeEmptyBarSilence(
  silenceMs: number,
  hasTranscript: boolean,
  thresholdMs: number = TAP_SILENCE_AUTO_STASH_MS,
): boolean {
  return !hasTranscript && silenceMs >= thresholdMs;
}

/** Fade the live bar (transcript or Listening…) during the silence window. */
export function shouldFadeLiveBar(silenceMs: number): boolean {
  return silenceMs > 0;
}

export function nextSessionPurityAfterAutoStash(current: number): number {
  return Math.max(0, Math.trunc(current) - 1);
}

export function isSessionPurityDepleted(purity: number): boolean {
  return purity <= 0;
}

/** Merge impure quality into any PoW JSON payload or metadata object (no new DB column). */
export function withImpurePoWData<T extends Record<string, unknown>>(
  data: T,
): T & { quality: "impure"; impure: true; session_quality: "impure" } {
  return {
    ...data,
    quality: "impure",
    impure: true,
    session_quality: "impure",
  };
}

export function stampPoWQuality<T extends Record<string, unknown>>(
  data: T,
  quality: TapSessionQuality,
): T | (T & { quality: "impure"; impure: true; session_quality: "impure" }) {
  if (quality !== "impure") return data;
  return withImpurePoWData(data);
}
