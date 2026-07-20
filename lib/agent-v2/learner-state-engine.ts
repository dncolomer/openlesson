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
  insertKnowledgeConfigSnapshot,
  loadLatestKnowledgeConfig,
  powRowsFromPerformanceContext,
} from "./knowledge-config-store";
import { insertEvalRunHistory } from "./eval-run-history-store";
import type { KnowledgeConfigSnapshotTrigger } from "@/lib/knowledge-config";
import type { AuthContext } from "./types";

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
}

function scoresDeltaFromReport(
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

  // Authoritative primary score for this evaluation always wins for its vertical.
  if (vertical === "verification") scores.verification_score = report.score;
  if (vertical === "augmentation") scores.augmentation_score = report.score;
  if (vertical === "optimization") scores.optimization_score = report.score;

  // Drop null entries so merge keeps prior LWM values for other verticals.
  const scores_snapshot = Object.fromEntries(
    Object.entries(scores).filter(([, v]) => v != null),
  ) as LearningWorldModelDelta["scores_snapshot"];

  const delta: LearningWorldModelDelta = {
    ...base,
    scores_snapshot,
  };

  if (report.workspace_goal?.trim()) {
    delta.inferred_goal = {
      ...(base.inferred_goal || {
        text: "",
        confidence: 0.5,
        source: "evolved" as const,
      }),
      text: report.workspace_goal.trim(),
      confidence: Math.max(0.4, base.inferred_goal?.confidence ?? 0.5),
      source: base.inferred_goal?.source ?? "evolved",
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

  // Archive full scorecard first so history survives even if LWM/knowledge-config write races fail.
  let evalRunHistoryId: string | null = null;
  let evalRunHistoryError: string | null = null;
  try {
    const archived = await insertEvalRunHistory(options.supabase, {
      workspaceId: options.workspaceId,
      subject,
      vertical: options.vertical,
      report: options.report,
      blockId: options.blockId ?? null,
      source: options.historySource ?? "score",
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

  const delta = scoresDeltaFromReport(options.report, options.vertical);
  const { id: lwmIdAfterMerge, model: merged } = await applyLearningWorldModelDelta(
    options.supabase,
    options.workspaceId,
    delta,
    subject,
  );

  const previous = await loadLatestKnowledgeConfig(options.supabase, options.workspaceId, subject);
  const embedding = encodeAndMeasureVelocity(
    {
      workspaceId: options.workspaceId,
      totalBlocks: options.totalBlocks,
      powRows: powRowsFromPerformanceContext(options.proofOfWork || []),
      worldModel: merged,
    },
    previous,
  );

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

  await insertKnowledgeConfigSnapshot(options.supabase, {
    workspaceId: options.workspaceId,
    subject,
    embedding,
    trigger: options.trigger ?? "score",
    lwmId: saved.id ?? lwmIdAfterMerge,
  });

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
