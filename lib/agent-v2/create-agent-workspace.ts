import type { SupabaseClient } from "@supabase/supabase-js";
import { callXaiJSON, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import { uploadFileToXAI } from "@/lib/xai-files";
import {
  fallbackConversionGoal,
  normalizeConversionGoal,
  WORKSPACE_GENERATION_CONVERSION_GOAL_RULE,
} from "./conversion-goal";
import {
  buildOpaqueConversionGoal,
  buildOpaqueGeneratedBlocks,
  buildOpaqueRootTopic,
  buildOpaqueWorkspaceNotes,
  buildOpaqueWorkspaceTitle,
  buildPrivacyMetadata,
  insertOpaqueWorkspaceBlocks,
  parseOpaqueWorkspaceCreateRequest,
  type OpaqueWorkspaceCreateRequest,
} from "./opaque-evaluation";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import type { AuthContext } from "./types";

export const CREATE_WORKSPACE_MAX_FILES = 5;
export const CREATE_WORKSPACE_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const CREATE_WORKSPACE_ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

export interface WorkspaceInitialFile {
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

export function parseWorkspaceInitialFiles(value: unknown): WorkspaceInitialFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((file): file is WorkspaceInitialFile => {
    const candidate = file as Partial<WorkspaceInitialFile>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.mime_type === "string" &&
      typeof candidate.data === "string"
    );
  });
}

export function validateWorkspaceInitialFiles(files: WorkspaceInitialFile[]): string | null {
  if (files.length > CREATE_WORKSPACE_MAX_FILES) {
    return `A workspace can start with at most ${CREATE_WORKSPACE_MAX_FILES} files`;
  }

  for (const file of files) {
    if (!CREATE_WORKSPACE_ALLOWED_MIME.has(file.mime_type)) {
      return `Unsupported file type: ${file.mime_type}`;
    }
    if (Buffer.from(file.data, "base64").length > CREATE_WORKSPACE_MAX_FILE_SIZE) {
      return `File exceeds 10 MB limit: ${file.name}`;
    }
  }

  return null;
}

async function resolveWorkspaceOwnerUserId(
  supabase: SupabaseClient,
  auth: AuthContext
): Promise<string | null> {
  if (auth.user_id) return auth.user_id;
  if (!auth.organization_id) return null;

  const { data: orgAdmin } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", auth.organization_id)
    .eq("is_org_admin", true)
    .limit(1)
    .maybeSingle();

  return orgAdmin?.id || null;
}

async function uploadWorkspaceSeedFiles(
  supabase: SupabaseClient,
  workspaceId: string,
  ownerUserId: string,
  files: WorkspaceInitialFile[]
) {
  const uploadedFiles = [];

  for (const file of files) {
    try {
      const xaiFile = await uploadFileToXAI(file.name, file.mime_type, file.data);
      const { data: fileRecord, error: fileError } = await supabase
        .from("workspace_files")
        .insert({
          workspace_id: workspaceId,
          user_id: ownerUserId,
          file_name: file.name,
          file_size: Buffer.from(file.data, "base64").length,
          mime_type: file.mime_type,
          xai_file_id: xaiFile.file_id,
        })
        .select("id, file_name, file_size, mime_type, created_at")
        .single();

      if (!fileError && fileRecord) uploadedFiles.push(fileRecord);
    } catch (error) {
      console.error("[create-agent-workspace] Initial file upload failed:", error);
    }
  }

  return uploadedFiles;
}

async function createSemanticAgentWorkspace(
  supabase: SupabaseClient,
  auth: AuthContext,
  initialPrompt: string,
  files: WorkspaceInitialFile[]
) {
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
    throw new Error("Failed to generate verification workspace");
  }

  const ownerUserId = await resolveWorkspaceOwnerUserId(supabase, auth);
  if (!ownerUserId) {
    throw new Error("No organization admin is available to own this workspace");
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
      evaluation_mode: "semantic",
    })
    .select(
      "id, title, root_topic, status, notes, conversion_goal, evaluation_mode, protocol_config, external_refs, created_at, updated_at"
    )
    .single();

  if (workspaceError || !workspace) {
    throw new Error("Failed to create workspace");
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

  await persistSkillGridPositions(
    supabase,
    skillGridNodesFromRefs(generated.data.blocks, blockIdMap)
  );

  const uploadedFiles = await uploadWorkspaceSeedFiles(supabase, workspace.id, ownerUserId, files);

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, title, description, is_start, next_block_ids, status, position_x, position_y, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  return {
    workspace,
    blocks: blocks || [],
    files: uploadedFiles,
    privacy: buildPrivacyMetadata({ evaluation_mode: "semantic", protocol_config: null, external_refs: null }),
  };
}

async function createOpaqueAgentWorkspace(
  supabase: SupabaseClient,
  auth: AuthContext,
  request: OpaqueWorkspaceCreateRequest,
  files: WorkspaceInitialFile[]
) {
  const ownerUserId = await resolveWorkspaceOwnerUserId(supabase, auth);
  if (!ownerUserId) {
    throw new Error("No organization admin is available to own this workspace");
  }

  const protocol = request.protocol;
  const workspaceTitle = buildOpaqueWorkspaceTitle(protocol);
  const conversionGoal = buildOpaqueConversionGoal(protocol);

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      user_id: ownerUserId,
      organization_id: auth.organization_id,
      guest_user_id: auth.guest_user_id,
      title: workspaceTitle,
      root_topic: buildOpaqueRootTopic(protocol),
      status: "active",
      source_type: "topic",
      description: "Opaque protocol evaluation workspace",
      notes: buildOpaqueWorkspaceNotes(protocol),
      conversion_goal: conversionGoal,
      is_agent_workspace: true,
      evaluation_mode: "opaque",
      protocol_config: protocol,
      external_refs: request.external_refs || null,
    })
    .select(
      "id, title, root_topic, status, notes, conversion_goal, evaluation_mode, protocol_config, external_refs, created_at, updated_at"
    )
    .single();

  if (workspaceError || !workspace) {
    throw new Error("Failed to create workspace");
  }

  const blockIdMap = await insertOpaqueWorkspaceBlocks(supabase, workspace.id, protocol);
  const opaqueBlocks = buildOpaqueGeneratedBlocks(protocol);
  await persistSkillGridPositions(
    supabase,
    skillGridNodesFromRefs(
      opaqueBlocks.map((block) => ({
        id: block.localId,
        title: block.title,
        description: block.description,
        is_start: block.is_start,
        next: block.next,
      })),
      blockIdMap
    )
  );

  const uploadedFiles = await uploadWorkspaceSeedFiles(supabase, workspace.id, ownerUserId, files);

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, title, description, is_start, next_block_ids, status, position_x, position_y, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  return {
    workspace,
    blocks: blocks || [],
    files: uploadedFiles,
    privacy: buildPrivacyMetadata({
      evaluation_mode: "opaque",
      protocol_config: protocol,
      external_refs: request.external_refs || null,
    }),
  };
}

export async function createAgentWorkspace(
  supabase: SupabaseClient,
  auth: AuthContext,
  body: Record<string, unknown>
) {
  const opaqueRequest = parseOpaqueWorkspaceCreateRequest(body);
  const files = parseWorkspaceInitialFiles(body.files);
  const fileError = validateWorkspaceInitialFiles(files);
  if (fileError) {
    throw new Error(fileError);
  }

  if (opaqueRequest) {
    return createOpaqueAgentWorkspace(supabase, auth, opaqueRequest, files);
  }

  const initialPrompt = typeof body.initial_prompt === "string" ? body.initial_prompt.trim() : "";
  if (!initialPrompt) {
    throw new Error("initial_prompt is required unless evaluation_mode is opaque with protocol");
  }

  return createSemanticAgentWorkspace(supabase, auth, initialPrompt, files);
}