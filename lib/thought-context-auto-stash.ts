/**
 * Forming-thought context capacity: progress bar + auto-stash at full.
 * Distinct from silence auto-stash — context full does NOT degrade purity.
 */

/**
 * Max characters of live unstashed thought before auto-stash.
 * 400 = two-thirds of the prior 600 capacity (fills ≥⅓ faster).
 */
export const THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS = 400;

export const AUTO_STASH_CONTEXT_LABEL = "Auto-stash context";

export type ThoughtContextBarTone = "green" | "yellow" | "red";

export function thoughtContextCharCount(text: string | null | undefined): number {
  if (typeof text !== "string") return 0;
  return text.length;
}

/** Fill ratio in [0, 1] for the progress bar. */
export function thoughtContextFillRatio(
  text: string | null | undefined,
  maxChars: number = THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
): number {
  if (!(maxChars > 0)) return 0;
  const n = thoughtContextCharCount(text);
  return Math.max(0, Math.min(1, n / maxChars));
}

/**
 * Color band: green &lt; 50%, yellow ≥ 50%, red ≥ 75%.
 * Full (100%) is still "red" for fill color; blink is a separate UI flag.
 */
export function thoughtContextBarTone(ratio: number): ThoughtContextBarTone {
  if (ratio >= 0.75) return "red";
  if (ratio >= 0.5) return "yellow";
  return "green";
}

/** Auto-stash when fill reaches capacity (ratio ≥ 1). */
export function shouldAutoStashOnContextFull(ratio: number): boolean {
  return Number.isFinite(ratio) && ratio >= 1;
}

/**
 * Context-capacity auto-stash never degrades session purity.
 * Silence-driven auto-stash remains the purity path.
 */
export function contextAutoStashAffectsPurity(): boolean {
  return false;
}

export function thoughtContextBarToneClass(tone: ThoughtContextBarTone): string {
  switch (tone) {
    case "yellow":
      return "bg-amber-400";
    case "red":
      return "bg-red-500";
    default:
      return "bg-emerald-400";
  }
}
