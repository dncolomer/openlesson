/**
 * Work-canvas countdown. Pure timer math. Resetting the scene stays in the scene module.
 */
/** Difficulty: Work-canvas countdown before the board resets (insights stay). */
export const ILE_CANVAS_TIMER_SECONDS_MIN = 10 * 60;
export const ILE_CANVAS_TIMER_SECONDS_DEFAULT = 15 * 60;
export const ILE_CANVAS_TIMER_SECONDS_CEILING = 60 * 60;
export const ILE_CANVAS_TIMER_SECONDS_STEP = 60;

export function clampIleCanvasTimerSeconds(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return ILE_CANVAS_TIMER_SECONDS_DEFAULT;
  if (n < ILE_CANVAS_TIMER_SECONDS_MIN) return ILE_CANVAS_TIMER_SECONDS_MIN;
  if (n > ILE_CANVAS_TIMER_SECONDS_CEILING) return ILE_CANVAS_TIMER_SECONDS_CEILING;
  return n;
}

export function ileWorkCanvasTimerRemainingSeconds(input: {
  durationSeconds: unknown;
  startedAtMs: unknown;
  nowMs: unknown;
}): number {
  const duration = clampIleCanvasTimerSeconds(input.durationSeconds);
  const started = Number(input.startedAtMs);
  const now = Number(input.nowMs);
  if (!Number.isFinite(started) || !Number.isFinite(now)) return duration;
  const elapsed = Math.max(0, (now - started) / 1000);
  return Math.max(0, Math.ceil(duration - elapsed));
}

export function ileWorkCanvasTimerExpired(input: {
  durationSeconds: unknown;
  startedAtMs: unknown;
  nowMs: unknown;
}): boolean {
  return ileWorkCanvasTimerRemainingSeconds(input) <= 0;
}

export function formatIleWorkCanvasTimer(remainingSeconds: unknown): string {
  const s = Math.max(0, Math.floor(Number(remainingSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Overlay duration so timer reset is visible before the seed returns. */
export const ILE_CANVAS_TIMER_RESET_LOADING_MS = 700;
