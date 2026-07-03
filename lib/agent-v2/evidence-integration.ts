import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  buildEvidenceSchemaInstructions,
  buildEvidenceSchemaPrompt,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
  parseEvidenceSchemaRequest,
  type EvidenceEvalSchemaResult,
  type EvidenceSchemaRequest,
} from "./evidence-schema";
import { buildWorkspacePerformanceContext } from "./performance-context";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const EVIDENCE_SPEC_VERSION = "1.0";

export function buildEvidenceSchemaApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/evidence-schema`;
}

export function buildEvidenceUploadApiPath(workspaceId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/v2/agent/workspaces/${workspaceId}/evidence`;
}

export function enrichEvidenceSpecResult(
  result: EvidenceEvalSchemaResult,
  workspaceId: string,
  baseUrl: string,
  blockId?: string | null
): EvidenceEvalSchemaResult {
  return {
    ...result,
    spec_version: EVIDENCE_SPEC_VERSION,
    evidence_spec_api_path: buildEvidenceSchemaApiPath(workspaceId, baseUrl),
    evidence_upload_api_path: buildEvidenceUploadApiPath(workspaceId, baseUrl),
    workspace_id: workspaceId,
    block_id: blockId ?? null,
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
Request body: { "definition": "<eval definition>", "block_id": "<optional>", "integration_hints": { "tool_name": "...", "partner_agent": "..." } }`;
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

  const spec = enrichEvidenceSpecResult(schemaResult.data, workspaceId, baseUrl, blockId);

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