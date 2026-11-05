import type { ContinuousEvaluationPolicy } from "./proof-of-work-schema";
import { formatInterruptionContractForSkillPrompt } from "./predictive-interruption";
import { buildIntegrationSkillApiPath } from "./proof-of-work-integration";
import { WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";
import { workspaceSupportsFeature } from "@/lib/workspace-capabilities";

export const UNCERTAIN_SYSTEMS_SCOPE = {
  product: "Uncertain Systems",
  mission:
    "Verify learning and measure readiness-to-perform using real product proof of work — not quizzes in isolation.",
  pillars: [
    "Learning Map management — create and edit a Learning Map, Helios map tools, workspace settings, and account settings",
    "Flow management — create, list, update, and link Solve, Calibration, and Verification flows onto map tiles",
    "Proof of work is recorded in the product UI — not a public agent session loop",
  ],
  workspace_model:
    "A Learning Map has tiles (Solve, Calibration, Verification, Content) and a workspace_goal. Agents create the map and the three flow types, then place flows on tiles.",
  integrator_model:
    "Partner agents authorize with a Bearer key and manage Learning Maps plus Solve, Calibration, and Verification flows. ChatGPT, Claude, or any MCP client uses the same REST and MCP surface.",
  docs: {
    api_reference: "/skill.md",
    human_guide: "/docs/learning-map-api",
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
      label: "Workspace management API (REST)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: `${base}${WORKSPACE_API_BASE}`,
      when_to_use: "Production integrations, server-side agents, and clients with standard HTTP + Bearer auth.",
    },
    {
      transport: "mcp",
      label: "Workspace management MCP (JSON-RPC)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: buildMcpEndpointPattern(baseUrl),
      when_to_use:
        "Cursor, Claude Desktop, Grok, and other MCP clients — full parity with REST for Learning Map and flow management.",
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
  const flowsRest = `POST ${baseUrl.replace(/\/$/, "")}${WORKSPACE_API_BASE}/${workspaceId}/flows`;
  const linkRest = `POST ${baseUrl.replace(/\/$/, "")}${WORKSPACE_API_BASE}/${workspaceId}/flows/{flow_id}/link`;
  const mapRest = `POST ${baseUrl.replace(/\/$/, "")}${WORKSPACE_API_BASE}/${workspaceId}/map-tools`;
  void contextCounts;

  return {
    principle: UNCERTAIN_SYSTEMS_SCOPE.workspace_model,
    more_evidence_improves:
      "More map tiles and linked Solve, Calibration, and Verification flows give the Learning Map a complete path.",
    regeneration_required: true,
    mcp_endpoint_pattern: buildMcpEndpointPattern(baseUrl),
    proof_of_work_spec: {
      mcp_tool: "create_flow",
      rest_equivalent: flowsRest,
      purpose: "Create a Solve, Calibration, or Verification flow on this Learning Map",
      when_to_call: [
        "When adding a new flow to the map",
        "When Helios or Manual authoring needs a flow before placing a tile",
      ],
    },
    integration_skill: {
      mcp_tool: "generate_integration_skill",
      rest_equivalent: skillRest,
      purpose: "Regenerate partner skill.md aligned with the current map and flows",
      when_to_call: [
        "When onboarding a new partner agent version",
        "After the map or flow set changes",
      ],
    },
    upload_proof_of_work: {
      mcp_tool: "link_flow",
      rest_equivalent: linkRest,
      purpose: "Place a flow onto a Learning Map tile",
      when_to_call: [
        "After create_flow, when a tile should launch that flow",
        "When reconnecting an existing flow to a different tile",
      ],
    },
    performance: {
      mcp_tool: "apply_map_tool",
      rest_equivalent: mapRest,
      purpose: "Apply Helios Learning Map builder tools (same catalog as in-app Helios).",
      when_to_call: [
        "When placing, shaping, or connecting map tiles",
        "When a flow should be created with the tile (add_block / create_flow)",
      ],
    },
    progress_snapshot: {
      mcp_tool: "get_workspace",
      rest_equivalent: `GET ${baseUrl.replace(/\/$/, "")}${WORKSPACE_API_BASE}/${workspaceId}`,
      purpose:
        "Workspace orientation: kind, map, settings, and workspace_goal.",
      when_to_call: [
        "When connecting MCP and need workspace context",
        "Before create_flow or apply_map_tool",
        "After long idle gaps to re-orient the agent",
      ],
    },
    recommended_cadence: `MCP loop: create_workspace or get_workspace → list_map_tools / apply_map_tool → create_flow → link_flow. REST mirror: ${WORKSPACE_API_BASE}.`,
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

  if (!has_workspace_goal) {
    actions.push({
      priority: 1,
      mcp_tool: "get_workspace",
      rest_equivalent: `GET ${WORKSPACE_API_BASE}/{id}`,
      reason: "Read workspace_goal, kind, and settings before running a flow.",
    });
  }

  if (blocks >= 0) {
    actions.push({
      priority: 2,
      mcp_tool: "list_blocks",
      rest_equivalent: `GET ${WORKSPACE_API_BASE}/{id}/blocks`,
      reason: "Read the map / contents on a Learning workspace.",
    });
  }

  if (workspaceSupportsFeature(options.workspace_kind, "map")) {
    actions.push({
      priority: 2,
      mcp_tool: "list_map_tools",
      rest_equivalent: `GET ${WORKSPACE_API_BASE}/{id}/map-tools`,
      reason:
        "Read the Helios Learning Map builder catalog (topologies, unusable ground, generative effects, DAG, overlay notes and drawing layers).",
    });
    actions.push({
      priority: 2,
      mcp_tool: "apply_map_tool",
      rest_equivalent: `POST ${WORKSPACE_API_BASE}/{id}/map-tools`,
      reason: "Apply Helios Learning Map builder tools to place, shape, or connect tiles.",
    });
  }

  actions.push({
    priority: 3,
    mcp_tool: "create_flow",
    rest_equivalent: `POST ${WORKSPACE_API_BASE}/{id}/flows`,
    reason: "Create a Solve, Calibration, or Verification flow on this Learning Map.",
  });

  if (proof_of_work_artifacts >= 0) {
    actions.push({
      priority: 4,
      mcp_tool: "list_flows",
      rest_equivalent: `GET ${WORKSPACE_API_BASE}/{id}/flows`,
      reason: "List Solve, Calibration, and Verification flows on this map.",
    });
    actions.push({
      priority: 5,
      mcp_tool: "link_flow",
      rest_equivalent: `POST ${WORKSPACE_API_BASE}/{id}/flows/{flow_id}/link`,
      reason: "Place a flow onto a Learning Map tile.",
    });
  }

  actions.push({
    priority: 6,
    mcp_tool: "get_workspace",
    rest_equivalent: `GET ${WORKSPACE_API_BASE}/{id}`,
    reason: "Re-orient on workspace_goal, map, and settings.",
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
    name: "Learning Map and flow management",
    description: "Map + three-flow loop, REST + MCP tool mapping.",
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
- **REST:** \`${base}${WORKSPACE_API_BASE}\` with Bearer API key
- **MCP:** \`${buildMcpEndpointPattern(baseUrl)}\` with Bearer API key and JSON-RPC tools/list

Docs: ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.api_reference} · ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.human_guide}
`;
  }

  if (uri === "uncertain-systems://proof-of-work-loop") {
    return `# Learning Map and flow management

ChatGPT, Claude, or any MCP client authorizes with a Bearer key and manages Learning Maps plus Solve, Calibration, and Verification flows. Proof of work is recorded in the product UI.

## Recommended loop
1. **create_workspace** or **get_workspace** — Learning Map, settings
2. **list_map_tools** / **apply_map_tool** — Helios catalog on REST ${WORKSPACE_API_BASE}/{workspace_id}/map-tools
3. **create_flow** / POST ${WORKSPACE_API_BASE}/{workspace_id}/flows — kind solve | calibration | verification
4. **link_flow** / POST ${WORKSPACE_API_BASE}/{workspace_id}/flows/{flow_id}/link — place the flow on a map tile
5. **generate_integration_skill** as the map grows

## Quick orientation
Call **get_workspace** with \`workspace_id\` for metadata and workspace_goal. Call **list_flows** for Solve, Calibration, and Verification flows on the map.

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