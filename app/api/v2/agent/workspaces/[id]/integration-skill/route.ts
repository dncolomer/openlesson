import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import {
  buildProofOfWorkSchemaRequestFromIntegration,
  generateWorkspaceProofOfWorkSpec,
  resolveEvalDefinition,
} from "@/lib/agent-v2/proof-of-work-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
} from "@/lib/agent-v2/integration-skill";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 180;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const result = await authenticateRequest(req, "workspaces:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;
    const { id: workspaceId } = await params;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, conversion_goal")
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
        .from("blocks")
        .select("id")
        .eq("id", blockId)
        .eq("workspace_id", workspaceId)
        .single();
      if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
    }

    let blocksQuery = supabase
      .from("blocks")
      .select("id, title, description, is_start")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (blockId) blocksQuery = blocksQuery.eq("id", blockId);

    const origin = req.nextUrl.origin;
    const workspaceTitle = workspace.title || workspace.root_topic || "workspace";
    const evalDefinition = resolveEvalDefinition(request.eval_definition, workspace);

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

    let proofOfWorkSpec = null;
    let proofOfWorkSpecContextCounts = null;

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
          proofOfWorkSpecContextCounts = proofOfWorkSpecResult.contextCounts;
        } catch (error) {
          console.error("[agent/integration-skill] Proof-of-work spec prefetch failed:", error);
        }
      }
    }

    const fileIds = contextResult?.fileIds || [];

    const skillResult = await callXaiResponsesWithFiles(
      buildIntegrationSkillPrompt(workspaceTitle, request.integration_name),
      fileIds,
      {
        instructions: buildIntegrationSkillInstructions(
          { ...request, eval_definition: evalDefinition, base_url: request.base_url || origin },
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
      return errorResponse(500, "internal_error", skillResult.error || "Failed to generate integration skill");
    }

    const contextCounts = contextResult?.payload.counts || proofOfWorkSpecContextCounts || null;

    return NextResponse.json(
      await withProofOfWorkApiResponse(
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
          proof_of_work_spec_api_path: proofOfWorkSpec?.proof_of_work_spec_api_path || null,
          context_counts: contextCounts,
          file_ids: fileIds,
        },
        {
          endpoint: "generate_integration_skill",
          workspace_id: workspaceId,
          block_id: blockId,
          proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
          workspace_title: workspace.title || workspace.root_topic || null,
          conversion_goal: workspace.conversion_goal,
          artifact_summary: `Integration skill generated for ${request.integration_name}`,
        }
      )
    );
  } catch (error) {
    console.error("[agent/integration-skill] Unhandled error:", error);
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to generate integration skill"
    );
  }
}