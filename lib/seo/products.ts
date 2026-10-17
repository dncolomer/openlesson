export type ProductStatus = "available" | "upcoming";

export type AudienceProductCopy = {
  summary: string;
  bullets: string[];
  href?: string;
  ctaLabel?: string;
};

export type ProductDefinition = {
  id: string;
  eyebrow: string;
  title: string;
  status?: ProductStatus;
  forHuman?: AudienceProductCopy;
  forAgent?: AudienceProductCopy;
};

export const FEP_FOUNDATION = {
  eyebrow: "Core layer",
  title: "Free Energy Principle",
  summary:
    "The shared influence behind every product. Learning is reducing uncertainty: the harness forages for information that shrinks what is unknown, rather than waiting for the next chat reply.",
  bullets: [
    "Same epistemic foraging policy across Proof-of-Work API, Stash API, and session (Calibrate, Learn, and Verify)",
    "Grounded in your workflow, skills, and conversion goals",
  ],
};

export const WORKSPACE_FOUNDATION = {
  eyebrow: "Foundation",
  title: "Workspace",
  summary:
    "The container for a learning goal. Set the skill or scenario, add context (docs, recordings, tool traces), and run every product against the same live picture of the work.",
  bullets: [
    "One place for goals, proof of work, and scores",
    "Humans and agents work inside the same workspace",
  ],
};

export const PRODUCTS: ProductDefinition[] = [
  {
    id: "verification-api",
    eyebrow: "API",
    title: "Proof-of-Work API",
    forHuman: {
      summary:
        "Optimize what you teach to convert users. Score proof of work from real workflows and power dynamic, agentic onboarding that closes gaps before drop-off.",
      bullets: [
        "Learning optimization tied to conversion — not completion rates",
        "Fits onboarding, certification, and QA gates",
      ],
    },
    forAgent: {
      summary:
        "Pipe tool traces and run artifacts from agent workflows. Get readiness scores and gap lists before deploy or promotion.",
      bullets: [
        "Scores agent runs from real tool use",
        "Fits CI, eval harnesses, and deploy gates",
      ],
    },
  },
  {
    id: "stash-api",
    eyebrow: "Agentic API · agent Stash",
    title: "Stash API",
    forAgent: {
      summary:
        "Evaluate agents the same way we evaluate humans with session. Buffer proof of work, then Stash (observation) or Submit (action) into the regular PoW stack.",
      bullets: [
        "Same PoW types as Proof-of-Work API — tool, screen, video, EEG",
        "Temporary memory until Stash or Submit; intent is first-class evidence",
      ],
    },
  },
  {
    id: "think-aloud-verification",
    eyebrow: "Live sessions",
    title: "Think Aloud Protocol",
    forHuman: {
      summary:
        "One interface for Calibrate, Learn, and Verify. Capture reasoning while people work — not rehearsed answers or AI-polished output.",
      bullets: [
        "Calibrate, Learn, and Verify on the same session surface",
        "Shareable links per workspace or practice block",
      ],
    },
  },
];

export const HUMAN_COLUMN_PRODUCTS = PRODUCTS.filter((product) => product.forHuman);
export const AGENT_COLUMN_PRODUCTS = PRODUCTS.filter((product) => product.forAgent);
