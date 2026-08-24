import type { ContinuousEvaluationPolicy } from "./proof-of-work-schema";
import { formatInterruptionContractForSkillPrompt } from "./predictive-interruption";
import {
  buildProofOfWorkSchemaApiPath,
  buildProofOfWorkUploadApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
} from "./proof-of-work-integration";
import { POW_API_BASE, STASH_API_BASE } from "@/lib/api/agent-api-paths";
import { workspaceAllowsKnowledgeLinkMint } from "@/lib/workspace-kind";

export const UNCERTAIN_SYSTEMS_SCOPE = {
  product: "Uncertain Systems",
  mission:
    "Verify learning and measure readiness-to-perform using real product proof of work — not quizzes in isolation.",
  pillars: [
    "LWM Snapshot — lwm_snapshot (Learning World Model Snapshot) + GHC from tool traces, artifacts, and sessions (manual UI or Snapshot API/MCP)",
    "Proof of work — upload_proof_of_work / POST .../proof-of-work streams observable actions as durable artifacts",
    "Predictive interruptions (TIM) — every response includes interruption (object or null) with delay_ms and intervention hints",
  ],
  workspace_model:
    "A Verification Workspace has blocks (assessable units), a workspace_goal (what success means), and accumulates proof of work. Progress is continuous: upload → re-fetch spec → LWM Snapshot → repeat.",
  integrator_model:
    "Partner agents instrument their product, upload proof of work after meaningful actions, and call lwm_snapshot (LWM Snapshot) for gap reports and next actions. Both REST (Bearer API key) and MCP (JSON-RPC with Bearer auth) expose the same capabilities.",
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
  const proofOfWorkSpecRest = buildProofOfWorkSchemaApiPath(workspaceId, baseUrl);
  const skillRest = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const uploadRest = buildProofOfWorkUploadApiPath(workspaceId, baseUrl);
  const performanceRest = buildPerformanceApiPath(workspaceId, baseUrl);

  const evidenceTriggers = [
    "Before the first proof-of-work upload for a new workflow or block",
    "After every 5-10 new proof-of-work artifacts accumulate in the workspace",
    "When block definitions, eval definition, or integration tooling changes",
    "When performance reports feel stale or gaps no longer match observed behavior",
  ];

  if (proofOfWorkCount === 0) {
    evidenceTriggers.unshift(
      "Immediately: call generate_proof_of_work_schema (MCP) or POST .../proof-of-work-schema (REST) before first upload"
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
      "More upload_proof_of_work / POST .../proof-of-work calls improve LWM Snapshot (lwm_snapshot) and GHC accuracy.",
    regeneration_required: true,
    mcp_endpoint_pattern: buildMcpEndpointPattern(baseUrl),
    proof_of_work_spec: {
      mcp_tool: "generate_proof_of_work_schema",
      rest_equivalent: proofOfWorkSpecRest,
      purpose: "Fetch formal tool_submissions, upload contract, and performance_report_contract",
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
      mcp_tool: "lwm_snapshot",
      rest_equivalent: performanceRest,
      purpose:
        "LWM Snapshot (lwm_snapshot): one primary 0–100 score + GHC + spider + analysis + next actions. Sole product snapshot strategy.",
      when_to_call: [
        "After each meaningful proof-of-work batch (e.g. every 3-10 uploads)",
        "Call lwm_snapshot for LWM Snapshot (manual; not auto on TAP/ILE end)",
      ],
    },
    progress_snapshot: {
      mcp_tool: "get_learning_progress",
      rest_equivalent: `GET ${baseUrl.replace(/\/$/, "")}/api/v3/pow/workspaces/${workspaceId} + performance summary`,
      purpose:
        "One-call orientation: workspace_goal, block map, proof-of-work counts, recommended next MCP tool and REST equivalent",
      when_to_call: [
        "When connecting MCP mid-session and need workspace progress context",
        "Before choosing between upload_proof_of_work vs lwm_snapshot (LWM Snapshot)",
        "After long idle gaps to re-orient the agent",
      ],
    },
    recommended_cadence: `MCP loop: generate_proof_of_work_schema → upload_proof_of_work (repeat) → lwm_snapshot (LWM Snapshot) → regenerate schema/skill. REST mirror: ${uploadRest} → ${proofOfWorkSpecRest} → ${performanceRest}.`,
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
  const { proof_of_work_artifacts, blocks, has_workspace_goal, workspace_kind } = options;
  const allowsLinkMint = workspaceAllowsKnowledgeLinkMint(workspace_kind);

  if (!has_workspace_goal) {
    actions.push({
      priority: 1,
      mcp_tool: "get_workspace",
      rest_equivalent: "GET .../workspaces/{id}",
      reason: "Read workspace_goal — defines what learning progress should optimize toward.",
    });
  }

  if (blocks > 0 && proof_of_work_artifacts === 0) {
    actions.push({
      priority: 2,
      mcp_tool: "generate_proof_of_work_schema",
      rest_equivalent: "POST .../proof-of-work-schema",
      reason: "No proof of work yet — fetch tool_submissions contract before first upload.",
    });
    actions.push({
      priority: 3,
      mcp_tool: "list_blocks",
      rest_equivalent: "GET .../blocks",
      reason: "Map assessable blocks to upcoming upload_proof_of_work block_id fields.",
    });
  }

  if (proof_of_work_artifacts > 0 && proof_of_work_artifacts % 5 === 0) {
    actions.push({
      priority: 4,
      mcp_tool: "generate_proof_of_work_schema",
      rest_equivalent: "POST .../proof-of-work-schema",
      reason: `${proof_of_work_artifacts} artifacts — re-fetch spec so evaluation stays aligned with observed behavior.`,
    });
  }

  if (proof_of_work_artifacts >= 1 && (proof_of_work_artifacts < 3 || proof_of_work_artifacts % 3 === 0)) {
    actions.push({
      priority: 5,
      mcp_tool: "lwm_snapshot",
      rest_equivalent: "POST .../lwm-snapshot",
      reason: "Enough signal to score — request scorecard (no prompt) for marker_scores and gap_analysis.",
    });
  }

  if (proof_of_work_artifacts > 0) {
    actions.push({
      priority: 6,
      mcp_tool: "upload_proof_of_work",
      rest_equivalent: "POST .../proof-of-work",
      reason: "Continue streaming product actions — more proof of work improves learning verification.",
    });
  }

  if (allowsLinkMint && proof_of_work_artifacts >= 5 && blocks > 0) {
    actions.push({
      priority: 7,
      mcp_tool: "create_tap_link",
      rest_equivalent: "POST .../blocks/{blockId}/tap-links",
      reason: "Optional Think Aloud Protocol session adds verbal reasoning signal to progress scoring.",
    });
  }

  if (!allowsLinkMint) {
    actions.push({
      priority: 7,
      mcp_tool: "buffer_proof_of_work",
      rest_equivalent: `POST ${STASH_API_BASE}/workspaces/{id}/proof-of-work`,
      reason:
        "TAPBench Stash API — buffer then stash_proof_of_work / submit_stashed_proof_of_work. Knowledge Region agent path is PoW capture plus Stash TAPBench.",
    });
  }

  actions.push({
    priority: 8,
    mcp_tool: "get_learning_progress",
    rest_equivalent: "Composite progress snapshot",
    reason: "Re-orient on workspace_goal, counts, and recommended next steps.",
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
        "Learning progress = proof-of-work volume + quality of marker_scores/gaps from LWM Snapshot (lwm_snapshot) + GHC, measured against workspace_goal.",
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
    name: "Predictive interruptions (TIM)",
    description: "Trace Interruption Model contract: interruption field, delay_ms, supersession, consumer obligations.",
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

Progress is **continuous**, not one-time setup.

## Recommended loop
1. **generate_proof_of_work_schema** / POST .../proof-of-work-schema — get tool_submissions + contracts
2. **list_blocks** / GET .../blocks — map competencies to block_id
3. **upload_proof_of_work** / POST .../proof-of-work — after each meaningful product action (repeat)
4. **lwm_snapshot** — LWM Snapshot (sole strategy; GHC secondary on the same report)
5. Re-fetch schema + regenerate skill as proof of work grows

## Progress signals
- \`proof_of_work_summary.proof_of_work_artifacts\` — how much signal exists
- \`report.score\` / named \`lwm_snapshot_score\` — primary 0-100 LWM Snapshot
- \`report.ghc_score\` — secondary Genuine Human Cognition signal
- \`report.workspace_goal\` — inferred or owner-set workspace goal
- \`report.marker_scores\` — per-competency spider/radar axes
- \`report.gap_analysis\` — analysis + product-language next actions

## Quick orientation
Call **get_learning_progress** with \`workspace_id\` for a one-shot snapshot and recommended_next_actions.

Every **generate_proof_of_work_schema** response includes \`continuous_evaluation\` (REST) and \`continuous_evaluation_mcp\` (tools) — do not treat either as optional.

Every Proof-of-Work API success response also includes \`interruption\` (TIM) — object or null.
`;
  }

  if (uri === "uncertain-systems://predictive-interruptions") {
    return `# Predictive interruptions (Trace Interruption Model)

${formatInterruptionContractForSkillPrompt()}

## REST + MCP parity
- REST success bodies and MCP tool results both include top-level \`interruption\`.
- \`interruption_contract\` on proof-of-work spec responses documents the full TIM contract.
- Supersession: any later Proof-of-Work API response replaces the previous pending interruption timer.
`;
  }

  return null;
}