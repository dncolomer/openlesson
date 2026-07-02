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
}

export const EVIDENCE_EVAL_SCHEMA_OUTPUT = {
  name: "evidence_eval_input_schema",
  schema: {
    type: "object",
    properties: {
      schema: {
        type: "object",
        description: "JSON Schema describing the ideal tool evidence payload for evaluation",
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
    },
    required: [
      "schema",
      "schema_name",
      "rationale",
      "example_payload",
      "recommended_mime_type",
      "recommended_evidence_type",
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

export function buildEvidenceSchemaInstructions(
  request: EvidenceSchemaRequest,
  blockId?: string | null
): string {
  const scope = blockId
    ? "Design an optimal evidence input schema for ONE block inside a performance workspace."
    : "Design an optimal evidence input schema for an entire performance workspace.";

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

You are an OpenLesson evidence architect. Given a workspace context (attached JSON summary and any plan files on xAI) plus an evaluation definition from the API caller, produce a JSON Schema that describes the **ideal tool evidence payload** for optimal learning and gap evaluation via POST .../performance.

The caller's evaluation definition:
"""
${request.definition}
"""

Integration hints (optional):
${hintsText}

Rules:
1. Default to evidence type "tool" with recommended_mime_type "application/json" unless the definition clearly needs screen, video, or eeg enrichments.
2. The returned "schema" must be a valid JSON Schema (draft-07 style) for the JSON object that goes inside the evidence upload "data" field (after base64 encoding). Prefer type "object" with explicit properties, required arrays, and enums where helpful.
3. Optimize for signals that POST .../performance can use: time-ordered events, learner reflections, goals achieved, artifact summaries, decision rationale, outcomes, and block-relevant competencies.
4. Align field names and semantics with the workspace root topic, block titles, and any uploaded plan files when present.
5. Include an example_payload that validates against your schema conceptually.
6. Keep required_fields practical — do not over-constrain integrators; use optional_fields for enrichments.
7. collection_guidance should explain when and how often to upload evidence for this definition.
8. schema_name should be snake_case, prefixed with "eval_input_".

Return only JSON matching the output schema.`;
}

export function buildEvidenceSchemaPrompt(workspaceTitle: string): string {
  return `Generate the optimal evidence input JSON Schema for evaluating "${workspaceTitle}" in OpenLesson.`;
}