import { NextRequest, NextResponse } from "next/server";
import { createVerificationWorkspaceFromPrompt } from "@/lib/agent-v2/create-verification-workspace";
import { requireTeamsUserSession } from "@/lib/agent-v2/workspace-session-access";
import {
  DEMO_EVAL_DEFINITION,
  DEMO_INTEGRATION_NAME,
  DEMO_WORKSPACE_MODEL_DOC,
  DEMO_WORKSPACE_PROMPT,
  getDemoWorkspaceModelFile,
} from "@/lib/evidence-api-demo/flowstack";
import {
  buildEvidenceSchemaApiPath,
  buildEvidenceUploadApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
} from "@/lib/agent-v2/evidence-integration";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const access = await requireTeamsUserSession();
    if (access instanceof NextResponse) return access;

    const origin = req.nextUrl.origin;
    const modelFile = getDemoWorkspaceModelFile();
    const { workspace, blocks, files } = await createVerificationWorkspaceFromPrompt(
      access.supabase,
      access.auth,
      DEMO_WORKSPACE_PROMPT,
      { files: [modelFile] }
    );

    const workspaceId = workspace.id as string;

    return NextResponse.json({
      workspace,
      blocks,
      files,
      demo: {
        product: "FlowStack",
        integration_name: DEMO_INTEGRATION_NAME,
        eval_definition: DEMO_EVAL_DEFINITION,
        model_doc_filename: modelFile.name,
        model_doc_preview: DEMO_WORKSPACE_MODEL_DOC.slice(0, 400),
      },
      api_paths: {
        evidence_schema: buildEvidenceSchemaApiPath(workspaceId, origin),
        evidence_upload: buildEvidenceUploadApiPath(workspaceId, origin),
        integration_skill: buildIntegrationSkillApiPath(workspaceId, origin),
        performance: buildPerformanceApiPath(workspaceId, origin),
      },
    });
  } catch (error) {
    console.error("[evidence-api-demo/workspace] Error:", error);
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