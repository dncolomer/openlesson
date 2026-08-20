/**
 * Science-page copy: Free Energy Principle as influence on the
 * learning-as-reducing-uncertainty POV (and the Uncertain Systems name).
 * Structured so tests assert terms against shipped strings (not re-implemented prose).
 */

/** Terms that must appear in the shipped science FEP copy. */
export const SCIENCE_FEP_TERMS = [
  "Free Energy Principle",
  "reducing uncertainty",
  "Uncertain Systems",
  "surprise",
  "prediction error",
  "variational free energy",
] as const;

export const SCIENCE_FEP_COPY = {
  eyebrow: "INFLUENCE",
  title: "Learning is reducing uncertainty.",
  influence:
    "Our point of view on learning is heavily influenced by the Free Energy Principle. Adaptive systems that persist act as if they minimize surprise: variational free energy is an upper bound on surprise, and prediction error is the signal that drives belief updates and action. Learning, in that picture, is reducing uncertainty about the hidden causes of what you encounter.",
  name:
    "That is why the platform is named Uncertain Systems: we treat learning as reducing uncertainty about a useful knowledge configuration, not as accumulating test scores.",
  caveat:
    "The Free Energy Principle is an influence on this point of view. We do not claim that Uncertain Systems is Friston's full formal theory, and we do not claim completed FEP empirical results.",
} as const;

/** Flatten all visitor-facing strings for term search / tests. */
export function getScienceFepFullText(
  copy: typeof SCIENCE_FEP_COPY = SCIENCE_FEP_COPY,
): string {
  return [copy.eyebrow, copy.title, copy.influence, copy.name, copy.caveat].join("\n");
}
