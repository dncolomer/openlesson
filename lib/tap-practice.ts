/**
 * TAP-only practice mode: fixed 1-minute dry run before scored topic pick.
 * Practice still records PoW, flagged as "Practice PoW" in payload/metadata
 * (no new DB column).
 */

export const TAP_PRACTICE_DURATION_MINUTES = 1;
export const TAP_PRACTICE_DURATION_SECONDS = 60;
/** Stable exportable label on practice artifacts. */
export const TAP_PRACTICE_POW_LABEL = "Practice PoW";

export function isTapPracticeRequest(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Scored sessions keep requested minutes; practice is always 1 minute. */
export function resolveTapLiveMinutes(input: {
  practice?: boolean;
  minutes?: number;
  defaultMinutes?: number;
}): number {
  if (input.practice) return TAP_PRACTICE_DURATION_MINUTES;
  const minutes = Number(input.minutes ?? input.defaultMinutes ?? 15);
  if (!Number.isFinite(minutes) || minutes < 1) return 15;
  return Math.trunc(minutes);
}

export function resolveTapLiveDurationSeconds(input: {
  practice?: boolean;
  minutes?: number;
  defaultMinutes?: number;
}): number {
  return resolveTapLiveMinutes(input) * 60;
}

/**
 * Merge Practice PoW flags into any PoW JSON payload or metadata object.
 * Safe to call on already-stamped objects (idempotent).
 */
export function withPracticePoWData<T extends object>(
  data: T,
): T & {
  practice: true;
  practice_pow: true;
  pow_kind: "practice";
  pow_label: typeof TAP_PRACTICE_POW_LABEL;
} {
  return {
    ...data,
    practice: true,
    practice_pow: true,
    pow_kind: "practice",
    pow_label: TAP_PRACTICE_POW_LABEL,
  };
}

export function stampPoWPracticeFlag<T extends object>(
  data: T,
  practice: boolean,
): T | (T & {
  practice: true;
  practice_pow: true;
  pow_kind: "practice";
  pow_label: typeof TAP_PRACTICE_POW_LABEL;
}) {
  if (!practice) return data;
  return withPracticePoWData(data);
}

export function isPracticePoWMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (
    metadata.practice === true ||
    metadata.practice_pow === true ||
    metadata.pow_kind === "practice" ||
    metadata.pow_label === TAP_PRACTICE_POW_LABEL
  );
}
