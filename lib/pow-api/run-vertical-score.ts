/**
 * Shared generator path for the single LWM Snapshot strategy
 * (former LWM Snapshot REST/MCP entry points).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  buildPrivacyMetadata,
  extractGoalRefFromWorkspaceGoal,
  finalizeOpaqueVerticalScoreReport,
  isOpaqueWorkspace,
  parseWorkspaceEvaluationMeta,
} from "./opaque-evaluation";
import {
  emptyVerticalScoreReport,
  SNAPSHOT_VERTICAL,
  type ScoreVertical,
  type VerticalScoreReport,
} from "./performance-report";
import { buildWorkspacePerformanceContext } from "./performance-context";
import { generateWorkspaceVerticalScoreReport } from "./generate-performance-report";
import { finalizeVerticalScoreReport } from "./workspace-goal";
import { updateLearnerStateAfterScore } from "./learner-state-engine";
import { assertEvalAllowedWithNewPow } from "./eval-pow-gate";
import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import {
  blockIdsFromProofOfWork,
  fingerprintGoals,
  fingerprintPowSet,
  parseGoalSelectionFromBody,
  resolveEvaluatedGoals,
  summarizeGoalsText,
  type EvaluatedGoal,
  type GoalSelectionInput,
} from "./goals";
import { loadGoalCatalogs } from "./goals-store";

export interface RunVerticalScoreInput {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  /** Always forced to SNAPSHOT_VERTICAL (LWM Snapshot). Accepted for call-site compat. */
  vertical?: ScoreVertical;
  blockId?: string | null;
  stylePrompt?: string | null;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
  /** Pre-resolved file ids (skip context build when set and non-empty). */
  fileIds?: string[];
  /** When false, skip durable LWM + knowledge-config snapshot (tests / dry runs). Default true. */
  updateLearnerState?: boolean;
  /** Tag for eval_run_history (api | web | tap | score | test). Default "api". */
  historySource?: string;
  /**
   * Goal selection for this snapshot: default | adhoc | selected catalog ids.
   * Also accepts a raw request body via goalSelectionBody.
   */
  goalSelection?: GoalSelectionInput | null;
  /** Raw API body; goal fields are parsed when goalSelection is omitted. */
  goalSelectionBody?: Record<string, unknown> | null;
  workspaceRow?: {
    id: string;
    title: string | null;
    root_topic: string | null;
    description: string | null;
    notes: string | null;
    workspace_goal: string | null;
    evaluation_mode?: string | null;
    protocol_config?: unknown;
    external_refs?: unknown;
  };
}

export interface RunVerticalScoreResult {
  report: VerticalScoreReport;
  workspace_goal: string;
  workspace_goal_source: "workspace" | "inferred" | "opaque_ref" | "multi_goals" | "adhoc";
  /** Goals this snapshot was evaluated against. */
  evaluated_goals: EvaluatedGoal[];
  goals_fingerprint: string | null;
  pow_set_fingerprint: string | null;
  protocol_report?: unknown;
  evaluation_mode?: string;
  privacy?: ReturnType<typeof buildPrivacyMetadata>;
  proof_of_work_summary: {
    blocks: number;
    proof_of_work_artifacts: number;
    linked_sessions: number;
    workspace_files: number;
  } | null;
  file_ids: string[];
  empty: boolean;
  /** Merged durable learning world model after this score (when updateLearnerState). */
  learning_world_model?: LearningWorldModelV0 | null;
  knowledge_config?: LearningWorldModelV0["knowledge_config"];
  /** Archive row id when history insert succeeded. */
  eval_run_history_id?: string | null;
  /** Present when history archive failed (surfaced to callers; not silent). */
  eval_run_history_error?: string | null;
}

export async function runVerticalScore(
  input: RunVerticalScoreInput
): Promise<RunVerticalScoreResult> {
  const {
    supabase,
    auth,
    workspaceId,
    blockId,
    stylePrompt,
    participantUserId,
    participantGuestUserId,
  } = input;
  // Product path: single LWM Snapshot strategy only (former verification).
  const vertical: ScoreVertical = SNAPSHOT_VERTICAL;
  const shouldUpdateLearnerState = input.updateLearnerState !== false;

  let workspace = input.workspaceRow;
  if (!workspace) {
    const { data } = await supabase
      .from("workspaces")
      .select(
        "id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs"
      )
      .eq("id", workspaceId)
      .single();
    if (!data) throw new Error("Workspace not found");
    workspace = data;
  }

  let activeFileIds = input.fileIds ?? [];
  let contextCounts: RunVerticalScoreResult["proof_of_work_summary"] = null;
  let storedGoal = workspace.workspace_goal;
  let proofOfWorkRows: Array<{
    id?: string;
    type?: string;
    proof_of_work_type?: string;
    block_id?: string | null;
    timestamp_ms?: number;
    tool_name?: string | null;
    tool_action?: string | null;
    metadata?: Record<string, unknown>;
    sample_count?: number | null;
    device_name?: string | null;
  }> = [];
  let totalBlocks = 0;

  // Always build context when we need PoW features for knowledge config, or when file ids missing.
  const needContext = activeFileIds.length === 0 || shouldUpdateLearnerState;
  if (needContext) {
    const context = await buildWorkspacePerformanceContext({
      supabase,
      auth,
      workspaceId,
      blockId,
      participantUserId: participantUserId || null,
      participantGuestUserId: participantGuestUserId || null,
    });
    if (activeFileIds.length === 0) {
      activeFileIds = context.fileIds;
    }
    contextCounts = context.payload.counts;
    storedGoal = context.payload.workspace.workspace_goal ?? workspace.workspace_goal;
    proofOfWorkRows = context.payload.proof_of_work;
    totalBlocks = context.payload.blocks.length;

    if (
      context.payload.counts.proof_of_work_artifacts === 0 &&
      context.payload.counts.linked_sessions === 0 &&
      context.payload.counts.workspace_files === 0
    ) {
      const finalized = finalizeVerticalScoreReport(
        emptyVerticalScoreReport(vertical),
        storedGoal,
        {
          title: workspace.title,
          description: workspace.description,
          notes: workspace.notes,
          root_topic: workspace.root_topic,
        },
        vertical,
        [],
      );
      const evalMeta = parseWorkspaceEvaluationMeta(workspace);
      return {
        report: finalized.report,
        workspace_goal: finalized.workspace_goal,
        workspace_goal_source: finalized.workspace_goal_source,
        evaluated_goals: finalized.evaluated_goals,
        goals_fingerprint: null,
        pow_set_fingerprint: null,
        evaluation_mode: evalMeta.evaluation_mode,
        privacy: buildPrivacyMetadata(evalMeta),
        proof_of_work_summary: contextCounts,
        file_ids: [],
        empty: true,
        learning_world_model: null,
        knowledge_config: null,
      };
    }
  }

  // Resolve multi-goals for this run (default / adhoc / selected).
  const selection: GoalSelectionInput =
    input.goalSelection ??
    parseGoalSelectionFromBody(input.goalSelectionBody ?? null);
  const catalogs = await loadGoalCatalogs(supabase, workspaceId);
  const powRelatedBlockIds = blockIdsFromProofOfWork(proofOfWorkRows);
  // When scoping to a single block, ensure that block is in the related set.
  if (blockId && !powRelatedBlockIds.includes(blockId)) {
    powRelatedBlockIds.push(blockId);
  }

  let evaluatedGoals = resolveEvaluatedGoals({
    selection,
    workspaceGoals: catalogs.workspaceGoals,
    blockGoals: catalogs.blockGoals,
    powRelatedBlockIds,
  });

  // Empty catalog + default: fall back to legacy workspace_goal string as a single implicit goal
  // so generation/scoring still has something to score against (no migration of old data).
  if (evaluatedGoals.length === 0 && selection.mode !== "selected") {
    const legacy = (storedGoal || workspace.workspace_goal || "").trim();
    if (legacy) {
      evaluatedGoals = [
        { id: null, text: legacy.slice(0, 500), scope: "workspace", block_id: null },
      ];
    } else if (selection.mode === "adhoc") {
      // adhoc with empty text already resolved empty
    }
  }

  const goalsFingerprint =
    evaluatedGoals.length > 0 ? fingerprintGoals(evaluatedGoals) : null;
  const powKeys = proofOfWorkRows
    .map((r, i) => (typeof r.id === "string" && r.id ? r.id : `pow:${i}:${r.timestamp_ms ?? 0}`))
    .filter(Boolean);
  const powSetFingerprint =
    powKeys.length > 0 ? fingerprintPowSet(powKeys) : null;

  // Re-running the same goal selection requires new proof of work since the last archive.
  await assertEvalAllowedWithNewPow(supabase, {
    workspaceId,
    vertical,
    auth,
    participantUserId,
    participantGuestUserId,
    blockId,
    goalsFingerprint,
  });

  const goalsSummary =
    summarizeGoalsText(evaluatedGoals) || storedGoal || workspace.workspace_goal;

  const evalMeta = parseWorkspaceEvaluationMeta(workspace);
  const opaque = isOpaqueWorkspace(evalMeta);
  const privacy = buildPrivacyMetadata(evalMeta);
  const goalRef =
    extractGoalRefFromWorkspaceGoal(workspace.workspace_goal) ||
    evalMeta.protocol_config?.goal_ref ||
    null;

  const generation = await generateWorkspaceVerticalScoreReport({
    workspaceId,
    workspaceTitle: workspace.title,
    workspaceRootTopic: workspace.root_topic,
    storedWorkspaceGoal: goalsSummary,
    evaluatedGoals,
    fileIds: activeFileIds,
    vertical,
    blockId,
    stylePrompt,
    opaque,
    goalRef,
  });

  if (!generation.success || !generation.data) {
    const err = new Error(generation.error || `Failed to generate ${vertical} score`);
    (err as Error & { code?: string }).code =
      generation.code ?? "performance_report_generation_failed";
    throw err;
  }

  const finalized = opaque
    ? {
        ...finalizeOpaqueVerticalScoreReport(
          generation.data,
          goalRef,
          evalMeta.protocol_config,
          vertical,
        ),
        evaluated_goals: evaluatedGoals,
      }
    : finalizeVerticalScoreReport(
        generation.data,
        goalsSummary,
        {
          title: workspace.title,
          description: workspace.description,
          notes: workspace.notes,
          root_topic: workspace.root_topic,
        },
        vertical,
        evaluatedGoals,
      );

  // Ensure report carries evaluated_goals
  const reportWithGoals: VerticalScoreReport = {
    ...finalized.report,
    evaluated_goals: evaluatedGoals,
    workspace_goal:
      finalized.workspace_goal ||
      summarizeGoalsText(evaluatedGoals) ||
      finalized.report.workspace_goal,
  };

  let learning_world_model: LearningWorldModelV0 | null = null;
  let knowledge_config: LearningWorldModelV0["knowledge_config"] = null;
  let eval_run_history_id: string | null = null;
  let eval_run_history_error: string | null = null;

  if (shouldUpdateLearnerState) {
    try {
      const state = await updateLearnerStateAfterScore({
        supabase,
        workspaceId,
        auth,
        report: reportWithGoals,
        vertical,
        participantUserId,
        participantGuestUserId,
        proofOfWork: proofOfWorkRows,
        totalBlocks,
        trigger: "score",
        blockId: blockId ?? null,
        historySource: input.historySource ?? "api",
        evaluatedGoals,
        goalsFingerprint,
      });
      learning_world_model = state.worldModel;
      knowledge_config = state.knowledgeConfig;
      eval_run_history_id = state.evalRunHistoryId;
      eval_run_history_error = state.evalRunHistoryError ?? null;
    } catch (err) {
      console.warn("[runVerticalScore] learner state update failed:", err);
      eval_run_history_error =
        err instanceof Error ? err.message : "Learner state update failed";
    }
  }

  return {
    report: reportWithGoals,
    workspace_goal: reportWithGoals.workspace_goal,
    workspace_goal_source: finalized.workspace_goal_source,
    evaluated_goals: evaluatedGoals,
    goals_fingerprint: goalsFingerprint,
    pow_set_fingerprint: powSetFingerprint,
    protocol_report: opaque
      ? (finalized as { protocol_report?: unknown }).protocol_report
      : undefined,
    evaluation_mode: evalMeta.evaluation_mode,
    privacy,
    proof_of_work_summary: contextCounts,
    file_ids: activeFileIds,
    empty: false,
    learning_world_model,
    knowledge_config,
    eval_run_history_id,
    eval_run_history_error,
  };
}

/** Preferred name for the single LWM Snapshot generator (alias of runVerticalScore). */
export const runLwmSnapshot = runVerticalScore;
