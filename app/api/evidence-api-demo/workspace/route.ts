import { NextRequest, NextResponse } from "next/server";
import { createVerificationWorkspaceFromPrompt } from "@/lib/agent-v2/create-verification-workspace";
import { requireDemoAdminSession } from "@/lib/evidence-api-demo/demo-access";
import { CUSTOM_DEMO_ID } from "@/lib/evidence-api-demo/custom-demo";
import { getDemoWorkspaceModelFile } from "@/lib/evidence-api-demo/demo-definition";
import { generateCustomDemoFromImport } from "@/lib/evidence-api-demo/generate-custom-from-import";
import { generateCustomDemoFromPrompt } from "@/lib/evidence-api-demo/generate-custom-simulation";
import {
  detectImportSource,
  type ImportSource,
} from "@/lib/evidence-api-demo/parse-import-text";
import { getDemoFromBody, parseDemoIdFromBody } from "@/lib/evidence-api-demo/resolve-demo";
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
    const access = await requireDemoAdminSession();
    if (access instanceof NextResponse) return access;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const demoId = parseDemoIdFromBody(body);
    const importText =
      typeof body.importText === "string" ? body.importText.trim() : "";
    const importSource: ImportSource =
      body.importSource === "mcp"
        ? "mcp"
        : body.importSource === "skill"
          ? "skill"
          : detectImportSource(importText);

    const demo =
      demoId === CUSTOM_DEMO_ID && importText
        ? (await generateCustomDemoFromImport(importText, importSource)).demo
        : demoId === CUSTOM_DEMO_ID
          ? await generateCustomDemoFromPrompt(
              typeof body.customPrompt === "string" ? body.customPrompt : ""
            )
          : getDemoFromBody(body);
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
      custom_definition: demo.id === CUSTOM_DEMO_ID ? demo : undefined,
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