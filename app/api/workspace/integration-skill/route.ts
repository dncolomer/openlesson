import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  buildProofOfWorkSchemaRequestFromIntegration,
  generateWorkspaceProofOfWorkSpec,
  resolveEvalDefinition,
} from "@/lib/pow-api/proof-of-work-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
  slugifyIntegrationName,
} from "@/lib/pow-api/integration-skill";
import { buildWorkspacePerformanceContext } from "@/lib/pow-api/performance-context";
import { requireWorkspaceOwnerSession } from "@/lib/pow-api/workspace-session-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const access = await requireWorkspaceOwnerSession(workspaceId);
    if (access instanceof NextResponse) return access;

    const { plan, auth, supabase } = access;
    const origin = req.nextUrl.origin;
    const defaultIntegrationName = slugifyIntegrationName(plan.title || plan.root_topic || "workspace");

    const request = parseIntegrationSkillRequest({
      integration_name:
        typeof body.integration_name === "string" && body.integration_name.trim()
          ? body.integration_name.trim()
          : defaultIntegrationName,
      partner_description:
        typeof body.partner_description === "string" && body.partner_description.trim()
          ? body.partner_description.trim()
          : plan.description?.trim() || plan.notes?.trim() || undefined,
      eval_definition:
        typeof body.eval_definition === "string" && body.eval_definition.trim()
          ? body.eval_definition.trim()
          : undefined,
      block_id: typeof body.block_id === "string" ? body.block_id : undefined,
      base_url: typeof body.base_url === "string" ? body.base_url : origin,
      include_sections: body.include_sections,
      integration_hints: body.integration_hints,
      prefetch_proof_of_work_spec: body.prefetch_proof_of_work_spec,
    });

    if (!request) {
      return jsonError(400, "integration_name is required");
    }

    const blockId = request.block_id ?? null;
    if (blockId) {
      const { data: block } = await supabase
        .from("blocks")
        .select("id")
        .eq("id", blockId)
        .eq("workspace_id", workspaceId)
        .single();
      if (!block) {
        return jsonError(404, "Block not found in this workspace");
      }
    }

    const blocksQuery = supabase
      .from("blocks")
      .select("id, title, description, status, is_start")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    const workspaceTitle = plan.title || plan.root_topic || "workspace";
    const evalDefinition = resolveEvalDefinition(request.eval_definition, plan);

    const [{ data: blocks }, contextResult] = await Promise.all([
      blockId ? blocksQuery.eq("id", blockId) : blocksQuery,
      buildWorkspacePerformanceContext({
        supabase,
        auth,
        workspaceId: workspaceId,
        blockId,
      }).catch((error) => {
        console.error("[workspace/integration-skill] Context build failed:", error);
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
            workspaceId: workspaceId,
            workspaceTitle,
            request: proofOfWorkSchemaRequest,
            baseUrl: origin,
            blockId,
          });
          proofOfWorkSpec = proofOfWorkSpecResult.spec;
          proofOfWorkSpecContextCounts = proofOfWorkSpecResult.contextCounts;
        } catch (error) {
          console.error("[workspace/integration-skill] Proof-of-work spec prefetch failed:", error);
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
            id: plan.id,
            title: plan.title,
            root_topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspace_goal: plan.workspace_goal ?? null,
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
      return jsonError(500, skillResult.error || "Failed to generate integration skill");
    }

    return NextResponse.json({
      skill_md: skillResult.text,
      skill_name: deriveSkillName(request.integration_name),
      suggested_share_path: deriveSuggestedSharePath(request.integration_name),
      workspace_summary: {
        id: plan.id,
        title: plan.title || plan.root_topic || "Untitled",
        root_topic: plan.root_topic,
        block_count: blocks?.length || 0,
      },
      proof_of_work_spec: proofOfWorkSpec,
      proof_of_work_spec_prefetched: !!proofOfWorkSpec,
      proof_of_work_spec_api_path: proofOfWorkSpec?.proof_of_work_spec_api_path || null,
      context_counts: contextResult?.payload.counts || proofOfWorkSpecContextCounts || null,
      file_ids: fileIds,
    });
  } catch (error) {
    console.error("[workspace/integration-skill] Unhandled error:", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to generate integration skill",
    );
  }
}