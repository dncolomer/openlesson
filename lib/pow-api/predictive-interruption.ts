import type { PerformanceReport } from "./performance-report";
import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import { TIM_CONTRACT_NARRATIVE } from "@/lib/prompt-kernel/tim";
import { buildTimFeatureEnvelope } from "./tim-feature-envelope";
import { predictWithTimProvider } from "./tim-provider";
import { normalizePredictedInterruption } from "./tim-normalize";

export type {
  InterruptionInterventionType,
  InterruptionIntervention,
  PredictiveInterruption,
  ProofOfWorkApiInterruption,
  ProofOfWorkApiEndpoint,
} from "./predictive-interruption-types";
export { normalizePredictedInterruption } from "./tim-normalize";

import type {
  InterruptionInterventionType,
  PredictiveInterruption,
  ProofOfWorkApiEndpoint,
  ProofOfWorkApiInterruption,
} from "./predictive-interruption-types";

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

export interface InterruptionContext {
  endpoint: ProofOfWorkApiEndpoint;
  workspace_id?: string;
  proof_of_work_artifacts?: number;
  block_id?: string | null;
  mode?: "report" | "score";
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
  workspace_goal?: string | null;
  /** Idle duration in ms when endpoint is upload_*_idle */
  idle_duration_ms?: number | null;
  /** Speech transcript snapshot when available */
  speech_transcript?: string | null;
  /** Optional learning world model snapshot for TIM features. */
  learning_world_model?: LearningWorldModelV0 | null;
}

const NO_INTERRUPTION_ENDPOINTS = new Set<ProofOfWorkApiEndpoint>([
  "list_workspaces",
  "get_workspace",
  "get_workspace_detail",
  "list_blocks",
  "list_tap_links",
  "get_world_model",
  "get_knowledge_config",
  "get_knowledge_config_trajectory",
  "knowledge_distance",
  "list_snapshot_history",
  "list_custom_knowledge_regions",
  "get_learning_progress",
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
      "Every Proof-of-Work API success response includes an interruption field powered by the Trace Interruption Model (TIM). When non-null, schedule the intervention after delay_ms unless a later Proof-of-Work API response supersedes it. TIM is a swappable interruption world model (baked-in default today; may later run as an independent external service) — the consumer interruption envelope stays stable.",
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

export async function predictInterruption(context: InterruptionContext): Promise<ProofOfWorkApiInterruption> {
  if (context.llm_interruption) {
    return context.llm_interruption;
  }

  if (NO_INTERRUPTION_ENDPOINTS.has(context.endpoint)) {
    return null;
  }

  const features = buildTimFeatureEnvelope(context, context.learning_world_model);
  return predictWithTimProvider(features);
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
  return `${TIM_CONTRACT_NARRATIVE}

Supersession: ${contract.supersession_rule}

Intervention types: ${contract.intervention_types.join(", ")}

Example active interruption:
${JSON.stringify(contract.example_active, null, 2)}

Empty interruption (no prediction): null

TIM provider note: the platform may host TIM in-process or as an independent world model service; integrators only depend on the interruption field and supersession rules above.`;
}