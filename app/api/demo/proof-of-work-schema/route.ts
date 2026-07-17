import { NextRequest, NextResponse } from "next/server";
import { getDemoFromBody } from "@/lib/product-demos/resolve-demo";
import { parseProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import {
  generateProofOfWorkSchemaForWorkspace,
  proofOfWorkSchemaErrorResponse,
} from "@/lib/agent-v2/proof-of-work-schema-handler";
import { requireDemoAdminWorkspaceSession } from "@/lib/product-demos/demo-access";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
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

  const request =
    parseProofOfWorkSchemaRequest({
      definition:
        typeof body.definition === "string" && body.definition.trim()
          ? body.definition
          : demo.evalDefinition,
      block_id: typeof body.block_id === "string" ? body.block_id : null,
      integration_hints: {
        tool_name: demo.integrationName,
        partner_agent: demo.integrationName,
        event_verbs: demo.integrationHints.event_verbs,
        goals: demo.integrationHints.goals,
      },
    }) ?? null;

  if (!request) {
    return NextResponse.json({ error: "Invalid evidence schema request" }, { status: 400 });
  }

  try {
    const result = await generateProofOfWorkSchemaForWorkspace({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId,
      plan: access.plan,
      request,
      baseUrl: req.nextUrl.origin,
      validateBlock: true,
    });

    if (result instanceof NextResponse) return result;

    return NextResponse.json({
      spec: result.spec,
      context_counts: result.contextCounts,
      file_ids: result.fileIds,
    });
  } catch (error) {
    return proofOfWorkSchemaErrorResponse(error, "[demo/proof-of-work-schema] Error:");
  }
}