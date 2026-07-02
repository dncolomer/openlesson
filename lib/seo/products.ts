export type ProductAudience = "human" | "agent" | "both";
export type ProductStatus = "available" | "upcoming";

export type ProductDefinition = {
  id: string;
  eyebrow: string;
  title: string;
  audience: ProductAudience;
  status?: ProductStatus;
  summary: string;
  bullets: string[];
  href?: string;
  ctaLabel?: string;
};

export const WORKSPACE_FOUNDATION = {
  eyebrow: "Foundation",
  title: "Verification Workspaces",
  summary:
    "Every product runs on Verification Workspaces: structured environments you create and enrich programmatically with documents, screen recordings, video assets, EEG traces, tool traces, and other evidence from humans or agents.",
  bullets: [
    "Define skills, scenarios, and decision domains as assessable blocks",
    "Ingest unstructured evidence via API or manual upload",
    "Continuously enrich context as new artifacts and signals arrive",
  ],
};

export const PRODUCTS: ProductDefinition[] = [
  {
    id: "verification-api",
    eyebrow: "Learning Verification",
    title: "Evidence API",
    audience: "both",
    summary:
      "Headless verification for humans and agents. Send unstructured artifacts, tool traces, transcripts, documents, screen captures, and receive continuous readiness scores with gap analysis. Beyond benchmarks for AI; beyond quizzes for people.",
    bullets: [
      "Agentic: verify skills and tool use before production deployment",
      "Human: confirm learners actually absorbed how to use a tool or workflow",
      "Integrate into LMS, HRIS, CI gates, or any agentic pipeline",
    ],
    href: "/docs/agentic-v2",
    ctaLabel: "API docs",
  },
  {
    id: "think-aloud-verification",
    eyebrow: "Human Learning Verification",
    title: "Think Aloud Protocol",
    audience: "human",
    summary:
      "Hosted verification for live human cognition. Issue shareable URLs so people verbalize reasoning under probe: the signal hidden AI overlays cannot fabricate.",
    bullets: [
      "Issue private TAP links scoped to blocks or workspaces",
      "Capture speech, hesitations, and causal chains in real time",
      "Score cognitive markers and return auditable gap reports",
    ],
    href: "/workspace/new",
    ctaLabel: "Create a workspace",
  },
  {
    id: "ile",
    eyebrow: "Human Learning",
    title: "Integrated Learning Environment",
    audience: "human",
    summary:
      "Where humans improve. The ILE turns gap findings into guided practice, think-aloud sessions, Socratic probes, and targeted blocks until scores move.",
    bullets: [
      "Practice real scenarios with live reasoning capture",
      "Close specific gaps surfaced by verification products",
      "Track score improvement with evidence along the way",
    ],
    href: "/workspace/new",
    ctaLabel: "Start practicing",
  },
  {
    id: "ale",
    eyebrow: "Agent Learning",
    title: "Agentic Learning Environment",
    audience: "agent",
    status: "upcoming",
    summary:
      "Where skill developers test and evolve agent skills. Run agents against workspace scenarios, inspect tool-use traces, and iterate on skill definitions until Evidence API scores clear your deploy bar.",
    bullets: [
      "Sandbox agent runs against real workspace blocks and scenarios",
      "Compare skill versions with shared scoring and gap analysis",
      "Close the loop from verification gaps to skill refinement",
    ],
  },
];

export const AUDIENCE_LABELS: Record<ProductAudience, string> = {
  human: "Humans",
  agent: "Agents",
  both: "Humans & Agents",
};