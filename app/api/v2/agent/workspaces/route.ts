import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { callXaiJSON, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import { uploadFileToXAI } from "@/lib/xai-files";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";
import {
  fallbackConversionGoal,
  normalizeConversionGoal,
  WORKSPACE_GENERATION_CONVERSION_GOAL_RULE,
} from "@/lib/agent-v2/conversion-goal";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";
import { type PlanId } from "@/lib/plans";
import { checkWorkspaceCreation, workspaceLimitErrorResponse } from "@/lib/workspace-limits";
import { loadUsageProfile } from "@/lib/usage-metrics";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

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

function parseFiles(value: unknown): InitialFile[] {
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

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  if (!auth.user_id && !auth.guest_user_id) {
    return errorResponse(403, "forbidden", "A real user or guest API key is required to create workspaces");
  }
  if (auth.guest_user_id && !auth.organization_id) {
    return errorResponse(403, "forbidden", "Guest workspace creation requires organization context");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  const initialPrompt = typeof body.initial_prompt === "string" ? body.initial_prompt.trim() : "";
  if (!initialPrompt) {
    return errorResponse(400, "validation_error", "initial_prompt is required");
  }

  if (auth.user_id) {
    const { profile, error: profileError } = await loadUsageProfile(supabase, auth.user_id);
    if (profileError || !profile) {
      return errorResponse(500, "internal_error", profileError || "Profile not found");
    }

    const workspaceCheck = await checkWorkspaceCreation(supabase, auth.user_id, {
      plan: (profile.plan || "free") as PlanId,
      is_admin: profile.is_admin ?? false,
      extra_lessons: profile.extra_lessons ?? 0,
      extra_workspaces: profile.extra_workspaces ?? 0,
      subscription_status: profile.subscription_status ?? "inactive",
      current_period_end: profile.current_period_end ?? null,
      token_tier: profile.token_tier ?? null,
      token_validity_expires_at: profile.token_validity_expires_at ?? null,
    });

    if (!workspaceCheck.allowed) {
      const payload = workspaceLimitErrorResponse(workspaceCheck);
      return errorResponse(403, "workspace_limit_reached", payload.error, payload);
    }
  }

  const files = parseFiles(body.files);
  if (files.length > MAX_FILES) {
    return errorResponse(400, "validation_error", `A workspace can start with at most ${MAX_FILES} files`);
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.mime_type)) {
      return errorResponse(400, "validation_error", `Unsupported file type: ${file.mime_type}`);
    }
    if (Buffer.from(file.data, "base64").length > MAX_FILE_SIZE) {
      return errorResponse(400, "validation_error", `File exceeds 10 MB limit: ${file.name}`);
    }
  }

  const fileContext = files.length
    ? `\nInitial files provided:\n${files.map((file) => `- ${file.name} (${file.mime_type})`).join("\n")}`
    : "";
  const generated = await callXaiJSON<GeneratedWorkspace>(
    [
      userMessage(`Create a performance learning workspace from this prompt. Break it into assessable blocks for learning verification and proof-of-work-based gap analysis.\n\nPrompt:\n${initialPrompt}${fileContext}\n\nReturn ONLY JSON:\n{\n  "title": "concise workspace title",\n  "conversion_goal": "concise success/conversion outcome for this workspace",\n  "blocks": [\n    { "id": "a", "title": "Block title", "description": "What the learner should demonstrate", "is_start": true, "next": ["b"] }\n  ]\n}\n\nRules:\n- Create 3 to 8 blocks.\n- Blocks are assessable learning/performance units.\n- Use short stable ids only for linking within this response.${WORKSPACE_GENERATION_CONVERSION_GOAL_RULE}`),
    ],
    { model: DEFAULT_MODEL, maxTokens: 1800, temperature: 0.3 }
  );

  if (!generated.success || !generated.data?.blocks?.length) {
    return errorResponse(500, "internal_error", "Failed to generate verification workspace");
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
    return errorResponse(403, "forbidden", "No organization admin is available to own this workspace");
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
    console.error("[agent/workspaces] Workspace insert error:", workspaceError);
    return errorResponse(500, "internal_error", "Failed to create workspace");
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

    if (blockError || !insertedBlock) {
      console.error("[agent/workspaces] Block insert error:", blockError);
      continue;
    }
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
    skillGridNodesFromRefs(generated.data.blocks, blockIdMap),
  );

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
    } catch (error) {
      console.error("[agent/workspaces] Initial file upload failed:", error);
    }
  }

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, title, description, is_start, next_block_ids, status, position_x, position_y, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  return NextResponse.json(
    withProofOfWorkApiResponse(
      {
        workspace,
        blocks: blocks || [],
        files: uploadedFiles,
      },
      { endpoint: "create_workspace", workspace_id: workspace.id }
    ),
    { status: 201 }
  );
}
