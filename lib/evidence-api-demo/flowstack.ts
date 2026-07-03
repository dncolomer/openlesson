export const DEMO_PRODUCT_NAME = "FlowStack";
export const DEMO_INTEGRATION_NAME = "flowstack-onboarding-agent";

export const DEMO_EVAL_DEFINITION = `Verify that trial users learned FlowStack well enough to activate and convert across a multidimensional onboarding surface:
- workspace setup and profile completion (optional paths: guided tour vs self-serve),
- integrations (Slack, GitHub, Jira) with correct scopes and recovery from misconfiguration,
- project creation (template vs blank, automations, cross-functional workflows),
- team collaboration (invites, permissions, delegation, wrong-workspace mistakes),
- activation milestones (checklist, collaborative edits, usage thresholds),
- support touchpoints (help center, live onboarding) and re-engagement after idle gaps.

Evidence should capture non-linear tool events, idle gaps, learner reflections, errors recovered, branching decisions, and outcomes tied to learning-to-conversion.`;

export const DEMO_WORKSPACE_MODEL_DOC = `# FlowStack Trial Verification Model

## Product context
**FlowStack** is a fictional B2B team collaboration platform used in the OpenLesson Evidence API demo.
The demo simulates a **non-linear trial surface** — learners branch across onboarding, integrations,
projects, team permissions, activation, and support paths. Calendar time can be compressed with
simulation tools (e.g. +1 day, +3 days, +7 days) to model idle gaps between sessions.

## Evaluation objective
${DEMO_EVAL_DEFINITION.trim()}

## Competency dimensions (spider / marker axes)
| Dimension | What evidence should show |
|-----------|---------------------------|
| workspace_setup | Trial start, profile completion, self-serve navigation |
| integration_connect | Slack, GitHub, Jira OAuth and scope correctness |
| integration_recovery | Detecting and fixing misconfigured scopes |
| project_setup | Template vs blank project creation |
| workflow_design | Automation rules and cross-tool workflows |
| team_collaboration | Invites, roles, delegation |
| activation | Checklist completion, collaborative edits, upgrade signals |
| support_usage | Help center and live onboarding touchpoints |
| re_engagement | Return after simulated idle gaps |
| mistake_recovery | Wrong-workspace invites, abandon flows |

## Evidence contract
- **Tool events**: JSON payloads via \`POST .../evidence\` (type: tool)
- **Time simulation**: \`simulate_time_passage\` events with \`days_elapsed\` and \`world_state\`
- **Performance reports**: \`overall_score\`, \`marker_scores\` (spider/radar), \`gap_analysis.gaps[]\`
- **Continuous evaluation**: re-fetch \`evidence-schema\`, regenerate \`integration-skill\` as artifacts grow

## Integration agent
- **Name**: ${DEMO_INTEGRATION_NAME}
- **Partner role**: Simulates FlowStack trial UI and uploads evidence to OpenLesson
- **Operating model**: Upload → re-fetch spec → regenerate skill → request performance → repeat

## Demo workspace note
This file was attached at workspace creation (like \`POST /api/v2/agent/workspaces\` with \`files[]\`)
so performance analysis, evidence-spec generation, and skill regeneration can ground claims in a
stable product + eval model description — not only live tool traces.
`;

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function getDemoWorkspaceModelFile(): {
  name: string;
  mime_type: string;
  data: string;
} {
  return {
    name: "flowstack-eval-model.md",
    mime_type: "text/markdown",
    data: utf8ToBase64(DEMO_WORKSPACE_MODEL_DOC),
  };
}

export const DEMO_WORKSPACE_PROMPT = `SaaS product onboarding verification for FlowStack, a team collaboration platform.
Trial users may take non-linear paths: skip tours, connect integrations in any order, invite teammates before or after project setup, hit friction, abandon and return days later.
Verify learning-to-conversion across integrations, projects, team permissions, activation, and support — not a single linear checklist.
Create assessable blocks for each competency dimension (setup, integrations, projects, team, activation, support/re-engagement).`;

export type SimulationCategory =
  | "onboarding"
  | "integrations"
  | "projects"
  | "team"
  | "activation"
  | "support"
  | "edge_cases"
  | "simulation_tools";

export type SimulationActionKind = "evidence" | "time_simulation";

export type SimulationActionId = string;

export interface SimulationAction {
  id: SimulationActionId;
  label: string;
  description: string;
  category: SimulationCategory;
  blockHint: string;
  cta: string;
  kind: SimulationActionKind;
  repeatable?: boolean;
  /** Soft guidance — demo does not hard-block, but UI can hint */
  suggestedAfter?: SimulationActionId[];
  timeDeltaDays?: number;
  outcome?: "success" | "partial" | "struggle" | "failure";
  dimension: string;
}

export const SIMULATION_CATEGORY_META: Record<
  SimulationCategory,
  { label: string; description: string }
> = {
  onboarding: {
    label: "Onboarding paths",
    description: "Trial start, profile, tour — users rarely follow one sequence.",
  },
  integrations: {
    label: "Integrations",
    description: "Connect, misconfigure, and recover across Slack, GitHub, and Jira.",
  },
  projects: {
    label: "Projects & workflows",
    description: "Templates, blank projects, and automation rules.",
  },
  team: {
    label: "Team & permissions",
    description: "Invites, roles, and delegation — often parallel to project setup.",
  },
  activation: {
    label: "Activation",
    description: "Checklists, collaborative milestones, and upgrade signals.",
  },
  support: {
    label: "Support & learning",
    description: "Help center and live onboarding touchpoints.",
  },
  edge_cases: {
    label: "Friction & return paths",
    description: "Abandonment, mistakes, and re-engagement after gaps.",
  },
  simulation_tools: {
    label: "Simulation tools",
    description: "Compress calendar time to model idle gaps between sessions.",
  },
};

export const SIMULATION_ACTIONS: SimulationAction[] = [
  {
    id: "start_trial",
    label: "Start trial",
    description: "Create workspace and accept trial terms.",
    category: "onboarding",
    blockHint: "Trial workspace setup",
    cta: "Start trial",
    kind: "evidence",
    dimension: "workspace_setup",
    outcome: "success",
  },
  {
    id: "complete_profile",
    label: "Complete profile",
    description: "Fill role, team size, and use-case fields.",
    category: "onboarding",
    blockHint: "Profile completion",
    cta: "Save profile",
    kind: "evidence",
    dimension: "workspace_setup",
    outcome: "success",
  },
  {
    id: "skip_product_tour",
    label: "Skip product tour",
    description: "Dismiss guided tour and explore self-serve.",
    category: "onboarding",
    blockHint: "Self-serve exploration",
    cta: "Skip tour",
    kind: "evidence",
    dimension: "self_serve_navigation",
    outcome: "partial",
  },
  {
    id: "connect_slack",
    label: "Connect Slack",
    description: "OAuth Slack with correct workspace channel.",
    category: "integrations",
    blockHint: "Slack integration",
    cta: "Connect Slack",
    kind: "evidence",
    dimension: "integration_connect",
    outcome: "success",
  },
  {
    id: "connect_github",
    label: "Connect GitHub",
    description: "Link repo for issue sync and PR notifications.",
    category: "integrations",
    blockHint: "GitHub integration",
    cta: "Connect GitHub",
    kind: "evidence",
    dimension: "integration_connect",
    outcome: "success",
  },
  {
    id: "misconfigure_slack_scope",
    label: "Misconfigure Slack scope",
    description: "Grant overly narrow channel scope, then notice missing events.",
    category: "integrations",
    blockHint: "Integration troubleshooting",
    cta: "Save wrong scope",
    kind: "evidence",
    repeatable: true,
    dimension: "integration_recovery",
    outcome: "struggle",
  },
  {
    id: "fix_slack_scope",
    label: "Fix Slack scope",
    description: "Re-authorize with correct channel and verify events flow.",
    category: "integrations",
    blockHint: "Integration recovery",
    cta: "Re-authorize Slack",
    kind: "evidence",
    suggestedAfter: ["misconfigure_slack_scope"],
    dimension: "integration_recovery",
    outcome: "success",
  },
  {
    id: "create_project_template",
    label: "Create from template",
    description: "Spin up Team Onboarding template project.",
    category: "projects",
    blockHint: "Template project",
    cta: "Use template",
    kind: "evidence",
    dimension: "project_setup",
    outcome: "success",
  },
  {
    id: "create_blank_project",
    label: "Create blank project",
    description: "Start empty project and configure columns manually.",
    category: "projects",
    blockHint: "Blank project setup",
    cta: "Create blank",
    kind: "evidence",
    dimension: "project_setup",
    outcome: "partial",
  },
  {
    id: "configure_automation",
    label: "Add automation rule",
    description: "Create when-status-changes → notify Slack rule.",
    category: "projects",
    blockHint: "Workflow automation",
    cta: "Save automation",
    kind: "evidence",
    dimension: "workflow_design",
    outcome: "success",
  },
  {
    id: "invite_editor",
    label: "Invite editor",
    description: "Invite colleague with editor permissions.",
    category: "team",
    blockHint: "Team invite",
    cta: "Send invite",
    kind: "evidence",
    dimension: "team_collaboration",
    outcome: "success",
  },
  {
    id: "invite_viewer",
    label: "Invite viewer only",
    description: "Invite stakeholder with read-only access.",
    category: "team",
    blockHint: "Permissions",
    cta: "Invite viewer",
    kind: "evidence",
    dimension: "permissions",
    outcome: "success",
  },
  {
    id: "delegate_project_admin",
    label: "Delegate project admin",
    description: "Transfer project ownership to teammate.",
    category: "team",
    blockHint: "Delegation",
    cta: "Delegate admin",
    kind: "evidence",
    dimension: "permissions",
    outcome: "partial",
  },
  {
    id: "complete_activation_checklist",
    label: "Complete activation checklist",
    description: "Finish in-app activation checklist items.",
    category: "activation",
    blockHint: "Activation milestone",
    cta: "Complete checklist",
    kind: "evidence",
    dimension: "activation",
    outcome: "success",
  },
  {
    id: "first_collaborative_edit",
    label: "First collaborative edit",
    description: "Two users edit same task concurrently.",
    category: "activation",
    blockHint: "Collaboration milestone",
    cta: "Co-edit task",
    kind: "evidence",
    dimension: "collaboration",
    outcome: "success",
  },
  {
    id: "view_upgrade_path",
    label: "View upgrade path",
    description: "Open pricing modal after hitting trial limits.",
    category: "activation",
    blockHint: "Conversion signal",
    cta: "View pricing",
    kind: "evidence",
    dimension: "conversion_intent",
    outcome: "partial",
  },
  {
    id: "open_help_center",
    label: "Open help center",
    description: "Search docs for integration troubleshooting.",
    category: "support",
    blockHint: "Self-serve support",
    cta: "Open help",
    kind: "evidence",
    repeatable: true,
    dimension: "support_usage",
    outcome: "partial",
  },
  {
    id: "attend_live_onboarding",
    label: "Join live onboarding",
    description: "Attend CS-led onboarding webinar.",
    category: "support",
    blockHint: "Live onboarding",
    cta: "Join session",
    kind: "evidence",
    dimension: "guided_learning",
    outcome: "success",
  },
  {
    id: "abandon_mid_flow",
    label: "Abandon mid-flow",
    description: "Close tab during Slack OAuth without finishing.",
    category: "edge_cases",
    blockHint: "Drop-off",
    cta: "Abandon flow",
    kind: "evidence",
    repeatable: true,
    dimension: "drop_off",
    outcome: "failure",
  },
  {
    id: "wrong_workspace_invite",
    label: "Wrong-workspace invite",
    description: "Send invite to personal email outside company domain.",
    category: "edge_cases",
    blockHint: "Invite mistake",
    cta: "Send wrong invite",
    kind: "evidence",
    dimension: "mistake_recovery",
    outcome: "struggle",
  },
  {
    id: "return_after_idle",
    label: "Return after idle gap",
    description: "Resume onboarding after simulated idle period.",
    category: "edge_cases",
    blockHint: "Re-engagement",
    cta: "Resume session",
    kind: "evidence",
    repeatable: true,
    dimension: "re_engagement",
    outcome: "partial",
  },
  {
    id: "wait_1_day",
    label: "Wait 1 day",
    description: "Simulate 24h idle gap between sessions (uploads time evidence).",
    category: "simulation_tools",
    blockHint: "Time simulation",
    cta: "+1 day",
    kind: "time_simulation",
    timeDeltaDays: 1,
    repeatable: true,
    dimension: "time_gap",
  },
  {
    id: "wait_3_days",
    label: "Wait 3 days",
    description: "Simulate a long weekend without product usage.",
    category: "simulation_tools",
    blockHint: "Time simulation",
    cta: "+3 days",
    kind: "time_simulation",
    timeDeltaDays: 3,
    repeatable: true,
    dimension: "time_gap",
  },
  {
    id: "wait_1_week",
    label: "Wait 1 week",
    description: "Simulate seven days before re-engagement or churn risk.",
    category: "simulation_tools",
    blockHint: "Time simulation",
    cta: "+7 days",
    kind: "time_simulation",
    timeDeltaDays: 7,
    repeatable: true,
    dimension: "time_gap",
  },
];

/** @deprecated Use SIMULATION_ACTIONS — kept for any stale imports */
export const FLOWSTACK_STEPS = SIMULATION_ACTIONS.filter((action) => action.kind === "evidence");

export type FlowStackStep = SimulationAction;

export interface DemoWorkspaceBlock {
  id: string;
  title: string;
  description?: string | null;
}

export interface SimulationWorldState {
  simulatedDays: number;
  completedActions: string[];
  actionCounts: Record<string, number>;
  lastActionAt: string | null;
}

export function createInitialWorldState(): SimulationWorldState {
  return {
    simulatedDays: 0,
    completedActions: [],
    actionCounts: {},
    lastActionAt: null,
  };
}

export function getSimulationAction(id: string): SimulationAction | undefined {
  return SIMULATION_ACTIONS.find((action) => action.id === id);
}

export function getActionsByCategory(category: SimulationCategory): SimulationAction[] {
  return SIMULATION_ACTIONS.filter((action) => action.category === category);
}

export function isActionRepeatable(action: SimulationAction): boolean {
  return action.repeatable === true || action.kind === "time_simulation";
}

export function hasCompletedAction(state: SimulationWorldState, actionId: string): boolean {
  return (state.actionCounts[actionId] ?? 0) > 0 || state.completedActions.includes(actionId);
}

export function applySimulationAction(
  state: SimulationWorldState,
  action: SimulationAction
): SimulationWorldState {
  const now = new Date().toISOString();
  const nextCounts = { ...state.actionCounts };
  nextCounts[action.id] = (nextCounts[action.id] ?? 0) + 1;

  const completedActions =
    isActionRepeatable(action) || state.completedActions.includes(action.id)
      ? state.completedActions
      : [...state.completedActions, action.id];

  return {
    simulatedDays: state.simulatedDays + (action.timeDeltaDays ?? 0),
    completedActions,
    actionCounts: nextCounts,
    lastActionAt: now,
  };
}

export function countDistinctEvidenceActions(state: SimulationWorldState): number {
  return SIMULATION_ACTIONS.filter(
    (action) => action.kind === "evidence" && hasCompletedAction(state, action.id)
  ).length;
}

export function totalActionCount(state: SimulationWorldState): number {
  return Object.values(state.actionCounts).reduce((sum, count) => sum + count, 0);
}

export function matchBlockToStep(blocks: DemoWorkspaceBlock[], action: SimulationAction): string | null {
  const hint = action.blockHint.toLowerCase();
  const label = action.label.toLowerCase();

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

export function buildSimulationEvidencePayload(
  action: SimulationAction,
  meta: {
    sessionId: string;
    blockId?: string | null;
    worldState: SimulationWorldState;
    reflection?: string;
    outcome?: "success" | "partial" | "struggle" | "failure";
    extra?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const now = new Date().toISOString();
  const count = meta.worldState.actionCounts[action.id] ?? 0;

  if (action.kind === "time_simulation") {
    return {
      schema_version: "flowstack_simulation_v2",
      product: DEMO_PRODUCT_NAME,
      integration: DEMO_INTEGRATION_NAME,
      session_id: meta.sessionId,
      block_id: meta.blockId || null,
      event: {
        verb: "simulate_time_passage",
        label: action.label,
        timestamp: now,
        tool_name: "flowstack_simulator",
        tool_action: action.id,
      },
      simulation: {
        days_elapsed: action.timeDeltaDays ?? 0,
        total_simulated_days: meta.worldState.simulatedDays + (action.timeDeltaDays ?? 0),
        occurrence: count + 1,
        reason: "Demo operator compressed calendar time between learner sessions.",
      },
      learner_reflection:
        meta.reflection ||
        `Simulated ${action.timeDeltaDays ?? 0} day(s) of idle time before the next onboarding activity.`,
      goals: ["time_gap_modeling", "re_engagement_signal"],
      outcome: "partial",
      dimension: action.dimension,
      world_state: {
        simulated_days: meta.worldState.simulatedDays + (action.timeDeltaDays ?? 0),
        prior_actions: meta.worldState.completedActions,
        action_counts: meta.worldState.actionCounts,
      },
      ...meta.extra,
    };
  }

  return {
    schema_version: "flowstack_simulation_v2",
    product: DEMO_PRODUCT_NAME,
    integration: DEMO_INTEGRATION_NAME,
    session_id: meta.sessionId,
    block_id: meta.blockId || null,
    event: {
      verb: action.id,
      label: action.label,
      timestamp: now,
      tool_name: "flowstack",
      tool_action: action.id,
      category: action.category,
      dimension: action.dimension,
      occurrence: count + 1,
    },
    learner_reflection:
      meta.reflection ||
      `User triggered "${action.label}" in the non-linear FlowStack trial surface.`,
    goals: ["trial_activation", "integration_connect", "team_invite", "multidimensional_onboarding"],
    outcome: meta.outcome || action.outcome || "success",
    block_hint: action.blockHint,
    world_state: {
      simulated_days: meta.worldState.simulatedDays,
      completed_actions: meta.worldState.completedActions,
      action_counts: meta.worldState.actionCounts,
    },
    ...meta.extra,
  };
}

/** @deprecated Use buildSimulationEvidencePayload */
export function buildToolEvidencePayload(
  step: SimulationAction,
  meta: {
    sessionId: string;
    blockId?: string | null;
    reflection?: string;
    outcome?: "success" | "partial" | "struggle" | "failure";
    extra?: Record<string, unknown>;
  }
): Record<string, unknown> {
  return buildSimulationEvidencePayload(step, {
    ...meta,
    worldState: createInitialWorldState(),
  });
}

export const SIMULATION_CATEGORY_ORDER: SimulationCategory[] = [
  "onboarding",
  "integrations",
  "projects",
  "team",
  "activation",
  "support",
  "edge_cases",
  "simulation_tools",
];

export function shouldSuggestSkillRegeneration(
  evidenceCount: number,
  previousEvidenceCount: number | null
): boolean {
  if (evidenceCount === 0) return false;
  if (previousEvidenceCount == null) return evidenceCount >= 3;
  const thresholds = [3, 5, 8, 12, 20];
  return thresholds.some(
    (threshold) => evidenceCount >= threshold && previousEvidenceCount < threshold
  );
}