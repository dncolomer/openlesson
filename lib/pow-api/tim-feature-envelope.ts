import type { PerformanceReport } from "./performance-report";
import {
  TIM_INTERVENTION_TYPE_CATALOG,
  type InterruptionInterventionType,
  type ProofOfWorkApiEndpoint,
} from "./predictive-interruption-types";
import {
  learningWorldModelForTim,
  type LearningWorldModelV0,
} from "@/lib/prompt-kernel/world-model";

/** Minimal context shape for TIM features (avoids circular imports with predictive-interruption). */
export interface TimFeatureSource {
  endpoint: ProofOfWorkApiEndpoint;
  workspace_id?: string;
  proof_of_work_artifacts?: number;
  block_id?: string | null;
  report?: PerformanceReport | null;
  tool_name?: string | null;
  tap_action?: string | null;
  artifact_summary?: string | null;
  artifact_metadata?: Record<string, unknown> | null;
  recent_pow_manifest?: string | null;
  idle_duration_ms?: number | null;
  speech_transcript?: string | null;
  learning_world_model?: LearningWorldModelV0 | null;
}

export const TIM_FEATURE_SCHEMA_VERSION = 1 as const;

export interface TimFeatureEnvelopeV1 {
  schema_version: typeof TIM_FEATURE_SCHEMA_VERSION;
  event: {
    endpoint: ProofOfWorkApiEndpoint;
    workspace_id?: string;
    block_id?: string | null;
    session_id?: string | null;
    tap_session_id?: string | null;
  };
  proof_of_work: {
    artifacts_count?: number;
    tool_name?: string | null;
    tool_action?: string | null;
    artifact_summary?: string | null;
    artifact_metadata?: Record<string, unknown> | null;
    recent_manifest?: string | null;
    idle_duration_ms?: number | null;
    speech_transcript?: string | null;
  };
  learning_world_model?: {
    inferred_goal?: string | null;
    evidence_appetite?: { want_more: string[]; saturated: string[] };
    scores_snapshot?: {
      verification_score?: number | null;
      augmentation_score?: number | null;
      optimization_score?: number | null;
      ghc_score?: number | null;
    };
    temporal_patterns?: Record<string, unknown> | null;
  };
  performance_summary?: {
    vertical?: string;
    score?: number;
    verification_score?: number | null;
    augmentation_score?: number | null;
    optimization_score?: number | null;
    workspace_goal?: string | null;
    ghc_score?: number | null;
    top_gaps?: Array<{ title: string; severity: string }>;
  } | null;
  policy: {
    allowed_intervention_types: InterruptionInterventionType[];
    min_delay_ms: number;
    max_delay_ms: number;
  };
}

export const DEFAULT_TIM_INTERVENTION_TYPES: InterruptionInterventionType[] = [
  ...TIM_INTERVENTION_TYPE_CATALOG,
];

function summarizeReportForTim(
  report: PerformanceReport | null | undefined,
): TimFeatureEnvelopeV1["performance_summary"] {
  if (!report) return null;
  return {
    vertical: report.vertical,
    score: report.score,
    verification_score: report.vertical === "verification" ? report.score : report.verification_score ?? null,
    augmentation_score: report.vertical === "augmentation" ? report.score : report.augmentation_score ?? null,
    optimization_score: report.vertical === "optimization" ? report.score : report.optimization_score ?? null,
    workspace_goal: report.workspace_goal ?? null,
    ghc_score: report.ghc_score ?? null,
    top_gaps: report.gap_analysis?.gaps?.slice(0, 3).map((gap) => ({
      title: gap.title,
      severity: gap.severity,
    })),
  };
}

/**
 * Build a versioned TIM feature envelope from interruption context + optional learning world model.
 * This is the only input a TimProvider needs — portable to a future external TIM service.
 */
export function buildTimFeatureEnvelope(
  context: TimFeatureSource,
  worldModel?: LearningWorldModelV0 | null,
): TimFeatureEnvelopeV1 {
  const fromContextModel = context.learning_world_model ?? null;
  const model = worldModel ?? fromContextModel;
  const wm = learningWorldModelForTim(model);

  const metadata = context.artifact_metadata;
  const tapSessionId =
    metadata && typeof metadata.tap_session_id === "string" ? metadata.tap_session_id : null;
  const sessionId =
    metadata && typeof metadata.session_id === "string"
      ? metadata.session_id
      : metadata && typeof metadata.focus_session_id === "string"
        ? metadata.focus_session_id
        : null;

  return {
    schema_version: TIM_FEATURE_SCHEMA_VERSION,
    event: {
      endpoint: context.endpoint,
      workspace_id: context.workspace_id,
      block_id: context.block_id ?? null,
      session_id: sessionId,
      tap_session_id: tapSessionId,
    },
    proof_of_work: {
      artifacts_count: context.proof_of_work_artifacts,
      tool_name: context.tool_name ?? null,
      tool_action: context.tap_action ?? null,
      artifact_summary: context.artifact_summary ?? null,
      artifact_metadata: context.artifact_metadata ?? null,
      recent_manifest: context.recent_pow_manifest ?? null,
      idle_duration_ms: context.idle_duration_ms ?? null,
      speech_transcript: context.speech_transcript ?? null,
    },
    learning_world_model: wm,
    performance_summary: summarizeReportForTim(context.report),
    policy: {
      allowed_intervention_types: DEFAULT_TIM_INTERVENTION_TYPES,
      min_delay_ms: context.endpoint === "upload_ile_chapter_done" ? 2_000 : 15_000,
      max_delay_ms: 600_000,
    },
  };
}
