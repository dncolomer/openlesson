import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { parseProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import {
  generateOpaqueWorkspaceProofOfWorkSpec,
  generateWorkspaceProofOfWorkSpec,
  parseOpaqueSchemaRequest,
  resolveProofOfWorkSchemaInterruption,
} from "@/lib/agent-v2/proof-of-work-integration";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";

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
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id, title, root_topic, evaluation_mode")
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

  const opaqueRequest = parseOpaqueSchemaRequest(body);
  const semanticRequest = opaqueRequest ? null : parseProofOfWorkSchemaRequest(body);

  if (!opaqueRequest && !semanticRequest) {
    return errorResponse(
      400,
      "validation_error",
      opaqueRequest === null && body.evaluation_mode === "opaque"
        ? "definition_ref and contract.event_verbs are required for opaque schema generation"
        : "definition is required (string describing what to evaluate)"
    );
  }

  const blockId =
    (opaqueRequest?.block_id ?? semanticRequest?.block_id) || null;

  if (blockId) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
  }

  const origin = req.nextUrl.origin;
  const workspaceTitle = workspace.title || workspace.root_topic || "workspace";

  try {
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

      return NextResponse.json(
        await withProofOfWorkApiResponse(
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
        )
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

    return NextResponse.json(
      await withProofOfWorkApiResponse(
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
      )
    );
  } catch (error) {
    console.error("[agent/proof-of-work-schema] Generation failed:", error);
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to generate proof-of-work specification"
    );
  }
}