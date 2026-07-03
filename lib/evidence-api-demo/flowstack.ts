export const DEMO_PRODUCT_NAME = "FlowStack";
export const DEMO_INTEGRATION_NAME = "flowstack-onboarding-agent";

export const DEMO_EVAL_DEFINITION = `Verify that trial users learned FlowStack onboarding well enough to activate and convert:
1) connect a Slack integration with correct workspace scope,
2) create a first project with the right template,
3) invite a teammate with appropriate permissions,
4) reach the activation milestone without needing support intervention.

Evidence should capture tool events, user reflections, decisions, errors recovered, and outcomes tied to learning-to-conversion.`;

export const DEMO_WORKSPACE_PROMPT = `SaaS product onboarding verification for FlowStack, a team collaboration platform.
Verify trial users learned to: connect Slack, create their first project, invite a teammate, and complete activation.
Focus on learning-to-conversion: can users execute the activation path without hand-holding?
Create assessable blocks for each onboarding milestone.`;

export type FlowStackStepId =
  | "start_trial"
  | "connect_slack"
  | "create_project"
  | "invite_teammate"
  | "complete_activation";

export interface FlowStackStep {
  id: FlowStackStepId;
  label: string;
  description: string;
  blockHint: string;
  cta: string;
}

export const FLOWSTACK_STEPS: FlowStackStep[] = [
  {
    id: "start_trial",
    label: "Start trial",
    description: "User creates a FlowStack workspace and accepts trial terms.",
    blockHint: "Trial workspace setup",
    cta: "Start 14-day trial",
  },
  {
    id: "connect_slack",
    label: "Connect Slack",
    description: "User connects Slack and selects the correct workspace channel.",
    blockHint: "Integration connect",
    cta: "Connect Slack",
  },
  {
    id: "create_project",
    label: "Create first project",
    description: "User creates a project from the Team Onboarding template.",
    blockHint: "First project setup",
    cta: "Create project",
  },
  {
    id: "invite_teammate",
    label: "Invite teammate",
    description: "User invites a colleague with editor permissions.",
    blockHint: "Team invite & permissions",
    cta: "Send invite",
  },
  {
    id: "complete_activation",
    label: "Reach activation",
    description: "User completes the activation checklist and sees upgrade path.",
    blockHint: "Activation milestone",
    cta: "Mark activation complete",
  },
];

export interface DemoWorkspaceBlock {
  id: string;
  title: string;
  description?: string | null;
}

export function matchBlockToStep(blocks: DemoWorkspaceBlock[], step: FlowStackStep): string | null {
  const hint = step.blockHint.toLowerCase();
  const label = step.label.toLowerCase();

  const scored = blocks
    .map((block) => {
      const title = (block.title || "").toLowerCase();
      const description = (block.description || "").toLowerCase();
      let score = 0;
      if (title.includes(hint) || hint.includes(title)) score += 3;
      if (title.includes(label) || label.includes(title)) score += 2;
      if (description.includes(hint) || description.includes(label)) score += 1;
      const hintWords = hint.split(/\s+/).filter((word) => word.length > 3);
      for (const word of hintWords) {
        if (title.includes(word) || description.includes(word)) score += 1;
      }
      return { id: block.id, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.id ?? blocks[0]?.id ?? null;
}

export function buildToolEvidencePayload(
  step: FlowStackStep,
  meta: {
    sessionId: string;
    blockId?: string | null;
    reflection?: string;
    outcome?: "success" | "partial" | "struggle";
    extra?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    schema_version: "flowstack_onboarding_v1",
    product: DEMO_PRODUCT_NAME,
    integration: DEMO_INTEGRATION_NAME,
    session_id: meta.sessionId,
    block_id: meta.blockId || null,
    event: {
      verb: step.id,
      label: step.label,
      timestamp: now,
      tool_name: "flowstack",
      tool_action: step.id,
    },
    learner_reflection:
      meta.reflection ||
      `Completed "${step.label}" in the FlowStack onboarding wizard.`,
    goals: ["trial_activation", "integration_connect", "team_invite"],
    outcome: meta.outcome || "success",
    block_hint: step.blockHint,
    ...meta.extra,
  };
}