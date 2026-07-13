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

export const TIM_FOUNDATION = {
  eyebrow: "Core layer",
  title: "Trace Interruption Model",
  summary:
    "The shared brain behind every product. It watches how people and agents think during real work, then steps in with a targeted question instead of waiting for the next chat reply.",
  bullets: [
    "Same model across Proof-of-Work API, TAP, ILE, and ALE",
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
      href: "/products/proof-of-work-api",
      ctaLabel: "Learn more",
    },
    forAgent: {
      summary:
        "Pipe tool traces and run artifacts from agent workflows. Get readiness scores and gap lists before deploy or promotion.",
      bullets: [
        "Scores agent runs from real tool use",
        "Fits CI, eval harnesses, and deploy gates",
      ],
      href: "/products/proof-of-work-api",
      ctaLabel: "Learn more",
    },
  },
  {
    id: "think-aloud-verification",
    eyebrow: "Live sessions",
    title: "Think Aloud Protocol",
    forHuman: {
      summary:
        "Hard skill and human verification via live think-aloud sessions. Capture reasoning while people work — not rehearsed answers or AI-polished output.",
      bullets: [
        "Captures live cognition under Socratic probe",
        "Shareable links per workspace or practice block",
      ],
      href: "/products/think-aloud-protocol",
      ctaLabel: "Learn more",
    },
  },
  {
    id: "ile",
    eyebrow: "Practice",
    title: "Integrated Learning Environment",
    forHuman: {
      summary:
        "Drop-in replacement for tests and take-homes when you need complex cognitive analysis — guided practice wired to verified gaps.",
      bullets: [
        "Depth over checkbox completion",
        "Progress tracked in the same workspace",
      ],
      href: "/products/integrated-learning-environment",
      ctaLabel: "Learn more",
    },
  },
  {
    id: "ale",
    eyebrow: "Skill evolution",
    title: "Agentic Learning Environment",
    forAgent: {
      summary:
        "Private environment to train agents and validate skills on sensitive workflows — evolve skill.md files without leaking corporate data to public sandboxes.",
      bullets: [
        "Skill evolution driven by proof of work, not one-shot prompt edits",
        "Validate before deploy inside your data boundary",
      ],
      href: "/products/agentic-learning-environment",
      ctaLabel: "Learn more",
    },
  },
];

export const HUMAN_COLUMN_PRODUCTS = PRODUCTS.filter((product) => product.forHuman);
export const AGENT_COLUMN_PRODUCTS = PRODUCTS.filter((product) => product.forAgent);