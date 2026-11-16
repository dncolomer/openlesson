/**
 * Science-page copy: Free Energy Principle as influence, told with the
 * pitch-deck scriptures (hidden states, proof of work, next step).
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
  eyebrow: "FREE ENERGY PRINCIPLE",
  title: "The Free Energy Principle.",
  influence:
    "Our point of view is heavily influenced by the Free Energy Principle. Adaptive systems that persist act as if they keep surprise within bounds. Variational free energy is a formal modelling quantity: a tractable upper bound on surprise. Prediction error is a process-level signal in some accounts of perception and action.",
  exploration:
    "We simulate the topic as a generative model of hidden states, and how someone would explore it (active inference, epistemic foraging). Your proof of work is projected onto it as you go: what you say, write, and draw. There is no content feed and no Q&A drill. It shows the next step that most reduces your uncertainty.",
  name:
    "That is why the platform is named Uncertain Systems: knowledge building is reducing uncertainty about hidden structure, rather than accumulating test scores.",
  caveat:
    "The Free Energy Principle is an influence on this point of view. We do not claim that Uncertain Systems is Friston's full formal theory, and we do not claim completed FEP empirical results. The live Unsys model uses these Concepts for Calibrate, Learn, and Verify. It does not compute variational free energy.",
} as const;

/** Flatten all visitor-facing strings for term search / tests. */
export function getScienceFepFullText(
  copy: typeof SCIENCE_FEP_COPY = SCIENCE_FEP_COPY,
): string {
  return [copy.eyebrow, copy.title, copy.influence, copy.exploration, copy.name, copy.caveat].join(
    "\n",
  );
}
