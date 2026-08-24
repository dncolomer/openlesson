/**
 * Science-page copy: epistemic foraging as the policy layer of the
 * learning-as-reducing-uncertainty POV (Friston / active inference).
 * Structured so tests assert terms against shipped strings (not re-implemented prose).
 */

export const SCIENCE_EPISTEMIC_FORAGING_PATH =
  "/science#science-epistemic-foraging" as const;

/** Terms that must appear in the shipped science foraging copy. */
export const SCIENCE_EPISTEMIC_FORAGING_TERMS = [
  "Epistemic foraging",
  "uncertainty",
  "rewards",
  "Friston",
  "Think Aloud Protocol",
  "Proof of Work",
] as const;

export const SCIENCE_EPISTEMIC_FORAGING_COPY = {
  eyebrow: "POLICY",
  title: "Foraging for information, not chasing scores.",
  definition:
    "Epistemic foraging is an active search for information to reduce uncertainty about an environment, rather than immediately chasing rewards. In Karl Friston’s active-inference account, actions carry epistemic value: information that shrinks uncertainty. We treat learning technology as a forage for that information.",
  platform:
    "On Uncertain Systems, Think Aloud Protocol probes, interruptions, knowledge maps, and Proof of Work traces are the forage: they search for signal about what is actually held.",
  caveat:
    "Epistemic foraging is an influence on this point of view. We do not claim that Uncertain Systems is Friston’s full formal theory, and we do not claim completed active-inference empirical results.",
} as const;

export type ScienceReading = {
  id: string;
  authors: string;
  year: string;
  title: string;
  venue: string;
  href: string;
  why: string;
};

/** Canonical further-reading list rendered on /science. */
export const SCIENCE_EPISTEMIC_FORAGING_READINGS: readonly ScienceReading[] = [
  {
    id: "friston-epistemic-value-2015",
    authors: "Friston, K., Rigoli, F., Ognibene, D., Mathys, C., Fitzgerald, T., & Pezzulo, G.",
    year: "2015",
    title: "Active inference and epistemic value",
    venue: "Cognitive Neuroscience, 6(4), 187–214",
    href: "https://doi.org/10.1080/17588928.2015.1020053",
    why: "Definitional paper: epistemic versus pragmatic value of action — forage for information, rather than immediately chase rewards.",
  },
  {
    id: "friston-process-theory-2017",
    authors: "Friston, K., FitzGerald, T., Rigoli, F., Schwartenbeck, P., & Pezzulo, G.",
    year: "2017",
    title: "Active Inference: A Process Theory",
    venue: "Neural Computation, 29(1), 1–49",
    href: "https://doi.org/10.1162/NECO_a_00912",
    why: "Process-level account of policies that minimize expected free energy, including information-seeking.",
  },
  {
    id: "schwartenbeck-exploration-2013",
    authors: "Schwartenbeck, P., FitzGerald, T., Dolan, R. J., & Friston, K.",
    year: "2013",
    title: "Exploration, novelty, surprise, and free energy minimization",
    venue: "Frontiers in Psychology, 4, 710",
    href: "https://doi.org/10.3389/fpsyg.2013.00710",
    why: "How exploration, novelty, and surprise reduce uncertainty under free-energy minimization.",
  },
  {
    id: "parr-pezzulo-friston-2022",
    authors: "Parr, T., Pezzulo, G., & Friston, K. J.",
    year: "2022",
    title: "Active Inference: The Free Energy Principle in Mind, Brain, and Behavior",
    venue: "MIT Press",
    href: "https://doi.org/10.7551/mitpress/12441.001.0001",
    why: "Readable book-length frame for active inference and the Free Energy Principle.",
  },
  {
    id: "friston-fep-2010",
    authors: "Friston, K.",
    year: "2010",
    title: "The free-energy principle: a unified brain theory?",
    venue: "Nature Reviews Neuroscience, 11(2), 127–138",
    href: "https://doi.org/10.1038/nrn2787",
    why: "The Free Energy Principle overview that the adjacent science section already names as an influence.",
  },
] as const;

/** Shared citation used by science white papers that point at the definitional paper. */
export const FRISTON_EPISTEMIC_VALUE_CITATION =
  "Friston, K., Rigoli, F., Ognibene, D., Mathys, C., Fitzgerald, T., & Pezzulo, G. (2015). Active inference and epistemic value. Cognitive Neuroscience, 6(4), 187–214. https://doi.org/10.1080/17588928.2015.1020053";

/** Flatten visitor-facing strings for term search / tests. */
export function getScienceEpistemicForagingFullText(
  copy: typeof SCIENCE_EPISTEMIC_FORAGING_COPY = SCIENCE_EPISTEMIC_FORAGING_COPY,
  readings: readonly ScienceReading[] = SCIENCE_EPISTEMIC_FORAGING_READINGS,
): string {
  const readingText = readings
    .map((r) => [r.authors, r.year, r.title, r.venue, r.why].join(" "))
    .join("\n");
  return [
    copy.eyebrow,
    copy.title,
    copy.definition,
    copy.platform,
    copy.caveat,
    readingText,
  ].join("\n");
}
