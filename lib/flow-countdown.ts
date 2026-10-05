import { DEFAULT_DURATION_MINUTES, DURATIONS } from "@/lib/tap-score-client-helpers";

/** Countdown choices shared by calibration and verification flows. */
export const FLOW_COUNTDOWN_MINUTES: readonly number[] = DURATIONS;

export function flowCountdownMinutes(value: unknown): number {
  const minutes = Math.round(Number(value));
  if ((FLOW_COUNTDOWN_MINUTES as readonly number[]).includes(minutes)) return minutes;
  return DEFAULT_DURATION_MINUTES;
}
