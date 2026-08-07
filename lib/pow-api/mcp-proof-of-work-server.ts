import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProofOfWorkSchemaRequest } from "./proof-of-work-schema";
import {
  generateOpaqueWorkspaceProofOfWorkSpec,
  generateWorkspaceProofOfWorkSpec,
  parseOpaqueSchemaRequest,
} from "./proof-of-work-integration";
import { CreateTapLinkError, createWorkspaceTapLink } from "./create-tap-link";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
  listWorkspaceTapbenchLinks,
} from "./create-tapbench-link";
import { rejectProgrammaticWorkspaceCreate } from "./workspace-create-ui-only";
import { runVerticalScore } from "./run-vertical-score";
import type { ScoreVertical } from "./performance-report";
import {
  buildProofOfWorkSchemaRequestFromIntegration,
  resolveEvalDefinition,
} from "./proof-of-work-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
} from "./integration-skill";
import { buildWorkspacePerformanceContext } from "./performance-context";
import type { ApiKeyScope, AuthContext } from "./types";
import { hasScope } from "./auth";
import { canAccessAgentWorkspace } from "./workspace-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildUncertainSystemsScopeForWorkspace,
  UNCERTAIN_SYSTEMS_SCOPE,
  recommendIntegrationActions,
} from "./integration-discovery";
import {
  buildContinuousEvaluationPolicy,
  buildProofOfWorkSchemaApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  resolveProofOfWorkSchemaInterruption,
} from "./proof-of-work-integration";
import {
  type InterruptionContext,
  withProofOfWorkApiResponse,
} from "./predictive-interruption";
import {
  getAgentLearningProgress,
  listAgentWorkspaces,
} from "./agent-workspace-ops";
import {
  getUploadProofOfWorkMeta,
  uploadWorkspaceProofOfWork,
} from "./upload-workspace-proof-of-work";
import { countWorkspaceProofOfWorkForPlan } from "./workspace-proof-of-work";
import { loadLearningWorldModel } from "./learning-world-model-store";
import { resolveEvaluationSubject } from "./evaluation-subject";
import {
  loadLatestKnowledgeConfig,
  loadKnowledgeConfigTrajectory,
  projectTrajectory2D,
  trajectoryPathLength,
} from "./knowledge-config-store";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  emptyKnowledgeConfig,
} from "@/lib/knowledge-config";
import { computeKnowledgeDistanceForSubject } from "./custom-verification-model-store";
import {
  createCustomVerificationModelFromSubjects,
  evalSubjectAgainstCustomVerificationModel,
  listCustomVerificationModels,
  listSubjectsWithKnowledgeConfig,
} from "./custom-verification-model-store";
import {
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "./eval-run-history-store";
import { SCORE_VERTICALS } from "./performance-report";
import {
  bufferSubjectId,
  getStashBufferSize,
  ingestStashUnit,
  stashBufferedProofOfWork,
  submitBufferedProofOfWork,
} from "./stash-api";


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

function textToolResult(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

async function evidenceToolResult(
  value: Record<string, unknown>,
  interruptionContext?: InterruptionContext
) {
  const payload = interruptionContext
    ? await withProofOfWorkApiResponse(value, interruptionContext)
    : { ...value, interruption: null };
  return textToolResult(payload);
}

function stringArg(args: Record<string, unknown>, name: string) {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function requireScope(scopes: ApiKeyScope[], scope: ApiKeyScope) {
  if (!hasScope(scopes, scope)) {
    throw new Error(`This tool requires the ${scope} scope on your API key or OAuth token.`);
  }
}

function withProgressGuidance<T extends Record<string, unknown>>(
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

type WorkspaceRow = {
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

async function loadWorkspace(
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

async function assertBlockInWorkspace(
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

function tapLinkIdArg(args: Record<string, unknown>) {
  return stringArg(args, "tap_link_id");
}

export async function callMcpProofOfWorkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpProofOfWorkToolContext
) {
  const { auth, supabase, origin } = ctx;
  if (name === "list_workspaces") {
    requireScope(auth.scopes, "workspaces:read");
    const payload = await listAgentWorkspaces(supabase, auth, {
      status: stringArg(args, "status"),
      limit: args.limit,
      offset: args.offset,
    });
    return await evidenceToolResult(payload, { endpoint: "list_workspaces" });
  }

  if (name === "get_workspace") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    return await evidenceToolResult(
      { workspace },
      { endpoint: "get_workspace", workspace_id: workspaceId }
    );
  }

  if (name === "get_learning_progress") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const progress = await getAgentLearningProgress(supabase, auth, workspaceId, origin);
    const { counts, workspace_row: _ws, ...payload } = progress;
    return await evidenceToolResult(payload, {
      endpoint: "get_learning_progress",
      workspace_id: workspaceId,
      proof_of_work_artifacts: counts.proof_of_work_artifacts,
    });
  }

  if (name === "create_workspace") {
    // Tool removed from catalog; hard-fail if a client still calls it.
    rejectProgrammaticWorkspaceCreate();
  }

  if (name === "list_blocks") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);

    const { data: blocks, error } = await supabase
      .from("blocks")
      .select("id, title, description, is_start, next_block_ids, status, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return await evidenceToolResult(
      { blocks: blocks || [] },
      { endpoint: "list_blocks", workspace_id: workspaceId }
    );
  }

  if (name === "generate_proof_of_work_schema") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const opaqueRequest = parseOpaqueSchemaRequest(args as Record<string, unknown>);
    const semanticRequest = opaqueRequest
      ? null
      : parseProofOfWorkSchemaRequest({
          definition: args.definition,
          block_id: args.block_id,
          integration_hints: args.integration_hints,
        });
    if (!opaqueRequest && !semanticRequest) {
      throw new Error(
        args.evaluation_mode === "opaque"
          ? "definition_ref and contract.event_verbs are required for opaque schema generation."
          : "definition is required."
      );
    }

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = (opaqueRequest?.block_id ?? semanticRequest?.block_id) || null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const workspaceTitle = workspace.title || workspace.root_topic || "workspace";

    if (opaqueRequest) {
      const { spec, contextCounts, fileIds, privacy } = await generateOpaqueWorkspaceProofOfWorkSpec({
        supabase,
        auth,
        workspaceId,
        request: opaqueRequest,
        baseUrl: origin,
        blockId,
      });

      const llmInterruption = resolveProofOfWorkSchemaInterruption(spec, workspaceId);

      return await evidenceToolResult(
        {
          ...spec,
          definition_ref: opaqueRequest.definition_ref,
          evaluation_mode: "opaque",
          privacy,
          workspace_summary: {
            id: workspace.id,
            title: workspace.title,
            root_topic: workspace.root_topic,
          },
          context_counts: contextCounts,
          file_ids: fileIds,
        },
        {
          endpoint: "generate_proof_of_work_schema",
          workspace_id: workspaceId,
          block_id: blockId,
          proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
          llm_interruption: llmInterruption,
        }
      );
    }

    const { spec, contextCounts, fileIds } = await generateWorkspaceProofOfWorkSpec({
      supabase,
      auth,
      workspaceId,
      workspaceTitle,
      request: semanticRequest!,
      baseUrl: origin,
      blockId,
    });

    const llmInterruption = resolveProofOfWorkSchemaInterruption(spec, workspaceId);

    return await evidenceToolResult(
      {
        ...spec,
        definition: semanticRequest!.definition,
        evaluation_mode: "semantic",
        workspace_summary: {
          id: workspace.id,
          title: workspace.title,
          root_topic: workspace.root_topic,
        },
        context_counts: contextCounts,
        file_ids: fileIds,
      },
      {
        endpoint: "generate_proof_of_work_schema",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
        llm_interruption: llmInterruption,
      }
    );
  }

  if (name === "generate_integration_skill") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const request = parseIntegrationSkillRequest({
      integration_name: args.integration_name,
      eval_definition: args.eval_definition,
      partner_description: args.partner_description,
      block_id: args.block_id,
      base_url: origin,
      prefetch_proof_of_work_spec: args.prefetch_proof_of_work_spec,
      integration_hints: args.integration_hints,
    });
    if (!request) throw new Error("integration_name is required.");

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = request.block_id ?? null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const workspaceTitle = workspace.title || workspace.root_topic || "workspace";
    const evalDefinition = resolveEvalDefinition(request.eval_definition, workspace);

    let blocksQuery = supabase
      .from("blocks")
      .select("id, title, description, status, is_start")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    if (blockId) blocksQuery = blocksQuery.eq("id", blockId);

    const [{ data: blocks }, contextResult] = await Promise.all([
      blocksQuery,
      buildWorkspacePerformanceContext({ supabase, auth, workspaceId, blockId }).catch(() => null),
    ]);

    let proofOfWorkSpec = null;
    if (request.prefetch_proof_of_work_spec) {
      const proofOfWorkSchemaRequest = buildProofOfWorkSchemaRequestFromIntegration(
        evalDefinition,
        request.integration_name,
        request.partner_description,
        blockId
      );
      if (proofOfWorkSchemaRequest) {
        try {
          const proofOfWorkSpecResult = await generateWorkspaceProofOfWorkSpec({
            supabase,
            auth,
            workspaceId,
            workspaceTitle,
            request: proofOfWorkSchemaRequest,
            baseUrl: origin,
            blockId,
          });
          proofOfWorkSpec = proofOfWorkSpecResult.spec;
        } catch {
          // skill still generated without prefetch
        }
      }
    }

    const fileIds = contextResult?.fileIds || [];
    const skillResult = await callXaiResponsesWithFiles(
      buildIntegrationSkillPrompt(workspaceTitle, request.integration_name),
      fileIds,
      {
        instructions: buildIntegrationSkillInstructions(
          { ...request, eval_definition: evalDefinition, base_url: origin },
          {
            id: workspace.id,
            title: workspace.title,
            root_topic: workspace.root_topic,
            description: workspace.description,
            notes: workspace.notes,
            workspace_goal: workspace.workspace_goal ?? null,
          },
          blocks || [],
          blockId,
          proofOfWorkSpec,
          contextResult?.payload ?? null
        ),
        temperature: 0.45,
        maxOutputTokens: 8192,
        fetchTimeout: 120000,
      }
    );

    if (!skillResult.success || !skillResult.text) {
      throw new Error(skillResult.error || "Failed to generate integration skill.");
    }

    return await evidenceToolResult(
      {
        skill_md: skillResult.text,
        skill_name: deriveSkillName(request.integration_name),
        suggested_share_path: deriveSuggestedSharePath(request.integration_name),
        workspace_summary: {
          id: workspace.id,
          title: workspace.title || workspace.root_topic || "Untitled",
          root_topic: workspace.root_topic,
          block_count: blocks?.length || 0,
        },
        proof_of_work_spec: proofOfWorkSpec,
        proof_of_work_spec_prefetched: !!proofOfWorkSpec,
        context_counts: contextResult?.payload.counts || null,
        file_ids: fileIds,
      },
      {
        endpoint: "generate_integration_skill",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: contextResult?.payload.counts.proof_of_work_artifacts,
      }
    );
  }

  if (name === "upload_proof_of_work") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = typeof args.block_id === "string" ? args.block_id : null;

    const row = await uploadWorkspaceProofOfWork(
      supabase,
      auth,
      {
        id: workspace.id,
        user_id: workspace.user_id,
        organization_id: workspace.organization_id,
        evaluation_mode: workspace.evaluation_mode,
        protocol_config: workspace.protocol_config,
        external_refs: workspace.external_refs,
        title: workspace.title,
        root_topic: workspace.root_topic,
        workspace_goal: workspace.workspace_goal,
      },
      {
        workspaceId,
        type: typeof args.type === "string" ? args.type : "",
        mime_type: typeof args.mime_type === "string" ? args.mime_type : "",
        data: typeof args.data === "string" ? args.data : "",
        block_id: blockId,
        session_id: typeof args.session_id === "string" ? args.session_id : null,
        file_name: typeof args.file_name === "string" ? args.file_name : undefined,
        timestamp_ms: typeof args.timestamp_ms === "number" ? args.timestamp_ms : undefined,
        tool_name: typeof args.tool_name === "string" ? args.tool_name : undefined,
        tool_action: typeof args.tool_action === "string" ? args.tool_action : undefined,
        metadata:
          args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
            ? (args.metadata as Record<string, unknown>)
            : undefined,
        require_existing_session: true,
      },
    );

    const meta = getUploadProofOfWorkMeta(row);
    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(supabase, workspaceId);

    return await evidenceToolResult(
      {
        proof_of_work: row,
        evaluation_mode: meta.evaluation_mode,
        privacy: meta.privacy,
        plaintext_lint: meta.plaintext_lint,
      },
      {
        endpoint: "upload_proof_of_work",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: proofOfWorkCount ?? 1,
        tool_name: typeof row.tool_name === "string" ? row.tool_name : null,
      }
    );
  }

  // Sole public score tool: LWM Snapshot.
  if (name === "lwm_snapshot") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const vertical = "verification" as ScoreVertical;
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const stylePrompt = typeof args.style_prompt === "string" ? args.style_prompt.trim() : "";
    const blockId = typeof args.block_id === "string" ? args.block_id : null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const scored = await runVerticalScore({
      supabase,
      auth,
      workspaceId,
      vertical,
      blockId,
      stylePrompt,
      workspaceRow: workspace,
      goalSelectionBody: args as Record<string, unknown>,
    });

    return await evidenceToolResult(
      withProgressGuidance(
        {
          mode: "score",
          vertical,
          strategy: "lwm_snapshot",
          label: "LWM Snapshot",
          evaluation_mode: scored.evaluation_mode,
          privacy: scored.privacy,
          workspace_goal: scored.workspace_goal,
          workspace_goal_source: scored.workspace_goal_source,
          evaluated_goals: scored.evaluated_goals,
          goals_fingerprint: scored.goals_fingerprint,
          report: scored.report,
          protocol_report: scored.protocol_report,
          proof_of_work_summary: scored.proof_of_work_summary,
          file_ids: scored.file_ids,
        },
        {
          origin,
          workspaceId,
          counts: scored.proof_of_work_summary ?? {
            blocks: 0,
            proof_of_work_artifacts: 0,
            linked_sessions: 0,
            workspace_files: 0,
          },
          workspaceGoal: scored.workspace_goal,
          workspaceTitle: workspace.title || workspace.root_topic || "workspace",
        }
      ),
      {
        endpoint: "lwm_snapshot",
        workspace_id: workspaceId,
        block_id: blockId,
        mode: "score",
        report: scored.report,
        proof_of_work_artifacts: scored.proof_of_work_summary?.proof_of_work_artifacts,
      }
    );
  }

  if (name === "list_tap_links") {
    requireScope(auth.scopes, "tap:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    let query = supabase
      .from("workspace_tap_sessions")
      .select(
        "id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, mode, overall_score, created_at, started_at, completed_at, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (auth.guest_user_id) {
      query = query.eq("guest_user_id", auth.guest_user_id);
    } else if (!auth.is_org_admin && auth.user_id) {
      query = query.or(`user_id.eq.${auth.user_id},assigned_user_id.eq.${auth.user_id}`);
    }

    const { data: links, error } = await query;
    if (error) throw new Error(error.message);
    return await evidenceToolResult(
      { tap_links: links || [] },
      { endpoint: "list_tap_links", workspace_id: workspaceId }
    );
  }

  if (name === "create_tap_link") {
    requireScope(auth.scopes, "tap:write");
    const workspaceId = stringArg(args, "workspace_id");
    const blockId = stringArg(args, "block_id") || null;
    if (!workspaceId) throw new Error("workspace_id is required.");

    try {
      const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
      const tapLink = await createWorkspaceTapLink({
        supabase,
        auth,
        workspaceId,
        blockId,
        body: args,
        baseUrl: appBase,
      });

      return await evidenceToolResult(
        {
          tap_link: tapLink,
          private_url: tapLink.private_url,
        },
        {
          endpoint: "create_tap_link",
          workspace_id: workspaceId,
          block_id: blockId,
          tap_minutes: Math.round(tapLink.requested_duration_seconds / 60),
        }
      );
    } catch (error) {
      if (error instanceof CreateTapLinkError) throw new Error(error.message);
      throw error;
    }
  }

  if (name === "list_tapbench_links") {
    requireScope(auth.scopes, "tap:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    try {
      const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
      const listed = await listWorkspaceTapbenchLinks({
        supabase,
        auth,
        workspaceId,
        baseUrl: appBase,
      });
      return await evidenceToolResult(listed, {
        endpoint: "list_tapbench_links",
        workspace_id: workspaceId,
      });
    } catch (error) {
      if (error instanceof CreateTapbenchLinkError) throw new Error(error.message);
      throw error;
    }
  }

  if (name === "create_tapbench_link") {
    requireScope(auth.scopes, "tap:write");
    const workspaceId = stringArg(args, "workspace_id");
    const blockId = stringArg(args, "block_id") || null;
    if (!workspaceId) throw new Error("workspace_id is required.");

    try {
      const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
      const tapbenchLink = await createWorkspaceTapbenchLink({
        supabase,
        auth,
        workspaceId,
        blockId,
        body: args,
        baseUrl: appBase,
      });
      return await evidenceToolResult(
        {
          workspace_id: workspaceId,
          tapbench_link: tapbenchLink,
          session_token: tapbenchLink.session_token,
          url: tapbenchLink.url,
          exercise_source: tapbenchLink.exercise_source,
        },
        {
          endpoint: "create_tapbench_link",
          workspace_id: workspaceId,
          block_id: blockId,
        },
      );
    } catch (error) {
      if (error instanceof CreateTapbenchLinkError) throw new Error(error.message);
      throw error;
    }
  }

  if (name === "get_world_model") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
    const subject = resolveEvaluationSubject(
      auth,
      {
        user_id: stringArg(args, "user_id") || auth.user_id,
        guest_user_id: stringArg(args, "guest_user_id"),
      },
      { isWorkspaceOwner },
    );
    const { id, model } = await loadLearningWorldModel(supabase, workspaceId, subject);
    return await evidenceToolResult(
      { workspace_id: workspaceId, subject, lwm_id: id, learning_world_model: model },
      { endpoint: "get_world_model", workspace_id: workspaceId },
    );
  }

  if (name === "get_knowledge_config") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
    const subject = resolveEvaluationSubject(
      auth,
      {
        user_id: stringArg(args, "user_id") || auth.user_id,
        guest_user_id: stringArg(args, "guest_user_id"),
      },
      { isWorkspaceOwner },
    );
    const modelId = stringArg(args, "embedding_model_id") || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    const [latest, lwm] = await Promise.all([
      loadLatestKnowledgeConfig(supabase, workspaceId, subject, modelId),
      loadLearningWorldModel(supabase, workspaceId, subject),
    ]);
    if (!latest) {
      const empty = emptyKnowledgeConfig();
      return await evidenceToolResult(
        {
          workspace_id: workspaceId,
          subject,
          embedding_model_id: empty.embedding_model_id,
          dim: empty.dim,
          vector: empty.vector,
          as_of: empty.as_of,
          as_of_ms: empty.as_of_ms,
          confidence: 0,
          pow_event_count: 0,
          lwm_updated_at: lwm.model.updated_at,
          empty: true,
        },
        { endpoint: "get_knowledge_config", workspace_id: workspaceId },
      );
    }
    return await evidenceToolResult(
      {
        workspace_id: workspaceId,
        subject,
        embedding_model_id: latest.embedding_model_id,
        dim: latest.dim || KNOWLEDGE_CONFIG_DIM,
        vector: latest.vector,
        as_of: new Date(latest.as_of_ms).toISOString(),
        as_of_ms: latest.as_of_ms,
        confidence: latest.confidence,
        pow_event_count: latest.pow_event_count,
        trigger: latest.trigger,
        lwm_updated_at: lwm.model.updated_at,
        empty: false,
      },
      { endpoint: "get_knowledge_config", workspace_id: workspaceId },
    );
  }

  if (name === "get_knowledge_config_trajectory") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
    const subject = resolveEvaluationSubject(
      auth,
      {
        user_id: stringArg(args, "user_id") || auth.user_id,
        guest_user_id: stringArg(args, "guest_user_id"),
      },
      { isWorkspaceOwner },
    );
    const maxPoints = boundedInt(args.max_points, 100, 2, 500);
    const includeProjection = args.project !== false;
    const modelId = stringArg(args, "embedding_model_id") || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
    const parseMs = (value: unknown): number | null => {
      if (typeof value !== "string" || !value) return null;
      if (/^\d+$/.test(value)) return Number(value);
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : null;
    };
    const points = await loadKnowledgeConfigTrajectory(supabase, {
      workspaceId,
      subject,
      fromMs: parseMs(args.from),
      toMs: parseMs(args.to),
      maxPoints,
      embeddingModelId: modelId,
    });
    return await evidenceToolResult(
      {
        workspace_id: workspaceId,
        subject,
        embedding_model_id: modelId,
        point_count: points.length,
        path_length: trajectoryPathLength(points),
        points,
        projection: includeProjection
          ? {
              frame_id: `${modelId}:ui2d`,
              embedding_model_id: modelId,
              coords: projectTrajectory2D(points),
            }
          : undefined,
      },
      { endpoint: "get_knowledge_config_trajectory", workspace_id: workspaceId },
    );
  }

  if (name === "knowledge_distance") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    const regionId = stringArg(args, "region_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    if (!regionId) throw new Error("region_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
    const subject = resolveEvaluationSubject(
      auth,
      {
        user_id: stringArg(args, "user_id") || auth.user_id,
        guest_user_id: stringArg(args, "guest_user_id"),
      },
      { isWorkspaceOwner },
    );
    const computed = await computeKnowledgeDistanceForSubject(supabase, {
      workspaceId,
      regionId,
      subject: { user_id: subject.user_id, guest_user_id: subject.guest_user_id },
    });
    return await evidenceToolResult(
      {
        workspace_id: workspaceId,
        computation: "knowledge_distance",
        note: "Pure embedding-space geometry — not a vertical Eval and not archived.",
        region: {
          id: computed.region.id,
          name: computed.region.name,
          embedding_model_id: computed.region.embedding_model_id,
          cosine_threshold: computed.region.cosine_threshold,
        },
        subject: computed.subject,
        knowledge_distance: computed.knowledge_distance,
      },
      { endpoint: "knowledge_distance", workspace_id: workspaceId },
    );
  }

  if (name === "list_snapshot_history") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
    const parseCsv = (value: string | null): string[] =>
      value
        ? value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const requestedUserIds = parseCsv(stringArg(args, "user_ids"));
    const requestedGuestUserIds = parseCsv(stringArg(args, "guest_user_ids"));
    const requestedSubject =
      stringArg(args, "user_id") || stringArg(args, "guest_user_id")
        ? resolveEvaluationSubject(
            auth,
            {
              user_id: stringArg(args, "user_id"),
              guest_user_id: stringArg(args, "guest_user_id"),
            },
            { isWorkspaceOwner },
          )
        : null;
    const scope = resolveHistorySubjectScope({
      authUserId: auth.user_id,
      authGuestUserId: auth.guest_user_id,
      isOrgAdmin: auth.is_org_admin,
      isWorkspaceOwner,
      requestedUserIds: requestedUserIds.length > 0 ? requestedUserIds : null,
      requestedGuestUserIds: requestedGuestUserIds.length > 0 ? requestedGuestUserIds : null,
      requestedSubject,
    });
    const verticalRaw = stringArg(args, "vertical");
    const vertical =
      verticalRaw && (SCORE_VERTICALS as readonly string[]).includes(verticalRaw)
        ? (verticalRaw as ScoreVertical)
        : null;
    const limit = boundedInt(args.limit, 50, 1, 500);
    const offset = boundedInt(args.offset, 0, 0, 10_000);
    const runs = await listEvalRunHistory(supabase, {
      workspaceId,
      subject: scope.subject,
      userIds: scope.userIds,
      guestUserIds: scope.guestUserIds,
      vertical,
      from: stringArg(args, "from"),
      to: stringArg(args, "to"),
      limit,
      offset,
    });
    return await evidenceToolResult(
      {
        workspace_id: workspaceId,
        scope: {
          restricted: scope.restricted,
          subject: scope.subject ?? null,
          user_ids: scope.userIds ?? null,
          guest_user_ids: scope.guestUserIds ?? null,
        },
        count: runs.length,
        runs,
        limit,
        offset,
      },
      { endpoint: "list_snapshot_history", workspace_id: workspaceId },
    );
  }

  if (name === "list_custom_knowledge_regions") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const [models, subjects] = await Promise.all([
      listCustomVerificationModels(supabase, workspaceId),
      listSubjectsWithKnowledgeConfig(supabase, workspaceId),
    ]);
    return await evidenceToolResult(
      { workspace_id: workspaceId, models, subjects },
      { endpoint: "list_custom_knowledge_regions", workspace_id: workspaceId },
    );
  }

  if (name === "create_custom_knowledge_region") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const modelName = stringArg(args, "name") || "";
    const subjects = Array.isArray(args.subjects) ? args.subjects : [];
    const { model, spec } = await createCustomVerificationModelFromSubjects(supabase, {
      workspaceId,
      name: modelName,
      description: stringArg(args, "description"),
      subjects: subjects.map((s: Record<string, unknown>) => ({
        user_id: typeof s.user_id === "string" ? s.user_id : null,
        guest_user_id: typeof s.guest_user_id === "string" ? s.guest_user_id : null,
        label: typeof s.label === "string" ? s.label : null,
      })),
      createdBy: auth.user_id,
    });
    return await evidenceToolResult(
      { workspace_id: workspaceId, model, spec, action: "create" },
      { endpoint: "create_custom_knowledge_region", workspace_id: workspaceId },
    );
  }

  if (name === "eval_custom_knowledge_region") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    const modelId = stringArg(args, "model_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    if (!modelId) throw new Error("model_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const isWorkspaceOwner = Boolean(auth.user_id && workspace.user_id === auth.user_id);
    const subject = resolveEvaluationSubject(
      auth,
      {
        user_id: stringArg(args, "user_id") || auth.user_id,
        guest_user_id: stringArg(args, "guest_user_id"),
      },
      { isWorkspaceOwner },
    );
    const scored = await evalSubjectAgainstCustomVerificationModel(supabase, {
      workspaceId,
      modelId,
      subject: { user_id: subject.user_id, guest_user_id: subject.guest_user_id },
    });
    return await evidenceToolResult(
      {
        workspace_id: workspaceId,
        model: { id: scored.model.id, name: scored.model.name },
        score: scored.score,
        action: "eval",
      },
      { endpoint: "eval_custom_knowledge_region", workspace_id: workspaceId },
    );
  }

  if (name === "buffer_proof_of_work") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    await loadWorkspace(supabase, auth, workspaceId);
    const subjectId = bufferSubjectId(auth);
    const ingested = ingestStashUnit(workspaceId, subjectId, args);
    if (!ingested.ok) throw new Error(ingested.message);
    const buffered = getStashBufferSize(workspaceId, subjectId);
    return await evidenceToolResult(
      {
        buffered: true,
        unit: {
          id: ingested.unit.id,
          type: ingested.unit.type,
          type_raw: ingested.unit.type_raw,
          mime_type: ingested.unit.mime_type,
          file_name: ingested.unit.file_name ?? null,
          block_id: ingested.unit.block_id,
          session_id: ingested.unit.session_id,
          tool_name: ingested.unit.tool_name,
          tool_action: ingested.unit.tool_action,
          timestamp_ms: ingested.unit.timestamp_ms,
          buffered_at: ingested.unit.buffered_at,
        },
        buffer_count: buffered,
        workspace_id: workspaceId,
        user_id: auth.user_id,
        guest_user_id: auth.guest_user_id,
        next: {
          stash: `POST /api/v3/stash/workspaces/${workspaceId}/stash`,
          submit: `POST /api/v3/stash/workspaces/${workspaceId}/submit`,
        },
        note: "Proof of work is held temporarily until Stash (System 1) or Submit (System 2).",
      },
      { endpoint: "buffer_proof_of_work", workspace_id: workspaceId },
    );
  }

  if (name === "stash_proof_of_work" || name === "submit_stashed_proof_of_work") {
    requireScope(auth.scopes, "workspaces:write");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const subjectId = bufferSubjectId(auth);
    const flush =
      name === "stash_proof_of_work"
        ? await stashBufferedProofOfWork({
            workspaceId,
            subjectId,
            auth,
            workspace: {
              id: workspace.id,
              user_id: workspace.user_id || auth.user_id || "",
              organization_id: workspace.organization_id ?? auth.organization_id,
            },
            supabase,
          })
        : await submitBufferedProofOfWork({
            workspaceId,
            subjectId,
            auth,
            workspace: {
              id: workspace.id,
              user_id: workspace.user_id || auth.user_id || "",
              organization_id: workspace.organization_id ?? auth.organization_id,
            },
            supabase,
          });
    if (!flush.ok) throw new Error(flush.error);
    const decision = name === "stash_proof_of_work" ? "stash" : "submit";
    return await evidenceToolResult(
      {
        decision,
        system: flush.system,
        system_label: decision === "stash" ? "System 1" : "System 2",
        flushed: flush.flushed,
        empty: flush.empty,
        proof_of_work: flush.proof_of_work,
        buffer_remaining: flush.buffer_remaining,
        workspace_id: workspaceId,
        user_id: auth.user_id,
        guest_user_id: auth.guest_user_id,
        note: flush.empty
          ? `No buffered proof of work — nothing to ${decision}.`
          : `Buffered units flushed to PoW API as ${decision === "stash" ? "System 1 (stash)" : "System 2 (submit)"}; buffer reset.`,
      },
      { endpoint: name, workspace_id: workspaceId },
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}