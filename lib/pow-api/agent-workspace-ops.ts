/**
 * Shared list-workspaces + learning-progress logic for REST and MCP.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import { canAccessAgentWorkspace } from "./workspace-access";
import { buildWorkspacePerformanceContext } from "./performance-context";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildUncertainSystemsScopeForWorkspace,
  recommendIntegrationActions,
} from "./integration-discovery";
import {
  buildContinuousEvaluationPolicy,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  buildProofOfWorkSchemaApiPath,
} from "./proof-of-work-integration";

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export type ListAgentWorkspacesInput = {
  status?: string | null;
  limit?: unknown;
  offset?: unknown;
};

export async function listAgentWorkspaces(
  supabase: SupabaseClient,
  auth: AuthContext,
  input: ListAgentWorkspacesInput = {},
) {
  const limit = boundedInt(input.limit, 20, 1, 100);
  const offset = boundedInt(input.offset, 0, 0, 10_000);
  const status =
    typeof input.status === "string" && input.status.trim() ? input.status.trim() : null;

  let query = supabase
    .from("workspaces")
    .select("id, title, root_topic, status, notes, workspace_goal, created_at, updated_at", {
      count: "exact",
    })
    .or(
      auth.user_id
        ? `user_id.eq.${auth.user_id},organization_id.eq.${auth.organization_id}`
        : `organization_id.eq.${auth.organization_id}`,
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    workspaces: data || [],
    pagination: {
      total: count ?? 0,
      limit,
      offset,
      has_more: offset + limit < (count ?? 0),
    },
  };
}

export async function getAgentLearningProgress(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspaceId: string,
  origin: string,
) {
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs, status, created_at, updated_at",
    )
    .eq("id", workspaceId)
    .single();

  if (wsError || !workspace || !canAccessAgentWorkspace(auth, workspace)) {
    throw new Error("Workspace not found.");
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("blocks")
    .select("id, title, description, is_start, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (blocksError) throw new Error(blocksError.message);

  const context = await buildWorkspacePerformanceContext({
    supabase,
    auth,
    workspaceId,
    blockId: null,
  });
  const counts = context.payload.counts;
  const workspaceTitle = workspace.title || workspace.root_topic || "workspace";

  return {
    workspace: {
      id: workspace.id,
      title: workspace.title,
      root_topic: workspace.root_topic,
      workspace_goal: workspace.workspace_goal,
      status: workspace.status,
    },
    blocks: blocks || [],
    proof_of_work_summary: counts,
    continuous_evaluation: buildContinuousEvaluationPolicy(workspaceId, origin, counts),
    continuous_evaluation_mcp: buildContinuousEvaluationMcpPolicy(workspaceId, origin, counts),
    rest_quick_reference: {
      evidence_schema: buildProofOfWorkSchemaApiPath(workspaceId, origin),
      integration_skill: buildIntegrationSkillApiPath(workspaceId, origin),
      performance: buildPerformanceApiPath(workspaceId, origin),
    },
    uncertain_systems_scope: buildUncertainSystemsScopeForWorkspace({
      workspaceTitle,
      workspaceGoal: workspace.workspace_goal,
      blockCount: counts.blocks,
      proofOfWorkCount: counts.proof_of_work_artifacts,
    }),
    integration_surfaces: buildIntegrationSurfaces(origin),
    recommended_next_actions: recommendIntegrationActions({
      proof_of_work_artifacts: counts.proof_of_work_artifacts,
      blocks: counts.blocks,
      has_workspace_goal: Boolean(workspace.workspace_goal?.trim()),
    }),
    progress_interpretation: {
      lwm_snapshot:
        "Call lwm_snapshot (REST POST .../lwm-snapshot) for the sole LWM Snapshot score + GHC + marker_scores.",
      evidence_health:
        counts.proof_of_work_artifacts === 0
          ? "No artifacts yet — call generate_proof_of_work_schema then upload_proof_of_work."
          : `${counts.proof_of_work_artifacts} artifact(s) — ${counts.proof_of_work_artifacts < 5 ? "early signal" : "enough for scoring"}.`,
    },
    counts,
    workspace_row: workspace,
  };
}
