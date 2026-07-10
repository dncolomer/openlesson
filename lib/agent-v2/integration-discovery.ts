import type { ContinuousEvaluationPolicy } from "./evidence-schema";
import { formatInterruptionContractForSkillPrompt } from "./predictive-interruption";
import {
  buildEvidenceSchemaApiPath,
  buildEvidenceUploadApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
} from "./evidence-integration";

export const OPENLESSON_SCOPE = {
  product: "openLesson",
  mission:
    "Verify learning and measure readiness-to-perform using real product evidence — not quizzes in isolation.",
  pillars: [
    "Learning verification — overall_score and marker_scores from tool traces, artifacts, and sessions",
    "Learning-to-conversion — conversion_score and conversion_goal tie competency to business outcomes",
    "Proof of work — upload_evidence / POST .../evidence streams observable actions as durable artifacts",
    "Predictive interruptions (TIM) — every response includes interruption (object or null) with delay_ms and intervention hints",
  ],
  workspace_model:
    "A Verification Workspace has blocks (assessable units), a conversion_goal (what success means), and accumulates evidence. Progress is continuous: upload → re-fetch spec → score → coach → repeat.",
  integrator_model:
    "Partner agents instrument their product, upload evidence after meaningful actions, and call performance analysis for gap reports and next-step coaching. Both REST (Bearer API key) and MCP (JSON-RPC with key in URL) expose the same capabilities.",
  docs: {
    api_reference: "/skill.md",
    human_guide: "/docs/agentic-v2",
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
  evidence_spec: McpEvaluationRef;
  integration_skill: McpEvaluationRef;
  upload_evidence: McpEvaluationRef;
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
      label: "Evidence API (REST)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: `${base}/api/v2/agent/workspaces/{workspace_id}`,
      when_to_use: "Production integrations, server-side agents, and clients with standard HTTP + Bearer auth.",
    },
    {
      transport: "mcp",
      label: "Evidence API MCP (JSON-RPC)",
      auth: "Authorization: Bearer <api_key>",
      entrypoint: buildMcpEndpointPattern(baseUrl),
      when_to_use:
        "Cursor, Claude Desktop, Grok, and other MCP clients — full parity with REST for evidence loop and progress tracking.",
    },
  ];
}

export function buildContinuousEvaluationMcpPolicy(
  workspaceId: string,
  baseUrl: string,
  contextCounts?: {
    evidence_artifacts?: number;
    blocks?: number;
    plan_files?: number;
    tap_sessions?: number;
  } | null
): ContinuousEvaluationMcpPolicy {
  const evidenceCount = contextCounts?.evidence_artifacts ?? 0;
  const evidenceSpecRest = buildEvidenceSchemaApiPath(workspaceId, baseUrl);
  const skillRest = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const uploadRest = buildEvidenceUploadApiPath(workspaceId, baseUrl);
  const performanceRest = buildPerformanceApiPath(workspaceId, baseUrl);

  const evidenceTriggers = [
    "Before the first evidence upload for a new workflow or block",
    "After every 5-10 new evidence artifacts accumulate in the workspace",
    "When block definitions, eval definition, or integration tooling changes",
    "When performance reports feel stale or gaps no longer match observed behavior",
  ];

  if (evidenceCount === 0) {
    evidenceTriggers.unshift(
      "Immediately: call generate_evidence_schema (MCP) or POST .../evidence-schema (REST) before first upload"
    );
  } else if (evidenceCount < 10) {
    evidenceTriggers.unshift(
      `Now: workspace has ${evidenceCount} artifact(s) — re-fetch schema so tool_submissions reflect learned patterns`
    );
  } else {
    evidenceTriggers.unshift(
      `Re-fetch recommended: ${evidenceCount} artifacts — spec should encode observed workflows`
    );
  }

  return {
    principle: OPENLESSON_SCOPE.workspace_model,
    more_evidence_improves:
      "More upload_evidence / POST .../evidence calls improve marker_scores, gap_analysis, and conversion_score accuracy.",
    regeneration_required: true,
    mcp_endpoint_pattern: buildMcpEndpointPattern(baseUrl),
    evidence_spec: {
      mcp_tool: "generate_evidence_schema",
      rest_equivalent: evidenceSpecRest,
      purpose: "Fetch formal tool_submissions, upload contract, and performance_report_contract",
      when_to_call: evidenceTriggers,
    },
    integration_skill: {
      mcp_tool: "generate_integration_skill",
      rest_equivalent: skillRest,
      purpose: "Regenerate partner skill.md aligned with latest spec and workspace context",
      when_to_call: [
        "After regenerating or materially updating the evidence spec",
        "When onboarding a new partner agent version",
        "On a recurring cadence during active evaluation — never treat initial skill as permanent",
      ],
    },
    upload_evidence: {
      mcp_tool: "upload_evidence",
      rest_equivalent: uploadRest,
      purpose: "Stream product/tool actions as learning evidence after meaningful user steps",
      when_to_call: [
        "After each observable workflow action defined in tool_submissions",
        "Include block_id when the action maps to a workspace block",
        "Batch uploads are fine; continuous streams beat one-time dumps",
      ],
    },
    performance: {
      mcp_tool: "analyze_performance",
      rest_equivalent: performanceRest,
      purpose: "Read learning progress: overall_score, marker_scores, gaps, next_steps; or chat with prompt",
      when_to_call: [
        "After each meaningful evidence batch (e.g. every 3-10 uploads)",
        "Before coaching the user on what to do next",
        "Omit prompt for structured scorecard; include prompt for Q&A",
      ],
    },
    progress_snapshot: {
      mcp_tool: "get_learning_progress",
      rest_equivalent: `GET ${baseUrl.replace(/\/$/, "")}/api/v2/agent/workspaces/${workspaceId} + performance summary`,
      purpose:
        "One-call orientation: conversion_goal, block map, evidence counts, recommended next MCP tool and REST equivalent",
      when_to_call: [
        "When connecting MCP mid-session and need workspace progress context",
        "Before choosing between upload_evidence vs analyze_performance",
        "After long idle gaps to re-orient the agent",
      ],
    },
    recommended_cadence: `MCP loop: generate_evidence_schema → upload_evidence (repeat) → analyze_performance → regenerate schema/skill. REST mirror: ${uploadRest} → ${evidenceSpecRest} → ${performanceRest}.`,
  };
}

export function recommendIntegrationActions(options: {
  evidence_artifacts: number;
  blocks: number;
  tap_sessions: number;
  has_conversion_goal: boolean;
  last_report_overall_score?: number | null;
}): RecommendedIntegrationAction[] {
  const actions: RecommendedIntegrationAction[] = [];
  const { evidence_artifacts, blocks, tap_sessions, has_conversion_goal } = options;

  if (!has_conversion_goal) {
    actions.push({
      priority: 1,
      mcp_tool: "get_workspace",
      rest_equivalent: "GET .../workspaces/{id}",
      reason: "Read conversion_goal — defines what learning progress should optimize toward.",
    });
  }

  if (blocks > 0 && evidence_artifacts === 0) {
    actions.push({
      priority: 2,
      mcp_tool: "generate_evidence_schema",
      rest_equivalent: "POST .../evidence-schema",
      reason: "No evidence yet — fetch tool_submissions contract before first upload.",
    });
    actions.push({
      priority: 3,
      mcp_tool: "list_blocks",
      rest_equivalent: "GET .../blocks",
      reason: "Map assessable blocks to upcoming upload_evidence block_id fields.",
    });
  }

  if (evidence_artifacts > 0 && evidence_artifacts % 5 === 0) {
    actions.push({
      priority: 4,
      mcp_tool: "generate_evidence_schema",
      rest_equivalent: "POST .../evidence-schema",
      reason: `${evidence_artifacts} artifacts — re-fetch spec so evaluation stays aligned with observed behavior.`,
    });
  }

  if (evidence_artifacts >= 1 && (evidence_artifacts < 3 || evidence_artifacts % 3 === 0)) {
    actions.push({
      priority: 5,
      mcp_tool: "analyze_performance",
      rest_equivalent: "POST .../performance",
      reason: "Enough signal to score — request scorecard (no prompt) for marker_scores and gap_analysis.",
    });
  }

  if (evidence_artifacts > 0) {
    actions.push({
      priority: 6,
      mcp_tool: "upload_evidence",
      rest_equivalent: "POST .../evidence",
      reason: "Continue streaming product actions — more evidence improves learning verification.",
    });
  }

  if (tap_sessions === 0 && evidence_artifacts >= 5 && blocks > 0) {
    actions.push({
      priority: 7,
      mcp_tool: "create_tap_link",
      rest_equivalent: "POST .../blocks/{blockId}/tap-links",
      reason: "Optional Think Aloud Protocol session adds verbal reasoning signal to progress scoring.",
    });
  }

  actions.push({
    priority: 8,
    mcp_tool: "get_learning_progress",
    rest_equivalent: "Composite progress snapshot",
    reason: "Re-orient on conversion_goal, counts, and recommended next steps.",
  });

  return actions.sort((a, b) => a.priority - b.priority);
}

export function buildOpenLessonScopeForWorkspace(options: {
  workspaceTitle: string;
  conversionGoal?: string | null;
  blockCount: number;
  evidenceCount: number;
}): Record<string, unknown> {
  return {
    ...OPENLESSON_SCOPE,
    workspace_context: {
      title: options.workspaceTitle,
      conversion_goal: options.conversionGoal?.trim() || "Infer from workspace title, notes, and evidence.",
      block_count: options.blockCount,
      evidence_artifact_count: options.evidenceCount,
      progress_interpretation:
        "Learning progress = evidence volume + quality of marker_scores/gaps from analyze_performance, measured against conversion_goal.",
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
    uri: "openlesson://integration-scope",
    name: "OpenLesson integration scope",
    description: "What openLesson is, workspace model, and learning-vs-conversion goals.",
    mimeType: "text/markdown",
  },
  {
    uri: "openlesson://evidence-loop",
    name: "Evidence loop and progress tracking",
    description: "Continuous evaluation loop, REST + MCP tool mapping, when to score.",
    mimeType: "text/markdown",
  },
  {
    uri: "openlesson://predictive-interruptions",
    name: "Predictive interruptions (TIM)",
    description: "Trace Interruption Model contract: interruption field, delay_ms, supersession, consumer obligations.",
    mimeType: "text/markdown",
  },
] as const;

export function buildMcpResourceContent(uri: string, baseUrl: string): string | null {
  const base = baseUrl.replace(/\/$/, "");

  if (uri === "openlesson://integration-scope") {
    return `# OpenLesson integration scope

${OPENLESSON_SCOPE.mission}

## Pillars
${OPENLESSON_SCOPE.pillars.map((p) => `- ${p}`).join("\n")}

## Workspace model
${OPENLESSON_SCOPE.workspace_model}

## Integrator model
${OPENLESSON_SCOPE.integrator_model}

## Surfaces (use either)
- **REST:** \`${base}/api/v2/agent/workspaces/{workspace_id}\` with Bearer API key
- **MCP:** \`${buildMcpEndpointPattern(baseUrl)}\` with Bearer API key and JSON-RPC tools/list

Docs: ${base}${OPENLESSON_SCOPE.docs.api_reference} · ${base}${OPENLESSON_SCOPE.docs.human_guide}
`;
  }

  if (uri === "openlesson://evidence-loop") {
    return `# Evidence loop and learning progress

Progress is **continuous**, not one-time setup.

## Recommended loop
1. **generate_evidence_schema** / POST .../evidence-schema — get tool_submissions + contracts
2. **list_blocks** / GET .../blocks — map competencies to block_id
3. **upload_evidence** / POST .../evidence — after each meaningful product action (repeat)
4. **analyze_performance** / POST .../performance — scorecard (no prompt) or chat (with prompt)
5. Re-fetch schema + regenerate skill as evidence grows

## Progress signals
- \`evidence_summary.evidence_artifacts\` — how much signal exists
- \`report.overall_score\` — learning verification (0-100)
- \`report.conversion_score\` — likelihood of achieving conversion_goal
- \`report.marker_scores\` — per-competency radar axes
- \`report.gap_analysis\` — deficiencies + product-language next steps

## Quick orientation
Call **get_learning_progress** with \`workspace_id\` for a one-shot snapshot and recommended_next_actions.

Every **generate_evidence_schema** response includes \`continuous_evaluation\` (REST) and \`continuous_evaluation_mcp\` (tools) — do not treat either as optional.

Every Evidence API success response also includes \`interruption\` (TIM) — object or null.
`;
  }

  if (uri === "openlesson://predictive-interruptions") {
    return `# Predictive interruptions (Trace Interruption Model)

${formatInterruptionContractForSkillPrompt()}

## REST + MCP parity
- REST success bodies and MCP tool results both include top-level \`interruption\`.
- \`interruption_contract\` on evidence spec responses documents the full TIM contract.
- Supersession: any later Evidence API response replaces the previous pending interruption timer.
`;
  }

  return null;
}