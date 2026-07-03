import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  buildEvidenceSchemaInstructions,
  buildEvidenceSchemaPrompt,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
  parseEvidenceSchemaRequest,
  type ContinuousEvaluationPolicy,
  type EvidenceEvalSchemaResult,
  type EvidenceSchemaRequest,
} from "./evidence-schema";
import { buildWorkspacePerformanceContext } from "./performance-context";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const EVIDENCE_SPEC_VERSION = "1.1";

export function buildEvidenceSchemaApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/evidence-schema`;
}

export function buildEvidenceUploadApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/evidence`;
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
    evidence_artifacts?: number;
    blocks?: number;
    plan_files?: number;
    ghl_sessions?: number;
  } | null
): ContinuousEvaluationPolicy {
  const evidenceCount = contextCounts?.evidence_artifacts ?? 0;
  const evidenceSpecPath = buildEvidenceSchemaApiPath(workspaceId, baseUrl);
  const skillPath = buildIntegrationSkillApiPath(workspaceId, baseUrl);
  const performancePath = buildPerformanceApiPath(workspaceId, baseUrl);
  const uploadPath = buildEvidenceUploadApiPath(workspaceId, baseUrl);

  const evidenceTriggers = [
    "Before the first evidence upload for a new workflow or block",
    "After every 5-10 new evidence artifacts accumulate in the workspace",
    "When block definitions, eval definition, or integration tooling changes",
    "When performance reports feel stale or gaps no longer match observed behavior",
  ];

  if (evidenceCount === 0) {
    evidenceTriggers.unshift("Immediately now: workspace has little or no evidence yet; spec will sharpen as uploads begin");
  } else if (evidenceCount < 10) {
    evidenceTriggers.unshift(
      `Now recommended: workspace has ${evidenceCount} evidence artifact(s); early spec will improve as more tool traces arrive`
    );
  } else {
    evidenceTriggers.unshift(
      `Re-fetch recommended: workspace already has ${evidenceCount} evidence artifacts; spec should reflect learned patterns`
    );
  }

  return {
    principle:
      "OpenLesson verification is continuous. The evidence spec and integration skill are living documents derived from workspace context and accumulated evidence.",
    more_evidence_improves:
      "The more tool usage, artifacts, and session evidence you submit, the richer workspace context becomes and the better POST .../performance can learn, score, and surface gaps.",
    regeneration_required: true,
    evidence_spec: {
      api_path: evidenceSpecPath,
      method: "POST",
      purpose: "Re-fetch the formal evidence specification (tool_submissions, upload contract) as evidence accumulates",
      when_to_call: evidenceTriggers,
    },
    integration_skill: {
      api_path: skillPath,
      method: "POST",
      purpose: "Regenerate skill.md so partner agents stay aligned with the latest evidence spec and workspace context",
      when_to_call: [
        "After regenerating or materially updating the evidence spec",
        "When onboarding a new partner agent version or changing integration behavior",
        "On a recurring cadence (e.g. weekly or after major evidence milestones) during active evaluation",
        "Never treat the initial skill.md as permanent; regeneration is part of the operating model",
      ],
    },
    performance: {
      api_path: performancePath,
      method: "POST",
      purpose: "Request updated gap analysis and readiness scores as new evidence arrives",
      when_to_call: [
        "After each meaningful batch of evidence uploads via POST .../evidence",
        "Before deploy gates, promotion decisions, or learning-to-conversion checkpoints",
        "Whenever you need refreshed marker scores tied to the latest workspace context",
      ],
    },
    recommended_cadence: `Continuous loop: upload evidence (${uploadPath}) → re-fetch spec (${evidenceSpecPath}) → regenerate skill (${skillPath}) → request performance (${performancePath}). Repeat as evidence grows.`,
  };
}

export function enrichEvidenceSpecResult(
  result: EvidenceEvalSchemaResult,
  workspaceId: string,
  baseUrl: string,
  blockId?: string | null,
  contextCounts?: {
    evidence_artifacts?: number;
    blocks?: number;
    plan_files?: number;
    ghl_sessions?: number;
  } | null
): EvidenceEvalSchemaResult {
  const evidenceSpecPath = buildEvidenceSchemaApiPath(workspaceId, baseUrl);
  const skillPath = buildIntegrationSkillApiPath(workspaceId, baseUrl);

  return {
    ...result,
    spec_version: EVIDENCE_SPEC_VERSION,
    evidence_spec_api_path: evidenceSpecPath,
    evidence_upload_api_path: buildEvidenceUploadApiPath(workspaceId, baseUrl),
    workspace_id: workspaceId,
    block_id: blockId ?? null,
    continuous_evaluation: buildContinuousEvaluationPolicy(workspaceId, baseUrl, contextCounts),
    collection_guidance: [
      result.collection_guidance,
      result.continuous_evaluation_summary,
      `Self-update: re-fetch this spec at ${evidenceSpecPath} and regenerate skill.md at ${skillPath} as evidence accumulates.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function formatEvidenceSpecForSkillPrompt(spec: EvidenceEvalSchemaResult): string {
  const toolLines =
    spec.tool_submissions?.map(
      (tool) =>
        `- ${tool.tool_name}: ${tool.purpose}\n  when: ${tool.when_to_submit}\n  required: ${(tool.required_fields || []).join(", ") || "see schema"}`
    ) || [];

  return `Evidence specification (generated for this workspace — skill.md must reference the dynamic API, not embed this verbatim):

schema_name: ${spec.schema_name}
rationale: ${spec.rationale}
collection_guidance: ${spec.collection_guidance || "n/a"}
recommended_evidence_type: ${spec.recommended_evidence_type}
recommended_mime_type: ${spec.recommended_mime_type}
required_fields: ${(spec.required_fields || []).join(", ") || "n/a"}
optional_fields: ${(spec.optional_fields || []).join(", ") || "n/a"}

Primary tool payload example (illustrative — integrators must fetch the live schema):
${JSON.stringify(spec.example_payload, null, 2)}

Tool submission specs:
${toolLines.length ? toolLines.join("\n") : "- single primary tool schema (see schema_name above)"}

Dynamic evidence spec API (MUST appear in skill.md):
POST ${spec.evidence_spec_api_path || "(workspace)/evidence-schema"}
Request body: { "definition": "<eval definition>", "block_id": "<optional>", "integration_hints": { "tool_name": "...", "partner_agent": "..." } }

Continuous evaluation (MUST appear in skill.md):
${spec.continuous_evaluation?.principle || "Verification is continuous; regenerate spec and skill as evidence grows."}
${spec.continuous_evaluation?.more_evidence_improves || ""}
Regenerate evidence spec: ${spec.continuous_evaluation?.evidence_spec.api_path || spec.evidence_spec_api_path}
Regenerate integration skill: ${spec.continuous_evaluation?.integration_skill.api_path || "(workspace)/integration-skill"}
Request refreshed performance: ${spec.continuous_evaluation?.performance.api_path || "(workspace)/performance"}
Recommended cadence: ${spec.continuous_evaluation?.recommended_cadence || "upload → re-fetch spec → regenerate skill → performance"}`;
}

export interface GenerateEvidenceSpecOptions {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  workspaceTitle: string;
  request: EvidenceSchemaRequest;
  baseUrl: string;
  blockId?: string | null;
}

export async function generateWorkspaceEvidenceSpec(
  options: GenerateEvidenceSpecOptions
): Promise<{ spec: EvidenceEvalSchemaResult; contextCounts: Record<string, number> | null; fileIds: string[] }> {
  const { supabase, auth, workspaceId, workspaceTitle, request, baseUrl, blockId } = options;

  const context = await buildWorkspacePerformanceContext({
    supabase,
    auth,
    workspaceId,
    blockId,
  });

  const schemaResult = await callXaiResponsesWithFiles<EvidenceEvalSchemaResult>(
    buildEvidenceSchemaPrompt(workspaceTitle),
    context.fileIds,
    {
      instructions: buildEvidenceSchemaInstructions(request, blockId, context.payload),
      temperature: 0.25,
      maxOutputTokens: 6144,
      fetchTimeout: 120000,
      jsonSchema: EVIDENCE_EVAL_SCHEMA_OUTPUT,
    }
  );

  if (!schemaResult.success || !schemaResult.data) {
    throw new Error(schemaResult.error || "Failed to generate evidence specification");
  }

  const spec = enrichEvidenceSpecResult(
    schemaResult.data,
    workspaceId,
    baseUrl,
    blockId,
    context.payload.counts
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

export function buildEvidenceSchemaRequestFromIntegration(
  evalDefinition: string,
  integrationName: string,
  partnerDescription?: string,
  blockId?: string | null
): EvidenceSchemaRequest | null {
  const definition = evalDefinition.trim();
  if (!definition) return null;

  return parseEvidenceSchemaRequest({
    definition,
    block_id: blockId,
    integration_hints: {
      tool_name: integrationName,
      partner_agent: integrationName,
      goals: partnerDescription ? [partnerDescription.slice(0, 500)] : undefined,
    },
  });
}