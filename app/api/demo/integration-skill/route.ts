import { NextRequest, NextResponse } from "next/server";
import { getDemoFromBody } from "@/lib/product-demos/resolve-demo";
import {
  buildProofOfWorkSchemaRequestFromIntegration,
  generateWorkspaceProofOfWorkSpec,
} from "@/lib/agent-v2/proof-of-work-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
} from "@/lib/agent-v2/integration-skill";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";
import { requireDemoAdminWorkspaceSession } from "@/lib/product-demos/demo-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const access = await requireDemoAdminWorkspaceSession(workspaceId);
    if (access instanceof NextResponse) return access;

    const demo = getDemoFromBody(body);
    const origin = req.nextUrl.origin;
    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";
    const prefetchEvidenceSpec = body.prefetch_proof_of_work_spec !== false;

    const [{ data: blocks }, contextResult] = await Promise.all([
      access.supabase
        .from("blocks")
        .select("id, title, description, is_start")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      buildWorkspacePerformanceContext({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId: workspaceId,
      }).catch((error) => {
        console.error("[demo/integration-skill] Context build failed:", error);
        return null;
      }),
    ]);

    let proofOfWorkSpec = null;
    let proofOfWorkSpecContextCounts = null;

    if (prefetchEvidenceSpec) {
      const proofOfWorkSchemaRequest = buildProofOfWorkSchemaRequestFromIntegration(
        demo.evalDefinition,
        demo.integrationName,
        demo.integrationSkillContext,
        null
      );

      if (proofOfWorkSchemaRequest) {
        try {
          const proofOfWorkSpecResult = await generateWorkspaceProofOfWorkSpec({
            supabase: access.supabase,
            auth: access.auth,
            workspaceId: workspaceId,
            workspaceTitle,
            request: proofOfWorkSchemaRequest,
            baseUrl: origin,
          });
          proofOfWorkSpec = proofOfWorkSpecResult.spec;
          proofOfWorkSpecContextCounts = proofOfWorkSpecResult.contextCounts;
        } catch (error) {
          console.error("[demo/integration-skill] Proof-of-work spec prefetch failed:", error);
        }
      }
    }

    const fileIds = contextResult?.fileIds || [];

    const skillResult = await callXaiResponsesWithFiles(
      buildIntegrationSkillPrompt(workspaceTitle, demo.integrationName),
      fileIds,
      {
        instructions: buildIntegrationSkillInstructions(
          {
            integration_name: demo.integrationName,
            partner_description: demo.partnerDescription,
            eval_definition: demo.evalDefinition,
            base_url: origin,
            prefetch_proof_of_work_spec: prefetchEvidenceSpec,
          },
          {
            id: workspaceId,
            title: access.plan.title,
            root_topic: access.plan.root_topic,
            description: access.plan.description,
          },
          blocks || [],
          null,
          proofOfWorkSpec
        ),
        temperature: 0.45,
        maxOutputTokens: 8192,
        fetchTimeout: 120000,
      }
    );

    if (!skillResult.success || !skillResult.text) {
      return NextResponse.json(
        { error: skillResult.error || "Failed to generate integration skill" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      skill_md: skillResult.text,
      skill_name: deriveSkillName(demo.integrationName),
      suggested_share_path: deriveSuggestedSharePath(demo.integrationName),
      workspace_summary: {
        id: workspaceId,
        title: access.plan.title || access.plan.root_topic || "Untitled",
        root_topic: access.plan.root_topic,
        block_count: blocks?.length || 0,
      },
      proof_of_work_spec: proofOfWorkSpec,
      proof_of_work_spec_prefetched: !!proofOfWorkSpec,
      context_counts: contextResult?.payload.counts || proofOfWorkSpecContextCounts || null,
      file_ids: fileIds,
    });
  } catch (error) {
    console.error("[demo/integration-skill] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate integration skill" },
      { status: 500 }
    );
  }
}