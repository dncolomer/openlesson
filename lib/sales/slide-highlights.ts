/**
 * Helpers for thesis-style labeled highlight callouts on pitch slides.
 * Visual chrome is rendered by SalesSlideDeck HighlightCallouts.
 */

export type LabeledHighlights = {
  highlights: string[];
  highlightLabels: string[];
};

/** Build highlights + labels from ordered [label, body] pairs. */
export function labeledHighlights(pairs: ReadonlyArray<readonly [string, string]>): LabeledHighlights {
  return {
    highlightLabels: pairs.map(([label]) => label),
    highlights: pairs.map(([, body]) => body),
  };
}
