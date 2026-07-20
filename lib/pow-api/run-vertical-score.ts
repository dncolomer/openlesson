/**
 * Shared generator path for the three vertical score REST/MCP entry points.
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
  type ScoreVertical,
  type VerticalScoreReport,
} from "./performance-report";
import { buildWorkspacePerformanceContext } from "./performance-context";
import { generateWorkspaceVerticalScoreReport } from "./generate-performance-report";
import { finalizeVerticalScoreReport } from "./workspace-goal";
import { updateLearnerStateAfterScore } from "./learner-state-engine";
import { assertEvalAllowedWithNewPow } from "./eval-pow-gate";
import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";

export interface RunVerticalScoreInput {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  vertical: ScoreVertical;
  blockId?: string | null;
  stylePrompt?: string | null;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
  /** Pre-resolved file ids (skip context build when set and non-empty). */
  fileIds?: string[];
  /** When false, skip durable LWM + knowledge-config snapshot (tests / dry runs). Default true. */
  updateLearnerState?: boolean;
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
  workspace_goal_source: "workspace" | "inferred" | "opaque_ref";
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
    vertical,
    blockId,
    stylePrompt,
    participantUserId,
    participantGuestUserId,
  } = input;
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
        vertical
      );
      const evalMeta = parseWorkspaceEvaluationMeta(workspace);
      return {
        report: finalized.report,
        workspace_goal: finalized.workspace_goal,
        workspace_goal_source: finalized.workspace_goal_source,
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

  // Re-running the same vertical requires new proof of work since the last archive.
  await assertEvalAllowedWithNewPow(supabase, {
    workspaceId,
    vertical,
    auth,
    participantUserId,
    participantGuestUserId,
    blockId,
  });

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
    storedWorkspaceGoal: storedGoal,
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
    ? finalizeOpaqueVerticalScoreReport(generation.data, goalRef, evalMeta.protocol_config, vertical)
    : {
        ...finalizeVerticalScoreReport(
          generation.data,
          storedGoal,
          {
            title: workspace.title,
            description: workspace.description,
            notes: workspace.notes,
            root_topic: workspace.root_topic,
          },
          vertical
        ),
        protocol_report: undefined,
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
        report: finalized.report,
        vertical,
        participantUserId,
        participantGuestUserId,
        proofOfWork: proofOfWorkRows,
        totalBlocks,
        trigger: "score",
        blockId: blockId ?? null,
        historySource: "api",
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
    report: finalized.report,
    workspace_goal: finalized.workspace_goal,
    workspace_goal_source: finalized.workspace_goal_source,
    protocol_report: opaque ? finalized.protocol_report : undefined,
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
