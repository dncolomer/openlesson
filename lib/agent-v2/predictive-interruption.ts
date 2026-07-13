import type { PerformanceReport } from "./performance-report";
import { predictInterruptionWithLlm } from "./tim-llm-predictor";

/** Trace Interruption Model (TIM) — intervention types a consumer may trigger toward the user. */
export type InterruptionInterventionType =
  | "reflection_prompt"
  | "checkpoint_probe"
  | "coaching_nudge"
  | "proof_of_work_reminder"
  | "performance_review";

export interface InterruptionIntervention {
  type: InterruptionInterventionType;
  /** Message or prompt the consumer should present to the user. */
  message: string;
  /** Why this intervention is predicted at this moment. */
  rationale?: string;
  /** Machine-oriented hint for the consumer system (e.g. call analyze_performance). */
  consumer_action?: string;
  block_id?: string | null;
}

export interface PredictiveInterruption {
  /** Unique id for this prediction. A newer response supersedes any pending timer with a different id. */
  interruption_id: string;
  /** Milliseconds to wait before triggering the intervention unless superseded. */
  delay_ms: number;
  intervention: InterruptionIntervention;
  confidence: "low" | "medium" | "high";
  /** ISO-8601 timestamp when this prediction was issued. */
  predicted_at: string;
}

/** null = no interruption predicted (empty interruption). */
export type ProofOfWorkApiInterruption = PredictiveInterruption | null;

export interface InterruptionContract {
  description: string;
  empty_value: null;
  consumer_obligations: string[];
  fields: {
    interruption_id: string;
    delay_ms: string;
    intervention: string;
    confidence: string;
    predicted_at: string;
  };
  supersession_rule: string;
  intervention_types: InterruptionInterventionType[];
  example_active: PredictiveInterruption;
  example_empty: null;
}

export type ProofOfWorkApiEndpoint =
  | "create_workspace"
  | "list_workspaces"
  | "get_workspace"
  | "list_blocks"
  | "generate_proof_of_work_schema"
  | "generate_integration_skill"
  | "upload_proof_of_work"
  | "upload_tap_trace"
  | "upload_tap_chat"
  | "upload_tap_idle"
  | "upload_tap_speech"
  | "upload_ile_trace"
  | "upload_ile_chat"
  | "upload_ile_idle"
  | "upload_ile_speech"
  | "analyze_performance"
  | "get_learning_progress"
  | "list_tap_links"
  | "create_tap_link"
  | "get_workspace_detail";

export interface InterruptionContext {
  endpoint: ProofOfWorkApiEndpoint;
  workspace_id?: string;
  proof_of_work_artifacts?: number;
  block_id?: string | null;
  mode?: "report" | "chat";
  report?: PerformanceReport | null;
  /** Workspace- or LLM-authored interruption candidate from proof of work spec generation. */
  llm_interruption?: ProofOfWorkApiInterruption;
  tool_name?: string | null;
  tap_minutes?: number;
  /** TAP trace action, e.g. system1:pause_finalize or system2:send */
  tap_action?: string | null;
  /** Human-readable summary of the triggering artifact or event. */
  artifact_summary?: string | null;
  /** Structured metadata about the artifact (tool payload, chat exchange, etc.). */
  artifact_metadata?: Record<string, unknown> | null;
  /** Recent proof-of-work manifest for session context. */
  recent_pow_manifest?: string | null;
  workspace_title?: string | null;
  conversion_goal?: string | null;
  /** Idle duration in ms when endpoint is upload_*_idle */
  idle_duration_ms?: number | null;
  /** Speech transcript snapshot when available */
  speech_transcript?: string | null;
}

const NO_INTERRUPTION_ENDPOINTS = new Set<ProofOfWorkApiEndpoint>([
  "list_workspaces",
  "get_workspace",
  "get_workspace_detail",
  "list_blocks",
  "list_tap_links",
]);

const DEFAULT_EXAMPLE: PredictiveInterruption = {
  interruption_id: "int_example_001",
  delay_ms: 90_000,
  intervention: {
    type: "reflection_prompt",
    message: "Before moving on, articulate the tradeoff you considered in your last action.",
    rationale: "Recent tool trace shows a decision point without recorded rationale.",
    consumer_action: "present_modal_reflection",
  },
  confidence: "medium",
  predicted_at: "2026-07-10T12:00:00.000Z",
};

export function buildInterruptionContract(): InterruptionContract {
  return {
    description:
      "Every Proof-of-Work API success response includes an interruption field powered by the Trace Interruption Model (TIM). When non-null, schedule the intervention after delay_ms unless a later Proof-of-Work API response supersedes it.",
    empty_value: null,
    consumer_obligations: [
      "Read interruption on every Proof-of-Work API response (REST and MCP).",
      "When interruption is null, do not schedule a new TIM intervention from this response.",
      "When interruption is non-null, schedule consumer_action after delay_ms.",
      "If another Proof-of-Work API call returns before the timer fires, cancel the pending timer and apply the newest interruption (or clear if null).",
      "Never stack duplicate timers for the same workspace session — always supersede.",
    ],
    fields: {
      interruption_id: "Stable id for deduplication and supersession tracking.",
      delay_ms: "Non-negative milliseconds before the consumer should trigger the intervention.",
      intervention:
        "type (reflection_prompt | checkpoint_probe | coaching_nudge | proof_of_work_reminder | performance_review), message, optional rationale, consumer_action, optional block_id.",
      confidence: "low | medium | high — how strongly TIM predicts this intervention.",
      predicted_at: "ISO-8601 timestamp when the prediction was issued.",
    },
    supersession_rule:
      "Any subsequent Proof-of-Work API response replaces the previous pending interruption. A new non-null interruption cancels the prior timer; null means no new intervention is predicted from that response.",
    intervention_types: [
      "reflection_prompt",
      "checkpoint_probe",
      "coaching_nudge",
      "proof_of_work_reminder",
      "performance_review",
    ],
    example_active: DEFAULT_EXAMPLE,
    example_empty: null,
  };
}

function createInterruptionId(endpoint: ProofOfWorkApiEndpoint, workspaceId?: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  const scope = workspaceId ? workspaceId.slice(0, 8) : "global";
  return `int_${endpoint}_${scope}_${suffix}`;
}

function clampDelayMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function normalizePredictedInterruption(
  raw: unknown,
  fallbackEndpoint: ProofOfWorkApiEndpoint,
  workspaceId?: string,
): ProofOfWorkApiInterruption {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const interventionRaw = record.intervention;
  if (!interventionRaw || typeof interventionRaw !== "object" || Array.isArray(interventionRaw)) {
    return null;
  }

  const intervention = interventionRaw as Record<string, unknown>;
  const type = intervention.type;
  const message = typeof intervention.message === "string" ? intervention.message.trim() : "";
  if (!message) return null;

  const allowedTypes: InterruptionInterventionType[] = [
    "reflection_prompt",
    "checkpoint_probe",
    "coaching_nudge",
    "proof_of_work_reminder",
    "performance_review",
  ];
  const interventionType = allowedTypes.includes(type as InterruptionInterventionType)
    ? (type as InterruptionInterventionType)
    : "reflection_prompt";

  const confidenceRaw = record.confidence;
  const confidence =
    confidenceRaw === "low" || confidenceRaw === "medium" || confidenceRaw === "high"
      ? confidenceRaw
      : "medium";

  return {
    interruption_id:
      typeof record.interruption_id === "string" && record.interruption_id.trim()
        ? record.interruption_id.trim()
        : createInterruptionId(fallbackEndpoint, workspaceId),
    delay_ms: clampDelayMs(Number(record.delay_ms), 15_000, 600_000),
    intervention: {
      type: interventionType,
      message: message.slice(0, 2000),
      rationale:
        typeof intervention.rationale === "string" ? intervention.rationale.trim().slice(0, 2000) : undefined,
      consumer_action:
        typeof intervention.consumer_action === "string"
          ? intervention.consumer_action.trim().slice(0, 500)
          : undefined,
      block_id:
        typeof intervention.block_id === "string"
          ? intervention.block_id
          : intervention.block_id === null
            ? null
            : undefined,
    },
    confidence,
    predicted_at: new Date().toISOString(),
  };
}

export async function predictInterruption(context: InterruptionContext): Promise<ProofOfWorkApiInterruption> {
  if (context.llm_interruption) {
    return context.llm_interruption;
  }

  if (NO_INTERRUPTION_ENDPOINTS.has(context.endpoint)) {
    return null;
  }

  const raw = await predictInterruptionWithLlm(context);
  if (!raw?.should_interrupt) {
    return null;
  }

  return normalizePredictedInterruption(
    {
      delay_ms: raw.delay_ms,
      confidence: raw.confidence,
      intervention: {
        type: raw.intervention_type,
        message: raw.message,
        rationale: raw.rationale,
        consumer_action: raw.consumer_action,
        block_id: context.block_id ?? null,
      },
    },
    context.endpoint,
    context.workspace_id,
  );
}

export async function withProofOfWorkApiResponse<T extends Record<string, unknown>>(
  payload: T,
  context: InterruptionContext,
): Promise<T & { interruption: ProofOfWorkApiInterruption }> {
  return {
    ...payload,
    interruption: await predictInterruption(context),
  };
}

export function formatInterruptionContractForSkillPrompt(): string {
  const contract = buildInterruptionContract();
  return `Predictive interruptions (TIM — Trace Interruption Model):
${contract.description}

Consumer obligations:
${contract.consumer_obligations.map((line) => `- ${line}`).join("\n")}

Supersession: ${contract.supersession_rule}

Intervention types: ${contract.intervention_types.join(", ")}

Example active interruption:
${JSON.stringify(contract.example_active, null, 2)}

Empty interruption (no prediction): null`;
}