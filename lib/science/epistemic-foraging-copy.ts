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
    "Epistemic foraging is an active search for information to reduce uncertainty about an environment, rather than immediately chasing rewards. In Karl Friston's active-inference account, actions carry epistemic value: the expected information that would shrink uncertainty about hidden states.",
  platform:
    "That policy is how we think about the understanding gap. If the bottleneck is inspection, questioning, and use, then the useful next step is often the one that exposes what is still unheld, rather than immediately chasing rewards. On Uncertain Systems, Think Aloud Protocol probes, interruptions, and Proof of Work traces are the current forage: they search for signal in observable work. The Unsys model is the generative model that forage is scored against.",
  caveat:
    "Epistemic foraging is an influence on this point of view. We do not claim that Uncertain Systems is Friston's full formal theory, and we do not claim completed active-inference empirical results.",
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

/** Friston / active-inference papers. Combined with SCIENCE_CONTEXT_READINGS on /science. */
export const SCIENCE_EPISTEMIC_FORAGING_READINGS: readonly ScienceReading[] = [
  {
    id: "friston-epistemic-value-2015",
    authors: "Friston, K., Rigoli, F., Ognibene, D., Mathys, C., Fitzgerald, T., & Pezzulo, G.",
    year: "2015",
    title: "Active inference and epistemic value",
    venue: "Cognitive Neuroscience, 6(4), 187–214",
    href: "https://doi.org/10.1080/17588928.2015.1020053",
    why: "Definitional paper: epistemic versus pragmatic value of action. Forage for information, rather than immediately chase rewards.",
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

/** Dresler, Cinel, Licklider: context for enhancement and symbiosis sections. */
export const SCIENCE_CONTEXT_READINGS: readonly ScienceReading[] = [
  {
    id: "dresler-hacking-the-brain-2019",
    authors:
      "Dresler, M., Sandberg, A., Bublitz, C., Ohla, K., Trenado, C., Mroczko-Wąsowicz, A., Kühn, S., & Repantis, D.",
    year: "2019",
    title: "Hacking the Brain: Dimensions of Cognitive Enhancement",
    venue: "ACS Chemical Neuroscience, 10(3), 1137–1148",
    href: "https://doi.org/10.1021/acschemneuro.8b00571",
    why: "Mode-of-action taxonomy (biochemical, physical, and behavioral) and further dimensions: domain, person, time scale, side effects, availability, and social acceptance.",
  },
  {
    id: "cinel-neurotechnologies-2019",
    authors: "Cinel, C., Valeriani, D., & Poli, R.",
    year: "2019",
    title:
      "Neurotechnologies for Human Cognitive Augmentation: Current State of the Art and Future Prospects",
    venue: "Frontiers in Human Neuroscience, 13:13",
    href: "https://doi.org/10.3389/fnhum.2019.00013",
    why: "Recording versus influencing brain activity, invasive and non-invasive methods, and a 2019 forecast. Vocabulary and context, not a current product-readiness assessment.",
  },
  {
    id: "licklider-symbiosis-1960",
    authors: "Licklider, J. C. R.",
    year: "1960",
    title: "Man-Computer Symbiosis",
    venue: "IRE Transactions on Human Factors in Electronics, HFE-1, 4–11",
    href: "https://groups.csail.mit.edu/medg/people/psz/Licklider.html",
    why: "Historical frame for people and computers adapting together in formulative thinking. An influence on the symbiotic vocabulary, not evidence of measured co-adaptation today.",
  },
] as const;

/** Full annotated list rendered once at the end of /science. */
export const SCIENCE_PAGE_READINGS: readonly ScienceReading[] = [
  ...SCIENCE_CONTEXT_READINGS,
  ...SCIENCE_EPISTEMIC_FORAGING_READINGS,
];

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
