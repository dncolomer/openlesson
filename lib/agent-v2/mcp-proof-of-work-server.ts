import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fallbackConversionGoal,
  finalizePerformanceReport,
  normalizeConversionGoal,
  WORKSPACE_GENERATION_CONVERSION_GOAL_RULE,
} from "./conversion-goal";
import { parseProofOfWorkSchemaRequest } from "./proof-of-work-schema";
import { generateWorkspaceProofOfWorkSpec } from "./proof-of-work-integration";
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
import {
  buildTapScoreSessionUrl,
  createPrivateToken,
  getTapScoreBriefForUser,
  hashPrivateToken,
} from "@/lib/tap-score";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import { callXaiJSON, callXaiResponses, callXaiResponsesWithFiles, DEFAULT_MODEL, userMessage, type ResponsesInputMessage } from "@/lib/xai-client";
import { deleteFileFromXAI, uploadFileToXAI } from "@/lib/xai-files";
import { assertCanSubmitProofOfWork } from "@/lib/usage-enforcement";
import {
  buildContinuousEvaluationMcpPolicy,
  buildIntegrationSurfaces,
  buildOpenLessonScopeForWorkspace,
  OPENLESSON_SCOPE,
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
export const MCP_PROOF_OF_WORK_SERVER_NAME = "openlesson-proof-of-work-api";
export const MCP_PROOF_OF_WORK_SERVER_VERSION = "1.3.0";

export const MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS = `openLesson Proof-of-Work API MCP — full parity with Proof-of-Work API REST.

## What openLesson is
${OPENLESSON_SCOPE.mission}
Pillars: ${OPENLESSON_SCOPE.pillars.join(" | ")}

## Workspace & progress model
${OPENLESSON_SCOPE.workspace_model}
Progress signals: proof_of_work_artifact counts, analyze_performance → overall_score, conversion_score vs conversion_goal, marker_scores, gap_analysis.

## Predictive interruptions (TIM)
Every tool result includes top-level \`interruption\` (object or null). When non-null, schedule intervention after delay_ms unless a later Proof-of-Work API call supersedes it. Read interruption_contract from generate_proof_of_work_schema. Resource: openlesson://predictive-interruptions

## Start here
1. get_learning_progress(workspace_id) — orientation + recommended_next_actions (REST equivalents included)
2. generate_proof_of_work_schema — returns continuous_evaluation (REST) AND continuous_evaluation_mcp (tools); read both
3. upload_proof_of_work after product actions (repeat)
4. analyze_performance without prompt = scorecard; with prompt = coaching chat
5. Re-fetch schema + regenerate skill as proof of work grows

REST mirror: same loop via Bearer auth on /api/v2/agent/workspaces/{id}/...

Resources: resources/read openlesson://integration-scope and openlesson://proof-of-work-loop

TAP links (create_tap_link): bearer URLs at /tap/session/{token}. Works for workspace owners and guests — open the link yourself or share with a learner. guest_email/guest_user_id are optional (org admins only).

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
      "One-call learning progress snapshot: conversion_goal, blocks, proof-of-work counts, openlesson_scope, dual REST+MCP evaluation policies, and recommended_next_actions. Call first when orienting mid-session.",
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
    description: "Create a Verification Workspace from initial_prompt and optional seed files.",
    inputSchema: {
      type: "object",
      properties: {
        initial_prompt: { type: "string", description: "What the learner should be verified on." },
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
      required: ["initial_prompt"],
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
      "Generate proof-of-work spec with tool_submissions, performance_report_contract, continuous_evaluation (REST paths), continuous_evaluation_mcp (tool names), openlesson_scope, and recommended_next_actions. Call before first upload and after every 5-10 artifacts. REST: POST .../proof-of-work-schema.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        definition: { type: "string", description: "What to evaluate / capture in proof of work." },
        block_id: { type: "string", description: "Optional block scope." },
        integration_hints: {
          type: "object",
          description: "Optional tool_name, partner_agent, event_verbs, goals.",
        },
      },
      required: ["workspace_id", "definition"],
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
      "Stream proof-of-work after meaningful product actions — core learning signal. Include block_id and tool_name per generate_proof_of_work_schema contract. REST: POST .../proof-of-work.",
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
      "Read learning progress: overall_score, conversion_score, marker_scores, gap_analysis. Omit prompt for scorecard; include prompt (+ optional style_prompt) for chat. Returns recommended_next_actions. REST: POST .../performance.",
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
      "Create a private Think Aloud Protocol (TAP) link for a workspace block (15 or 30 minutes). Call list_blocks first; block_id must be the blocks UUID id field.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        block_id: {
          type: "string",
          description: "blocks.id UUID from list_blocks (not title, slug, or index).",
        },
        minutes: { type: "number", description: "15 or 30. Default 15." },
        guest_email: { type: "string" },
        guest_user_id: { type: "string" },
      },
      required: ["workspace_id", "block_id"],
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

function evidenceToolResult(
  value: Record<string, unknown>,
  interruptionContext?: InterruptionContext
) {
  const payload = interruptionContext
    ? withProofOfWorkApiResponse(value, interruptionContext)
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
  openlesson_scope: Record<string, unknown>;
  integration_surfaces: ReturnType<typeof buildIntegrationSurfaces>;
  continuous_evaluation_mcp: ReturnType<typeof buildContinuousEvaluationMcpPolicy>;
  recommended_next_actions: ReturnType<typeof recommendIntegrationActions>;
} {
  return {
    ...payload,
    openlesson_scope: buildOpenLessonScopeForWorkspace({
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
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, conversion_goal, status, created_at, updated_at"
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

    return evidenceToolResult(
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
    return evidenceToolResult(
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

    return evidenceToolResult(
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

    const initialPrompt = stringArg(args, "initial_prompt");
    if (!initialPrompt) throw new Error("initial_prompt is required.");

    const files = parseInitialFiles(args.files);
    if (files.length > CREATE_WORKSPACE_MAX_FILES) {
      throw new Error(`A workspace can start with at most ${CREATE_WORKSPACE_MAX_FILES} files.`);
    }
    for (const file of files) {
      if (!CREATE_WORKSPACE_ALLOWED_MIME.has(file.mime_type)) {
        throw new Error(`Unsupported file type: ${file.mime_type}`);
      }
      if (Buffer.from(file.data, "base64").length > CREATE_WORKSPACE_MAX_FILE_SIZE) {
        throw new Error(`File exceeds 10 MB limit: ${file.name}`);
      }
    }

    const fileContext = files.length
      ? `\nInitial files provided:\n${files.map((file) => `- ${file.name} (${file.mime_type})`).join("\n")}`
      : "";

    const generated = await callXaiJSON<GeneratedWorkspace>(
      [
        userMessage(
          `Create a performance learning workspace from this prompt. Break it into assessable blocks for learning verification and proof-of-work-based gap analysis.\n\nPrompt:\n${initialPrompt}${fileContext}\n\nReturn ONLY JSON:\n{\n  "title": "concise workspace title",\n  "conversion_goal": "concise success/conversion outcome for this workspace",\n  "blocks": [\n    { "id": "a", "title": "Block title", "description": "What the learner should demonstrate", "is_start": true, "next": ["b"] }\n  ]\n}\n\nRules:\n- Create 3 to 8 blocks.\n- Blocks are assessable learning/performance units.\n- Use short stable ids only for linking within this response.${WORKSPACE_GENERATION_CONVERSION_GOAL_RULE}`
        ),
      ],
      { model: DEFAULT_MODEL, maxTokens: 1800, temperature: 0.3 }
    );

    if (!generated.success || !generated.data?.blocks?.length) {
      throw new Error("Failed to generate verification workspace.");
    }

    let ownerUserId = auth.user_id;
    if (!ownerUserId && auth.organization_id) {
      const { data: orgAdmin } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", auth.organization_id)
        .eq("is_org_admin", true)
        .limit(1)
        .maybeSingle();
      ownerUserId = orgAdmin?.id || null;
    }
    if (!ownerUserId) {
      throw new Error("No organization admin is available to own this workspace.");
    }

    const workspaceTitle = generated.data.title || "Verification Workspace";
    const conversionGoal =
      normalizeConversionGoal(generated.data.conversion_goal) ||
      fallbackConversionGoal({
        title: workspaceTitle,
        notes: initialPrompt,
        root_topic: initialPrompt.slice(0, 160),
      });

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({
        user_id: ownerUserId,
        organization_id: auth.organization_id,
        guest_user_id: auth.guest_user_id,
        title: workspaceTitle,
        root_topic: initialPrompt.slice(0, 160),
        status: "active",
        source_type: "topic",
        notes: initialPrompt,
        conversion_goal: conversionGoal,
        is_agent_workspace: true,
      })
      .select("id, title, root_topic, status, notes, conversion_goal, created_at, updated_at")
      .single();

    if (workspaceError || !workspace) {
      throw new Error("Failed to create workspace.");
    }

    const blockIdMap = new Map<string, string>();
    for (const block of generated.data.blocks) {
      const { data: insertedBlock, error: blockError } = await supabase
        .from("blocks")
        .insert({
          workspace_id: workspace.id,
          title: block.title,
          description: block.description || "",
          is_start: block.is_start === true,
          next_block_ids: [],
          status: "available",
        })
        .select("id")
        .single();

      if (blockError || !insertedBlock) continue;
      blockIdMap.set(block.id, insertedBlock.id);
    }

    for (const block of generated.data.blocks) {
      const dbId = blockIdMap.get(block.id);
      if (!dbId || !Array.isArray(block.next)) continue;
      const nextIds = block.next.map((id) => blockIdMap.get(id)).filter((id): id is string => Boolean(id));
      if (nextIds.length) {
        await supabase.from("blocks").update({ next_block_ids: nextIds }).eq("id", dbId);
      }
    }

    await persistSkillGridPositions(supabase, skillGridNodesFromRefs(generated.data.blocks, blockIdMap));

    const uploadedFiles = [];
    for (const file of files) {
      try {
        const xaiFile = await uploadFileToXAI(file.name, file.mime_type, file.data);
        const { data: fileRecord, error: fileError } = await supabase
          .from("workspace_files")
          .insert({
            workspace_id: workspace.id,
            user_id: ownerUserId,
            file_name: file.name,
            file_size: Buffer.from(file.data, "base64").length,
            mime_type: file.mime_type,
            xai_file_id: xaiFile.file_id,
          })
          .select("id, file_name, file_size, mime_type, created_at")
          .single();
        if (!fileError && fileRecord) uploadedFiles.push(fileRecord);
      } catch {
        // non-fatal seed file upload
      }
    }

    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, title, description, is_start, next_block_ids, status, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    return evidenceToolResult(
      { workspace, blocks: blocks || [], files: uploadedFiles },
      { endpoint: "create_workspace", workspace_id: workspace.id }
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
    return evidenceToolResult(
      { blocks: blocks || [] },
      { endpoint: "list_blocks", workspace_id: workspaceId }
    );
  }

  if (name === "generate_proof_of_work_schema") {
    requireScope(auth.scopes, "workspaces:read");
    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const request = parseProofOfWorkSchemaRequest({
      definition: args.definition,
      block_id: args.block_id,
      integration_hints: args.integration_hints,
    });
    if (!request) throw new Error("definition is required.");

    const workspace = await loadWorkspace(supabase, auth, workspaceId);
    const blockId = request.block_id ?? null;
    if (blockId) await assertBlockInWorkspace(supabase, workspaceId, blockId);

    const workspaceTitle = workspace.title || workspace.root_topic || "workspace";
    const { spec, contextCounts, fileIds } = await generateWorkspaceProofOfWorkSpec({
      supabase,
      auth,
      workspaceId,
      workspaceTitle,
      request,
      baseUrl: origin,
      blockId,
    });

    const llmInterruption = resolveProofOfWorkSchemaInterruption(
      spec,
      workspaceId,
      blockId,
      contextCounts?.proof_of_work_artifacts
    );

    return evidenceToolResult(
      {
        ...spec,
        definition: request.definition,
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

    return evidenceToolResult(
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

    const fileName = defaultProofOfWorkFileName(
      evidenceType,
      typeof args.file_name === "string" ? args.file_name : undefined
    );

    const uploaded = await uploadFileToXAI(fileName, mimeType, base64);
    const metadata =
      args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
        ? (args.metadata as Record<string, unknown>)
        : {};

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

    return evidenceToolResult(
      {
        proof_of_work: {
          ...row,
          workspace_id: row.workspace_id,
          block_id: row.block_id,
          type: row.proof_of_work_type,
        },
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

      return evidenceToolResult(
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
        model: "grok-4.3",
        instructions: buildPerformanceChatInstructions(blockId, stylePrompt),
        input: inputMessages,
        temperature: 0.6,
        maxOutputTokens: 4096,
        fetchTimeout: 120000,
      });

      if (!chatResult.success || !chatResult.text) {
        throw new Error(chatResult.error || "Failed to generate performance chat response.");
      }

      return evidenceToolResult(
        withProgressGuidance(
          {
            mode: "chat",
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
      `Generate a learning and gap analysis report for workspace "${workspace.title || workspace.root_topic}".`,
      activeFileIds,
      {
        instructions: buildPerformanceReportInstructions(blockId, storedConversionGoal, stylePrompt),
        temperature: 0.35,
        maxOutputTokens: 2500,
        fetchTimeout: 120000,
        jsonSchema: PERFORMANCE_REPORT_SCHEMA,
      }
    );

    if (!reportResult.success || !reportResult.data) {
      throw new Error(reportResult.error || "Failed to generate performance report.");
    }

    const finalized = finalizePerformanceReport(reportResult.data, storedConversionGoal, {
      title: workspace.title,
      description: workspace.description,
      notes: workspace.notes,
      root_topic: workspace.root_topic,
    });

    return evidenceToolResult(
      withProgressGuidance(
        {
          mode: "report",
          workspace_conversion_goal: finalized.workspace_conversion_goal,
          conversion_goal_source: finalized.conversion_goal_source,
          report: finalized.report,
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
        "id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, mode, overall_score, created_at, started_at, completed_at"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (auth.guest_user_id) query = query.eq("guest_user_id", auth.guest_user_id);
    else if (!auth.is_org_admin) query = query.eq("user_id", auth.user_id);

    const { data: links, error } = await query;
    if (error) throw new Error(error.message);
    return evidenceToolResult(
      { tap_links: links || [] },
      { endpoint: "list_tap_links", workspace_id: workspaceId }
    );
  }

  if (name === "create_tap_link") {
    requireScope(auth.scopes, "tap:write");
    const workspaceId = stringArg(args, "workspace_id");
    const blockId = stringArg(args, "block_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    if (!blockId) throw new Error("block_id is required.");

    const requestedMinutes = Number(args.minutes || 15);
    const minutes = requestedMinutes === 30 ? 30 : 15;
    const guestEmail = typeof args.guest_email === "string" ? args.guest_email.trim().toLowerCase() : "";
    const requestedGuestId = typeof args.guest_user_id === "string" ? args.guest_user_id : null;

    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, workspace_id, workspaces!inner(id, user_id, organization_id, guest_user_id)")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();

    if (blockError || !block) throw new Error("Block not found.");

    const workspaceRaw = (block as { workspaces: unknown }).workspaces;
    const workspace = (Array.isArray(workspaceRaw) ? workspaceRaw[0] : workspaceRaw) as {
      id: string;
      user_id: string | null;
      organization_id: string | null;
      guest_user_id: string | null;
    };
    if (!canAccessAgentWorkspace(auth, workspace)) throw new Error("Workspace not found.");

    let guestUserId = auth.guest_user_id;
    if (!guestUserId && (requestedGuestId || guestEmail)) {
      if (!auth.is_org_admin || !auth.organization_id) {
        throw new Error("Only organization admins can assign TAP links to guests.");
      }
      let guestQuery = supabase
        .from("organization_guest_users")
        .select("id, status")
        .eq("organization_id", auth.organization_id)
        .eq("status", "active");
      guestQuery = requestedGuestId ? guestQuery.eq("id", requestedGuestId) : guestQuery.eq("email", guestEmail);
      const { data: guest } = await guestQuery.single();
      if (!guest) throw new Error("Guest user not found.");
      guestUserId = guest.id;
    }

    const ownerUserId = auth.user_id || (workspace.user_id as string);
    if (!ownerUserId) throw new Error("Workspace owner is missing.");

    try {
      await getTapScoreBriefForUser(workspaceId, ownerUserId, [blockId], true, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Not authorized";
      if (message === "Workspace not found") throw new Error("Workspace not found.");
      throw new Error(message);
    }

    const privateToken = createPrivateToken();
    const { data: link, error } = await supabase
      .from("workspace_tap_sessions")
      .insert({
        workspace_id: workspaceId,
        user_id: ownerUserId,
        guest_user_id: guestUserId,
        organization_id: auth.organization_id || (workspace.organization_id as string),
        created_by_api_key_id: createdByApiKeyId(auth),
        private_token_hash: hashPrivateToken(privateToken),
        requested_duration_seconds: Math.round(minutes * 60),
        block_id: blockId,
        mode: "curious",
        focus_block_ids: [blockId],
        voice_id: "ara",
        status: "pending",
      })
      .select("id, workspace_id, block_id, status, requested_duration_seconds, focus_block_ids, created_at")
      .single();

    if (error || !link) {
      console.error("[mcp/create_tap_link] Create error:", error);
      const detail = typeof error?.message === "string" ? error.message : null;
      throw new Error(detail ? `Failed to create TAP link: ${detail}` : "Failed to create TAP link.");
    }

    const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;
    const privateUrl = buildTapScoreSessionUrl(appBase, privateToken);
    return evidenceToolResult(
      {
        tap_link: { ...link, private_url: privateUrl },
        private_url: privateUrl,
      },
      {
        endpoint: "create_tap_link",
        workspace_id: workspaceId,
        block_id: blockId,
        tap_minutes: minutes,
      }
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}