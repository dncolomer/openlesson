/**
 * Shared science hypothesis + Proof-of-Work proxy lines for every deck's
 * "Our thesis" slide. Rendered as highlighted callouts, then vertical thesis bullets.
 */

export type ThesisFocus = "platform" | "verification" | "optimization" | "augmentation";

/** Core science line (shared). */
export const THESIS_SCIENCE_HYPOTHESIS =
  "Science hypothesis: learning is movement through knowledge configuration space. Knowledge is proximity to a useful state (retrieve, apply, transform), not a binary flag or completion score.";

/** Core PoW proxy line (platform / default). */
export const THESIS_POW_PROXY_DEFAULT =
  "Proof of Work is the best proxy for that proximity: real artifacts, tool traces, and reasoning under probe measure configuration; quizzes and benchmarks only sample thin output slices.";

/**
 * Vertical-adapted science + PoW highlights for the thesis slide.
 * Science stays shared; PoW proxy is framed for the deck's motion.
 */
export function thesisScienceHighlights(focus: ThesisFocus = "platform"): string[] {
  const powByFocus: Record<ThesisFocus, string> = {
    platform: THESIS_POW_PROXY_DEFAULT,
    verification:
      "Proof of Work is the best proxy for that proximity: verify hire, promote, certify, and deploy from real artifacts, tool traces, and think-aloud under probe. Not polished outputs, self-report, or benchmark pass rates alone.",
    optimization:
      "Proof of Work is the best proxy for that proximity: severity-ranked PoW scores show which configuration gaps block adoption, so optimization practices what actually moves skill rather than checklist completion.",
    augmentation:
      "Proof of Work is the best proxy for that proximity: probes and scored traces interrupt shallow fluency and replace check-your-knowledge quizzes that never measure configuration under real work.",
  };

  return [THESIS_SCIENCE_HYPOTHESIS, powByFocus[focus]];
}

/** Labels paired with thesisScienceHighlights() for UI chrome. */
export const THESIS_HIGHLIGHT_LABELS = ["Science hypothesis", "Proof of Work proxy"] as const;

/** @deprecated Prefer thesisScienceHighlights. Kept for tests that expect two bullet strings. */
export const THESIS_SCIENCE_POW_BULLETS = [
  THESIS_SCIENCE_HYPOTHESIS,
  THESIS_POW_PROXY_DEFAULT,
] as const;

/** Anchors tests and smoke should find on every thesis slide. */
export const THESIS_SCIENCE_POW_ANCHORS = [
  "knowledge configuration",
  "proximity",
  "Proof of Work",
  "proxy",
] as const;

/**
 * Prepend science/PoW snippet bullets to existing thesis bullets without dropping any.
 * Prefer highlights on the slide model for visual emphasis; this remains for merge tests.
 */
export function withThesisScienceBullets(existingBullets: string[] = []): string[] {
  return [...THESIS_SCIENCE_POW_BULLETS, ...existingBullets];
}

/** Merge vertical thesis bullets with focus-adapted science highlights (highlights stay separate). */
export function thesisHighlightsForFocus(focus: ThesisFocus): {
  highlights: string[];
  highlightLabels: readonly string[];
} {
  return {
    highlights: thesisScienceHighlights(focus),
    highlightLabels: THESIS_HIGHLIGHT_LABELS,
  };
}
