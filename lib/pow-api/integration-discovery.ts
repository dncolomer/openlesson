import type { ContinuousEvaluationPolicy } from "./proof-of-work-schema";
import { formatInterruptionContractForSkillPrompt } from "./predictive-interruption";
import {
  buildHeadlessSessionStartApiPath,
  buildProofOfWorkUploadApiPath,
  buildIntegrationSkillApiPath,
} from "./proof-of-work-integration";
import { POW_API_BASE, WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";
import { workspaceSupportsFeature } from "@/lib/workspace-capabilities";

export const UNCERTAIN_SYSTEMS_SCOPE = {
  product: "Uncertain Systems",
  mission:
    "Verify learning and measure readiness-to-perform using real product proof of work — not quizzes in isolation.",
  pillars: [
    "Workspace management — create and edit a Learning workspace, the map, workspace settings, and account settings",
    "Headless proof of work — start_session → upload_proof_of_work → end_session. The server prepares the answers-model tree, infers the path, and enforces the clock",
    "Predictive interruptions (expected free energy) — every response includes interruption (object or null) with delay_ms and intervention hints",
  ],
  workspace_model:
    "A workspace has blocks (assessable units), a workspace_goal (what success means), and headless Calibrate / Learn / Verify sessions. Progress is continuous: start_session → upload proof of work → end_session → repeat.",
  integrator_model:
    "Partner agents authorize with a Bearer key, manage workspaces, and run flows headless. ChatGPT, Claude, or any MCP client uses the same two APIs.",
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
      label: "Proof-of-Work API (REST)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: `${base}${POW_API_BASE}/workspaces/{workspace_id}`,
      when_to_use: "Production integrations, server-side agents, and clients with standard HTTP + Bearer auth.",
    },
    {
      transport: "mcp",
      label: "Proof-of-Work API MCP (JSON-RPC)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: buildMcpEndpointPattern(baseUrl),
      when_to_use:
        "Cursor, Claude Desktop, Grok, and other MCP clients — full parity with REST for proof-of-work loop and progress tracking.",
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
  const proofOfWorkCount = contextCounts?.proof_of_work_artifacts ?? 0;
  const startRest = `POST ${buildHeadlessSessionStartApiPath(workspaceId, baseUrl)}`;
  const skillRest = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const uploadRest = `POST ${buildProofOfWorkUploadApiPath(workspaceId, baseUrl)}`;

  const evidenceTriggers = [
    "Before the first proof-of-work upload for a new workflow or block",
    "After every 5-10 new proof-of-work artifacts accumulate in the workspace",
    "When block definitions, eval definition, or integration tooling changes",
    "When performance reports feel stale or gaps no longer match observed behavior",
  ];

  if (proofOfWorkCount === 0) {
    evidenceTriggers.unshift(
      "Immediately: call start_session (MCP) or POST .../sessions (REST) before the first upload"
    );
  } else if (proofOfWorkCount < 10) {
    evidenceTriggers.unshift(
      `Now: workspace has ${proofOfWorkCount} artifact(s) — re-fetch schema so tool_submissions reflect learned patterns`
    );
  } else {
    evidenceTriggers.unshift(
      `Re-fetch recommended: ${proofOfWorkCount} artifacts — spec should encode observed workflows`
    );
  }

  return {
    principle: UNCERTAIN_SYSTEMS_SCOPE.workspace_model,
    more_evidence_improves:
      "More upload_proof_of_work calls during a live session improve the inferred path on the prepared answers-model tree.",
    regeneration_required: true,
    mcp_endpoint_pattern: buildMcpEndpointPattern(baseUrl),
    proof_of_work_spec: {
      mcp_tool: "start_session",
      rest_equivalent: startRest,
      purpose: "Start a headless Calibrate, Learn, or Verify session: prepare the answers-model tree and clock",
      when_to_call: evidenceTriggers,
    },
    integration_skill: {
      mcp_tool: "generate_integration_skill",
      rest_equivalent: skillRest,
      purpose: "Regenerate partner skill.md aligned with latest spec and workspace context",
      when_to_call: [
        "After regenerating or materially updating the proof of work spec",
        "When onboarding a new partner agent version",
        "On a recurring cadence during active evaluation — never treat initial skill as permanent",
      ],
    },
    upload_proof_of_work: {
      mcp_tool: "upload_proof_of_work",
      rest_equivalent: uploadRest,
      purpose: "Stream product/tool actions as learning proof of work after meaningful user steps",
      when_to_call: [
        "After each observable workflow action defined in tool_submissions",
        "Include block_id when the action maps to a workspace block",
        "Batch uploads are fine; continuous streams beat one-time dumps",
      ],
    },
    performance: {
      mcp_tool: "end_session",
      rest_equivalent: `${baseUrl.replace(/\/$/, "")}${POW_API_BASE}/workspaces/${workspaceId}/sessions/{session_id}/end`,
      purpose:
        "End a headless session: score the inferred path against the prepared answers-model tree and persist the flow embedding.",
      when_to_call: [
        "When the session clock expires or the agent is done",
        "After streaming proof of work into start_session",
      ],
    },
    progress_snapshot: {
      mcp_tool: "get_workspace",
      rest_equivalent: `GET ${baseUrl.replace(/\/$/, "")}${WORKSPACE_API_BASE}/${workspaceId}`,
      purpose:
        "Workspace orientation: kind, map, settings, and workspace_goal.",
      when_to_call: [
        "When connecting MCP mid-session and need workspace context",
        "Before start_session",
        "After long idle gaps to re-orient the agent",
      ],
    },
    recommended_cadence: `MCP loop: create_workspace or get_workspace → start_session → upload_proof_of_work (repeat) → end_session → regenerate skill. REST mirror: ${WORKSPACE_API_BASE} → ${startRest} → ${uploadRest}.`,
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
  }

  if (proof_of_work_artifacts === 0) {
    actions.push({
      priority: 3,
      mcp_tool: "start_session",
      rest_equivalent: `POST ${POW_API_BASE}/workspaces/{id}/sessions`,
      reason: "Start a headless Calibrate, Learn, or Verify session.",
    });
  }

  if (proof_of_work_artifacts > 0) {
    actions.push({
      priority: 4,
      mcp_tool: "upload_proof_of_work",
      rest_equivalent: `POST ${POW_API_BASE}/workspaces/{id}/sessions/{session_id}/proof-of-work`,
      reason: "Stream proof of work into the live session so the server can infer the path.",
    });
    actions.push({
      priority: 5,
      mcp_tool: "end_session",
      rest_equivalent: `POST ${POW_API_BASE}/workspaces/{id}/sessions/{session_id}/end`,
      reason: "End the session to persist the answers-model tree, inferred path, and flow embedding.",
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
        "Learning progress = headless session proof of work projected onto the prepared answers-model tree, measured against workspace_goal.",
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
    name: "Proof-of-work loop and progress tracking",
    description: "Continuous evaluation loop, REST + MCP tool mapping, when to score.",
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
- **REST:** \`${base}/api/v3/pow/workspaces/{workspace_id}\` with Bearer API key
- **MCP:** \`${buildMcpEndpointPattern(baseUrl)}\` with Bearer API key and JSON-RPC tools/list

Docs: ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.api_reference} · ${base}${UNCERTAIN_SYSTEMS_SCOPE.docs.human_guide}
`;
  }

  if (uri === "uncertain-systems://proof-of-work-loop") {
    return `# Proof-of-work loop and learning progress

Progress is **continuous**, not one-time setup. ChatGPT, Claude, or any MCP client authorizes with a Bearer key and runs Calibrate, Learn, or Verify headless.

## Recommended loop
1. **create_workspace** or **get_workspace** — Learning workspace, map, settings
2. **start_session** / POST ${POW_API_BASE}/workspaces/{workspace_id}/sessions — \`flow_kind\` calibrate | learn | verify. The server prepares the answers-model tree and starts the clock.
3. **upload_proof_of_work** / POST ${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work — after each meaningful action (repeat). The server infers the path on the prepared tree (catalogs 4 / 8 / 16). Expired sessions reject further work.
4. **end_session** / POST ${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}/end — score the inferred path and persist the flow embedding
5. **generate_integration_skill** as the workspace grows

## Progress signals
- \`answers_model\` — prepared tree (catalog size, focus, branch count)
- \`sequence\` — inferred path from proof plus actions
- \`remaining_ms\` — session clock
- \`embedding\` — flowcfg-v1-d96 after end_session (answers model + projected policy + proof of work)

## Quick orientation
Call **get_workspace** with \`workspace_id\` for metadata and workspace_goal. Call **get_session** for remaining time and the current focus.

Every schema/skill response includes \`continuous_evaluation\` (REST) and \`continuous_evaluation_mcp\` (tools) — do not treat either as optional.

Every Proof-of-Work API success response also includes \`interruption\` (expected free energy) — object or null.

Snapshot and Stash are not public agent tools.
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