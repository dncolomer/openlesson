export type VerificationAudience = "human" | "agent";

export type VerificationExampleGap = {
  label: string;
  severity: "High" | "Medium" | "Low";
  detail: string;
};

export type VerificationExample = {
  id: string;
  audience: VerificationAudience;
  product: "Evidence API" | "Think Aloud Protocol" | "ILE" | "Agentic Learning Environment";
  category: string;
  title: string;
  context: string;
  score: number;
  markers: { label: string; score: number }[];
  gaps: VerificationExampleGap[];
  nextStep: string;
};

export const VERIFICATION_EXAMPLES: VerificationExample[] = [
  {
    id: "agent-tool-use",
    audience: "agent",
    product: "Evidence API",
    category: "Agentic deployment gate",
    title: "CRM update agent — pre-production",
    context: "Tool traces from staging runs scored before promote to production.",
    score: 58,
    markers: [
      { label: "Tool selection", score: 72 },
      { label: "Argument fidelity", score: 61 },
      { label: "Error recovery", score: 34 },
      { label: "Policy compliance", score: 48 },
      { label: "Handoff clarity", score: 55 },
    ],
    gaps: [
      {
        label: "Error recovery",
        severity: "High",
        detail: "Retries blind API 429s without backoff; never surfaces partial-failure state to the user.",
      },
      {
        label: "Policy compliance",
        severity: "Medium",
        detail: "Writes to restricted fields when account tier is trial—passes happy-path evals only.",
      },
    ],
    nextStep: "Block deploy until recovery traces pass Evidence API threshold",
  },
  {
    id: "human-tool-learning",
    audience: "human",
    product: "Evidence API",
    category: "Tool adoption verification",
    title: "RevOps analyst — CRM workflow",
    context: "Screen captures and call notes scored after enablement—not a multiple-choice quiz.",
    score: 64,
    markers: [
      { label: "Record hygiene", score: 71 },
      { label: "Stage logic", score: 58 },
      { label: "Forecast judgment", score: 42 },
      { label: "Handoff notes", score: 67 },
      { label: "Exception handling", score: 49 },
    ],
    gaps: [
      {
        label: "Forecast judgment",
        severity: "High",
        detail: "Copies AI-suggested commit dates without tying them to discovery evidence in the CRM.",
      },
    ],
    nextStep: "Route to ILE block on forecast defense; re-score artifacts in 2 weeks",
  },
  {
    id: "human-tap-hiring",
    audience: "human",
    product: "Think Aloud Protocol",
    category: "Live cognition under probe",
    title: "Platform engineer — incident triage",
    context: "TAP session before pager expansion; verbalized reasoning beats benchmark scores.",
    score: 52,
    markers: [
      { label: "Signal triage", score: 61 },
      { label: "Blast radius", score: 44 },
      { label: "Rollback judgment", score: 38 },
      { label: "Comms clarity", score: 58 },
      { label: "Runbook adaptation", score: 49 },
    ],
    gaps: [
      {
        label: "Rollback judgment",
        severity: "High",
        detail: "Under probe, cannot articulate safe rollback order when two services share a migration.",
      },
      {
        label: "Blast radius",
        severity: "Medium",
        detail: "Maps dependencies from memory; skips data-plane vs control-plane distinction.",
      },
    ],
    nextStep: "ILE practice on staged outage scenarios, then re-run TAP gate",
  },
  {
    id: "human-ile-practice",
    audience: "human",
    product: "ILE",
    category: "Gap-driven improvement",
    title: "CSM — enterprise escalation repair",
    context: "TAP surfaced weak stakeholder mapping; ILE closes the gap with Socratic practice.",
    score: 71,
    markers: [
      { label: "Stakeholder map", score: 74 },
      { label: "Causal repair", score: 68 },
      { label: "Commitment framing", score: 65 },
      { label: "Risk disclosure", score: 72 },
      { label: "Follow-through plan", score: 76 },
    ],
    gaps: [
      {
        label: "Commitment framing",
        severity: "Medium",
        detail: "Still over-promises timelines when executive sponsor joins mid-call.",
      },
    ],
    nextStep: "Re-verify with TAP before strategic book assignment",
  },
  {
    id: "agent-skill-benchmark",
    audience: "agent",
    product: "Evidence API",
    category: "Beyond benchmark scores",
    title: "Support copilot — policy reasoning",
    context: "Benchmark accuracy was 94%; evidence traces show systematic refund-policy gaps.",
    score: 47,
    markers: [
      { label: "Policy retrieval", score: 88 },
      { label: "Exception paths", score: 31 },
      { label: "Tone calibration", score: 62 },
      { label: "Escalation triggers", score: 39 },
      { label: "Audit trail", score: 54 },
    ],
    gaps: [
      {
        label: "Exception paths",
        severity: "High",
        detail: "High benchmark accuracy masks failure on pro-rated refund edge cases in 3 locales.",
      },
      {
        label: "Escalation triggers",
        severity: "High",
        detail: "Does not escalate regulatory complaints—confident wrong answers pass unit tests.",
      },
    ],
    nextStep: "Hold production cutover; feed failure traces back into training workspace",
  },
  {
    id: "agent-ale-skill-dev",
    audience: "agent",
    product: "Agentic Learning Environment",
    category: "Skill development sandbox",
    title: "Support copilot skill — v3 iteration",
    context: "Skill developer runs agent against workspace blocks before publishing skill.md v3.",
    score: 68,
    markers: [
      { label: "Tool routing", score: 74 },
      { label: "Policy edges", score: 52 },
      { label: "Recovery paths", score: 61 },
      { label: "Handoff quality", score: 70 },
      { label: "Trace clarity", score: 63 },
    ],
    gaps: [
      {
        label: "Policy edges",
        severity: "High",
        detail: "v3 still mishandles partial refunds in EU locale—v2 passed benchmarks but failed evidence scoring.",
      },
    ],
    nextStep: "Iterate skill prompts in ALE; re-run Evidence API gate before publish",
  },
  {
    id: "human-tap-sales",
    audience: "human",
    product: "Think Aloud Protocol",
    category: "Anti-cheat verification",
    title: "AE — competitive displacement call",
    context: "Live think-aloud separates genuine discovery from AI-fed talk tracks.",
    score: 59,
    markers: [
      { label: "Pain qualification", score: 63 },
      { label: "Competitive framing", score: 55 },
      { label: "Technical validation", score: 48 },
      { label: "Mutual close plan", score: 52 },
      { label: "Risk surfacing", score: 61 },
    ],
    gaps: [
      {
        label: "Technical validation",
        severity: "High",
        detail: "Recites feature matrix but cannot explain integration risk when buyer cites legacy SSO.",
      },
    ],
    nextStep: "ILE block on technical validation handoffs; Evidence API on call prep artifacts",
  },
];