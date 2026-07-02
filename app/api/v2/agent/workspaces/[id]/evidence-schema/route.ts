import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import {
  buildEvidenceSchemaInstructions,
  buildEvidenceSchemaPrompt,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
  parseEvidenceSchemaRequest,
  type EvidenceEvalSchemaResult,
} from "@/lib/agent-v2/evidence-schema";
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
    .select("id, user_id, organization_id, guest_user_id, title, root_topic")
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

  const request = parseEvidenceSchemaRequest(body);
  if (!request) {
    return errorResponse(400, "validation_error", "definition is required (string describing what to evaluate)");
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

  let context;
  try {
    context = await buildWorkspacePerformanceContext({
      supabase,
      auth,
      workspaceId,
      blockId,
    });
  } catch (error) {
    console.error("[agent/evidence-schema] Context build failed:", error);
    return errorResponse(500, "internal_error", "Failed to prepare workspace context");
  }

  const workspaceTitle = workspace.title || workspace.root_topic || "workspace";
  const schemaResult = await callXaiResponsesWithFiles<EvidenceEvalSchemaResult>(
    buildEvidenceSchemaPrompt(workspaceTitle),
    context.fileIds,
    {
      instructions: buildEvidenceSchemaInstructions(request, blockId),
      temperature: 0.25,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
      jsonSchema: EVIDENCE_EVAL_SCHEMA_OUTPUT,
    }
  );

  if (!schemaResult.success || !schemaResult.data) {
    return errorResponse(500, "internal_error", schemaResult.error || "Failed to generate evidence schema");
  }

  return NextResponse.json({
    ...schemaResult.data,
    workspace_id: workspaceId,
    block_id: blockId,
    definition: request.definition,
    workspace_summary: {
      id: workspace.id,
      title: workspace.title,
      root_topic: workspace.root_topic,
    },
    context_counts: context.payload.counts,
    file_ids: context.fileIds,
  });
}