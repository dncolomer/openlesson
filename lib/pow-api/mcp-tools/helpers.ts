import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiKeyScope, AuthContext } from "../types";
import { hasScope } from "../auth";
import { canAccessAgentWorkspace } from "../workspace-access";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildUncertainSystemsScopeForWorkspace,
  recommendIntegrationActions,
} from "../integration-discovery";
import {
  type InterruptionContext,
  withProofOfWorkApiResponse,
} from "../predictive-interruption";

export const MCP_PROOF_OF_WORK_PROTOCOL_VERSION = "2025-03-26";
export const MCP_PROOF_OF_WORK_SERVER_NAME = "uncertain-systems-proof-of-work-api";
export const MCP_PROOF_OF_WORK_SERVER_VERSION = "1.3.0";

export const MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS = `Uncertain Systems public agent MCP — two APIs with REST parity:

1. Workspace management — create and edit a Learning workspace, the map, workspace settings, and account settings. Learning maps use list_map_tools / apply_map_tool (Helios catalog: topologies, unusable ground, generative effects, DAG, overlay notes and drawing layers). REST: /api/v3/workspaces (including /map-tools) and /api/v3/account.
2. Headless proof-of-work — start, run, and end Calibrate, Learn, and Verify sessions. Submit proof of work; the server prepares the answers-model tree, infers the path, and enforces the session clock. REST: /api/v3/pow.

Authorize with Authorization: Bearer <api_key or OAuth token> on POST /api/mcp. ChatGPT, Claude, and other agents use these tools to run flows for the user.

Scopes: workspaces:read, workspaces:write, sessions:read, sessions:write. Teams tier (error code api_plan_required).`;

export { MCP_EVIDENCE_TOOLS } from "./evidence-tools";

export type McpProofOfWorkToolContext = {
  auth: AuthContext;
   
  supabase: SupabaseClient<any>;
  origin: string;
};

export function textToolResult(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export async function evidenceToolResult(
  value: Record<string, unknown>,
  interruptionContext?: InterruptionContext
) {
  const payload = interruptionContext
    ? await withProofOfWorkApiResponse(value, interruptionContext)
    : { ...value, interruption: null };
  return textToolResult(payload);
}

export function stringArg(args: Record<string, unknown>, name: string) {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export function requireScope(scopes: ApiKeyScope[], scope: ApiKeyScope) {
  if (!hasScope(scopes, scope)) {
    throw new Error(`This tool requires the ${scope} scope on your API key or OAuth token.`);
  }
}

export function withProgressGuidance<T extends Record<string, unknown>>(
  payload: T,
  options: {
    origin: string;
    workspaceId: string;
    counts: {
      proof_of_work_artifacts: number;
      blocks: number;
    };
    workspaceGoal?: string | null;
    workspaceTitle?: string;
    workspace_kind?: unknown;
  }
): T & {
  uncertain_systems_scope: Record<string, unknown>;
  integration_surfaces: ReturnType<typeof buildIntegrationSurfaces>;
  continuous_evaluation_mcp: ReturnType<typeof buildContinuousEvaluationMcpPolicy>;
  recommended_next_actions: ReturnType<typeof recommendIntegrationActions>;
} {
  return {
    ...payload,
    uncertain_systems_scope: buildUncertainSystemsScopeForWorkspace({
      workspaceTitle: options.workspaceTitle || "workspace",
      workspaceGoal: options.workspaceGoal,
      blockCount: options.counts.blocks,
      proofOfWorkCount: options.counts.proof_of_work_artifacts,
    }),
    integration_surfaces: buildIntegrationSurfaces(options.origin),
    continuous_evaluation_mcp: buildContinuousEvaluationMcpPolicy(
      options.workspaceId,
      options.origin,
      options.counts
    ),
    recommended_next_actions: recommendIntegrationActions({
      proof_of_work_artifacts: options.counts.proof_of_work_artifacts,
      blocks: options.counts.blocks,
      has_workspace_goal: Boolean(options.workspaceGoal?.trim()),
      workspace_kind: options.workspace_kind,
    }),
  };
}

export type WorkspaceRow = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  guest_user_id: string | null;
  title: string | null;
  root_topic: string | null;
  description: string | null;
  notes: string | null;
  workspace_goal: string | null;
  evaluation_mode?: string | null;
  protocol_config?: unknown;
  external_refs?: unknown;
  status: string | null;
  created_at?: string;
  updated_at?: string;
  workspace_kind?: string | null;
};

export async function loadWorkspace(
  supabase: McpProofOfWorkToolContext["supabase"],
  auth: AuthContext,
  workspaceId: string
): Promise<WorkspaceRow> {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs, status, created_at, updated_at, workspace_kind"
    )
    .eq("id", workspaceId)
    .single();

  const row = workspace as WorkspaceRow | null;
  if (error || !row || !canAccessAgentWorkspace(auth, row)) {
    throw new Error("Workspace not found.");
  }

  return row;
}

export async function assertBlockInWorkspace(
  supabase: McpProofOfWorkToolContext["supabase"],
  workspaceId: string,
  blockId: string
) {
  const { data: block } = await supabase
    .from("blocks")
    .select("id")
    .eq("id", blockId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!block) throw new Error("Block not found in this workspace.");
}

export function tapLinkIdArg(args: Record<string, unknown>) {
  return stringArg(args, "tap_link_id");
}

