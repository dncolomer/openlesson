import type { SupabaseClient } from "@supabase/supabase-js";
import type { PerformanceContextPayload } from "./performance-context";
import type { PerformanceReport, PerformanceReportContract } from "./performance-report";
import type { ProofOfWorkEvalSchemaResult, ProofOfWorkSchemaRequest } from "./proof-of-work-schema";

export type EvaluationMode = "semantic" | "opaque";

export interface OpaqueProtocolPhase {
  id: string;
  verb: string;
  label?: string;
}

export interface OpaqueProtocol {
  protocol_id: string;
  goal_ref: string;
  phases?: OpaqueProtocolPhase[];
  goal_tokens?: string[];
  constraints?: string[];
}

export interface OpaqueContract {
  event_verbs: string[];
  goal_tokens?: string[];
  required_event_fields?: string[];
  token_fields?: string[];
}

export interface OpaqueWorkspaceCreateRequest {
  evaluation_mode: "opaque";
  protocol: OpaqueProtocol;
  external_refs?: Record<string, string>;
}

export interface OpaqueSchemaRequest {
  evaluation_mode: "opaque";
  definition_ref: string;
  contract: OpaqueContract;
  block_id?: string | null;
  integration_hints?: ProofOfWorkSchemaRequest["integration_hints"];
}

export interface PrivacyMetadata {
  evaluation_mode: EvaluationMode;
  semantic_inference: "enabled" | "disabled";
  plaintext_lint: "off" | "enforced";
  stored_prompt: boolean;
}

export interface OpaquePlaintextLintResult {
  passed: boolean;
  violations: string[];
}

export interface OpaqueProtocolReport {
  protocol_id: string;
  goal_ref: string;
  protocol_compliance_score: number;
  phase_coverage: Record<string, boolean>;
  trace_integrity: {
    trace_id_consistent: boolean | null;
    goals_achieved_present: boolean | null;
    validation_checks_passed: string[];
  };
  structural_gaps: Array<{
    code: string;
    phase?: string;
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
}

export interface WorkspaceEvaluationMeta {
  evaluation_mode: EvaluationMode;
  protocol_config: OpaqueProtocol | null;
  external_refs: Record<string, string> | null;
}

const OPAQUE_METADATA_ALLOWLIST = new Set([
  "trace_token",
  "goal_ref",
  "anon",
  "event_count",
  "schema_version",
  "protocol_id",
  "phase_id",
  "allow_plaintext",
]);

const PLAINTEXT_PATH_PATTERNS = [
  /\/Users\//i,
  /\/home\//i,
  /[A-Za-z]:\\/, 
  /\b\w+\.(txt|json|md|py|ts|js|sh)\b/i,
];

export const CANONICAL_PROTOCOLS: Record<string, OpaqueProtocolPhase[]> = {
  "agent-trace-v3": [
    { id: "p1", verb: "enumerate", label: "Phase 1: Enumerate" },
    { id: "p2", verb: "fingerprint", label: "Phase 2: Fingerprint" },
    { id: "p3", verb: "aggregate", label: "Phase 3: Aggregate" },
    { id: "p4", verb: "emit", label: "Phase 4: Emit" },
    { id: "p5", verb: "validate", label: "Phase 5: Validate" },
  ],
};

export function normalizeEvaluationMode(value: unknown): EvaluationMode {
  return value === "opaque" ? "opaque" : "semantic";
}

export function isOpaqueWorkspace(meta: WorkspaceEvaluationMeta): boolean {
  return meta.evaluation_mode === "opaque";
}

export function buildPrivacyMetadata(meta: WorkspaceEvaluationMeta): PrivacyMetadata {
  const opaque = isOpaqueWorkspace(meta);
  return {
    evaluation_mode: meta.evaluation_mode,
    semantic_inference: opaque ? "disabled" : "enabled",
    plaintext_lint: opaque ? "enforced" : "off",
    stored_prompt: !opaque,
  };
}

export function parseOpaqueWorkspaceCreateRequest(
  body: Record<string, unknown>
): OpaqueWorkspaceCreateRequest | null {
  if (normalizeEvaluationMode(body.evaluation_mode) !== "opaque") return null;

  const protocolRaw = body.protocol;
  if (!protocolRaw || typeof protocolRaw !== "object" || Array.isArray(protocolRaw)) return null;

  const protocol = protocolRaw as Record<string, unknown>;
  const protocolId = typeof protocol.protocol_id === "string" ? protocol.protocol_id.trim() : "";
  const goalRef = typeof protocol.goal_ref === "string" ? protocol.goal_ref.trim() : "";
  if (!protocolId || !goalRef) return null;
  if (goalRef.length > 128) return null;

  const phases = parseProtocolPhases(protocol.phases, protocolId);
  const goalTokens = parseStringArray(protocol.goal_tokens);
  const constraints = parseStringArray(protocol.constraints);

  let externalRefs: Record<string, string> | undefined;
  if (body.external_refs && typeof body.external_refs === "object" && !Array.isArray(body.external_refs)) {
    externalRefs = {};
    for (const [key, value] of Object.entries(body.external_refs as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        externalRefs[key.slice(0, 64)] = value.trim().slice(0, 256);
      }
    }
  }

  return {
    evaluation_mode: "opaque",
    protocol: {
      protocol_id: protocolId.slice(0, 64),
      goal_ref: goalRef,
      phases,
      goal_tokens: goalTokens,
      constraints,
    },
    external_refs: externalRefs,
  };
}

export function parseOpaqueSchemaRequest(
  body: Record<string, unknown>
): OpaqueSchemaRequest | null {
  if (normalizeEvaluationMode(body.evaluation_mode) !== "opaque") return null;

  const definitionRef = typeof body.definition_ref === "string" ? body.definition_ref.trim() : "";
  if (!definitionRef) return null;

  const contractRaw = body.contract;
  if (!contractRaw || typeof contractRaw !== "object" || Array.isArray(contractRaw)) return null;

  const contractObj = contractRaw as Record<string, unknown>;
  const eventVerbs = parseStringArray(contractObj.event_verbs);
  if (!eventVerbs.length) return null;

  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const hintsRaw = body.integration_hints;
  let integration_hints: ProofOfWorkSchemaRequest["integration_hints"];

  if (hintsRaw && typeof hintsRaw === "object" && !Array.isArray(hintsRaw)) {
    const hints = hintsRaw as Record<string, unknown>;
    integration_hints = {
      tool_name: typeof hints.tool_name === "string" ? hints.tool_name.trim() : undefined,
      partner_agent: typeof hints.partner_agent === "string" ? hints.partner_agent.trim() : undefined,
      event_verbs: parseStringArray(hints.event_verbs),
      goals: parseStringArray(hints.goals),
    };
  }

  return {
    evaluation_mode: "opaque",
    definition_ref: definitionRef.slice(0, 128),
    contract: {
      event_verbs: eventVerbs,
      goal_tokens: parseStringArray(contractObj.goal_tokens),
      required_event_fields: parseStringArray(contractObj.required_event_fields),
      token_fields: parseStringArray(contractObj.token_fields),
    },
    block_id: blockId,
    integration_hints,
  };
}

export function resolveProtocolPhases(protocol: OpaqueProtocol): OpaqueProtocolPhase[] {
  if (protocol.phases?.length) return protocol.phases;
  return CANONICAL_PROTOCOLS[protocol.protocol_id] || CANONICAL_PROTOCOLS["agent-trace-v3"];
}

export function buildOpaqueWorkspaceTitle(protocol: OpaqueProtocol): string {
  return `Opaque Protocol ${protocol.protocol_id}`;
}

export function buildOpaqueConversionGoal(protocol: OpaqueProtocol): string {
  return `goal_ref:${protocol.goal_ref}`;
}

export function buildOpaqueRootTopic(protocol: OpaqueProtocol): string {
  return `protocol:${protocol.protocol_id}`;
}

export function buildOpaqueWorkspaceNotes(protocol: OpaqueProtocol): string {
  return [
    `evaluation_mode=opaque`,
    `protocol_id=${protocol.protocol_id}`,
    `goal_ref=${protocol.goal_ref}`,
    protocol.constraints?.length ? `constraints=${protocol.constraints.join(",")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export interface OpaqueGeneratedBlock {
  localId: string;
  title: string;
  description: string;
  is_start: boolean;
  next: string[];
  phase_id: string;
  verb: string;
}

export function buildOpaqueGeneratedBlocks(protocol: OpaqueProtocol): OpaqueGeneratedBlock[] {
  const phases = resolveProtocolPhases(protocol);
  return phases.map((phase, index) => ({
    localId: phase.id,
    title: phase.label || `Phase: ${phase.verb}`,
    description: `Demonstrate protocol phase ${phase.verb} with tokenized trace output.`,
    is_start: index === 0,
    next: index < phases.length - 1 ? [phases[index + 1].id] : [],
    phase_id: phase.id,
    verb: phase.verb,
  }));
}

export async function insertOpaqueWorkspaceBlocks(
  supabase: SupabaseClient,
  workspaceId: string,
  protocol: OpaqueProtocol
): Promise<Map<string, string>> {
  const blocks = buildOpaqueGeneratedBlocks(protocol);
  const blockIdMap = new Map<string, string>();

  for (const block of blocks) {
    const { data: insertedBlock, error } = await supabase
      .from("blocks")
      .insert({
        workspace_id: workspaceId,
        title: block.title,
        description: block.description,
        is_start: block.is_start,
        next_block_ids: [],
        status: "available",
      })
      .select("id")
      .single();

    if (error || !insertedBlock) continue;
    blockIdMap.set(block.localId, insertedBlock.id);
  }

  for (const block of blocks) {
    const dbId = blockIdMap.get(block.localId);
    if (!dbId || !block.next.length) continue;
    const nextIds = block.next.map((id) => blockIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (nextIds.length) {
      await supabase.from("blocks").update({ next_block_ids: nextIds }).eq("id", dbId);
    }
  }

  return blockIdMap;
}

export function buildOpaqueProofOfWorkSpec(
  request: OpaqueSchemaRequest,
  protocol: OpaqueProtocol,
  workspaceId: string
): ProofOfWorkEvalSchemaResult {
  const verbs = request.contract.event_verbs;
  const goalTokens = request.contract.goal_tokens || protocol.goal_tokens || [];
  const requiredFields = request.contract.required_event_fields || ["verb", "timestamp_ms"];
  const tokenFields = request.contract.token_fields || ["path", "fingerprint", "artifact_ref", "aggregate_fp"];

  const eventSchema = {
    type: "object",
    properties: {
      verb: { type: "string", enum: verbs },
      timestamp_ms: { type: "number" },
      path: { type: "string", description: "Tokenized path reference" },
      fingerprint: { type: "string", description: "Content fingerprint hash" },
      stats: { type: "object", additionalProperties: true },
      artifact_ref: { type: "string" },
      metadata: { type: "object", additionalProperties: true },
    },
    required: requiredFields,
  };

  const schema = {
    type: "object",
    properties: {
      trace_id: { type: "string" },
      session_id: { type: "string" },
      events: { type: "array", items: eventSchema },
      goals_achieved: { type: "array", items: { type: "string", enum: goalTokens } },
    },
    required: ["trace_id", "events"],
  };

  const exampleEvents = verbs.slice(0, 3).map((verb, index) => ({
    verb,
    timestamp_ms: 1_700_000_000_000 + index * 100,
    ...(tokenFields.includes("path") ? { path: "a1b2c3d4e5f6g7h8" } : {}),
    ...(verb === "fingerprint" && tokenFields.includes("fingerprint")
      ? { fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000" }
      : {}),
  }));

  return {
    schema,
    schema_name: `opaque_${protocol.protocol_id.replace(/[^a-z0-9_-]/gi, "_")}`,
    rationale: `Opaque contract ${request.definition_ref} requires ${verbs.length} phase verbs with tokenized fields only. No semantic inference is performed on goal_ref ${protocol.goal_ref}.`,
    example_payload: {
      trace_id: "trace_token_example",
      session_id: "session_token_example",
      events: exampleEvents,
      goals_achieved: goalTokens.slice(0, 2),
    },
    recommended_mime_type: "application/json",
    recommended_proof_of_work_type: "tool",
    required_fields: ["trace_id", "events"],
    optional_fields: ["session_id", "goals_achieved"],
    collection_guidance: "Upload one artifact per protocol phase. Use tokenized path/fingerprint fields only.",
    continuous_evaluation_summary:
      "Opaque mode: schema is contract-driven. Re-fetch after every 5-10 artifacts to refresh phase alignment.",
    tool_submissions: [
      {
        tool_name: request.integration_hints?.tool_name || "opaque_agent_trace",
        purpose: `Submit tokenized trace events for protocol ${protocol.protocol_id}`,
        when_to_submit: "After each protocol phase completes",
        schema,
        example_payload: {
          trace_id: "trace_token_example",
          events: exampleEvents,
        },
        required_fields: ["trace_id", "events"],
        optional_fields: ["goals_achieved"],
      },
    ],
    performance_report_contract: buildOpaquePerformanceReportContract(),
    spec_version: "1.4-opaque",
    workspace_id: workspaceId,
    block_id: request.block_id ?? null,
  };
}

export function buildOpaquePerformanceReportContract(): PerformanceReportContract {
  return {
    endpoint_pattern: "(workspace)/performance",
    response_mode: "report",
    required_fields: [
      "overall_score",
      "conversion_score",
      "conversion_goal",
      "ghc_score",
      "ghc_confidence",
      "marker_scores",
      "gap_analysis",
      "protocol_compliance_score",
    ],
    overall_score: {
      type: "integer",
      range: "0-100",
      description: "Structural trace completeness / phase coverage score (opaque mode)",
    },
    conversion_score: {
      type: "integer",
      range: "0-100",
      description: "Protocol compliance score — goals_achieved and phase coverage",
    },
    conversion_goal: {
      type: "string",
      description: "Opaque goal_ref token only",
    },
    ghc_score: {
      type: "integer",
      range: "0-100",
      description:
        "Opaque mode: structural authenticity only (0 when no human selective-thought signal); typically ghc_confidence none|low",
    },
    ghc_confidence: {
      type: "string",
      description: "none | low | medium | high — usually none or low in opaque structural mode",
    },
    marker_scores: {
      description: "One marker per protocol phase; rationales cite observable event fields only",
      min_markers: 3,
      max_markers: 8,
      visualization: "spider_radar",
      item_fields: ["id", "label", "score", "rationale", "block_id"],
    },
    gap_analysis: {
      required: true,
      gaps_required: true,
      item_fields: ["title", "proof_of_work", "severity", "suggested_repair"],
      next_steps_required: true,
      next_steps_fields: ["directions", "events"],
    },
    example_report: {
      overall_score: 0,
      conversion_score: 0,
      conversion_goal: "goal_ref:example",
      ghc_score: 0,
      ghc_confidence: "none",
      marker_scores: [],
      summary: "Insufficient proof of work.",
      strengths: [],
      growth_areas: [],
      gap_analysis: {
        summary: "No artifacts yet.",
        gaps: [],
        next_steps: { directions: [], events: [] },
      },
      suggestions: [],
      confidence: "emerging",
    },
  };
}

export const OPAQUE_INFERENCE_GUARDRAILS = `Opaque evaluation guardrails (MANDATORY):
- Do NOT infer meaning from goal_ref, protocol_ref, definition_ref, trace_token, or any hash/token value.
- Do NOT expand opaque tokens into guessed domain semantics.
- Rationales must cite only observable event fields: verb, timestamp_ms, items_found, byte_count, count_check, resample_match, goals_achieved, anon, event_count.
- gap_analysis.gaps[].title must use structural codes (e.g. MISSING_PHASE, INCOMPLETE_VALIDATION, TRACE_ID_MISMATCH).
- suggestions and next_steps.events must reference protocol verbs and structural metadata only — never domain tasks.
- conversion_goal must echo the authoritative goal_ref exactly when provided.`;

export function buildOpaquePerformanceReportInstructions(
  blockId?: string | null,
  goalRef?: string | null
): string {
  const scope = blockId ? "a single protocol phase" : "the full opaque protocol";
  const goalLine = goalRef?.trim()
    ? `\nAuthoritative goal_ref (echo exactly as conversion_goal; do not interpret):\n"${goalRef.trim()}"\n`
    : "";

  return `You produce **structural-only** learning verification for ${scope} in opaque evaluation mode.
${goalLine}
${OPAQUE_INFERENCE_GUARDRAILS}

Score outputs:
1. overall_score — structural trace completeness / phase coverage (0-100)
2. conversion_score — protocol compliance: phase coverage + goals_achieved presence (0-100). This replaces semantic conversion likelihood in opaque mode.
3. conversion_goal — echo goal_ref exactly when provided
4. ghc_score — structural authenticity only (0 when no human selective-thought signal); typically low
5. ghc_confidence — none or low in opaque mode (no semantic GHC)
6. marker_scores — one axis per protocol phase block; rationales cite event fields only
7. gap_analysis — structural deficits only; use codes in titles when possible
8. protocol_compliance_score — same integer as conversion_score (duplicate for opaque consumers)

Be honest when proof of work is thin.`;
}

export function buildOpaquePerformanceChatInstructions(blockId?: string | null): string {
  const scope = blockId ? "one protocol phase" : "the full opaque protocol";
  return `You are an Uncertain Systems structural coach for opaque evaluation mode over ${scope}.

${OPAQUE_INFERENCE_GUARDRAILS}

Answer using only observable trace structure. Recommend metadata and validation improvements — never domain-specific implementation details.`;
}

export function redactOpaqueFileName(artifactId: string): string {
  return `pow-${artifactId}.json`;
}

export function sanitizeOpaqueMetadata(
  metadata: Record<string, unknown>,
  allowPlaintext = false
): Record<string, unknown> {
  if (allowPlaintext) return metadata;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (OPAQUE_METADATA_ALLOWLIST.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function lintOpaquePayload(
  decodedText: string,
  options?: { allowPlaintext?: boolean }
): OpaquePlaintextLintResult {
  if (options?.allowPlaintext) {
    return { passed: true, violations: [] };
  }

  const violations: string[] = [];
  for (const pattern of PLAINTEXT_PATH_PATTERNS) {
    if (pattern.test(decodedText)) {
      violations.push(`matched_pattern:${pattern.source}`);
    }
  }

  return { passed: violations.length === 0, violations };
}

export function scrubOpaquePerformanceContext(
  payload: PerformanceContextPayload,
  protocol: OpaqueProtocol | null
): PerformanceContextPayload {
  return {
    ...payload,
    workspace: {
      ...payload.workspace,
      title: protocol ? buildOpaqueWorkspaceTitle(protocol) : payload.workspace.title,
      root_topic: protocol ? buildOpaqueRootTopic(protocol) : "opaque",
      description: "Opaque protocol evaluation workspace",
      notes: protocol ? buildOpaqueWorkspaceNotes(protocol) : "evaluation_mode=opaque",
      conversion_goal: protocol ? buildOpaqueConversionGoal(protocol) : payload.workspace.conversion_goal,
    },
    blocks: payload.blocks.map((block) => ({
      ...block,
      description: block.description?.startsWith("Demonstrate protocol phase")
        ? block.description
        : `Protocol phase block (${block.id})`,
    })),
  };
}

export function extractGoalRefFromConversionGoal(conversionGoal: string | null | undefined): string | null {
  if (!conversionGoal) return null;
  const match = conversionGoal.match(/^goal_ref:(.+)$/);
  return match?.[1]?.trim() || null;
}

export function finalizeOpaquePerformanceReport(
  report: PerformanceReport,
  goalRef: string | null,
  protocol: OpaqueProtocol | null
): {
  report: PerformanceReport;
  workspace_conversion_goal: string;
  conversion_goal_source: "opaque_ref";
  protocol_report: OpaqueProtocolReport;
} {
  const complianceScore = report.conversion_score;
  const phases = protocol ? resolveProtocolPhases(protocol) : [];
  const phaseVerbs = phases.map((p) => p.verb);

  const protocolReport: OpaqueProtocolReport = {
    protocol_id: protocol?.protocol_id || "unknown",
    goal_ref: goalRef || protocol?.goal_ref || "unknown",
    protocol_compliance_score: complianceScore,
    phase_coverage: Object.fromEntries(phaseVerbs.map((verb) => [verb, true])),
    trace_integrity: {
      trace_id_consistent: null,
      goals_achieved_present: null,
      validation_checks_passed: [],
    },
    structural_gaps: report.gap_analysis.gaps.map((gap) => ({
      code: gap.title.replace(/\s+/g, "_").toUpperCase().slice(0, 48),
      severity: gap.severity,
      evidence: gap.proof_of_work,
    })),
  };

  const conversionGoal = goalRef ? `goal_ref:${goalRef}` : report.conversion_goal;

  return {
    report: {
      ...report,
      conversion_goal: conversionGoal,
      conversion_score: complianceScore,
      overall_score: report.overall_score,
      ghc_score: report.ghc_score ?? 0,
      ghc_confidence: report.ghc_confidence ?? "none",
    },
    workspace_conversion_goal: conversionGoal,
    conversion_goal_source: "opaque_ref",
    protocol_report: protocolReport,
  };
}

export function parseWorkspaceEvaluationMeta(row: {
  evaluation_mode?: string | null;
  protocol_config?: unknown;
  external_refs?: unknown;
}): WorkspaceEvaluationMeta {
  const protocolConfig = parseStoredProtocol(row.protocol_config);
  const externalRefs = parseStoredExternalRefs(row.external_refs);

  return {
    evaluation_mode: normalizeEvaluationMode(row.evaluation_mode),
    protocol_config: protocolConfig,
    external_refs: externalRefs,
  };
}

function parseProtocolPhases(value: unknown, protocolId: string): OpaqueProtocolPhase[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return CANONICAL_PROTOCOLS[protocolId];
  }

  const phases: OpaqueProtocolPhase[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const verb = typeof item.verb === "string" ? item.verb.trim() : "";
    if (!id || !verb) continue;
    phases.push({
      id: id.slice(0, 32),
      verb: verb.slice(0, 32),
      label: typeof item.label === "string" ? item.label.trim().slice(0, 80) : undefined,
    });
  }

  return phases.length ? phases : CANONICAL_PROTOCOLS[protocolId];
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStoredProtocol(value: unknown): OpaqueProtocol | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const protocolId = typeof raw.protocol_id === "string" ? raw.protocol_id : "";
  const goalRef = typeof raw.goal_ref === "string" ? raw.goal_ref : "";
  if (!protocolId || !goalRef) return null;

  return {
    protocol_id: protocolId,
    goal_ref: goalRef,
    phases: parseProtocolPhases(raw.phases, protocolId),
    goal_tokens: parseStringArray(raw.goal_tokens),
    constraints: parseStringArray(raw.constraints),
  };
}

function parseStoredExternalRefs(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === "string" && val.trim()) out[key] = val.trim();
  }
  return Object.keys(out).length ? out : null;
}