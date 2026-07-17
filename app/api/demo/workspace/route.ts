import { NextRequest, NextResponse } from "next/server";
import { createVerificationWorkspaceFromPrompt } from "@/lib/agent-v2/create-verification-workspace";
import { requireDemoAdminSession } from "@/lib/product-demos/demo-access";
import { getDemoWorkspaceModelFile } from "@/lib/product-demos/demo-definition";
import { getDemoFromBody } from "@/lib/product-demos/resolve-demo";
import {
  buildProofOfWorkSchemaApiPath,
  buildProofOfWorkUploadApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
} from "@/lib/agent-v2/proof-of-work-integration";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const access = await requireDemoAdminSession();
    if (access instanceof NextResponse) return access;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const demo = getDemoFromBody(body);
    const origin = req.nextUrl.origin;
    const modelFile = getDemoWorkspaceModelFile(demo);
    const { workspace, blocks, files } = await createVerificationWorkspaceFromPrompt(
      access.supabase,
      access.auth,
      demo.workspacePrompt,
      {
        files: [modelFile],
        description: demo.workspaceDescription,
        isAgentSession: false,
      }
    );

    const workspaceId = workspace.id as string;

    return NextResponse.json({
      workspace,
      blocks,
      files,
      demo: {
        id: demo.id,
        product: demo.productName,
        integration_name: demo.integrationName,
        eval_definition: demo.evalDefinition,
        model_doc_filename: modelFile.name,
        model_doc_preview: demo.modelDoc.slice(0, 400),
      },
      api_paths: {
        evidence_schema: buildProofOfWorkSchemaApiPath(workspaceId, origin),
        proof_of_work_upload: buildProofOfWorkUploadApiPath(workspaceId, origin),
        integration_skill: buildIntegrationSkillApiPath(workspaceId, origin),
        performance: buildPerformanceApiPath(workspaceId, origin),
      },
    });
  } catch (error) {
    console.error("[demo/workspace] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create demo workspace";
    const hint =
      message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "Set SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the dev server."
        : message.includes("XAI_API_KEY")
          ? "Set XAI_API_KEY in .env.local and restart the dev server."
          : undefined;
    return NextResponse.json({ error: message, hint }, { status: 500 });
  }
}