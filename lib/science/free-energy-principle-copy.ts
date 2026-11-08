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
  title: "Uncertainty, surprise, and the Free Energy Principle.",
  influence:
    "Our point of view on knowledge building is heavily influenced by the Free Energy Principle. In that theoretical picture, adaptive systems that persist act as if they keep surprise within bounds. Surprise, or surprisal, is how unexpected an outcome is under a model. Variational free energy is a formal modelling quantity: a tractable upper bound on surprise, used in approximate inference. Prediction error is a process-level signal in some accounts of perception and action. Uncertainty is a property of beliefs about hidden states. These quantities are related in the theory. They are not interchangeable names for the same thing.",
  exploration:
    "Useful exploration can reveal unknowns. An informative step can raise the number of open questions even as it improves the model of what was already in view. Learning, in this influence, is work on uncertainty about hidden structure, including the structure of a concept someone is trying to acquire. Variational free energy is not fuel the brain burns, and less effort in our product language is not free-energy minimization or reduced brain metabolism.",
  name:
    "That is why the platform is named Uncertain Systems: we treat knowledge building as reducing uncertainty about a useful knowledge configuration, rather than as accumulating test scores.",
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
