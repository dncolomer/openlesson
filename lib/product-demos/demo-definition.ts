import type { SimulationAction, SimulationCategory } from "./types";

export interface ProofOfWorkApiDemoDefinition {
  id: string;
  productName: string;
  integrationName: string;
  /** Distinct verification scenario — not always onboarding */
  useCase: string;
  tagline: string;
  saasCategory: string;
  description: string;
  scenarioTitle: string;
  scenarioIntro: string;
  /** Stored on workspaces.description — must read like a real customer program */
  workspaceDescription: string;
  initials: string;
  accent: "indigo" | "emerald" | "violet" | "amber";
  evalDefinition: string;
  workspacePrompt: string;
  modelDocFilename: string;
  modelDoc: string;
  toolName: string;
  simulatorToolName: string;
  schemaVersion: string;
  proofOfWorkGoals: string[];
  integrationHints: {
    event_verbs: string[];
    goals: string[];
  };
  partnerDescription: string;
  integrationSkillContext: string;
  categoryMeta: Record<SimulationCategory, { label: string; description: string }>;
  categoryOrder: SimulationCategory[];
  actions: SimulationAction[];
  /** "game" = Three.js play surface; "app" = in-product UI; "external" = standalone app at /demo-app. */
  simulatorMode?: "events" | "game" | "app" | "external";
}

export const STANDARD_CATEGORY_ORDER: SimulationCategory[] = [
  "onboarding",
  "integrations",
  "projects",
  "team",
  "activation",
  "support",
  "edge_cases",
  "simulation_tools",
];

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function getDemoWorkspaceModelFile(demo: ProofOfWorkApiDemoDefinition): {
  name: string;
  mime_type: string;
  data: string;
} {
  return {
    name: demo.modelDocFilename,
    mime_type: "text/markdown",
    data: utf8ToBase64(demo.modelDoc),
  };
}

export function createTimeToolActions(): SimulationAction[] {
  return [
    {
      id: "wait_1_day",
      label: "Wait 1 day",
      description: "Record a 24h idle gap between sessions (uploads time-gap proof of work).",
      category: "simulation_tools",
      blockHint: "Time gap",
      cta: "+1 day",
      kind: "time_simulation",
      timeDeltaDays: 1,
      repeatable: true,
      dimension: "time_gap",
    },
    {
      id: "wait_3_days",
      label: "Wait 3 days",
      description: "Record a long weekend without product usage.",
      category: "simulation_tools",
      blockHint: "Time gap",
      cta: "+3 days",
      kind: "time_simulation",
      timeDeltaDays: 3,
      repeatable: true,
      dimension: "time_gap",
    },
    {
      id: "wait_1_week",
      label: "Wait 1 week",
      description: "Record seven days before re-engagement or churn risk.",
      category: "simulation_tools",
      blockHint: "Time gap",
      cta: "+7 days",
      kind: "time_simulation",
      timeDeltaDays: 7,
      repeatable: true,
      dimension: "time_gap",
    },
  ];
}

export function buildModelDoc(
  demo: Pick<
    ProofOfWorkApiDemoDefinition,
    "productName" | "integrationName" | "evalDefinition" | "modelDocFilename" | "useCase" | "scenarioIntro"
  >,
  competencyRows: string
): string {
  return `# ${demo.productName} Learning Verification Model

## Product context
**${demo.productName}** — ${demo.useCase}

${demo.scenarioIntro.trim()}

This document defines how partner integrations should collect proof of work and how Uncertain Systems evaluates
competency. Attach at workspace creation via \`POST /api/v3/pow/workspaces\` with \`files[]\` so
performance analysis, proof-of-work-spec generation, and integration-skill regeneration stay grounded in
a stable eval model — not only live tool traces.

## Evaluation objective
${demo.evalDefinition.trim()}

## Competency dimensions (spider / marker axes)
| Dimension | What proof of work should show |
|-----------|---------------------------|
${competencyRows}

## Proof-of-work contract
- **Tool events**: JSON payloads via \`POST .../proof-of-work\` (type: tool)
- **Time gaps**: \`time_gap_elapsed\` events with \`days_elapsed\` when calendar idle time matters
- **Performance reports**: \`verification_score\`, \`optimization_score\`, \`workspace_goal\`, \`marker_scores\` (spider/radar), \`gap_analysis.gaps[]\`, \`gap_analysis.next_steps.directions[]\`, \`gap_analysis.next_steps.events[]\`
- **Remediation rule**: gaps, next_steps, and suggestions must stay product-independent — never recommend TAP sessions, block completion, or ILE; use domain/tool event language only
- **Continuous evaluation**: re-fetch \`proof-of-work-schema\`, regenerate \`integration-skill\` as artifacts grow

## Integration agent
- **Name**: ${demo.integrationName}
- **Partner role**: Emits ${demo.productName} product events and uploads proof of work to Uncertain Systems
- **Operating model**: Upload proof of work → re-fetch spec → regenerate skill → request performance → surface product-specific coaching from score cards → repeat
`;
}