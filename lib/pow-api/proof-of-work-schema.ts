import type {
  ContinuousEvaluationMcpPolicy,
  IntegrationSurfaceRef,
  RecommendedIntegrationAction,
} from "./integration-discovery";
import type { PerformanceContextPayload } from "./performance-context";
import type { PerformanceReportContract } from "./performance-report";
import type { ProofOfWorkApiInterruption, InterruptionContract } from "./predictive-interruption";
import { composePrompt } from "@/lib/prompt-kernel/compose";
import {
  POW_MODEL_VERSION,
  PROOF_OF_WORK_MIME_BY_TYPE,
  WORKSPACE_PROOF_OF_WORK_TYPES,
  type WorkspaceProofOfWorkType,
} from "./workspace-proof-of-work";

export interface ProofOfWorkSchemaIntegrationHints {
  tool_name?: string;
  event_verbs?: string[];
  partner_agent?: string;
  goals?: string[];
}

export interface ProofOfWorkSchemaRequest {
  definition: string;
  block_id?: string | null;
  integration_hints?: ProofOfWorkSchemaIntegrationHints;
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

export interface ProofOfWorkTypeContract {
  type: WorkspaceProofOfWorkType;
  mime_types: string[];
  when_to_use: string;
}

export interface ProofOfWorkUploadContract {
  endpoint_pattern: string;
  encoding: "base64";
  proof_of_work_types: ProofOfWorkTypeContract[];
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
  proof_of_work_spec: RegenerationEndpointRef;
  integration_skill: RegenerationEndpointRef;
  performance: RegenerationEndpointRef;
  recommended_cadence: string;
}

export interface ProofOfWorkEvalSchemaResult {
  schema: Record<string, unknown>;
  schema_name: string;
  rationale: string;
  example_payload: Record<string, unknown>;
  recommended_mime_type: string;
  recommended_proof_of_work_type: WorkspaceProofOfWorkType;
  required_fields?: string[];
  optional_fields?: string[];
  collection_guidance?: string;
  continuous_evaluation_summary?: string;
  tool_submissions?: ToolSubmissionSpec[];
  proof_of_work_upload_contract?: ProofOfWorkUploadContract;
  continuous_evaluation?: ContinuousEvaluationPolicy;
  continuous_evaluation_mcp?: ContinuousEvaluationMcpPolicy;
  uncertain_systems_scope?: Record<string, unknown>;
  integration_surfaces?: IntegrationSurfaceRef[];
  recommended_next_actions?: RecommendedIntegrationAction[];
  /** Primary LWM Snapshot (verification) score contract (TAP/ILE / default). */
  performance_report_contract?: PerformanceReportContract;
  /** Snapshot score contracts — sole product strategy is LWM Snapshot (verification wire key). */
  vertical_score_contracts?: {
    verification: PerformanceReportContract;
  };
  /** Trace Interruption Model contract — every Proof-of-Work API response also carries top-level interruption. */
  interruption_contract?: InterruptionContract;
  /** LLM-predicted interruption for this workspace context (mapped to response interruption). */
  predicted_interruption?: ProofOfWorkApiInterruption;
  spec_version?: string;
  pow_model_version?: string;
  proof_of_work_spec_api_path?: string;
  proof_of_work_upload_api_path?: string;
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
        description: "JSON Schema for the primary tool proof-of-work payload",
        additionalProperties: true,
      },
      schema_name: { type: "string" },
      rationale: { type: "string" },
      example_payload: {
        type: "object",
        additionalProperties: true,
      },
      recommended_mime_type: { type: "string" },
      recommended_proof_of_work_type: {
        type: "string",
        enum: [...WORKSPACE_PROOF_OF_WORK_TYPES],
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
          "Short summary for integrators: more proof of work improves evaluation; this spec and the integration skill must be regenerated as proof of work accumulates",
      },
      tool_submissions: {
        type: "array",
        description: "Formal per-tool proof-of-work submission specifications for this workspace",
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
      proof_of_work_upload_contract: {
        type: "object",
        properties: {
          endpoint_pattern: { type: "string" },
          encoding: { type: "string", enum: ["base64"] },
          proof_of_work_types: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: [...WORKSPACE_PROOF_OF_WORK_TYPES] },
                mime_types: { type: "array", items: { type: "string" } },
                when_to_use: { type: "string" },
              },
              required: ["type", "mime_types", "when_to_use"],
              additionalProperties: false,
            },
          },
          common_fields: { type: "array", items: { type: "string" } },
        },
        required: ["endpoint_pattern", "encoding", "proof_of_work_types", "common_fields"],
        additionalProperties: false,
      },
      performance_report_contract: {
        type: "object",
        description:
          "Formal contract for POST .../lwm-snapshot: score (lwm_snapshot_score), workspace_goal, marker_scores (spider/radar), analysis, and gap_analysis next actions",
        properties: {
          endpoint_pattern: { type: "string" },
          response_mode: { type: "string", enum: ["score", "report"] },
          required_fields: { type: "array", items: { type: "string" } },
          primary_score: {
            type: "object",
            properties: {
              type: { type: "string" },
              range: { type: "string" },
              description: { type: "string" },
            },
            required: ["type", "range", "description"],
            additionalProperties: false,
          },
          workspace_goal: {
            type: "object",
            properties: {
              type: { type: "string" },
              description: { type: "string" },
            },
            required: ["type", "description"],
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
          "marker_scores",
          "gap_analysis",
          "example_report",
        ],
        additionalProperties: true,
      },
      vertical_score_contracts: {
        type: "object",
        description:
          "LWM Snapshot contract only (lwm-snapshot / lwm_snapshot / lwm_snapshot_score). Sole product strategy; GHC is secondary on the same report.",
        additionalProperties: true,
      },
      predicted_interruption: {
        type: ["object", "null"],
        description:
          "Optional TIM prediction: when non-null, suggests an intervention the consumer should trigger after delay_ms unless superseded by a later Proof-of-Work API response. Use null when no interruption is warranted.",
        properties: {
          delay_ms: {
            type: "number",
            description: "Milliseconds before consumer triggers intervention (15000-600000).",
          },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          intervention: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "reflection_prompt",
                  "checkpoint_probe",
                  "coaching_nudge",
                  "proof_of_work_reminder",
                  "performance_review",
                ],
              },
              message: { type: "string" },
              rationale: { type: "string" },
              consumer_action: { type: "string" },
              block_id: { type: ["string", "null"] },
            },
            required: ["type", "message"],
            additionalProperties: false,
          },
        },
        required: ["delay_ms", "intervention", "confidence"],
        additionalProperties: false,
      },
    },
    required: [
      "schema",
      "schema_name",
      "rationale",
      "example_payload",
      "recommended_mime_type",
      "recommended_proof_of_work_type",
      "tool_submissions",
      "proof_of_work_upload_contract",
      "continuous_evaluation_summary",
      "performance_report_contract",
    ],
    additionalProperties: false,
  },
};

export function parseProofOfWorkSchemaRequest(body: Record<string, unknown>): ProofOfWorkSchemaRequest | null {
  if (body.evaluation_mode === "opaque") return null;

  const definition = typeof body.definition === "string" ? body.definition.trim() : "";
  if (!definition) return null;

  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const hintsRaw = body.integration_hints;
  let integration_hints: ProofOfWorkSchemaIntegrationHints | undefined;

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
    return "Workspace context file attached separately (blocks, proof-of-work history, plan files, Think Aloud Protocol (TAP) sessions).";
  }

  const blockLines = payload.blocks
    .map((block) => `- ${block.title || "Untitled"} (${block.id}): ${block.description || "no description"}`)
    .join("\n");

  const evidenceTools = Array.from(
    new Set(payload.proof_of_work.map((row) => row.tool_name).filter((name): name is string => !!name))
  );

  return `Workspace context summary (use the attached JSON for full detail):
- title: ${payload.workspace.title || "n/a"}
- root_topic: ${payload.workspace.root_topic || "n/a"}
- description: ${payload.workspace.description || "n/a"}
- notes: ${payload.workspace.notes || "n/a"}
- focus_block_id: ${payload.focus_block_id || "full workspace"}
- blocks (${payload.counts.blocks}):
${blockLines || "  none"}
- existing proof of work artifacts: ${payload.counts.proof_of_work_artifacts}
- known tool names in prior uploads: ${evidenceTools.length ? evidenceTools.join(", ") : "none yet"}
- plan files: ${payload.counts.workspace_files}`;
}

export function buildProofOfWorkSchemaInstructions(
  request: ProofOfWorkSchemaRequest,
  blockId?: string | null,
  workspacePayload?: PerformanceContextPayload,
  worldModelAppetiteGuidance?: string | null,
): string {
  const scope = blockId
    ? "Design a formal proof-of-work specification for ONE block inside this verification workspace."
    : "Design a formal proof-of-work specification for the entire verification workspace.";

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

  const appetiteBlock = worldModelAppetiteGuidance?.trim()
    ? `\n\n${worldModelAppetiteGuidance.trim()}\n`
    : "";

  const task = `${scope}

You are an Uncertain Systems proof-of-work architect. Produce a **formal proof-of-work specification** that tells integrators exactly how to submit tool usage and related artifacts for learning verification.

Uncertain Systems scope: single LWM Snapshot strategy — lwm_snapshot (Learning World Model Snapshot, 0–100). GHC (ghc_score + ghc_confidence) is a secondary cognition signal on the same report. Collect proof-of-work via proof-of-work uploads. Scoring is **on demand** — Knowledge UI Generate new snapshot or Snapshot API POST .../lwm-snapshot / MCP lwm_snapshot (not auto on TAP/ILE end).

Integrators may use **REST** (Bearer API key: POST .../proof-of-work, POST .../lwm-snapshot) or **MCP** (JSON-RPC tools upload_proof_of_work, lwm_snapshot, generate_proof_of_work_schema) with identical semantics. Document REST paths in contracts; the platform also attaches continuous_evaluation_mcp with tool names after generation — your continuous_evaluation_summary must mention both surfaces.

Use the full workspace context: attached JSON summary, block titles/descriptions, existing proof of work patterns, plan files, and Think Aloud Protocol (TAP) session signals when present. TAP and ILE may inform scoring — but score report remediation (gaps, next_steps, suggestions) must stay product-independent: never recommend TAP sessions, block completion, ILE, or other Uncertain Systems platform mechanics.

${formatWorkspaceContextSummary(workspacePayload)}
${appetiteBlock}
The caller's evaluation definition:
"""
${request.definition}
"""

Integration hints (optional):
${hintsText}

Output rules:
1. "schema" is the primary/default JSON Schema (draft-07) for the main tool proof-of-work payload placed in the proof of work upload "data" field (base64-encoded JSON).
2. "tool_submissions" must list one or more formal tool submission specs. Include separate entries when the workspace implies multiple tools, workflows, or block-specific payloads. Each entry needs tool_name, purpose, when_to_submit, schema, example_payload, and optional block_ids tying submissions to workspace blocks.
3. Align every schema with workspace blocks, root topic, notes, and any tool names already present in proof-of-work history.
4. "proof_of_work_upload_contract" must formally describe POST .../proof-of-work:
   - endpoint_pattern: "POST /api/v3/pow/workspaces/{workspace_id}/proof-of-work"
   - encoding: "base64"
   - proof_of_work_types: tool (${PROOF_OF_WORK_MIME_BY_TYPE.tool.join(", ")}), screen (${PROOF_OF_WORK_MIME_BY_TYPE.screen.join(", ")}), video (${PROOF_OF_WORK_MIME_BY_TYPE.video.join(", ")}), eeg (${PROOF_OF_WORK_MIME_BY_TYPE.eeg.join(", ")}) with when_to_use guidance. Stored types are ${WORKSPACE_PROOF_OF_WORK_TYPES.join(" | ")}. Model version ${POW_MODEL_VERSION}.
   - common_fields: type, mime_type, data, file_name, block_id, session_id, timestamp_ms, tool_name, tool_action, metadata, pow_model_version
5. Optimize payloads for the LWM Snapshot endpoint: time-ordered events, learner reflections, goals achieved, artifact summaries, decision rationale, outcomes, block-relevant competencies. Each snapshot call returns one primary score (0-100 lwm_snapshot_score), workspace_goal, ghc_score + ghc_confidence (secondary), marker_scores (spider/radar), summary analysis, and gap_analysis with next_steps.
6. "performance_report_contract" must formally describe POST .../lwm-snapshot (LWM Snapshot — sole strategy; TAP/ILE end use this):
   - endpoint_pattern: "POST /api/v3/snapshot/workspaces/{workspace_id}/lwm-snapshot"
   - response_mode: "score"
   - required_fields: score, lwm_snapshot_score, vertical, workspace_goal, marker_scores, gap_analysis, gap_analysis.gaps, gap_analysis.next_steps, summary, strengths, growth_areas, suggestions, confidence
   - score / lwm_snapshot_score: integer 0-100 LWM Snapshot
   - workspace_goal: inferred or owner-set success outcome for this workspace
   - marker_scores: 4-8 competency axes for spider/radar
   - gap_analysis.next_steps: directions and events (product/workflow language only — never TAP, block completion, or ILE)
   Do not document other score endpoints — LWM Snapshot is the sole product strategy.
7. "collection_guidance" explains cadence, checkpoint timing, block-scoped vs workspace-global uploads, and that **more proof of work submitted improves LWM Snapshot and GHC**. Encourage ongoing uploads, not one-time dumps. When learning world model evidence appetite is provided above, bias collection_guidance and tool_submissions toward want_more types and de-emphasize saturated types.
8. "continuous_evaluation_summary" must state clearly that:
   - This proof-of-work spec is a snapshot derived from current workspace context and proof-of-work history
   - Integrators must **re-fetch** POST .../proof-of-work-schema (REST) or call generate_proof_of_work_schema (MCP) as proof of work accumulates
   - Integrators must **regenerate** POST .../integration-skill (REST) or generate_integration_skill (MCP) so skill.md stays aligned
   - Progress tracking uses lwm_snapshot (LWM Snapshot) MCP tool and REST .../lwm-snapshot
   - get_learning_progress (MCP) orients agents mid-session; REST equivalents remain authoritative in API paths
   - Continuous evaluation is the intended operating model, not a one-time setup
9. schema_name must be snake_case prefixed with "eval_input_".
10. Keep required_fields practical; use optional_fields for enrichments.
11. "predicted_interruption" — Trace Interruption Model (TIM) prediction for the consumer system (TIM is a swappable interruption world model; consumer envelope stays stable):
   - Return null when no intervention is predicted (user is on track, or context is too thin).
   - When non-null, set delay_ms (15000-600000) and intervention { type, message, optional rationale, consumer_action, block_id }.
   - Types: reflection_prompt (articulate reasoning), checkpoint_probe (verify understanding), coaching_nudge (gap-driven nudge), proof_of_work_reminder (upload proof-of-work), performance_review (request LWM Snapshot).
   - Ground predictions in workspace blocks, eval definition, proof-of-work history, evidence appetite, and collection_guidance — not generic coaching.
   - The consumer schedules the intervention after delay_ms unless any later Proof-of-Work API response supersedes it.

Return only JSON matching the output schema.`;

  return composePrompt({ ontology: "full", task });
}

export function buildProofOfWorkSchemaPrompt(workspaceTitle: string): string {
  return `Generate the formal proof-of-work specification for evaluating "${workspaceTitle}" in Uncertain Systems, using the full workspace context.`;
}