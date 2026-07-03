import type { PerformanceContextPayload } from "./performance-context";
import type { PerformanceReportContract } from "./performance-report";

export interface EvidenceSchemaIntegrationHints {
  tool_name?: string;
  event_verbs?: string[];
  partner_agent?: string;
  goals?: string[];
}

export interface EvidenceSchemaRequest {
  definition: string;
  block_id?: string | null;
  integration_hints?: EvidenceSchemaIntegrationHints;
}

export interface ToolSubmissionSpec {
  tool_name: string;
  purpose: string;
  when_to_submit: string;
  schema: Record<string, unknown>;
  example_payload: Record<string, unknown>;
  required_fields?: string[];
  optional_fields?: string[];
  block_ids?: string[];
}

export interface EvidenceTypeContract {
  type: "tool" | "screen" | "video" | "eeg";
  mime_types: string[];
  when_to_use: string;
}

export interface EvidenceUploadContract {
  endpoint_pattern: string;
  encoding: "base64";
  evidence_types: EvidenceTypeContract[];
  common_fields: string[];
}

export interface RegenerationEndpointRef {
  api_path: string;
  method: "POST";
  purpose: string;
  when_to_call: string[];
}

export interface ContinuousEvaluationPolicy {
  principle: string;
  more_evidence_improves: string;
  regeneration_required: boolean;
  evidence_spec: RegenerationEndpointRef;
  integration_skill: RegenerationEndpointRef;
  performance: RegenerationEndpointRef;
  recommended_cadence: string;
}

export interface EvidenceEvalSchemaResult {
  schema: Record<string, unknown>;
  schema_name: string;
  rationale: string;
  example_payload: Record<string, unknown>;
  recommended_mime_type: string;
  recommended_evidence_type: "tool" | "screen" | "video" | "eeg";
  required_fields?: string[];
  optional_fields?: string[];
  collection_guidance?: string;
  continuous_evaluation_summary?: string;
  tool_submissions?: ToolSubmissionSpec[];
  evidence_upload_contract?: EvidenceUploadContract;
  continuous_evaluation?: ContinuousEvaluationPolicy;
  performance_report_contract?: PerformanceReportContract;
  spec_version?: string;
  evidence_spec_api_path?: string;
  evidence_upload_api_path?: string;
  workspace_id?: string;
  block_id?: string | null;
}

export const EVIDENCE_EVAL_SCHEMA_OUTPUT = {
  name: "evidence_eval_input_schema",
  schema: {
    type: "object",
    properties: {
      schema: {
        type: "object",
        description: "JSON Schema for the primary tool evidence payload",
        additionalProperties: true,
      },
      schema_name: { type: "string" },
      rationale: { type: "string" },
      example_payload: {
        type: "object",
        additionalProperties: true,
      },
      recommended_mime_type: { type: "string" },
      recommended_evidence_type: {
        type: "string",
        enum: ["tool", "screen", "video", "eeg"],
      },
      required_fields: {
        type: "array",
        items: { type: "string" },
      },
      optional_fields: {
        type: "array",
        items: { type: "string" },
      },
      collection_guidance: { type: "string" },
      continuous_evaluation_summary: {
        type: "string",
        description:
          "Short summary for integrators: more evidence improves evaluation; this spec and the integration skill must be regenerated as evidence accumulates",
      },
      tool_submissions: {
        type: "array",
        description: "Formal per-tool evidence submission specifications for this workspace",
        items: {
          type: "object",
          properties: {
            tool_name: { type: "string" },
            purpose: { type: "string" },
            when_to_submit: { type: "string" },
            schema: { type: "object", additionalProperties: true },
            example_payload: { type: "object", additionalProperties: true },
            required_fields: { type: "array", items: { type: "string" } },
            optional_fields: { type: "array", items: { type: "string" } },
            block_ids: { type: "array", items: { type: "string" } },
          },
          required: ["tool_name", "purpose", "when_to_submit", "schema", "example_payload"],
          additionalProperties: false,
        },
      },
      evidence_upload_contract: {
        type: "object",
        properties: {
          endpoint_pattern: { type: "string" },
          encoding: { type: "string", enum: ["base64"] },
          evidence_types: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["tool", "screen", "video", "eeg"] },
                mime_types: { type: "array", items: { type: "string" } },
                when_to_use: { type: "string" },
              },
              required: ["type", "mime_types", "when_to_use"],
              additionalProperties: false,
            },
          },
          common_fields: { type: "array", items: { type: "string" } },
        },
        required: ["endpoint_pattern", "encoding", "evidence_types", "common_fields"],
        additionalProperties: false,
      },
      performance_report_contract: {
        type: "object",
        description:
          "Formal contract for POST .../performance report mode: overall_score, conversion_score, conversion_goal, marker_scores (spider/radar), and gap_analysis.gaps",
        properties: {
          endpoint_pattern: { type: "string" },
          response_mode: { type: "string", enum: ["report"] },
          required_fields: { type: "array", items: { type: "string" } },
          overall_score: {
            type: "object",
            properties: {
              type: { type: "string" },
              range: { type: "string" },
              description: { type: "string" },
            },
            required: ["type", "range", "description"],
            additionalProperties: false,
          },
          marker_scores: {
            type: "object",
            properties: {
              description: { type: "string" },
              min_markers: { type: "number" },
              max_markers: { type: "number" },
              visualization: { type: "string", enum: ["spider_radar"] },
              item_fields: { type: "array", items: { type: "string" } },
            },
            required: ["description", "min_markers", "max_markers", "visualization", "item_fields"],
            additionalProperties: false,
          },
          gap_analysis: {
            type: "object",
            properties: {
              required: { type: "boolean" },
              gaps_required: { type: "boolean" },
              item_fields: { type: "array", items: { type: "string" } },
            },
            required: ["required", "gaps_required", "item_fields"],
            additionalProperties: false,
          },
          example_report: { type: "object", additionalProperties: true },
        },
        required: [
          "endpoint_pattern",
          "response_mode",
          "required_fields",
          "overall_score",
          "marker_scores",
          "gap_analysis",
          "example_report",
        ],
        additionalProperties: false,
      },
    },
    required: [
      "schema",
      "schema_name",
      "rationale",
      "example_payload",
      "recommended_mime_type",
      "recommended_evidence_type",
      "tool_submissions",
      "evidence_upload_contract",
      "continuous_evaluation_summary",
      "performance_report_contract",
    ],
    additionalProperties: false,
  },
};

export function parseEvidenceSchemaRequest(body: Record<string, unknown>): EvidenceSchemaRequest | null {
  const definition = typeof body.definition === "string" ? body.definition.trim() : "";
  if (!definition) return null;

  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const hintsRaw = body.integration_hints;
  let integration_hints: EvidenceSchemaIntegrationHints | undefined;

  if (hintsRaw && typeof hintsRaw === "object" && !Array.isArray(hintsRaw)) {
    const hints = hintsRaw as Record<string, unknown>;
    integration_hints = {
      tool_name: typeof hints.tool_name === "string" ? hints.tool_name.trim() : undefined,
      partner_agent: typeof hints.partner_agent === "string" ? hints.partner_agent.trim() : undefined,
      event_verbs: Array.isArray(hints.event_verbs)
        ? hints.event_verbs.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : undefined,
      goals: Array.isArray(hints.goals)
        ? hints.goals.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : undefined,
    };
  }

  return {
    definition: definition.slice(0, 12000),
    block_id: blockId,
    integration_hints,
  };
}

function formatWorkspaceContextSummary(payload?: PerformanceContextPayload): string {
  if (!payload) {
    return "Workspace context file attached separately (blocks, evidence history, plan files, Think Aloud Protocol (TAP) sessions).";
  }

  const blockLines = payload.blocks
    .map((block) => `- ${block.title || "Untitled"} (${block.id}): ${block.description || "no description"}`)
    .join("\n");

  const evidenceTools = Array.from(
    new Set(payload.evidence.map((row) => row.tool_name).filter((name): name is string => !!name))
  );

  return `Workspace context summary (use the attached JSON for full detail):
- title: ${payload.workspace.title || "n/a"}
- root_topic: ${payload.workspace.root_topic || "n/a"}
- description: ${payload.workspace.description || "n/a"}
- notes: ${payload.workspace.notes || "n/a"}
- focus_block_id: ${payload.focus_block_id || "full workspace"}
- blocks (${payload.counts.blocks}):
${blockLines || "  none"}
- existing evidence artifacts: ${payload.counts.evidence_artifacts}
- known tool names in prior uploads: ${evidenceTools.length ? evidenceTools.join(", ") : "none yet"}
- plan files: ${payload.counts.plan_files}
- TAP sessions: ${payload.counts.tap_sessions}`;
}

export function buildEvidenceSchemaInstructions(
  request: EvidenceSchemaRequest,
  blockId?: string | null,
  workspacePayload?: PerformanceContextPayload
): string {
  const scope = blockId
    ? "Design a formal evidence specification for ONE block inside this verification workspace."
    : "Design a formal evidence specification for the entire verification workspace.";

  const hints = request.integration_hints;
  const hintsText = hints
    ? JSON.stringify(
        {
          tool_name: hints.tool_name || null,
          partner_agent: hints.partner_agent || null,
          event_verbs: hints.event_verbs || [],
          goals: hints.goals || [],
        },
        null,
        2
      )
    : "none provided";

  return `${scope}

You are an OpenLesson evidence architect. Produce a **formal evidence specification** that tells integrators exactly how to submit tool usage and related artifacts for learning verification via POST .../evidence and evaluation via POST .../performance.

Use the full workspace context: attached JSON summary, block titles/descriptions, existing evidence patterns, plan files, and Think Aloud Protocol (TAP) session signals. Route remediation gaps to ILE (Integrated Learning Environment) practice where appropriate.

${formatWorkspaceContextSummary(workspacePayload)}

The caller's evaluation definition:
"""
${request.definition}
"""

Integration hints (optional):
${hintsText}

Output rules:
1. "schema" is the primary/default JSON Schema (draft-07) for the main tool evidence payload placed in the evidence upload "data" field (base64-encoded JSON).
2. "tool_submissions" must list one or more formal tool submission specs. Include separate entries when the workspace implies multiple tools, workflows, or block-specific payloads. Each entry needs tool_name, purpose, when_to_submit, schema, example_payload, and optional block_ids tying submissions to workspace blocks.
3. Align every schema with workspace blocks, root topic, notes, and any tool names already present in evidence history.
4. "evidence_upload_contract" must formally describe POST .../evidence:
   - endpoint_pattern: "POST /api/v2/agent/workspaces/{workspace_id}/evidence"
   - encoding: "base64"
   - evidence_types: tool (application/json, text/plain), screen (image/png, image/jpeg, image/webp), video (video/mp4, video/webm), eeg (application/json) with when_to_use guidance
   - common_fields: evidence_type, data, mime_type, file_name, plan_node_id, session_id, timestamp_ms, tool_name, tool_action, metadata
5. Optimize payloads for POST .../performance: time-ordered events, learner reflections, goals achieved, artifact summaries, decision rationale, outcomes, block-relevant competencies. The performance report always returns overall_score (0-100 learning verification), conversion_score (0-100 goal conversion likelihood), conversion_goal, marker_scores (spider/radar axes), and gap_analysis.gaps.
6. "performance_report_contract" must formally describe POST .../performance report mode:
   - endpoint_pattern: "POST /api/v2/agent/workspaces/{workspace_id}/performance"
   - response_mode: "report"
   - required_fields: overall_score, conversion_score, conversion_goal, marker_scores, gap_analysis, gap_analysis.gaps, summary, strengths, growth_areas, suggestions, confidence
   - overall_score: integer 0-100 learning verification score
   - conversion_score: integer 0-100 estimated conversion likelihood (distinct from learning verification)
   - conversion_goal: string defining what conversion means for this workspace
   - marker_scores: 4-8 competency axes (id, label, score, rationale, optional block_id) for spider/radar visualization — derive labels from workspace blocks and eval definition
   - gap_analysis: required gaps array with title, evidence, severity, suggested_repair
   - example_report: realistic example with overall_score, conversion_score, conversion_goal, marker_scores, and at least one gap when evidence would support it
7. "collection_guidance" explains cadence, checkpoint timing, block-scoped vs workspace-global uploads, and that **more evidence submitted improves learning verification and gap analysis**. Encourage ongoing uploads, not one-time dumps.
8. "continuous_evaluation_summary" must state clearly that:
   - This evidence spec is a snapshot derived from current workspace context and evidence history
   - Integrators must **re-fetch** POST .../evidence-schema as evidence accumulates (schemas and tool_submissions evolve)
   - Integrators must **regenerate** POST .../integration-skill so skill.md stays aligned with the latest spec and workspace state
   - Continuous evaluation is the intended operating model, not a one-time setup
9. schema_name must be snake_case prefixed with "eval_input_".
10. Keep required_fields practical; use optional_fields for enrichments.

Return only JSON matching the output schema.`;
}

export function buildEvidenceSchemaPrompt(workspaceTitle: string): string {
  return `Generate the formal evidence specification for evaluating "${workspaceTitle}" in OpenLesson, using the full workspace context.`;
}