import type { ContinuousEvaluationPolicy } from "./proof-of-work-schema";
import { formatInterruptionContractForSkillPrompt } from "./predictive-interruption";
import { buildIntegrationSkillApiPath } from "./proof-of-work-integration";
import { FLOW_API_BASE } from "@/lib/api/agent-api-paths";

export const UNCERTAIN_SYSTEMS_SCOPE = {
  product: "Uncertain Systems",
  mission:
    "Verify learning and measure readiness-to-perform using real product proof of work — not quizzes in isolation.",
  pillars: [
    "Flow management — create, list, update, and delete independent Solve, Calibration, and Verification flows",
    "Proof of work is recorded in the product UI — not a public agent session loop",
  ],
  workspace_model:
    "Solve, Calibration, and Verification flows are independent. Agents create and update those flows; learners record proof of work in the product UI.",
  integrator_model:
    "Partner agents authorize with a Bearer key and manage Solve, Calibration, and Verification flows. ChatGPT, Claude, or any MCP client uses the same REST and MCP surface.",
  docs: {
    api_reference: "/skill.md",
    human_guide: "/docs/proof-of-work-api",
  },
} as const;

export type IntegrationSurfaceRef = {
  transport: "rest" | "mcp";
  label: string;
  auth: string;
  entrypoint: string;
  when_to_use: string;
};

export type McpEvaluationRef = {
  mcp_tool: string;
  rest_equivalent: string;
  purpose: string;
  when_to_call: string[];
};

export type ContinuousEvaluationMcpPolicy = {
  principle: string;
  more_evidence_improves: string;
  regeneration_required: boolean;
  mcp_endpoint_pattern: string;
  proof_of_work_spec: McpEvaluationRef;
  integration_skill: McpEvaluationRef;
  upload_proof_of_work: McpEvaluationRef;
  performance: McpEvaluationRef;
  progress_snapshot: McpEvaluationRef;
  recommended_cadence: string;
};

export type RecommendedIntegrationAction = {
  priority: number;
  mcp_tool: string;
  rest_equivalent: string;
  reason: string;
};

export function buildMcpEndpointPattern(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `POST ${base}/api/mcp`;
}

export function buildIntegrationSurfaces(baseUrl: string): IntegrationSurfaceRef[] {
  const base = baseUrl.replace(/\/$/, "");
  return [
    {
      transport: "rest",
      label: "Flow management API (REST)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: `${base}${FLOW_API_BASE}`,
      when_to_use: "Production integrations, server-side agents, and clients with standard HTTP + Bearer auth.",
    },
    {
      transport: "mcp",
      label: "Flow management MCP (JSON-RPC)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: buildMcpEndpointPattern(baseUrl),
      when_to_use:
        "Cursor, Claude Desktop, Grok, and other MCP clients — full parity with REST for flow management.",
    },
  ];
}

export function buildContinuousEvaluationMcpPolicy(
  workspaceId: string,
  baseUrl: string,
  contextCounts?: {
    proof_of_work_artifacts?: number;
    blocks?: number;
    workspace_files?: number;
    tap_sessions?: number;
  } | null
): ContinuousEvaluationMcpPolicy {
  const skillRest = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const flowsRest = `POST ${baseUrl.replace(/\/$/, "")}${FLOW_API_BASE}`;
  const getRest = `GET ${baseUrl.replace(/\/$/, "")}${FLOW_API_BASE}/{flow_id}`;
  const listRest = `GET ${baseUrl.replace(/\/$/, "")}${FLOW_API_BASE}`;
  void contextCounts;

  return {
    principle: UNCERTAIN_SYSTEMS_SCOPE.workspace_model,
    more_evidence_improves:
      "More Solve, Calibration, and Verification flows give partners a complete evaluation path.",
    regeneration_required: true,
    mcp_endpoint_pattern: buildMcpEndpointPattern(baseUrl),
    proof_of_work_spec: {
      mcp_tool: "create_flow",
      rest_equivalent: flowsRest,
      purpose: "Create a Solve, Calibration, or Verification flow",
      when_to_call: [
        "When adding a new flow",
        "When an authoring client needs a flow before a session",
      ],
    },
    integration_skill: {
      mcp_tool: "generate_integration_skill",
      rest_equivalent: skillRest,
      purpose: "Regenerate partner skill.md aligned with the current flows",
      when_to_call: [
        "When onboarding a new partner agent version",
        "After the flow set changes",
      ],
    },
    upload_proof_of_work: {
      mcp_tool: "update_flow",
      rest_equivalent: `PATCH ${baseUrl.replace(/\/$/, "")}${FLOW_API_BASE}/{flow_id}`,
      purpose: "Update an existing Solve, Calibration, or Verification flow",
      when_to_call: [
        "After create_flow, when the problem or questions change",
        "When reconnecting an existing flow to a different topic",
      ],
    },
    performance: {
      mcp_tool: "list_flows",
      rest_equivalent: listRest,
      purpose: "List Solve, Calibration, and Verification flows owned by this key.",
      when_to_call: [
        "When reviewing the current flow set",
        "Before creating a duplicate flow",
      ],
    },
    progress_snapshot: {
      mcp_tool: "get_flow",
      rest_equivalent: getRest,
      purpose: "Read one Solve, Calibration, or Verification flow.",
      when_to_call: [
        "When connecting MCP and need flow context",
        "Before update_flow",
        "After long idle gaps to re-orient the agent",
      ],
    },
    recommended_cadence: `MCP loop: list_flows → create_flow → get_flow → update_flow. REST mirror: ${FLOW_API_BASE}.`,
  };
}

export function recommendIntegrationActions(options: {
  proof_of_work_artifacts: number;
  blocks: number;
  has_workspace_goal: boolean;
  last_report_score?: number | null;
  workspace_kind?: unknown;
}): RecommendedIntegrationAction[] {
  const actions: RecommendedIntegrationAction[] = [];
  const { proof_of_work_artifacts, blocks, has_workspace_goal } = options;
  void options.workspace_kind;

  void blocks;
  void has_workspace_goal;

  actions.push({
    priority: 1,
    mcp_tool: "list_flows",
    rest_equivalent: `GET ${FLOW_API_BASE}`,
    reason: "List Solve, Calibration, and Verification flows owned by this key.",
  });

  actions.push({
    priority: 2,
    mcp_tool: "create_flow",
    rest_equivalent: `POST ${FLOW_API_BASE}`,
    reason: "Create a Solve, Calibration, or Verification flow.",
  });

  if (proof_of_work_artifacts >= 0) {
    actions.push({
      priority: 3,
      mcp_tool: "get_flow",
      rest_equivalent: `GET ${FLOW_API_BASE}/{flow_id}`,
      reason: "Read one Solve, Calibration, or Verification flow.",
    });
    actions.push({
      priority: 4,
      mcp_tool: "update_flow",
      rest_equivalent: `PATCH ${FLOW_API_BASE}/{flow_id}`,
      reason: "Update an existing flow.",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export function buildUncertainSystemsScopeForWorkspace(options: {
  workspaceTitle: string;
  workspaceGoal?: string | null;
  blockCount: number;
  proofOfWorkCount: number;
}): Record<string, unknown> {
  return {
    ...UNCERTAIN_SYSTEMS_SCOPE,
    workspace_context: {
      title: options.workspaceTitle,
      workspace_goal: options.workspaceGoal?.trim() || "Infer from workspace title, notes, and proof of work.",
      block_count: options.blockCount,
      proof_of_work_artifact_count: options.proofOfWorkCount,
      progress_interpretation:
        "Learning progress = map tiles and linked Solve, Calibration, and Verification flows measured against workspace_goal. Proof of work is recorded in the product UI.",
    },
  };
}

export function formatDualSurfaceGuidance(
  restPolicy: ContinuousEvaluationPolicy,
  mcpPolicy: ContinuousEvaluationMcpPolicy
): string {
  return [
    "Use REST or MCP interchangeably — same operating loop:",
    `REST cadence: ${restPolicy.recommended_cadence}`,
    `MCP cadence: ${mcpPolicy.recommended_cadence}`,
    "Pair continuous_evaluation (REST paths) with continuous_evaluation_mcp (tool names) in every schema response.",
  ].join(" ");
}

export const MCP_RESOURCE_CATALOG = [
  {
    uri: "uncertain-systems://integration-scope",
    name: "Uncertain Systems integration scope",
    description: "What Uncertain Systems is, workspace model, and learning-vs-conversion goals.",
    mimeType: "text/markdown",
  },
  {
    uri: "uncertain-systems://proof-of-work-loop",
    name: "Flow management",
    description: "Independent Solve, Calibration, and Verification flow loop, REST + MCP tool mapping.",
    mimeType: "text/markdown",
  },
  {
    uri: "uncertain-systems://predictive-interruptions",
    name: "Predictive interruptions (expected free energy)",
    description: "Expected-free-energy interruption contract: interruption field, delay_ms, supersession, consumer obligations.",
    mimeType: "text/markdown",
  },
] as const;

export function buildMcpResourceContent(uri: string, baseUrl: string): string | null {
  const base = baseUrl.replace(/\/$/, "");

  if (uri === "uncertain-systems://integration-scope") {
    return `# Uncertain Systems integration scope

${UNCERTAIN_SYSTEMS_SCOPE.mission}

## Pillars
${UNCERTAIN_SYSTEMS_SCOPE.pillars.map((p) => `- ${p}`).join("\n")}

## Workspace model
${UNCERTAIN_SYSTEMS_SCOPE.workspace_model}

## Integrator model
${UNCERTAIN_SYSTEMS_SCOPE.integrator_model}

## Surfaces (use either)
- **REST:** \`${base}${FLOW_API_BASE}\` with Bearer API key
- **MCP:** \`${buildMcpEndpointPattern(baseUrl)}\` with Bearer API key and JSON-RPC tools/list

Docs: ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.api_reference} · ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.human_guide}
`;
  }

  if (uri === "uncertain-systems://proof-of-work-loop") {
    return `# Flow management

ChatGPT, Claude, or any MCP client authorizes with a Bearer key and manages Solve, Calibration, and Verification flows. Proof of work is recorded in the product UI.

## Recommended loop
1. **list_flows** — existing Solve, Calibration, and Verification flows
2. **create_flow** / POST ${FLOW_API_BASE} — kind solve | calibration | verification
3. **get_flow** / GET ${FLOW_API_BASE}/{flow_id}
4. **update_flow** / PATCH ${FLOW_API_BASE}/{flow_id}

## Quick orientation
Call **list_flows** for Solve, Calibration, and Verification flows owned by this key.

Every schema/skill response includes \`continuous_evaluation\` (REST) and \`continuous_evaluation_mcp\` (tools).

Headless start_session / upload_proof_of_work / end_session are not public agent tools. Snapshot and Stash are not public agent tools.
`;
  }

  if (uri === "uncertain-systems://predictive-interruptions") {
    return `# Predictive interruptions (expected free energy)

${formatInterruptionContractForSkillPrompt()}

## REST + MCP parity
- REST success bodies and MCP tool results both include top-level \`interruption\`.
- \`interruption_contract\` on proof-of-work spec responses documents the full interruption contract.
- Supersession: any later Proof-of-Work API response replaces the previous pending interruption timer.
`;
  }

  return null;
}