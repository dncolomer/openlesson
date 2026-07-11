import { NextRequest, NextResponse } from "next/server";
import { parseProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import {
  generateWorkspaceProofOfWorkSpec,
  resolveEvalDefinition,
} from "@/lib/agent-v2/proof-of-work-integration";
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

  const blockId = request.block_id ?? null;
  if (blockId) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!block) {
      return NextResponse.json({ error: "Block not found in this workspace" }, { status: 404 });
    }
  }

  const origin = req.nextUrl.origin;
  const workspaceTitle = plan.title || plan.root_topic || "workspace";

  try {
    const { spec, contextCounts, fileIds } = await generateWorkspaceProofOfWorkSpec({
      supabase,
      auth,
      workspaceId: workspaceId,
      workspaceTitle,
      request,
      baseUrl: origin,
      blockId,
    });

    return NextResponse.json({
      ...spec,
      definition: request.definition,
      workspace_summary: {
        id: plan.id,
        title: plan.title,
        root_topic: plan.root_topic,
      },
      context_counts: contextCounts,
      file_ids: fileIds,
    });
  } catch (error) {
    console.error("[workspace/proof-of-work-schema] Generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proof-of-work specification" },
      { status: 500 }
    );
  }
}