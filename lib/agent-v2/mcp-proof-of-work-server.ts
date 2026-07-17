import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fallbackConversionGoal,
  finalizePerformanceReport,
  normalizeConversionGoal,
  WORKSPACE_GENERATION_CONVERSION_GOAL_RULE,
} from "./conversion-goal";
import { parseProofOfWorkSchemaRequest } from "./proof-of-work-schema";
import {
  generateOpaqueWorkspaceProofOfWorkSpec,
  generateWorkspaceProofOfWorkSpec,
  parseOpaqueSchemaRequest,
} from "./proof-of-work-integration";
import { createAgentWorkspace } from "./create-agent-workspace";
import { CreateTapLinkError, createWorkspaceTapLink } from "./create-tap-link";
import {
  buildOpaquePerformanceChatInstructions,
  buildOpaquePerformanceReportInstructions,
  buildPrivacyMetadata,
  extractGoalRefFromConversionGoal,
  finalizeOpaquePerformanceReport,
  isOpaqueWorkspace,
  lintOpaquePayload,
  parseWorkspaceEvaluationMeta,
  redactOpaqueFileName,
  sanitizeOpaqueMetadata,
} from "./opaque-evaluation";
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
import {
  buildPerformanceChatInstructions,
  buildPerformanceReportInstructions,
  buildWorkspacePerformanceContext,
  emptyPerformanceReport,
  PERFORMANCE_REPORT_SCHEMA,
  type PerformanceConversationMessage,
  type PerformanceReport,
} from "./performance-context";
import type { ApiKeyScope, AuthContext } from "./types";
import { createdByApiKeyId, hasScope } from "./auth";
import { canAccessAgentWorkspace } from "./workspace-access";
import {
  defaultProofOfWorkFileName,
  isAllowedProofOfWorkMime,
  MAX_WORKSPACE_PROOF_OF_WORK_BYTES,
  normalizeProofOfWorkType,
} from "./workspace-proof-of-work";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import { callXaiJSON, callXaiResponses, callXaiResponsesWithFiles, DEFAULT_MODEL, userMessage, type ResponsesInputMessage } from "@/lib/xai-client";
import { deleteFileFromXAI, uploadFileToXAI } from "@/lib/xai-files";
import { assertCanSubmitProofOfWork } from "@/lib/usage-enforcement";
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

export const MCP_PROOF_OF_WORK_PROTOCOL_VERSION = "2025-03-26";
export const MCP_PROOF_OF_WORK_SERVER_NAME = "uncertain-systems-proof-of-work-api";
export const MCP_PROOF_OF_WORK_SERVER_VERSION = "1.3.0";

export const MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS = `Uncertain Systems Proof-of-Work API MCP — full parity with Proof-of-Work API REST.

## What Uncertain Systems is
${UNCERTAIN_SYSTEMS_SCOPE.mission}
Pillars: ${UNCERTAIN_SYSTEMS_SCOPE.pillars.join(" | ")}

## Workspace & progress model
${UNCERTAIN_SYSTEMS_SCOPE.workspace_model}
Progress signals: proof_of_work_artifact counts, analyze_performance → overall_score, conversion_score vs conversion_goal, marker_scores, gap_analysis.

## Predictive interruptions (TIM)
Every tool result includes top-level \`interruption\` (object or null). When non-null, schedule intervention after delay_ms unless a later Proof-of-Work API call supersedes it. Read interruption_contract from generate_proof_of_work_schema. Resource: uncertain-systems://predictive-interruptions

## Evaluation modes
- **semantic** (default): \`create_workspace\` with \`initial_prompt\`. Grok decomposes the workspace; performance reports use semantic gap analysis.
- **opaque**: \`create_workspace\` with \`evaluation_mode: "opaque"\` and \`protocol\` (\`protocol_id\`, \`goal_ref\`, optional \`phases\` / \`goal_tokens\`). Privacy-preserving structural verification — prompts are not stored, semantic inference is disabled, uploads are plaintext-linted.
  - \`generate_proof_of_work_schema\`: opaque workspaces use \`definition_ref\` + \`contract.event_verbs\` (not \`definition\`).
  - \`upload_proof_of_work\`: metadata allowlist only; tool payloads reject file paths unless \`metadata.allow_plaintext=true\`.
  - \`analyze_performance\` report mode: adds \`evaluation_mode\`, \`privacy\`, and \`protocol_report\` (structural compliance).

Canonical protocol \`agent-trace-v3\` phases: enumerate → fingerprint → aggregate → emit → validate.

## Start here
1. get_learning_progress(workspace_id) — orientation + recommended_next_actions (REST equivalents included)
2. generate_proof_of_work_schema — returns continuous_evaluation (REST) AND continuous_evaluation_mcp (tools); read both
3. upload_proof_of_work after product actions (repeat)
4. analyze_performance without prompt = scorecard; with prompt = coaching chat
5. Re-fetch schema + regenerate skill as proof of work grows

REST mirror: same loop via Bearer auth on /api/v2/agent/workspaces/{id}/...

Resources: resources/read uncertain-systems://integration-scope and uncertain-systems://proof-of-work-loop

TAP links (create_tap_link): bearer URLs at /tap/session/{token}. Scope to the full workspace (omit block_id) or a single block. Works for workspace owners and guests — open the link yourself or share with a learner. guest_email/guest_user_id are optional (org admins only).

Partner agents: call generate_integration_skill for a workspace-specific skill.md, then use MCP tools proactively per that skill's checkpoint policy.

Scopes: workspaces:read, workspaces:write, tap:read, tap:write. Teams tier. Auth: Authorization: Bearer <api_key or OAuth token> on POST /api/mcp.`;

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
      "One-call learning progress snapshot: conversion_goal, blocks, proof-of-work counts, uncertain_systems_scope, dual REST+MCP evaluation policies, and recommended_next_actions. Call first when orienting mid-session.",
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
      "Get workspace metadata including conversion_goal — the outcome learning progress is scored against. REST: GET .../workspaces/{id}.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string", description: "Workspace UUID." } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "create_workspace",
    description:
      "Create a Verification Workspace from initial_prompt (semantic) or protocol (opaque). Optional seed files. Semantic mode places blocks on a 2D skill grid starting at (0,0) with signed multi-quadrant coords, sparse branching paths, and an initial_chapters band (narrow|mid|broad) controlling how many blocks to generate.",
    inputSchema: {
      type: "object",
      properties: {
        evaluation_mode: { type: "string", enum: ["semantic", "opaque"] },
        initial_prompt: { type: "string", description: "Required for semantic mode." },
        initial_chapters: {
          type: "string",
          enum: ["narrow", "mid", "broad"],
          description:
            "Initial chapters/blocks band for semantic create: narrow (fewest), mid (default), broad (most; deeper branch arms). Controls generate count and spatial breadth.",
        },
        protocol: {
          type: "object",
          description: "Required for opaque mode: protocol_id, goal_ref, optional phases/goal_tokens.",
          properties: {
            protocol_id: { type: "string" },
            goal_ref: { type: "string" },
            phases: { type: "array" },
            goal_tokens: { type: "array" },
            constraints: { type: "array" },
          },
        },
        external_refs: { type: "object", description: "Partner-owned opaque refs (stored, not inferred)." },
        files: {
          type: "array",
          description: "Optional seed files (max 5): name, mime_type, data (base64).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              mime_type: { type: "string" },
              data: { type: "string" },
            },
            required: ["name", "mime_type", "data"],
          },
        },
      },
      additionalProperties: false,
    },
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
    name: "analyze_performance",
    description:
      "Read learning progress: overall_score, conversion_score, marker_scores, gap_analysis. Omit prompt for scorecard; include prompt (+ optional style_prompt) for chat. Opaque workspaces also return evaluation_mode, privacy, and protocol_report (structural compliance). Returns recommended_next_actions. REST: POST .../performance.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        block_id: { type: "string" },
        prompt: { type: "string", description: "Chat question. Omit for report mode." },
        style_prompt: {
          type: "string",
          description: "Optional voice/tone (e.g. second person, formal coach).",
        },
        conversation_history: {
          type: "array",
          description: "Prior chat turns for multi-turn Q&A.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
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
      },
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
    conversionGoal?: string | null;
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
      conversionGoal: options.conversionGoal,
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
      has_conversion_goal: Boolean(options.conversionGoal?.trim()),
    }),
  };
}

function parseConversationHistory(value: unknown): PerformanceConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is PerformanceConversationMessage => {
      const item = entry as Partial<PerformanceConversationMessage>;
      return (item.role === "user" || item.role === "assistant") && typeof item.content === "string";
    })
    .map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, 8000),
    }))
    .slice(-12);
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
  conversion_goal: string | null;
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
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, conversion_goal, evaluation_mode, protocol_config, external_refs, status, created_at, updated_at"
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

interface InitialFile {
  name: string;
  mime_type: string;
  data: string;
}

interface GeneratedBlock {
  id: string;
  title: string;
  description: string;
  is_start?: boolean;
  next?: string[];
}

interface GeneratedWorkspace {
  title: string;
  conversion_goal?: string;
  blocks: GeneratedBlock[];
}

const CREATE_WORKSPACE_MAX_FILES = 5;
const CREATE_WORKSPACE_MAX_FILE_SIZE = 10 * 1024 * 1024;
const CREATE_WORKSPACE_ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

function parseInitialFiles(value: unknown): InitialFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((file): file is InitialFile => {
    const candidate = file as Partial<InitialFile>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.mime_type === "string" &&
      typeof candidate.data === "string"
    );
  });
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
    const limit = boundedInt(args.limit, 20, 1, 100);
    const offset = boundedInt(args.offset, 0, 0, 10_000);
    const status = stringArg(args, "status");

    let query = supabase
      .from("workspaces")
      .select("id, title, root_topic, status, notes, created_at, updated_at", { count: "exact" })
      .or(
        auth.user_id
          ? `user_id.eq.${auth.user_id},organization_id.eq.${auth.organization_id}`
          : `organization_id.eq.${auth.organization_id}`
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return await evidenceToolResult(
      {
        workspaces: data || [],
        pagination: {
          total: count ?? 0,
          limit,
          offset,
          has_more: offset + limit < (count ?? 0),
        },
      },
      { endpoint: "list_workspaces" }
    );
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

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
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

    return await evidenceToolResult(
      withProgressGuidance(
        {
          workspace: {
            id: workspace.id,
            title: workspace.title,
            root_topic: workspace.root_topic,
            conversion_goal: workspace.conversion_goal,
            status: workspace.status,
          },
          blocks: blocks || [],
          proof_of_work_summary: counts,
          continuous_evaluation: buildContinuousEvaluationPolicy(workspaceId, origin, counts),
          rest_quick_reference: {
            evidence_schema: buildProofOfWorkSchemaApiPath(workspaceId, origin),
            integration_skill: buildIntegrationSkillApiPath(workspaceId, origin),
            performance: buildPerformanceApiPath(workspaceId, origin),
          },
          progress_interpretation: {
            learning_verification: "Request analyze_performance (no prompt) for overall_score and marker_scores.",
            conversion_tracking: "Compare conversion_score to conversion_goal from workspace metadata.",
            evidence_health:
              counts.proof_of_work_artifacts === 0
                ? "No artifacts yet — call generate_proof_of_work_schema then upload_proof_of_work."
                : `${counts.proof_of_work_artifacts} artifact(s) — ${counts.proof_of_work_artifacts < 5 ? "early signal" : "enough for scoring"}.`,
          },
        },
        {
          origin,
          workspaceId,
          counts,
          conversionGoal: workspace.conversion_goal,
          workspaceTitle,
        }
      ),
      {
        endpoint: "get_learning_progress",
        workspace_id: workspaceId,
        proof_of_work_artifacts: counts.proof_of_work_artifacts,
      }
    );
  }

  if (name === "create_workspace") {
    requireScope(auth.scopes, "workspaces:write");
    if (!auth.user_id && !auth.guest_user_id) {
      throw new Error("A user or guest API key is required to create workspaces.");
    }
    if (auth.guest_user_id && !auth.organization_id) {
      throw new Error("Guest workspace creation requires organization context.");
    }

    const created = await createAgentWorkspace(supabase, auth, args as Record<string, unknown>);

    return await evidenceToolResult(
      {
        workspace: created.workspace,
        blocks: created.blocks,
        files: created.files,
        evaluation_mode: created.privacy.evaluation_mode,
        privacy: created.privacy,
      },
      { endpoint: "create_workspace", workspace_id: created.workspace.id as string }
    );
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
      .select("id, title, description, is_start")
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
          },
          blocks || [],
          blockId,
          proofOfWorkSpec
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

    const evidenceType = normalizeProofOfWorkType(args.type);
    const mimeType = typeof args.mime_type === "string" ? args.mime_type.trim().toLowerCase() : "";
    const base64 = typeof args.data === "string" ? args.data : "";
    const blockId = typeof args.block_id === "string" ? args.block_id : null;
    const sessionId = typeof args.session_id === "string" ? args.session_id : null;

    if (!evidenceType) {
      throw new Error("type must be one of: tool, screen, screenshot, video, eeg");
    }
    if (!mimeType || !base64) throw new Error("mime_type and data (base64) are required.");
    if (!isAllowedProofOfWorkMime(evidenceType, mimeType)) {
      throw new Error(`mime_type ${mimeType} is not allowed for type ${evidenceType}`);
    }

    const fileBytes = Buffer.from(base64, "base64");
    if (!fileBytes.length) throw new Error("data must be non-empty base64 content.");
    if (fileBytes.length > MAX_WORKSPACE_PROOF_OF_WORK_BYTES) {
      throw new Error("Proof-of-work file exceeds 10 MB limit.");
    }

    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);
    if (sessionId) {
      const { data: session } = await supabase.from("sessions").select("id").eq("id", sessionId).single();
      if (!session) throw new Error("session_id not found.");
    }

    const ownerUserId = auth.user_id || workspace.user_id;
    if (!ownerUserId) {
      throw new Error("Workspace owner is missing.");
    }
    await assertCanSubmitProofOfWork(supabase, ownerUserId);

    const evalMeta = parseWorkspaceEvaluationMeta(workspace);
    const opaque = isOpaqueWorkspace(evalMeta);
    const rawMetadata =
      args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
        ? (args.metadata as Record<string, unknown>)
        : {};
    const allowPlaintext = opaque && rawMetadata.allow_plaintext === true;

    if (opaque && evidenceType === "tool") {
      const lint = lintOpaquePayload(fileBytes.toString("utf8"), { allowPlaintext });
      if (!lint.passed) {
        throw new Error(`Opaque mode plaintext lint failed: ${lint.violations.join(", ")}`);
      }
    }

    const artifactId = randomUUID();
    const fileName = opaque
      ? redactOpaqueFileName(artifactId)
      : defaultProofOfWorkFileName(evidenceType, typeof args.file_name === "string" ? args.file_name : undefined);

    const uploaded = await uploadFileToXAI(fileName, mimeType, base64);
    const metadata = opaque ? sanitizeOpaqueMetadata(rawMetadata, allowPlaintext) : rawMetadata;

    const { data: row, error } = await supabase
      .from("workspace_proof_of_work")
      .insert({
        workspace_id: workspaceId,
        block_id: blockId,
        session_id: sessionId,
        proof_of_work_type: evidenceType,
        file_name: fileName,
        mime_type: mimeType,
        file_size: fileBytes.length,
        xai_file_id: uploaded.file_id,
        timestamp_ms: typeof args.timestamp_ms === "number" ? args.timestamp_ms : Date.now(),
        chunk_index: 0,
        metadata,
        tool_name: typeof args.tool_name === "string" ? args.tool_name : null,
        tool_action: typeof args.tool_action === "string" ? args.tool_action : null,
        user_id: ownerUserId,
        guest_user_id: auth.guest_user_id,
        organization_id: auth.organization_id || workspace.organization_id,
        created_by_api_key_id: createdByApiKeyId(auth),
      })
      .select(
        "id, workspace_id, block_id, session_id, proof_of_work_type, file_name, mime_type, file_size, xai_file_id, timestamp_ms, metadata, tool_name, tool_action, created_at"
      )
      .single();

    if (error || !row) {
      await deleteFileFromXAI(uploaded.file_id).catch(() => {});
      throw new Error("Failed to store workspace proof of work.");
    }

    const { count: proofOfWorkCount } = await supabase
      .from("workspace_proof_of_work")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    return await evidenceToolResult(
      {
        proof_of_work: {
          ...row,
          workspace_id: row.workspace_id,
          block_id: row.block_id,
          type: row.proof_of_work_type,
        },
        evaluation_mode: evalMeta.evaluation_mode,
        privacy: opaque ? buildPrivacyMetadata(evalMeta) : undefined,
        plaintext_lint: opaque ? { passed: true, violations: [] } : undefined,
      },
      {
        endpoint: "upload_proof_of_work",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: proofOfWorkCount ?? 1,
        tool_name: row.tool_name,
      }
    );
  }

  if (name === "analyze_performance") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const evalMeta = parseWorkspaceEvaluationMeta(workspace);
    const opaque = isOpaqueWorkspace(evalMeta);
    const privacy = buildPrivacyMetadata(evalMeta);
    const goalRef =
      extractGoalRefFromConversionGoal(workspace.conversion_goal) || evalMeta.protocol_config?.goal_ref || null;
    const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
    const stylePrompt = typeof args.style_prompt === "string" ? args.style_prompt.trim() : "";
    const blockId = typeof args.block_id === "string" ? args.block_id : null;
    const conversationHistory = parseConversationHistory(args.conversation_history);

    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const context = await buildWorkspacePerformanceContext({
      supabase,
      auth,
      workspaceId,
      blockId,
    });
    const activeFileIds = context.fileIds;
    const contextCounts = context.payload.counts;

    if (
      contextCounts.proof_of_work_artifacts === 0 &&
      contextCounts.linked_sessions === 0 &&
      contextCounts.workspace_files === 0
    ) {
      const emptyReport = prompt
        ? null
        : finalizePerformanceReport(emptyPerformanceReport(), workspace.conversion_goal, {
            title: workspace.title,
            description: workspace.description,
            notes: workspace.notes,
            root_topic: workspace.root_topic,
          });

      return await evidenceToolResult(
        withProgressGuidance(
          {
            mode: prompt ? "chat" : "report",
            response: prompt
              ? "No performance proof of work is attached to this workspace yet. Upload tool usage via upload_proof_of_work or complete a TAP session before asking detailed questions."
              : null,
            report: emptyReport?.report ?? null,
            workspace_conversion_goal: emptyReport?.workspace_conversion_goal,
            conversion_goal_source: emptyReport?.conversion_goal_source,
            proof_of_work_summary: contextCounts,
            file_ids: [],
          },
          {
            origin,
            workspaceId,
            counts: contextCounts,
            conversionGoal: workspace.conversion_goal,
            workspaceTitle: workspace.title || workspace.root_topic || "workspace",
          }
        ),
        {
          endpoint: "analyze_performance",
          workspace_id: workspaceId,
          block_id: blockId,
          mode: prompt ? "chat" : "report",
          report: emptyReport?.report ?? null,
          proof_of_work_artifacts: contextCounts.proof_of_work_artifacts,
        }
      );
    }

    if (prompt) {
      const inputMessages: ResponsesInputMessage[] = conversationHistory.map((message) => ({
        role: message.role,
        content: message.content,
      }));
      inputMessages.push({
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...activeFileIds.map((fileId) => ({ type: "input_file" as const, file_id: fileId })),
        ],
      });

      const chatResult = await callXaiResponses({
        model: DEFAULT_MODEL,
        instructions: opaque
          ? buildOpaquePerformanceChatInstructions(blockId)
          : buildPerformanceChatInstructions(blockId, stylePrompt),
        input: inputMessages,
        temperature: 0.6,
        maxOutputTokens: 4096,
        fetchTimeout: 120000,
      });

      if (!chatResult.success || !chatResult.text) {
        throw new Error(chatResult.error || "Failed to generate performance chat response.");
      }

      return await evidenceToolResult(
        withProgressGuidance(
          {
            mode: "chat",
            evaluation_mode: evalMeta.evaluation_mode,
            privacy,
            response: chatResult.text,
            proof_of_work_summary: contextCounts,
            file_ids: activeFileIds,
          },
          {
            origin,
            workspaceId,
            counts: contextCounts,
            conversionGoal: workspace.conversion_goal,
            workspaceTitle: workspace.title || workspace.root_topic || "workspace",
          }
        ),
        {
          endpoint: "analyze_performance",
          workspace_id: workspaceId,
          block_id: blockId,
          mode: "chat",
          proof_of_work_artifacts: contextCounts.proof_of_work_artifacts,
        }
      );
    }

    const storedConversionGoal =
      context.payload.workspace.conversion_goal ?? workspace.conversion_goal;

    const reportResult = await callXaiResponsesWithFiles<PerformanceReport>(
      opaque
        ? `Generate a structural-only opaque protocol report for workspace ${workspaceId}.`
        : `Generate a learning and gap analysis report for workspace "${workspace.title || workspace.root_topic}".`,
      activeFileIds,
      {
        instructions: opaque
          ? buildOpaquePerformanceReportInstructions(blockId, goalRef)
          : buildPerformanceReportInstructions(blockId, storedConversionGoal, stylePrompt),
        temperature: 0.35,
        maxOutputTokens: 2500,
        fetchTimeout: 120000,
        jsonSchema: PERFORMANCE_REPORT_SCHEMA,
      }
    );

    if (!reportResult.success || !reportResult.data) {
      throw new Error(reportResult.error || "Failed to generate performance report.");
    }

    const finalized = opaque
      ? finalizeOpaquePerformanceReport(reportResult.data, goalRef, evalMeta.protocol_config)
      : {
          ...finalizePerformanceReport(reportResult.data, storedConversionGoal, {
            title: workspace.title,
            description: workspace.description,
            notes: workspace.notes,
            root_topic: workspace.root_topic,
          }),
          protocol_report: undefined,
        };

    return await evidenceToolResult(
      withProgressGuidance(
        {
          mode: "report",
          evaluation_mode: evalMeta.evaluation_mode,
          privacy,
          workspace_conversion_goal: finalized.workspace_conversion_goal,
          conversion_goal_source: finalized.conversion_goal_source,
          report: finalized.report,
          protocol_report: opaque ? finalized.protocol_report : undefined,
          proof_of_work_summary: contextCounts,
          file_ids: activeFileIds,
        },
        {
          origin,
          workspaceId,
          counts: contextCounts,
          conversionGoal: workspace.conversion_goal,
          workspaceTitle: workspace.title || workspace.root_topic || "workspace",
        }
      ),
      {
        endpoint: "analyze_performance",
        workspace_id: workspaceId,
        block_id: blockId,
        mode: "report",
        report: finalized.report,
        proof_of_work_artifacts: contextCounts.proof_of_work_artifacts,
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

  throw new Error(`Unknown tool: ${name}`);
}