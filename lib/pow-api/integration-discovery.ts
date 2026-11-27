import type { ContinuousEvaluationPolicy } from "./proof-of-work-schema";
import { formatInterruptionContractForSkillPrompt } from "./predictive-interruption";
import { buildIntegrationSkillApiPath } from "./proof-of-work-integration";
import { KNOWLEDGE_REGION_API_BASE, PROTOCOL_API_BASE } from "@/lib/api/agent-api-paths";

export const UNCERTAIN_SYSTEMS_SCOPE = {
  product: "Uncertain Systems",
  mission:
    "Verify learning and measure readiness-to-perform using real product proof of work — not quizzes in isolation.",
  pillars: [
    "Protocol management — create, list, update, and delete knowledge verification protocols",
    "Knowledge Regions — create, list, update, delete, simulate, and retrieve candidate/run data",
    "Proof of work is recorded in the product UI — not a public agent session loop",
  ],
  workspace_model:
    "Knowledge verification protocols and knowledge regions are independent families. Agents create and update those objects; learners record proof of work in the product UI.",
  integrator_model:
    "Partner agents authorize with a Bearer key and manage knowledge verification protocols and knowledge regions. ChatGPT, Claude, coding agents, or any MCP client uses the same REST and MCP surface.",
  docs: {
    api_reference: "/skill.md",
    coding_agents: "/coding-agents.md",
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
      label: "Protocol management API (REST)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: `${base}${PROTOCOL_API_BASE}`,
      when_to_use: "Production integrations, server-side agents, and clients with standard HTTP + Bearer auth.",
    },
    {
      transport: "mcp",
      label: "Protocol management MCP (JSON-RPC)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: buildMcpEndpointPattern(baseUrl),
      when_to_use:
        "Cursor, Claude Desktop, Grok, and other MCP clients — full parity with REST for protocol management.",
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
  const protocolsRest = `POST ${baseUrl.replace(/\/$/, "")}${PROTOCOL_API_BASE}`;
  const getRest = `GET ${baseUrl.replace(/\/$/, "")}${PROTOCOL_API_BASE}/{protocol_id}`;
  const listRest = `GET ${baseUrl.replace(/\/$/, "")}${PROTOCOL_API_BASE}`;
  void contextCounts;

  return {
    principle: UNCERTAIN_SYSTEMS_SCOPE.workspace_model,
    more_evidence_improves:
      "More knowledge verification protocols give partners a complete evaluation path.",
    regeneration_required: true,
    mcp_endpoint_pattern: buildMcpEndpointPattern(baseUrl),
    proof_of_work_spec: {
      mcp_tool: "create_protocol",
      rest_equivalent: protocolsRest,
      purpose: "Create a knowledge verification protocol",
      when_to_call: [
        "When adding a new protocol",
        "When an authoring client needs a protocol before a session",
      ],
    },
    integration_skill: {
      mcp_tool: "generate_integration_skill",
      rest_equivalent: skillRest,
      purpose: "Regenerate partner skill.md aligned with the current protocols",
      when_to_call: [
        "When onboarding a new partner agent version",
        "After the protocol set changes",
      ],
    },
    upload_proof_of_work: {
      mcp_tool: "update_protocol",
      rest_equivalent: `PATCH ${baseUrl.replace(/\/$/, "")}${PROTOCOL_API_BASE}/{protocol_id}`,
      purpose: "Update an existing knowledge verification protocol",
      when_to_call: [
        "After create_protocol, when The Protocol Challenge or questions change",
        "When reconnecting an existing protocol to a different challenge",
      ],
    },
    performance: {
      mcp_tool: "list_protocols",
      rest_equivalent: listRest,
      purpose: "List knowledge verification protocols owned by this key.",
      when_to_call: [
        "When reviewing the current protocol set",
        "Before creating a duplicate protocol",
      ],
    },
    progress_snapshot: {
      mcp_tool: "get_protocol",
      rest_equivalent: getRest,
      purpose: "Read one knowledge verification protocol.",
      when_to_call: [
        "When connecting MCP and need protocol context",
        "Before update_protocol",
        "After long idle gaps to re-orient the agent",
      ],
    },
    recommended_cadence: `MCP loop: list_protocols → create_protocol → get_protocol → update_protocol. Knowledge regions: get_knowledge_region_options → create_knowledge_region → get_knowledge_region. REST mirror: ${PROTOCOL_API_BASE} and ${KNOWLEDGE_REGION_API_BASE}.`,
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
    mcp_tool: "list_protocols",
    rest_equivalent: `GET ${PROTOCOL_API_BASE}`,
    reason: "List knowledge verification protocols owned by this key.",
  });

  actions.push({
    priority: 2,
    mcp_tool: "create_protocol",
    rest_equivalent: `POST ${PROTOCOL_API_BASE}`,
    reason: "Create a knowledge verification protocol.",
  });

  if (proof_of_work_artifacts >= 0) {
    actions.push({
      priority: 3,
      mcp_tool: "get_protocol",
      rest_equivalent: `GET ${PROTOCOL_API_BASE}/{protocol_id}`,
      reason: "Read one knowledge verification protocol.",
    });
    actions.push({
      priority: 4,
      mcp_tool: "update_protocol",
      rest_equivalent: `PATCH ${PROTOCOL_API_BASE}/{protocol_id}`,
      reason: "Update an existing protocol.",
    });
  }

  actions.push({
    priority: 5,
    mcp_tool: "get_knowledge_region_options",
    rest_equivalent: `GET ${KNOWLEDGE_REGION_API_BASE}/options`,
    reason: "Load wizard options for knowledge-region create (protocols, strategies, AI-use).",
  });
  actions.push({
    priority: 6,
    mcp_tool: "create_knowledge_region",
    rest_equivalent: `POST ${KNOWLEDGE_REGION_API_BASE}`,
    reason: "Create a knowledge region with the simulation wizard.",
  });

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
        "Learning progress = knowledge verification protocols measured against workspace_goal. Proof of work is recorded in the product UI.",
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
    name: "Protocol management",
    description: "Knowledge verification protocol loop, REST + MCP tool mapping.",
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
- **REST:** \`${base}${PROTOCOL_API_BASE}\` and \`${base}${KNOWLEDGE_REGION_API_BASE}\` with Bearer API key
- **MCP:** \`${buildMcpEndpointPattern(baseUrl)}\` with Bearer API key and JSON-RPC tools/list

Docs: ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.api_reference} · ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.coding_agents} · ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.human_guide}
`;
  }

  if (uri === "uncertain-systems://proof-of-work-loop") {
    return `# Protocol management

ChatGPT, Claude, coding agents, or any MCP client authorizes with a Bearer key and manages knowledge verification protocols and knowledge regions. Proof of work is recorded in the product UI.

## Recommended loop
1. **list_protocols** — existing knowledge verification protocols
2. **create_protocol** / POST ${PROTOCOL_API_BASE} — send challenge (The Protocol Challenge). Do not send kind.
3. **get_protocol** / GET ${PROTOCOL_API_BASE}/{protocol_id}
4. **update_protocol** / PATCH ${PROTOCOL_API_BASE}/{protocol_id}
5. **get_knowledge_region_options** / GET ${KNOWLEDGE_REGION_API_BASE}/options
6. **create_knowledge_region** / POST ${KNOWLEDGE_REGION_API_BASE}
7. **get_knowledge_region** / GET ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}

## Quick orientation
Call **list_protocols** for knowledge verification protocols owned by this key. Call **list_knowledge_regions** for regions.

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
