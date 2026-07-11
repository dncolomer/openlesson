import { NextRequest, NextResponse } from "next/server";
import { parseProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import { resolveEvalDefinition } from "@/lib/agent-v2/proof-of-work-integration";
import {
  generateProofOfWorkSchemaForWorkspace,
  proofOfWorkSchemaErrorResponse,
} from "@/lib/agent-v2/proof-of-work-schema-handler";
import { requireWorkspaceOwnerSession } from "@/lib/agent-v2/workspace-session-access";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const access = await requireWorkspaceOwnerSession(workspaceId);
  if (access instanceof NextResponse) return access;

  const { plan, auth, supabase } = access;
  const definition = resolveEvalDefinition(
    typeof body.definition === "string" ? body.definition : undefined,
    plan
  );

  const request = parseProofOfWorkSchemaRequest({
    definition,
    block_id: typeof body.block_id === "string" ? body.block_id : undefined,
    integration_hints: body.integration_hints,
  });

  if (!request) {
    return NextResponse.json({ error: "definition is required" }, { status: 400 });
  }

  try {
    const result = await generateProofOfWorkSchemaForWorkspace({
      supabase,
      auth,
      workspaceId,
      plan,
      request,
      baseUrl: req.nextUrl.origin,
      validateBlock: true,
    });

    if (result instanceof NextResponse) return result;

    return NextResponse.json({
      ...result.spec,
      definition: result.definition,
      workspace_summary: result.workspaceSummary,
      context_counts: result.contextCounts,
      file_ids: result.fileIds,
    });
  } catch (error) {
    return proofOfWorkSchemaErrorResponse(error, "[workspace/proof-of-work-schema] Generation failed:");
  }
}