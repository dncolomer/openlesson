/**
 * Learner state engine: merge LWM deltas + encode/persist knowledge config snapshots.
 * Called after vertical scores (and optionally throttled PoW uploads).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningWorldModelDelta, LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import type { ScoreVertical, VerticalScoreReport } from "./performance-report";
import {
  applyLearningWorldModelDelta,
  loadLearningWorldModel,
  saveLearningWorldModel,
  subjectFromAuthAndParticipants,
  type SubjectRef,
} from "./learning-world-model-store";
import {
  knowledgeConfigPointerFromEmbedding,
  encodeAndMeasureVelocity,
  insertExperimentalKnowledgeConfigSnapshots,
  insertKnowledgeConfigSnapshot,
  loadLatestKnowledgeConfig,
  powRowsFromPerformanceContext,
} from "./knowledge-config-store";
import { insertEvalRunHistory } from "./eval-run-history-store";
import type { KnowledgeConfigSnapshotTrigger } from "@/lib/knowledge-config";
import type { AuthContext } from "./types";
import {
  goalsEmbeddingText,
  normalizeEvaluatedGoals,
  summarizeGoalsText,
  type EvaluatedGoal,
} from "./goals";

export interface UpdateLearnerStateAfterScoreOptions {
  supabase: SupabaseClient;
  workspaceId: string;
  auth: AuthContext;
  report: VerticalScoreReport;
  vertical: ScoreVertical;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
  proofOfWork?: Array<{
    type?: string;
    proof_of_work_type?: string;
    block_id?: string | null;
    timestamp_ms?: number;
    tool_name?: string | null;
    tool_action?: string | null;
    metadata?: Record<string, unknown>;
    sample_count?: number | null;
    device_name?: string | null;
  }>;
  totalBlocks?: number;
  trigger?: KnowledgeConfigSnapshotTrigger;
  /** Optional block scope for the eval run archive row. */
  blockId?: string | null;
  /** Source tag for eval_run_history (score | web | api). */
  historySource?: string;
  /** Goals this snapshot was scored against. */
  evaluatedGoals?: EvaluatedGoal[] | null;
  goalsFingerprint?: string | null;
}

function uniqueNonEmptyStrings(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Map a score report into an LWM delta.
 * Always writes scores; also promotes top-level narrative fields (strengths,
 * growth_areas, gaps) into learning_profile / exploration so the LWM skill card
 * is not score-only when the model fills report.* but omits world_model_delta.
 */
export function scoresDeltaFromReport(
  report: VerticalScoreReport,
  vertical: ScoreVertical,
): LearningWorldModelDelta {
  const base = report.world_model_delta ? { ...report.world_model_delta } : {};

  // Only set fields we know — null must not clobber other verticals already stored on LWM.
  // mergeLearningWorldModelDelta shallow-merges scores_snapshot; omit unknown verticals.
  const scoresFromDelta: Partial<
    NonNullable<LearningWorldModelDelta["scores_snapshot"]>
  > = base.scores_snapshot ?? {};
  const scores: NonNullable<LearningWorldModelDelta["scores_snapshot"]> = {
    verification_score:
      scoresFromDelta.verification_score !== undefined
        ? scoresFromDelta.verification_score
        : null,
    augmentation_score:
      scoresFromDelta.augmentation_score !== undefined
        ? scoresFromDelta.augmentation_score
        : null,
    optimization_score:
      scoresFromDelta.optimization_score !== undefined
        ? scoresFromDelta.optimization_score
        : null,
    ghc_score: report.ghc_score ?? scoresFromDelta.ghc_score ?? null,
  };

  // Authoritative primary score: LWM Snapshot always writes history wire key verification_score
  // (scores_snapshot; not a product score type name). Legacy archives still map by vertical.
  if (vertical === "verification") scores.verification_score = report.score;
  else if (vertical === "augmentation") scores.augmentation_score = report.score;
  else if (vertical === "optimization") scores.optimization_score = report.score;
  else scores.verification_score = report.score;

  // Drop null entries so merge keeps prior LWM values for other verticals.
  const scores_snapshot = Object.fromEntries(
    Object.entries(scores).filter(([, v]) => v != null),
  ) as LearningWorldModelDelta["scores_snapshot"];

  const strengths = uniqueNonEmptyStrings([
    ...(base.learning_profile?.strengths ?? []),
    ...(report.strengths ?? []),
  ]);
  const friction = uniqueNonEmptyStrings([
    ...(base.learning_profile?.friction_patterns ?? []),
    ...(report.growth_areas ?? []),
  ]);
  const blindSpots = uniqueNonEmptyStrings([
    ...(base.exploration?.blind_spots ?? []),
    ...((report.gap_analysis?.gaps ?? []).map((g) => g?.title).filter(Boolean) as string[]),
  ]);
  const pathways = uniqueNonEmptyStrings([...(base.exploration?.pathways_touched ?? [])]);

  const delta: LearningWorldModelDelta = {
    ...base,
    scores_snapshot,
  };

  if (strengths.length > 0 || friction.length > 0 || base.learning_profile) {
    delta.learning_profile = {
      strengths: strengths.length > 0 ? strengths : (base.learning_profile?.strengths ?? []),
      friction_patterns:
        friction.length > 0 ? friction : (base.learning_profile?.friction_patterns ?? []),
      preferred_modalities: base.learning_profile?.preferred_modalities ?? [],
      temporal_patterns: base.learning_profile?.temporal_patterns ?? {
        avg_dwell_ms: null,
        idle_bursts: null,
      },
    };
  }

  if (
    blindSpots.length > 0 ||
    pathways.length > 0 ||
    (base.exploration?.block_coverage?.length ?? 0) > 0
  ) {
    delta.exploration = {
      block_coverage: base.exploration?.block_coverage ?? [],
      pathways_touched: pathways,
      blind_spots: blindSpots,
    };
  }

  // Promote narrative "what to collect next" into evidence appetite when the
  // model omitted world_model_delta.evidence_appetite (common structured-output miss).
  const wantMore = uniqueNonEmptyStrings([
    ...(base.evidence_appetite?.want_more ?? []),
    ...(report.gap_analysis?.next_steps?.events ?? []),
    ...(report.gap_analysis?.next_steps?.directions ?? []),
    ...(report.suggestions ?? []),
  ]);
  const saturated = uniqueNonEmptyStrings([...(base.evidence_appetite?.saturated ?? [])]);
  if (wantMore.length > 0 || saturated.length > 0 || base.evidence_appetite) {
    delta.evidence_appetite = {
      want_more: wantMore.length > 0 ? wantMore : (base.evidence_appetite?.want_more ?? []),
      saturated: saturated.length > 0 ? saturated : (base.evidence_appetite?.saturated ?? []),
    };
  }

  const multiGoals = normalizeEvaluatedGoals(report.evaluated_goals);
  const goalText =
    (multiGoals.length > 0 ? summarizeGoalsText(multiGoals) : null) ||
    report.workspace_goal?.trim() ||
    "";
  if (goalText) {
    delta.inferred_goal = {
      ...(base.inferred_goal || {
        text: "",
        confidence: 0.5,
        source: "evolved" as const,
      }),
      text: goalText,
      confidence: Math.max(0.4, base.inferred_goal?.confidence ?? 0.5),
      source: multiGoals.length > 0 ? "workspace" : (base.inferred_goal?.source ?? "evolved"),
    };
  }

  return delta;
}

export async function updateLearnerStateAfterScore(
  options: UpdateLearnerStateAfterScoreOptions,
): Promise<{
  worldModel: LearningWorldModelV0;
  lwmId: string | null;
  knowledgeConfig: LearningWorldModelV0["knowledge_config"];
  evalRunHistoryId: string | null;
  /** Set when history archive failed so callers can surface instead of silent drop. */
  evalRunHistoryError?: string | null;
}> {
  const subject: SubjectRef = subjectFromAuthAndParticipants({
    authUserId: options.auth.user_id,
    authGuestUserId: options.auth.guest_user_id,
    participantUserId: options.participantUserId,
    participantGuestUserId: options.participantGuestUserId,
  });

  const evaluatedGoals =
    options.evaluatedGoals ??
    normalizeEvaluatedGoals(options.report.evaluated_goals);

  // Archive full scorecard first so history survives even if LWM/knowledge-config write races fail.
  let evalRunHistoryId: string | null = null;
  let evalRunHistoryError: string | null = null;
  try {
    const archived = await insertEvalRunHistory(options.supabase, {
      workspaceId: options.workspaceId,
      subject,
      vertical: options.vertical,
      report: {
        ...options.report,
        evaluated_goals: evaluatedGoals,
      },
      blockId: options.blockId ?? null,
      source: options.historySource ?? "score",
      evaluatedGoals,
      goalsFingerprint: options.goalsFingerprint ?? null,
    });
    evalRunHistoryId = archived.id;
    if (!archived.id) {
      evalRunHistoryError = archived.error || "Eval history was not saved";
      console.warn("[learner-state-engine] eval run history insert failed:", evalRunHistoryError);
    }
  } catch (err) {
    evalRunHistoryError = err instanceof Error ? err.message : "Eval history insert failed";
    console.warn("[learner-state-engine] eval run history insert failed:", err);
  }

  const delta = scoresDeltaFromReport(
    { ...options.report, evaluated_goals: evaluatedGoals },
    options.vertical,
  );
  const { id: lwmIdAfterMerge, model: merged } = await applyLearningWorldModelDelta(
    options.supabase,
    options.workspaceId,
    delta,
    subject,
  );

  // Product geometry: v1-d64 only for LWM pointer + velocity baseline.
  // Evaluated goal text enters the embedding so goal selection shifts vectors.
  const previous = await loadLatestKnowledgeConfig(options.supabase, options.workspaceId, subject);
  const encodeInput = {
    workspaceId: options.workspaceId,
    totalBlocks: options.totalBlocks,
    powRows: powRowsFromPerformanceContext(options.proofOfWork || []),
    worldModel: merged,
    evaluatedGoalsText: goalsEmbeddingText(evaluatedGoals),
  };
  const embedding = encodeAndMeasureVelocity(encodeInput, previous);

  const withPointer: LearningWorldModelV0 = {
    ...merged,
    knowledge_config: knowledgeConfigPointerFromEmbedding(embedding),
  };

  const saved = await saveLearningWorldModel(
    options.supabase,
    options.workspaceId,
    withPointer,
    subject,
  );

  const lwmId = saved.id ?? lwmIdAfterMerge;
  const trigger = options.trigger ?? "score";

  await insertKnowledgeConfigSnapshot(options.supabase, {
    workspaceId: options.workspaceId,
    subject,
    embedding,
    trigger,
    lwmId,
  });

  // Parallel experimental models: same score event, separate model ids — no backfill.
  try {
    await insertExperimentalKnowledgeConfigSnapshots(options.supabase, {
      workspaceId: options.workspaceId,
      subject,
      encodeInput,
      trigger,
      lwmId,
    });
  } catch (err) {
    console.warn("[learner-state-engine] experimental knowledge-config dual-write failed:", err);
  }

  return {
    worldModel: saved.model,
    lwmId: saved.id,
    knowledgeConfig: saved.model.knowledge_config ?? knowledgeConfigPointerFromEmbedding(embedding),
    evalRunHistoryId,
    evalRunHistoryError,
  };
}

export async function getLearnerWorldModel(
  supabase: SupabaseClient,
  workspaceId: string,
  subject?: SubjectRef | null,
) {
  return loadLearningWorldModel(supabase, workspaceId, subject);
}
