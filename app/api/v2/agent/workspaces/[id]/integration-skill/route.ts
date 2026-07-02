import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
} from "@/lib/agent-v2/integration-skill";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("learning_plans")
    .select("id, user_id, organization_id, guest_user_id, title, root_topic, description")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  const request = parseIntegrationSkillRequest(body);
  if (!request) {
    return errorResponse(400, "validation_error", "integration_name is required");
  }

  const blockId = request.block_id ?? null;
  if (blockId) {
    const { data: block } = await supabase
      .from("plan_nodes")
      .select("id")
      .eq("id", blockId)
      .eq("plan_id", workspaceId)
      .single();
    if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
  }

  let blocksQuery = supabase
    .from("plan_nodes")
    .select("id, title, description, is_start")
    .eq("plan_id", workspaceId)
    .order("created_at", { ascending: true });

  if (blockId) blocksQuery = blocksQuery.eq("id", blockId);

  const [{ data: blocks }, contextResult] = await Promise.all([
    blocksQuery,
    buildWorkspacePerformanceContext({
      supabase,
      auth,
      workspaceId,
      blockId,
    }).catch((error) => {
      console.error("[agent/integration-skill] Context build failed:", error);
      return null;
    }),
  ]);

  const fileIds = contextResult?.fileIds || [];
  const workspaceTitle = workspace.title || workspace.root_topic || "workspace";

  const skillResult = await callXaiResponsesWithFiles(
    buildIntegrationSkillPrompt(workspaceTitle, request.integration_name),
    fileIds,
    {
      instructions: buildIntegrationSkillInstructions(
        request,
        {
          id: workspace.id,
          title: workspace.title,
          root_topic: workspace.root_topic,
          description: workspace.description,
        },
        blocks || [],
        blockId
      ),
      temperature: 0.45,
      maxOutputTokens: 8192,
      fetchTimeout: 120000,
    }
  );

  if (!skillResult.success || !skillResult.text) {
    return errorResponse(500, "internal_error", skillResult.error || "Failed to generate integration skill");
  }

  const skillName = deriveSkillName(request.integration_name);
  const suggestedSharePath = deriveSuggestedSharePath(request.integration_name);

  return NextResponse.json({
    skill_md: skillResult.text,
    skill_name: skillName,
    suggested_share_path: suggestedSharePath,
    workspace_summary: {
      id: workspace.id,
      title: workspace.title || workspace.root_topic || "Untitled",
      root_topic: workspace.root_topic,
      block_count: blocks?.length || 0,
    },
    context_counts: contextResult?.payload.counts || null,
    file_ids: fileIds,
  });
}