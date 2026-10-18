/**
 * Helios always opens at the abstract layer: what do we want to build
 * in this map? Deterministic copy — no live model call.
 */

export const HELIOS_MAP_OPENING_QUESTION =
  "What do we want to build in this map?";

export const HELIOS_MAP_OPENING_GUIDE_QUESTIONS = [
  "What should someone be able to do after they walk it?",
  "Is it a path, a fork, or open terrain?",
] as const;

export type HeliosMapOpeningExample = {
  id: string;
  label: string;
  prompt: string;
};

/** Topics match shipped featured maps in `lib/marketing/landing-featured-maps.ts`. */
export const HELIOS_MAP_OPENING_EXAMPLES: readonly HeliosMapOpeningExample[] = [
  {
    id: "surface-code-mwpm-neural-decoding",
    label: "Surface-code MWPM vs neural decoding",
    prompt:
      "Build a Learning Map for surface-code MWPM vs neural decoding. Compare minimum-weight perfect matching with learned decoders on rotated surface-code error chains, and decide when a learned decoder beats MWPM on a distance-5 rotated surface code.",
  },
  {
    id: "prime-editing-pegrna",
    label: "CRISPR prime-editing pegRNA design",
    prompt:
      "Build a Learning Map for CRISPR prime-editing pegRNA design. Design pegRNAs for a pathogenic SNP: PBS, RTT, nicking sgRNA, and off-target screens, ending at a pegRNA pair predicted to install one therapeutic SNP with low bystander edits.",
  },
  {
    id: "sae-circuit-discovery",
    label: "Sparse autoencoder circuit discovery",
    prompt:
      "Build a Learning Map for sparse autoencoder circuit discovery. Train an SAE on residual-stream activations and stitch features into a circuit for a behavior, ending at a named sparse feature circuit that is necessary for a chosen IOI-style behavior.",
  },
  {
    id: "stark-fri-proximity",
    label: "STARK FRI proximity proofs",
    prompt:
      "Build a Learning Map for STARK FRI proximity proofs. Build a FRI low-degree test for a STARK: Reed–Solomon code, folding, and query soundness, and set blowup, folding factor, and queries for 100-bit soundness on a small AIR.",
  },
];

export const HELIOS_MAP_OPENING_PLACEHOLDER =
  "Name the map — even if it is still fuzzy";

export function heliosMapOpeningMarkdown(): string {
  const guides = HELIOS_MAP_OPENING_GUIDE_QUESTIONS.map(
    (question) => `- ${question}`,
  ).join("\n");
  return [
    `**${HELIOS_MAP_OPENING_QUESTION}**`,
    "",
    "Stay with the idea before we place blocks.",
    "",
    guides,
  ].join("\n");
}

export function heliosMapOpeningAwarenessText(): string {
  const examples = HELIOS_MAP_OPENING_EXAMPLES.map(
    (example) => `- ${example.label}`,
  ).join("\n");
  return [
    "OPENING",
    `Always start at the abstract layer: ${HELIOS_MAP_OPENING_QUESTION}`,
    "Ask what the map is for before placing blocks. Guiding questions:",
    ...HELIOS_MAP_OPENING_GUIDE_QUESTIONS.map((question) => `- ${question}`),
    "Example topics (the author may pick one):",
    examples,
    "Once the author names a direction or picks a shape, choose a map type and build that topology immediately with tools. Do not spray an unprompted map or a linear row of blocks.",
  ].join("\n");
}
