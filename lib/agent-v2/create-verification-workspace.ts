import type { SupabaseClient } from "@supabase/supabase-js";
import { callXaiJSON, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import { uploadFileToXAI } from "@/lib/xai-files";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import {
  fallbackConversionGoal,
  normalizeConversionGoal,
  WORKSPACE_GENERATION_CONVERSION_GOAL_RULE,
} from "./conversion-goal";
import type { AuthContext } from "./types";

export interface WorkspaceInitialFile {
  name: string;
  mime_type: string;
  data: string;
}

export interface UploadedPlanFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
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

export async function createVerificationWorkspaceFromPrompt(
  supabase: SupabaseClient,
  auth: AuthContext,
  initialPrompt: string,
  options?: {
    files?: WorkspaceInitialFile[];
    description?: string;
    isAgentSession?: boolean;
  }
): Promise<{
  workspace: Record<string, unknown>;
  blocks: Record<string, unknown>[];
  files: UploadedPlanFile[];
}> {
  const files = options?.files ?? [];
  const fileContext = files.length
    ? `\nInitial files provided:\n${files.map((file) => `- ${file.name} (${file.mime_type})`).join("\n")}`
    : "";

  const generated = await callXaiJSON<GeneratedWorkspace>(
    [
      userMessage(
        `Create a performance learning workspace from this prompt. Break it into assessable blocks for learning verification and evidence-based gap analysis.\n\nPrompt:\n${initialPrompt}${fileContext}\n\nReturn ONLY JSON:\n{\n  "title": "concise workspace title",\n  "conversion_goal": "concise success/conversion outcome for this workspace",\n  "blocks": [\n    { "id": "a", "title": "Block title", "description": "What the learner should demonstrate", "is_start": true, "next": ["b"] }\n  ]\n}\n\nRules:\n- Create 3 to 6 blocks.\n- Blocks are assessable learning/performance units.\n- Use short stable ids only for linking within this response.${WORKSPACE_GENERATION_CONVERSION_GOAL_RULE}`
      ),
    ],
    { model: DEFAULT_MODEL, maxTokens: 1800, temperature: 0.3 }
  );

  if (!generated.success || !generated.data?.blocks?.length) {
    throw new Error("Failed to generate verification workspace");
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
    throw new Error("No user available to own this workspace");
  }

  const workspaceTitle = generated.data.title || "Verification Workspace";
  const workspaceDescription =
    options?.description || "Verification workspace for learning and performance assessment";
  const conversionGoal =
    normalizeConversionGoal(generated.data.conversion_goal) ||
    fallbackConversionGoal({
      title: workspaceTitle,
      description: workspaceDescription,
      notes: initialPrompt,
      root_topic: initialPrompt.slice(0, 160),
    });

  const { data: workspace, error: workspaceError } = await supabase
    .from("learning_plans")
    .insert({
      user_id: ownerUserId,
      organization_id: auth.organization_id,
      guest_user_id: auth.guest_user_id,
      title: workspaceTitle,
      root_topic: initialPrompt.slice(0, 160),
      status: "active",
      source_type: "topic",
      notes: initialPrompt,
      description: workspaceDescription,
      conversion_goal: conversionGoal,
      is_agent_session: options?.isAgentSession ?? true,
    })
    .select("id, title, root_topic, status, notes, description, conversion_goal, created_at, updated_at")
    .single();

  if (workspaceError || !workspace) {
    console.error("[create-verification-workspace] Workspace insert error:", workspaceError);
    throw new Error(workspaceError?.message || "Failed to create workspace");
  }

  const blockIdMap = new Map<string, string>();
  for (const block of generated.data.blocks) {
    const { data: insertedBlock, error: blockError } = await supabase
      .from("plan_nodes")
      .insert({
        plan_id: workspace.id,
        title: block.title,
        description: block.description || "",
        is_start: block.is_start === true,
        next_node_ids: [],
        status: "available",
      })
      .select("id, title, description, is_start")
      .single();

    if (blockError || !insertedBlock) continue;
    blockIdMap.set(block.id, insertedBlock.id);
  }

  for (const block of generated.data.blocks) {
    const dbId = blockIdMap.get(block.id);
    if (!dbId || !Array.isArray(block.next)) continue;
    const nextIds = block.next.map((id) => blockIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (nextIds.length) {
      await supabase.from("plan_nodes").update({ next_node_ids: nextIds }).eq("id", dbId);
    }
  }

  await persistSkillGridPositions(supabase, skillGridNodesFromRefs(generated.data.blocks, blockIdMap));

  const uploadedFiles: UploadedPlanFile[] = [];
  for (const file of files) {
    try {
      const xaiFile = await uploadFileToXAI(file.name, file.mime_type, file.data);
      const { data: fileRecord, error: fileError } = await supabase
        .from("plan_files")
        .insert({
          plan_id: workspace.id,
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
      console.error("[create-verification-workspace] Initial file upload failed:", error);
    }
  }

  const { data: blocks } = await supabase
    .from("plan_nodes")
    .select("id, title, description, is_start, next_node_ids, status, created_at")
    .eq("plan_id", workspace.id)
    .order("created_at", { ascending: true });

  return { workspace, blocks: blocks || [], files: uploadedFiles };
}