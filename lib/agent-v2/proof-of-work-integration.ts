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
  buildOpenLessonScopeForWorkspace,
  formatDualSurfaceGuidance,
  recommendIntegrationActions,
} from "./integration-discovery";
import { buildPerformanceReportContract, type PerformanceReportContract } from "./performance-report";
import {
  buildInterruptionContract,
  formatInterruptionContractForSkillPrompt,
  normalizePredictedInterruption,
  type ProofOfWorkApiInterruption,
} from "./predictive-interruption";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const EVIDENCE_SPEC_VERSION = "1.3";

export function buildProofOfWorkSchemaApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/proof-of-work-schema`;
}

export function buildProofOfWorkUploadApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/proof-of-work`;
}

export function buildIntegrationSkillApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/integration-skill`;
}

export function buildPerformanceApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/performance`;
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
  const proofOfWorkSpecPath = buildProofOfWorkSchemaApiPath(workspaceId, baseUrl);
  const skillPath = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const performancePath = buildPerformanceApiPath(workspaceId, baseUrl);
  const uploadPath = buildProofOfWorkUploadApiPath(workspaceId, baseUrl);

  const evidenceTriggers = [
    "Before the first proof-of-work upload for a new workflow or block",
    "After every 5-10 new proof-of-work artifacts accumulate in the workspace",
    "When block definitions, eval definition, or integration tooling changes",
    "When performance reports feel stale or gaps no longer match observed behavior",
  ];

  if (proofOfWorkCount === 0) {
    evidenceTriggers.unshift("Immediately now: workspace has little or no proof of work yet; spec will sharpen as uploads begin");
  } else if (proofOfWorkCount < 10) {
    evidenceTriggers.unshift(
      `Now recommended: workspace has ${proofOfWorkCount} proof-of-work artifact(s); early spec will improve as more tool traces arrive`
    );
  } else {
    evidenceTriggers.unshift(
      `Re-fetch recommended: workspace already has ${proofOfWorkCount} proof-of-work artifacts; spec should reflect learned patterns`
    );
  }

  return {
    principle:
      "OpenLesson verification is continuous. The proof-of-work spec and integration skill are living documents derived from workspace context and accumulated proof of work.",
    more_evidence_improves:
      "The more tool usage, artifacts, and session proof of work you submit, the richer workspace context becomes and the better POST .../performance can learn, score, and surface gaps.",
    regeneration_required: true,
    proof_of_work_spec: {
      api_path: proofOfWorkSpecPath,
      method: "POST",
      purpose: "Re-fetch the formal proof-of-work specification (tool_submissions, upload contract) as proof of work accumulates",
      when_to_call: evidenceTriggers,
    },
    integration_skill: {
      api_path: skillPath,
      method: "POST",
      purpose: "Regenerate skill.md so partner agents stay aligned with the latest proof-of-work spec and workspace context",
      when_to_call: [
        "After regenerating or materially updating the proof of work spec",
        "When onboarding a new partner agent version or changing integration behavior",
        "On a recurring cadence (e.g. weekly or after major proof-of-work milestones) during active evaluation",
        "Never treat the initial skill.md as permanent; regeneration is part of the operating model",
      ],
    },
    performance: {
      api_path: performancePath,
      method: "POST",
      purpose: "Request updated gap analysis and readiness scores as new proof of work arrives",
      when_to_call: [
        "After each meaningful batch of proof-of-work uploads via POST .../proof-of-work",
        "Before deploy gates, promotion decisions, or learning-to-conversion checkpoints",
        "Whenever you need refreshed marker scores tied to the latest workspace context",
      ],
    },
    recommended_cadence: `Continuous loop: upload proof of work (${uploadPath}) → re-fetch spec (${proofOfWorkSpecPath}) → regenerate skill (${skillPath}) → request performance (${performancePath}). Repeat as proof of work grows.`,
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
    conversion_goal?: string | null;
  }
): ProofOfWorkEvalSchemaResult {
  const proofOfWorkSpecPath = buildProofOfWorkSchemaApiPath(workspaceId, baseUrl);
  const skillPath = buildIntegrationSkillApiPath(workspaceId, baseUrl);

  const performanceContract: PerformanceReportContract =
    result.performance_report_contract ?? {
      ...buildPerformanceReportContract(baseUrl),
      endpoint_pattern: buildPerformanceApiPath(workspaceId, baseUrl),
    };

  const continuousEvaluation = buildContinuousEvaluationPolicy(workspaceId, baseUrl, contextCounts);
  const continuousEvaluationMcp = buildContinuousEvaluationMcpPolicy(workspaceId, baseUrl, contextCounts);
  const proofOfWorkCount = contextCounts?.proof_of_work_artifacts ?? 0;
  const blockCount = contextCounts?.blocks ?? 0;
  const llmInterruption = normalizePredictedInterruption(
    result.predicted_interruption,
    "generate_proof_of_work_schema",
    workspaceId
  );

  return {
    ...result,
    spec_version: EVIDENCE_SPEC_VERSION,
    interruption_contract: buildInterruptionContract(),
    predicted_interruption: llmInterruption,
    proof_of_work_spec_api_path: proofOfWorkSpecPath,
    proof_of_work_upload_api_path: buildProofOfWorkUploadApiPath(workspaceId, baseUrl),
    workspace_id: workspaceId,
    block_id: blockId ?? null,
    performance_report_contract: performanceContract,
    continuous_evaluation: continuousEvaluation,
    continuous_evaluation_mcp: continuousEvaluationMcp,
    openlesson_scope: buildOpenLessonScopeForWorkspace({
      workspaceTitle: workspaceMeta?.title || result.schema_name,
      conversionGoal: workspaceMeta?.conversion_goal,
      blockCount,
      proofOfWorkCount,
    }),
    integration_surfaces: buildIntegrationSurfaces(baseUrl),
    recommended_next_actions: recommendIntegrationActions({
      proof_of_work_artifacts: proofOfWorkCount,
      blocks: blockCount,
      has_conversion_goal: Boolean(workspaceMeta?.conversion_goal?.trim()),
    }),
    collection_guidance: [
      result.collection_guidance,
      result.continuous_evaluation_summary,
      formatDualSurfaceGuidance(continuousEvaluation, continuousEvaluationMcp),
      `Self-update: re-fetch REST ${proofOfWorkSpecPath} or MCP generate_proof_of_work_schema; regenerate skill at ${skillPath} or MCP generate_integration_skill.`,
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

Dynamic proof-of-work spec API (MUST appear in skill.md):
POST ${spec.proof_of_work_spec_api_path || "(workspace)/proof-of-work-schema"}
Request body: { "definition": "<eval definition>", "block_id": "<optional>", "integration_hints": { "tool_name": "...", "partner_agent": "..." } }

Continuous evaluation — REST (MUST appear in skill.md):
${spec.continuous_evaluation?.principle || "Verification is continuous; regenerate spec and skill as proof of work grows."}
${spec.continuous_evaluation?.more_evidence_improves || ""}
Regenerate proof-of-work spec: ${spec.continuous_evaluation?.proof_of_work_spec.api_path || spec.proof_of_work_spec_api_path}
Regenerate integration skill: ${spec.continuous_evaluation?.integration_skill.api_path || "(workspace)/integration-skill"}
Upload proof of work: ${spec.continuous_evaluation?.proof_of_work_spec.api_path ? spec.proof_of_work_upload_api_path : "(workspace)/proof-of-work"}
Request refreshed performance: ${spec.continuous_evaluation?.performance.api_path || "(workspace)/performance"}
REST cadence: ${spec.continuous_evaluation?.recommended_cadence || "upload → re-fetch spec → regenerate skill → performance"}

Continuous evaluation — MCP (same loop, tool names):
${spec.continuous_evaluation_mcp?.principle || spec.continuous_evaluation?.principle || ""}
MCP endpoint: ${spec.continuous_evaluation_mcp?.mcp_endpoint_pattern || "POST /api/mcp"} (Authorization: Bearer <api_key>)
generate_proof_of_work_schema ↔ ${spec.continuous_evaluation?.proof_of_work_spec.api_path || "REST proof-of-work-schema"}
upload_proof_of_work ↔ ${spec.proof_of_work_upload_api_path || "REST proof of work"}
analyze_performance ↔ ${spec.continuous_evaluation?.performance.api_path || "REST performance"}
get_learning_progress — one-call progress snapshot + recommended_next_actions
MCP cadence: ${spec.continuous_evaluation_mcp?.recommended_cadence || "schema → upload → performance → repeat"}

Integration surfaces: REST Bearer auth + MCP JSON-RPC (full parity — document both, prefer live API paths over static copies).

Performance report contract (MUST appear in skill.md — every report includes scores + gaps):
Endpoint: ${spec.performance_report_contract?.endpoint_pattern || spec.continuous_evaluation?.performance.api_path || "(workspace)/performance"}
Required fields: ${(spec.performance_report_contract?.required_fields || ["overall_score", "conversion_score", "conversion_goal", "marker_scores", "gap_analysis.gaps"]).join(", ")}
overall_score: ${spec.performance_report_contract?.overall_score.range || "0-100"} integer learning verification score
conversion_score: ${spec.performance_report_contract?.conversion_score?.range || "0-100"} integer estimated conversion likelihood
conversion_goal: ${spec.performance_report_contract?.conversion_goal?.description || "workspace-specific outcome goal"}
marker_scores: ${spec.performance_report_contract?.marker_scores.visualization || "spider_radar"} chart with ${spec.performance_report_contract?.marker_scores.min_markers || 4}-${spec.performance_report_contract?.marker_scores.max_markers || 8} competency axes (id, label, score, rationale)
gap_analysis.gaps: required list of gaps (title, proof_of_work, severity, suggested_repair) — product/workflow remediation only; never TAP, block completion, or ILE
gap_analysis.next_steps: directions (domain goals) and events (granular product/tool actions) — same remediation rules
Example report shape:
${JSON.stringify(
    spec.performance_report_contract?.example_report || {
      overall_score: 0,
      conversion_score: 0,
      conversion_goal: "Workspace goal conversion",
      marker_scores: [],
      gap_analysis: { gaps: [] },
    },
    null,
    2
  )}

${formatInterruptionContractForSkillPrompt()}`;
}

export function resolveProofOfWorkSchemaInterruption(
  spec: ProofOfWorkEvalSchemaResult,
  workspaceId: string,
): ProofOfWorkApiInterruption {
  return normalizePredictedInterruption(
    spec.predicted_interruption,
    "generate_proof_of_work_schema",
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
    .select("id, title, evaluation_mode, protocol_config, external_refs, conversion_goal")
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
      conversion_goal: workspace.conversion_goal,
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

  const schemaResult = await callXaiResponsesWithFiles<ProofOfWorkEvalSchemaResult>(
    buildProofOfWorkSchemaPrompt(workspaceTitle),
    context.fileIds,
    {
      instructions: buildProofOfWorkSchemaInstructions(request, blockId, context.payload),
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
      conversion_goal: context.payload.workspace.conversion_goal,
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