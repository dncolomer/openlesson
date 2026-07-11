import { NextRequest, NextResponse } from "next/server";
import { getDemoFromBody } from "@/lib/openlesson-demo/resolve-demo";
import { generateWorkspaceProofOfWorkSpec } from "@/lib/agent-v2/proof-of-work-integration";
import { parseProofOfWorkSchemaRequest } from "@/lib/agent-v2/proof-of-work-schema";
import { requireDemoAdminWorkspaceSession } from "@/lib/openlesson-demo/demo-access";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const origin = req.nextUrl.origin;
    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";

    const { spec, contextCounts, fileIds } = await generateWorkspaceProofOfWorkSpec({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId: workspaceId,
      workspaceTitle,
      request,
      baseUrl: origin,
      blockId: request.block_id,
    });

    return NextResponse.json({
      spec,
      context_counts: contextCounts,
      file_ids: fileIds,
    });
  } catch (error) {
    console.error("[demo/proof-of-work-schema] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate evidence schema" },
      { status: 500 }
    );
  }
}