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
        "Send recordings, write-ups, or session artifacts from human workflows. Get readiness scores and a clear gap list before promotion or sign-off.",
      bullets: [
        "Scores live cognition and written proof of work",
        "Fits onboarding, certification, and QA gates",
      ],
      href: "/docs/proof-of-work-api",
      ctaLabel: "API docs",
    },
    forAgent: {
      summary:
        "Pipe tool traces and run artifacts from agent workflows. Get readiness scores and gap lists before deploy or promotion.",
      bullets: [
        "Scores agent runs from real tool use",
        "Fits CI, eval harnesses, and deploy gates",
      ],
      href: "/docs/proof-of-work-api",
      ctaLabel: "API docs",
    },
  },
  {
    id: "think-aloud-verification",
    eyebrow: "Live sessions",
    title: "Think Aloud Protocol",
    forHuman: {
      summary:
        "Send someone a link. They talk through their thinking while they work. You get a scored report on what they actually understand.",
      bullets: [
        "Captures live reasoning, not polished write-ups",
        "Shareable links per workspace or practice block",
      ],
      href: "/workspace/new",
      ctaLabel: "Create a workspace",
    },
  },
  {
    id: "ile",
    eyebrow: "Practice",
    title: "Integrated Learning Environment",
    forHuman: {
      summary:
        "Where people practice after gaps show up. Guided scenarios and coaching until scores improve.",
      bullets: [
        "Practice targets the gaps that were found",
        "Progress tracked in the same workspace",
      ],
      href: "/workspace/new",
      ctaLabel: "Start practicing",
    },
  },
  {
    id: "ale",
    eyebrow: "Skill evolution",
    title: "Agentic Learning Environment",
    status: "upcoming",
    forAgent: {
      summary:
        "Agents are not born with skills. ALE evolves skill.md files as agents learn from real workspace runs, closing gaps until Proof-of-Work API scores say the skill is ready to deploy.",
      bullets: [
        "Skill file evolution driven by proof of work, not one-shot prompt edits",
        "Sandbox practice on real scenarios until the agent earns the skill",
      ],
    },
  },
];

export const HUMAN_COLUMN_PRODUCTS = PRODUCTS.filter((product) => product.forHuman);
export const AGENT_COLUMN_PRODUCTS = PRODUCTS.filter((product) => product.forAgent);