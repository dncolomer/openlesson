export type ProductDefinition = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  bullets: string[];
  href?: string;
  ctaLabel?: string;
};

export const WORKSPACE_FOUNDATION = {
  eyebrow: "Foundation",
  title: "Performance Workspaces",
  summary:
    "Every product runs on Performance Workspaces—structured environments you create and enrich programmatically with documents, screen recordings, video assets, EEG traces, and other human-generated evidence.",
  bullets: [
    "Define skills, scenarios, and decision domains as assessable blocks",
    "Ingest unstructured evidence via API or manual upload",
    "Continuously enrich context as new artifacts and signals arrive",
  ],
};

export const PRODUCTS: ProductDefinition[] = [
  {
    id: "verification-api",
    eyebrow: "Human Knowledge Verification",
    title: "Evidence API",
    summary:
      "Headless, purely evidence-based verification. Send unstructured artifacts to the API and receive a continuous readiness score with gap analysis—no hosted session required.",
    bullets: [
      "POST documents, transcripts, screen captures, and sensor data",
      "Continuous scoring and analysis as evidence accumulates",
      "Integrate into LMS, HRIS, or any agentic workflow",
    ],
    href: "/docs/agentic-v2",
    ctaLabel: "API docs",
  },
  {
    id: "think-aloud-verification",
    eyebrow: "Human Knowledge Verification",
    title: "Think-Aloud Protocol",
    summary:
      "Hosted verification for live cognition. Generate shareable URLs so humans verbalize reasoning under probe—the signal hidden AI overlays cannot fabricate.",
    bullets: [
      "Issue private evaluation links scoped to blocks or workspaces",
      "Capture speech, hesitations, and causal chains in real time",
      "Score cognitive markers and return auditable gap reports",
    ],
    href: "/workspace/new",
    ctaLabel: "Create a workspace",
  },
  {
    id: "ile",
    eyebrow: "Learning",
    title: "Integrated Learning Environment",
    summary:
      "Where humans improve. The ILE turns gap findings into guided practice—think-aloud sessions, Socratic probes, and targeted blocks until scores move.",
    bullets: [
      "Practice real scenarios with live reasoning capture",
      "Close specific gaps surfaced by verification products",
      "Track score improvement with evidence along the way",
    ],
    href: "/workspace/new",
    ctaLabel: "Start practicing",
  },
];