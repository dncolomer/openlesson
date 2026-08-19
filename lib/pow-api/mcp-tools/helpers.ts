import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProofOfWorkSchemaRequest } from "../proof-of-work-schema";
import {
  generateOpaqueWorkspaceProofOfWorkSpec,
  generateWorkspaceProofOfWorkSpec,
  parseOpaqueSchemaRequest,
} from "../proof-of-work-integration";
import { CreateTapLinkError, createWorkspaceTapLink } from "../create-tap-link";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
  listWorkspaceTapbenchLinks,
} from "../create-tapbench-link";
import { rejectProgrammaticWorkspaceCreate } from "../workspace-create-ui-only";
import { runVerticalScore } from "../run-vertical-score";
import type { ScoreVertical } from "../performance-report";
import {
  buildProofOfWorkSchemaRequestFromIntegration,
  resolveEvalDefinition,
} from "../proof-of-work-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
} from "../integration-skill";
import { buildWorkspacePerformanceContext } from "../performance-context";
import type { ApiKeyScope, AuthContext } from "../types";
import { hasScope } from "../auth";
import { canAccessAgentWorkspace } from "../workspace-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildUncertainSystemsScopeForWorkspace,
  UNCERTAIN_SYSTEMS_SCOPE,
  recommendIntegrationActions,
} from "../integration-discovery";
import {
  buildContinuousEvaluationPolicy,
  buildProofOfWorkSchemaApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  resolveProofOfWorkSchemaInterruption,
} from "../proof-of-work-integration";
import {
  type InterruptionContext,
  withProofOfWorkApiResponse,
} from "../predictive-interruption";
import {
  getAgentLearningProgress,
  listAgentWorkspaces,
} from "../agent-workspace-ops";
import {
  getUploadProofOfWorkMeta,
  uploadWorkspaceProofOfWork,
} from "../upload-workspace-proof-of-work";
import { countWorkspaceProofOfWorkForPlan } from "../workspace-proof-of-work";
import { loadLearningWorldModel } from "../learning-world-model-store";
import { resolveEvaluationSubject } from "../evaluation-subject";
import {
  loadLatestKnowledgeConfig,
  loadKnowledgeConfigTrajectory,
  projectTrajectory2D,
  trajectoryPathLength,
} from "../knowledge-config-store";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  emptyKnowledgeConfig,
} from "@/lib/knowledge-config";
import { computeKnowledgeDistanceForSubject } from "../custom-verification-model-store";
import {
  createCustomVerificationModelFromSubjects,
  evalSubjectAgainstCustomVerificationModel,
  listCustomVerificationModels,
  listSubjectsWithKnowledgeConfig,
} from "../custom-verification-model-store";
import {
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "../eval-run-history-store";
import { SCORE_VERTICALS } from "../performance-report";
import {
  bufferSubjectId,
  getStashBufferSize,
  ingestStashUnit,
  stashBufferedProofOfWork,
  submitBufferedProofOfWork,
} from "../stash-api";


export const MCP_PROOF_OF_WORK_PROTOCOL_VERSION = "2025-03-26";
export const MCP_PROOF_OF_WORK_SERVER_NAME = "uncertain-systems-proof-of-work-api";
export const MCP_PROOF_OF_WORK_SERVER_VERSION = "1.3.0";

export const MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS = `Uncertain Systems Proof-of-Work API MCP — 100% parity with public agent REST under /api/v3/{pow,snapshot,stash} (workspace ops). Workspace create is UI-only. API key CRUD is browser-session only (not MCP).

## What Uncertain Systems is
${UNCERTAIN_SYSTEMS_SCOPE.mission}
Pillars: ${UNCERTAIN_SYSTEMS_SCOPE.pillars.join(" | ")}

## Workspace & progress model
${UNCERTAIN_SYSTEMS_SCOPE.workspace_model}
Progress signals: proof_of_work_artifact counts; LWM Snapshot (lwm_snapshot) + GHC; workspace_goal; learning world model; knowledge config.

## Predictive interruptions (TIM)
Every tool result includes top-level \`interruption\` (object or null). When non-null, schedule intervention after delay_ms unless a later Proof-of-Work API call supersedes it. Read interruption_contract from generate_proof_of_work_schema. Resource: uncertain-systems://predictive-interruptions

## Evaluation modes
Workspaces are created **only in the product UI** (\`/workspace/new\`). Programmatic create (\`create_workspace\` / \`POST /workspaces\`) is not available.
- **semantic** (default): performance reports use semantic gap analysis against the workspace goal and blocks.
- **opaque**: privacy-preserving structural verification — prompts are not stored, semantic inference is disabled, uploads are plaintext-linted.

## Start here
1. list_workspaces or get_learning_progress(workspace_id) — orient on an existing UI-created workspace
2. generate_proof_of_work_schema — returns continuous_evaluation (REST) AND continuous_evaluation_mcp (tools)
3. upload_proof_of_work (or buffer_proof_of_work → stash_proof_of_work / submit_stashed_proof_of_work)
4. lwm_snapshot (LWM Snapshot — sole strategy); optional get_world_model / get_knowledge_config / list_snapshot_history
5. Re-fetch schema + regenerate skill as proof of work grows
Note: LWM Snapshot (lwm_snapshot) is manual via Knowledge UI or this API/MCP — not auto-run on TAP/ILE end. Workspace creation is UI-only.

REST mirror: /api/v3/pow (capture), /api/v3/snapshot (scores + LWM/knowledge), /api/v3/stash (TAP buffer + TAPBench sessions).

Resources: uncertain-systems://integration-scope, proof-of-work-loop, predictive-interruptions

Scopes: workspaces:read, workspaces:write, tap:read, tap:write. Teams tier (error code api_plan_required). Auth: Authorization: Bearer <api_key or OAuth token> on POST /api/mcp.`;

export const MCP_EVIDENCE_TOOLS = [
  {
    name: "list_workspaces",
    description: "List Verification Workspaces accessible to the API key.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Optional workspace status filter." },
        limit: { type: "number", description: "Max results 1–100. Default 20." },
        offset: { type: "number", description: "Pagination offset. Default 0." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_learning_progress",
    description:
      "One-call learning progress snapshot: workspace_goal, blocks, proof-of-work counts, uncertain_systems_scope, dual REST+MCP evaluation policies, and recommended_next_actions. Call first when orienting mid-session.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string", description: "Workspace UUID." } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_workspace",
    description:
      "Get workspace metadata including workspace_goal — the outcome learning progress is scored against. REST: GET .../workspaces/{id}.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string", description: "Workspace UUID." } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_blocks",
    description: "List assessable blocks in a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "generate_proof_of_work_schema",
    description:
      "Generate proof-of-work spec with tool_submissions, performance_report_contract, continuous_evaluation (REST paths), continuous_evaluation_mcp (tool names), uncertain_systems_scope, and recommended_next_actions. Semantic workspaces: pass definition. Opaque workspaces: pass evaluation_mode opaque with definition_ref + contract.event_verbs. Call before first upload and after every 5-10 artifacts. REST: POST .../proof-of-work-schema.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        evaluation_mode: {
          type: "string",
          enum: ["semantic", "opaque"],
          description: "Optional override; defaults from workspace evaluation_mode.",
        },
        definition: { type: "string", description: "Semantic mode: what to evaluate / capture in proof of work." },
        definition_ref: {
          type: "string",
          description: "Opaque mode: opaque reference token (not semantically interpreted).",
        },
        contract: {
          type: "object",
          description: "Opaque mode: event_verbs required; optional goal_tokens, required_event_fields, token_fields.",
          properties: {
            event_verbs: { type: "array", items: { type: "string" } },
            goal_tokens: { type: "array", items: { type: "string" } },
            required_event_fields: { type: "array", items: { type: "string" } },
            token_fields: { type: "array", items: { type: "string" } },
          },
        },
        block_id: { type: "string", description: "Optional block scope." },
        integration_hints: {
          type: "object",
          description: "Optional tool_name, partner_agent, event_verbs, goals.",
        },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_integration_skill",
    description: "Generate partner skill.md referencing dynamic proof-of-work-spec and performance APIs.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        integration_name: { type: "string" },
        eval_definition: { type: "string" },
        partner_description: { type: "string" },
        block_id: { type: "string" },
        prefetch_proof_of_work_spec: {
          type: "boolean",
          description: "When true, generates proof-of-work spec first (slower, richer skill).",
        },
      },
      required: ["workspace_id", "integration_name"],
      additionalProperties: false,
    },
  },
  {
    name: "upload_proof_of_work",
    description:
      "Stream proof-of-work after meaningful product actions — core learning signal. Include block_id and tool_name per generate_proof_of_work_schema contract. Opaque workspaces: metadata allowlist (trace_token, goal_ref, anon, event_count, schema_version, protocol_id, phase_id, allow_plaintext); tool payloads are plaintext-linted unless allow_plaintext=true. REST: POST .../proof-of-work.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        type: { type: "string", description: "tool | screen | screenshot | video | eeg" },
        mime_type: { type: "string" },
        data: { type: "string", description: "Base64-encoded payload." },
        block_id: { type: "string" },
        session_id: { type: "string" },
        file_name: { type: "string" },
        tool_name: { type: "string" },
        tool_action: { type: "string" },
        metadata: { type: "object" },
        timestamp_ms: { type: "number" },
      },
      required: ["workspace_id", "type", "mime_type", "data"],
      additionalProperties: false,
    },
  },
  {
    name: "lwm_snapshot",
    description:
      "LWM Snapshot (Learning World Model Snapshot) score (0–100) plus GHC, spider marker_scores, analysis (summary/gaps), and next actions. Sole product snapshot strategy. Evaluated against a goal set: default = all workspace goals + PoW-related block goals; or adhoc_goal; or selected goal_ids. Returns evaluated_goals on the response. Run via Knowledge UI Generate new snapshot or this tool/REST — not auto on TAP/ILE end. Opaque workspaces also return evaluation_mode, privacy, and protocol_report. REST: POST .../lwm-snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        block_id: { type: "string" },
        style_prompt: {
          type: "string",
          description: "Optional voice/tone (e.g. second person, formal coach).",
        },
        goal_mode: {
          type: "string",
          description:
            "default | adhoc | selected. Default uses all workspace goals plus goals of blocks related to the PoW under evaluation.",
        },
        adhoc_goal: {
          type: "string",
          description: "Natural-language adhoc goal when goal_mode=adhoc.",
        },
        goal_ids: {
          type: "array",
          items: { type: "string" },
          description: "Workspace and/or block goal catalog ids when goal_mode=selected.",
        },
        selected_goal_ids: {
          type: "array",
          items: { type: "string" },
          description: "Alias for goal_ids.",
        },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_tap_links",
    description: "List Think Aloud Protocol (TAP) links and completion status for a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_tap_link",
    description:
      "Create a private Think Aloud Protocol (TAP) link for a workspace or a single block. Omit block_id for full-workspace scope. When scoping to a block, call list_blocks first; block_id must be the blocks UUID id field.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        block_id: {
          type: "string",
          description:
            "Optional. blocks.id UUID from list_blocks (not title, slug, or index). Omit for a full-workspace TAP link.",
        },
        minutes: { type: "number", description: "Session length in minutes (1–120). Default 15." },
        participant_type: {
          type: "string",
          description: "anonymous | guest | user. anonymous provisions a link-scoped guest identity.",
        },
        guest_email: { type: "string" },
        guest_user_id: { type: "string" },
        user_id: { type: "string", description: "Org member user id when participant_type=user (requires sign-in)." },
        post_session: {
          type: "string",
          description: "redirect_workspace | show_results | redirect_url",
        },
        redirect_url: { type: "string", description: "Required when post_session=redirect_url." },
        completion_webhook_url: { type: "string", description: "Optional webhook URL on TAP completion." },
        interaction_kind: {
          type: "string",
          description:
            "conversational (default dialogue TAP) | exercise (solo exercise prompt + submitted thoughts, no Helios chat).",
        },
        exercise: {
          type: "boolean",
          description: "Shorthand: true creates an Exercise TAP (interaction_kind=exercise).",
        },
        show_end_session: {
          type: "boolean",
          description: "When true (default), guest UI shows End Session.",
        },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_tapbench_links",
    description:
      "List TAPBench (agent TAP) links for a workspace — exercise, remaining time, share URL, session token. REST: GET .../tapbench-links.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_tapbench_link",
    description:
      "Mint a TAPBench timed exercise session for a workspace or block. Returns session_token for Stash/Submit (X-Tapbench-Session). Optional block_id from list_blocks; optional duration_seconds or minutes; optional exercise text. REST: POST .../tapbench-links.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        block_id: {
          type: "string",
          description:
            "Optional. blocks.id UUID from list_blocks. Omit for full-workspace TAPBench exercise.",
        },
        duration_seconds: {
          type: "number",
          description: "Session length in seconds (60–10800). Default 900 (15m).",
        },
        minutes: {
          type: "number",
          description: "Session length in minutes (alternative to duration_seconds).",
        },
        exercise: {
          type: "string",
          description: "Optional explicit exercise text. When omitted, a domain exercise is generated.",
        },
        exercise_text: {
          type: "string",
          description: "Alias of exercise.",
        },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_world_model",
    description:
      "Durable learning world model for workspace × subject. REST: GET /api/v3/snapshot/workspaces/{id}/world-model.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        user_id: { type: "string" },
        guest_user_id: { type: "string" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_knowledge_config",
    description:
      "Latest knowledge config embedding (knowledgecfg-v1-d64). REST: GET .../knowledge-config.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        user_id: { type: "string" },
        guest_user_id: { type: "string" },
        embedding_model_id: { type: "string" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_knowledge_config_trajectory",
    description:
      "Knowledge config trajectory + optional 2D projection. REST: GET .../knowledge-config/trajectory.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        user_id: { type: "string" },
        guest_user_id: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        max_points: { type: "number" },
        project: { type: "boolean" },
        embedding_model_id: { type: "string" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "knowledge_distance",
    description:
      "Knowledge distance (user ↔ region) in knowledgecfg space — not a vertical Eval. REST: POST .../knowledge-distance.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        region_id: { type: "string" },
        user_id: { type: "string" },
        guest_user_id: { type: "string" },
      },
      required: ["workspace_id", "region_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_snapshot_history",
    description:
      "Prior vertical eval scorecards. REST: GET .../snapshot-history.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        user_id: { type: "string" },
        guest_user_id: { type: "string" },
        user_ids: { type: "string", description: "Comma-separated cohort user ids." },
        guest_user_ids: { type: "string" },
        vertical: { type: "string", description: "verification | augmentation | optimization" },
        from: { type: "string" },
        to: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_custom_knowledge_regions",
    description:
      "List custom knowledge regions and subjects. REST: GET .../custom-knowledge-regions.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_custom_knowledge_region",
    description:
      "Create custom knowledge region from subjects. REST: POST .../custom-knowledge-regions action=create.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        subjects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              user_id: { type: "string" },
              guest_user_id: { type: "string" },
              label: { type: "string" },
            },
          },
        },
      },
      required: ["workspace_id", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "eval_custom_knowledge_region",
    description:
      "Score a subject against a custom knowledge region. REST: POST .../custom-knowledge-regions action=eval.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        model_id: { type: "string" },
        user_id: { type: "string" },
        guest_user_id: { type: "string" },
      },
      required: ["workspace_id", "model_id"],
      additionalProperties: false,
    },
  },
  {
    name: "buffer_proof_of_work",
    description:
      "Buffer a PoW unit in Stash API memory until stash or submit (TAP). REST: POST /api/v3/stash/workspaces/{id}/proof-of-work.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        type: { type: "string" },
        mime_type: { type: "string" },
        data: { type: "string" },
        block_id: { type: "string" },
        session_id: { type: "string" },
        file_name: { type: "string" },
        tool_name: { type: "string" },
        tool_action: { type: "string" },
        metadata: { type: "object" },
        timestamp_ms: { type: "number" },
      },
      required: ["workspace_id", "type", "mime_type", "data"],
      additionalProperties: false,
    },
  },
  {
    name: "stash_proof_of_work",
    description:
      "Flush buffered PoW as System 1 (stash). REST: POST .../stash.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_stashed_proof_of_work",
    description:
      "Flush buffered PoW as System 2 (submit). REST: POST .../submit.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
] as const;

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
};

export async function loadWorkspace(
  supabase: McpProofOfWorkToolContext["supabase"],
  auth: AuthContext,
  workspaceId: string
): Promise<WorkspaceRow> {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, workspace_goal, evaluation_mode, protocol_config, external_refs, status, created_at, updated_at"
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

