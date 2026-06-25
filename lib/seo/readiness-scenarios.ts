/** Landing-page readiness widget scenarios — shared with SEO scenario routes. */

export type ReadinessSignal = {
  label: string;
  value: string;
  width: string;
  muted?: boolean;
  alert?: boolean;
};

export type ReadinessScenario = {
  id: string;
  title: string;
  verticalSlug: string;
  scenarioSlug: string;
  solutionHref: string;
  signals: ReadinessSignal[];
  probe: string;
  metrics: { value: string; label: string }[];
};

export const READINESS_SCENARIOS: ReadinessScenario[] = [
  {
    id: "client-escalation",
    title: "Client escalation readiness",
    verticalSlug: "customer-success",
    scenarioSlug: "client-escalation-readiness",
    solutionHref: "/solutions/customer-success/client-escalation-readiness",
    signals: [
      { label: "Explains tradeoffs without script", value: "Strong", width: "82%" },
      { label: "Updates judgment when facts change", value: "Forming", width: "54%", muted: true },
      { label: "Identifies AI failure modes", value: "Gap", width: "34%", alert: true },
    ],
    probe:
      "If the AI-generated recommendation is confidently wrong, what evidence would make you stop and revise your decision?",
    metrics: [
      { value: "14", label: "reasoning traces" },
      { value: "5", label: "hidden gaps" },
      { value: "2", label: "critical risks" },
    ],
  },
  {
    id: "sales-discovery",
    title: "Sales discovery judgment",
    verticalSlug: "sales-enablement",
    scenarioSlug: "sales-discovery-judgment",
    solutionHref: "/solutions/sales-enablement/sales-discovery-judgment",
    signals: [
      { label: "Qualifies pain without leading questions", value: "Strong", width: "76%" },
      { label: "Challenges AI-drafted talk tracks", value: "Forming", width: "48%", muted: true },
      { label: "Maps buyer stakes to solution fit", value: "Gap", width: "31%", alert: true },
    ],
    probe:
      "Your prospect agrees with every point in the AI summary. What would you ask next to test whether they actually understand the problem?",
    metrics: [
      { value: "11", label: "reasoning traces" },
      { value: "4", label: "hidden gaps" },
      { value: "1", label: "critical risks" },
    ],
  },
  {
    id: "compliance-exception",
    title: "Compliance exception review",
    verticalSlug: "compliance-risk",
    scenarioSlug: "compliance-exception-review",
    solutionHref: "/solutions/compliance-risk/compliance-exception-review",
    signals: [
      { label: "Cites policy rationale in own words", value: "Strong", width: "88%" },
      { label: "Weighs exception blast radius", value: "Forming", width: "57%", muted: true },
      { label: "Flags undocumented AI assumptions", value: "Gap", width: "29%", alert: true },
    ],
    probe:
      "The model says the exception is low risk because similar cases were approved. What would you verify before signing off?",
    metrics: [
      { value: "9", label: "reasoning traces" },
      { value: "3", label: "hidden gaps" },
      { value: "2", label: "critical risks" },
    ],
  },
  {
    id: "incident-triage",
    title: "Incident response triage",
    verticalSlug: "engineering-oncall",
    scenarioSlug: "incident-response-triage",
    solutionHref: "/solutions/engineering-oncall/incident-response-triage",
    signals: [
      { label: "Narrows root cause without guesswork", value: "Strong", width: "71%" },
      { label: "Prioritizes customer impact over noise", value: "Forming", width: "52%", muted: true },
      { label: "Explains rollback tradeoffs", value: "Gap", width: "38%", alert: true },
    ],
    probe:
      "An AI runbook suggests restarting the service immediately. What signals would change your mind about that first step?",
    metrics: [
      { value: "16", label: "reasoning traces" },
      { value: "6", label: "hidden gaps" },
      { value: "3", label: "critical risks" },
    ],
  },
  {
    id: "manager-coaching",
    title: "New manager coaching",
    verticalSlug: "corporate-learning",
    scenarioSlug: "manager-coaching-readiness",
    solutionHref: "/solutions/corporate-learning/manager-coaching-readiness",
    signals: [
      { label: "Gives feedback tied to behavior", value: "Strong", width: "79%" },
      { label: "Adapts tone to individual context", value: "Forming", width: "46%", muted: true },
      { label: "Detects when AI scripts sound hollow", value: "Gap", width: "33%", alert: true },
    ],
    probe:
      "You used an AI draft for a tough performance conversation. How would you know the employee actually heard the core message?",
    metrics: [
      { value: "8", label: "reasoning traces" },
      { value: "4", label: "hidden gaps" },
      { value: "1", label: "critical risks" },
    ],
  },
];

export function getReadinessScenario(id: string) {
  return READINESS_SCENARIOS.find((scenario) => scenario.id === id);
}