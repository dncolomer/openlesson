import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  buildProofOfWorkSchemaInstructions,
  buildProofOfWorkSchemaPrompt,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
  parseProofOfWorkSchemaRequest,
  type ContinuousEvaluationPolicy,
  type ProofOfWorkEvalSchemaResult,
  type ProofOfWorkSchemaRequest,
} from "./proof-of-work-schema";
import { buildWorkspacePerformanceContext } from "./performance-context";
import {
  buildOpaqueProofOfWorkSpec,
  buildPrivacyMetadata,
  isOpaqueWorkspace,
  parseOpaqueSchemaRequest,
  parseWorkspaceEvaluationMeta,
  type OpaqueSchemaRequest,
} from "./opaque-evaluation";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildUncertainSystemsScopeForWorkspace,
  formatDualSurfaceGuidance,
  recommendIntegrationActions,
} from "./integration-discovery";
import { POW_MODEL_VERSION } from "./workspace-proof-of-work";
import {
  buildVerticalScoreReportContract,
  type PerformanceReportContract,
} from "./performance-report";
import {
  buildInterruptionContract,
  formatInterruptionContractForSkillPrompt,
  normalizePredictedInterruption,
  type ProofOfWorkApiInterruption,
} from "./predictive-interruption";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";
import { workspaceResource, powWorkspaceResource } from "@/lib/api/agent-api-paths";

export const EVIDENCE_SPEC_VERSION = "1.3";

export function buildProofOfWorkSchemaApiPath(workspaceId: string, baseUrl: string): string {
  return powWorkspaceResource(workspaceId, "proof-of-work-schema", baseUrl);
}

export function buildProofOfWorkUploadApiPath(workspaceId: string, baseUrl: string): string {
  return powWorkspaceResource(workspaceId, "sessions/{session_id}/proof-of-work", baseUrl);
}

export function buildHeadlessSessionStartApiPath(workspaceId: string, baseUrl: string): string {
  return powWorkspaceResource(workspaceId, "sessions", baseUrl);
}

export function buildIntegrationSkillApiPath(workspaceId: string, baseUrl: string): string {
  return workspaceResource(workspaceId, "integration-skill", baseUrl);
}

/** Headless session end — public agent performance outcome. */
export function buildPerformanceApiPath(workspaceId: string, baseUrl: string): string {
  return powWorkspaceResource(workspaceId, "sessions/{session_id}/end", baseUrl);
}

export function buildContinuousEvaluationPolicy(
  workspaceId: string,
  baseUrl: string,
  contextCounts?: {
    proof_of_work_artifacts?: number;
    blocks?: number;
    workspace_files?: number;
  } | null
): ContinuousEvaluationPolicy {
  const proofOfWorkCount = contextCounts?.proof_of_work_artifacts ?? 0;
  const flowsPath = workspaceResource(workspaceId, "flows", baseUrl);
  const skillPath = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const mapPath = workspaceResource(workspaceId, "map-tools", baseUrl);

  const evidenceTriggers = [
    "When adding a Solve, Calibration, or Verification flow to the Learning Map",
    "After Helios or Manual authoring needs a flow before placing a tile",
    "When block definitions or workspace_goal change",
  ];

  if (proofOfWorkCount === 0) {
    evidenceTriggers.unshift("Immediately now: workspace has little or no proof of work yet; spec will sharpen as the map and flows grow");
  } else if (proofOfWorkCount < 10) {
    evidenceTriggers.unshift(
      `Now recommended: workspace has ${proofOfWorkCount} proof-of-work artifact(s) recorded in the product UI; keep the map and flows aligned`
    );
  } else {
    evidenceTriggers.unshift(
      `Re-fetch recommended: workspace already has ${proofOfWorkCount} proof-of-work artifacts; spec should reflect the current map and flows`
    );
  }

  return {
    principle:
      "Uncertain Systems public agents manage Learning Maps and Solve, Calibration, and Verification flows. Proof of work is recorded in the product UI.",
    more_evidence_improves:
      "More map tiles and linked Solve, Calibration, and Verification flows give the Learning Map a complete path.",
    regeneration_required: true,
    proof_of_work_spec: {
      api_path: flowsPath,
      method: "POST",
      purpose: "Create a Solve, Calibration, or Verification flow on this Learning Map",
      when_to_call: evidenceTriggers,
    },
    integration_skill: {
      api_path: skillPath,
      method: "POST",
      purpose: "Regenerate skill.md so partner agents stay aligned with the latest map and flows",
      when_to_call: [
        "After the map or flow set changes",
        "When onboarding a new partner agent version",
        "Never treat the initial skill.md as permanent; regeneration is part of the operating model",
      ],
    },
    performance: {
      api_path: mapPath,
      method: "POST",
      purpose: "Apply Helios Learning Map builder tools (same catalog as in-app Helios)",
      when_to_call: [
        "When placing, shaping, or connecting map tiles",
        "When a flow should be created with the tile",
      ],
    },
    recommended_cadence: `Map + flow loop: create_workspace or get_workspace → list_map_tools / apply_map_tool (${mapPath}) → create_flow (${flowsPath}) → link_flow → regenerate skill (${skillPath}).`,
  };
}

export function enrichProofOfWorkSpecResult(
  result: ProofOfWorkEvalSchemaResult,
  workspaceId: string,
  baseUrl: string,
  blockId?: string | null,
  contextCounts?: {
    proof_of_work_artifacts?: number;
    blocks?: number;
    workspace_files?: number;
  } | null,
  workspaceMeta?: {
    title?: string;
    workspace_goal?: string | null;
    workspace_kind?: unknown;
  }
): ProofOfWorkEvalSchemaResult {
  const proofOfWorkSpecPath = buildProofOfWorkSchemaApiPath(workspaceId, baseUrl);
  const skillPath = buildIntegrationSkillApiPath(workspaceId, baseUrl);

  const mapRequiredFields = ["workspace_id", "tool", "tool_calls"] as const;
  const performanceContract: PerformanceReportContract = {
    ...(result.performance_report_contract ??
      buildVerticalScoreReportContract("verification", baseUrl)),
    endpoint_pattern: `POST ${workspaceResource(workspaceId, "map-tools", baseUrl)}`,
    mcp_tool: "apply_map_tool",
    required_fields: [...mapRequiredFields],
  };

  const continuousEvaluation = buildContinuousEvaluationPolicy(workspaceId, baseUrl, contextCounts);
  const continuousEvaluationMcp = buildContinuousEvaluationMcpPolicy(workspaceId, baseUrl, contextCounts);
  const proofOfWorkCount = contextCounts?.proof_of_work_artifacts ?? 0;
  const blockCount = contextCounts?.blocks ?? 0;
  const llmInterruption = normalizePredictedInterruption(
    result.predicted_interruption,
    "create_flow",
    workspaceId
  );

  return {
    ...result,
    spec_version: EVIDENCE_SPEC_VERSION,
    pow_model_version: POW_MODEL_VERSION,
    interruption_contract: buildInterruptionContract(),
    predicted_interruption: llmInterruption,
    proof_of_work_spec_api_path: proofOfWorkSpecPath,
    proof_of_work_upload_api_path: buildProofOfWorkUploadApiPath(workspaceId, baseUrl),
    workspace_id: workspaceId,
    block_id: blockId ?? null,
    performance_report_contract: performanceContract,
    vertical_score_contracts: {
      verification: performanceContract,
    },
    continuous_evaluation: continuousEvaluation,
    continuous_evaluation_mcp: continuousEvaluationMcp,
    uncertain_systems_scope: buildUncertainSystemsScopeForWorkspace({
      workspaceTitle: workspaceMeta?.title || result.schema_name,
      workspaceGoal: workspaceMeta?.workspace_goal,
      blockCount,
      proofOfWorkCount,
    }),
    integration_surfaces: buildIntegrationSurfaces(baseUrl),
    recommended_next_actions: recommendIntegrationActions({
      proof_of_work_artifacts: proofOfWorkCount,
      blocks: blockCount,
      has_workspace_goal: Boolean(workspaceMeta?.workspace_goal?.trim()),
      workspace_kind: workspaceMeta?.workspace_kind,
    }),
    collection_guidance: [
      result.collection_guidance,
      result.continuous_evaluation_summary,
      formatDualSurfaceGuidance(continuousEvaluation, continuousEvaluationMcp),
      `Self-update: create_flow then link_flow then apply_map_tool; regenerate skill at ${skillPath} or MCP generate_integration_skill.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function formatProofOfWorkSpecForSkillPrompt(spec: ProofOfWorkEvalSchemaResult): string {
  const toolLines =
    spec.tool_submissions?.map(
      (tool) =>
        `- ${tool.tool_name}: ${tool.purpose}\n  when: ${tool.when_to_submit}\n  required: ${(tool.required_fields || []).join(", ") || "see schema"}`
    ) || [];

  return `Proof-of-work specification (generated for this workspace — skill.md must reference the dynamic API, not embed this verbatim):

schema_name: ${spec.schema_name}
rationale: ${spec.rationale}
collection_guidance: ${spec.collection_guidance || "n/a"}
recommended_proof_of_work_type: ${spec.recommended_proof_of_work_type}
recommended_mime_type: ${spec.recommended_mime_type}
required_fields: ${(spec.required_fields || []).join(", ") || "n/a"}
optional_fields: ${(spec.optional_fields || []).join(", ") || "n/a"}

Primary tool payload example (illustrative — integrators must fetch the live schema):
${JSON.stringify(spec.example_payload, null, 2)}

Tool submission specs:
${toolLines.length ? toolLines.join("\n") : "- single primary tool schema (see schema_name above)"}

Dynamic integration skill API (MUST appear in skill.md):
POST ${spec.continuous_evaluation?.integration_skill.api_path || spec.proof_of_work_spec_api_path || "(workspace)/integration-skill"}

Continuous evaluation — REST (MUST appear in skill.md):
${spec.continuous_evaluation?.principle || "Public agents manage Learning Maps and Solve, Calibration, and Verification flows."}
${spec.continuous_evaluation?.more_evidence_improves || ""}
Create flow: ${spec.continuous_evaluation?.proof_of_work_spec.api_path || "(workspace)/flows"}
Regenerate integration skill: ${spec.continuous_evaluation?.integration_skill.api_path || "(workspace)/integration-skill"}
Apply map tools: ${spec.continuous_evaluation?.performance.api_path || "(workspace)/map-tools"}
REST cadence: ${spec.continuous_evaluation?.recommended_cadence || "create_workspace → apply_map_tool → create_flow → link_flow → regenerate skill"}

Continuous evaluation — MCP (same loop, tool names):
${spec.continuous_evaluation_mcp?.principle || spec.continuous_evaluation?.principle || ""}
MCP endpoint: ${spec.continuous_evaluation_mcp?.mcp_endpoint_pattern || "POST /api/mcp"} (Authorization: Bearer <api_key>)
create_flow ↔ REST POST .../flows
link_flow ↔ REST POST .../flows/{flow_id}/link
apply_map_tool ↔ REST POST .../map-tools
get_workspace — workspace_goal, kind, map, and settings
MCP cadence: ${spec.continuous_evaluation_mcp?.recommended_cadence || "create/get workspace → apply_map_tool → create_flow → link_flow → repeat"}

Integration surfaces: REST Bearer auth + MCP JSON-RPC (full parity — document both, prefer live API paths over static copies).

Proof of work is recorded in the product UI. Headless start_session / upload_proof_of_work / end_session are not public agent APIs. Snapshot and Stash are not public agent APIs.

${formatInterruptionContractForSkillPrompt()}`;
}

export function resolveProofOfWorkSchemaInterruption(
  spec: ProofOfWorkEvalSchemaResult,
  workspaceId: string,
): ProofOfWorkApiInterruption {
  return normalizePredictedInterruption(
    spec.predicted_interruption,
    "create_flow",
    workspaceId,
  );
}

export interface GenerateEvidenceSpecOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  workspaceTitle: string;
  request: ProofOfWorkSchemaRequest;
  baseUrl: string;
  blockId?: string | null;
}

export interface GenerateOpaqueEvidenceSpecOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  request: OpaqueSchemaRequest;
  baseUrl: string;
  blockId?: string | null;
}

export async function generateOpaqueWorkspaceProofOfWorkSpec(
  options: GenerateOpaqueEvidenceSpecOptions
): Promise<{ spec: ProofOfWorkEvalSchemaResult; contextCounts: Record<string, number> | null; fileIds: string[]; privacy: ReturnType<typeof buildPrivacyMetadata> }> {
  const { supabase, auth, workspaceId, request, baseUrl, blockId } = options;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, title, evaluation_mode, protocol_config, external_refs, workspace_kind")
    .eq("id", workspaceId)
    .single();

  if (!workspace) throw new Error("Workspace not found");

  const meta = parseWorkspaceEvaluationMeta(workspace);
  if (!isOpaqueWorkspace(meta) || !meta.protocol_config) {
    throw new Error("Workspace is not in opaque evaluation mode");
  }

  const context = await buildWorkspacePerformanceContext({
    supabase,
    auth,
    workspaceId,
    blockId,
  });

  const spec = enrichProofOfWorkSpecResult(
    buildOpaqueProofOfWorkSpec(request, meta.protocol_config, workspaceId),
    workspaceId,
    baseUrl,
    blockId,
    context.payload.counts,
    {
      title: workspace.title || meta.protocol_config.protocol_id,
      workspace_goal:
        (workspace as { description?: string | null }).description ??
        (workspace as { notes?: string | null }).notes ??
        null,
      workspace_kind: (workspace as { workspace_kind?: unknown }).workspace_kind,
    }
  );

  return {
    spec,
    contextCounts: context.payload.counts,
    fileIds: context.fileIds,
    privacy: buildPrivacyMetadata(meta),
  };
}

export async function generateWorkspaceProofOfWorkSpec(
  options: GenerateEvidenceSpecOptions
): Promise<{ spec: ProofOfWorkEvalSchemaResult; contextCounts: Record<string, number> | null; fileIds: string[] }> {
  const { supabase, auth, workspaceId, workspaceTitle, request, baseUrl, blockId } = options;

  const context = await buildWorkspacePerformanceContext({
    supabase,
    auth,
    workspaceId,
    blockId,
  });

  const worldModelAppetiteGuidance: string | null = null;

  const schemaResult = await callXaiResponsesWithFiles<ProofOfWorkEvalSchemaResult>(
    buildProofOfWorkSchemaPrompt(workspaceTitle),
    context.fileIds,
    {
      instructions: buildProofOfWorkSchemaInstructions(
        request,
        blockId,
        context.payload,
        worldModelAppetiteGuidance,
      ),
      temperature: 0.25,
      maxOutputTokens: 6144,
      fetchTimeout: 120000,
      jsonSchema: EVIDENCE_EVAL_SCHEMA_OUTPUT,
    }
  );

  if (!schemaResult.success || !schemaResult.data) {
    throw new Error(schemaResult.error || "Failed to generate proof-of-work specification");
  }

  const spec = enrichProofOfWorkSpecResult(
    schemaResult.data,
    workspaceId,
    baseUrl,
    blockId,
    context.payload.counts,
    {
      title: workspaceTitle,
      workspace_goal: context.payload.workspace.workspace_goal,
      workspace_kind: context.payload.workspace.workspace_kind,
    }
  );

  return {
    spec,
    contextCounts: context.payload.counts,
    fileIds: context.fileIds,
  };
}

export function resolveEvalDefinition(
  explicit: string | undefined,
  fallback: {
    notes?: string | null;
    description?: string | null;
    root_topic?: string | null;
    title?: string | null;
  }
): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  return (
    fallback.notes?.trim() ||
    fallback.description?.trim() ||
    fallback.root_topic?.trim() ||
    fallback.title?.trim() ||
    ""
  );
}

export { parseOpaqueSchemaRequest };

export function buildProofOfWorkSchemaRequestFromIntegration(
  evalDefinition: string,
  integrationName: string,
  partnerDescription?: string,
  blockId?: string | null
): ProofOfWorkSchemaRequest | null {
  const definition = evalDefinition.trim();
  if (!definition) return null;

  return parseProofOfWorkSchemaRequest({
    definition,
    block_id: blockId,
    integration_hints: {
      tool_name: integrationName,
      partner_agent: integrationName,
      goals: partnerDescription ? [partnerDescription.slice(0, 500)] : undefined,
    },
  });
}