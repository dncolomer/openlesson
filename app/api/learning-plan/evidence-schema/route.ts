import { NextRequest, NextResponse } from "next/server";
import { parseEvidenceSchemaRequest } from "@/lib/agent-v2/evidence-schema";
import {
  generateWorkspaceEvidenceSpec,
  resolveEvalDefinition,
} from "@/lib/agent-v2/evidence-integration";
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

  const planId = typeof body.planId === "string" ? body.planId : "";
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const access = await requireWorkspaceOwnerSession(planId);
  if (access instanceof NextResponse) return access;

  const { plan, auth, supabase } = access;
  const definition = resolveEvalDefinition(
    typeof body.definition === "string" ? body.definition : undefined,
    plan
  );

  const request = parseEvidenceSchemaRequest({
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
      .from("plan_nodes")
      .select("id")
      .eq("id", blockId)
      .eq("plan_id", planId)
      .single();
    if (!block) {
      return NextResponse.json({ error: "Block not found in this workspace" }, { status: 404 });
    }
  }

  const origin = req.nextUrl.origin;
  const workspaceTitle = plan.title || plan.root_topic || "workspace";

  try {
    const { spec, contextCounts, fileIds } = await generateWorkspaceEvidenceSpec({
      supabase,
      auth,
      workspaceId: planId,
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
    console.error("[learning-plan/evidence-schema] Generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate evidence specification" },
      { status: 500 }
    );
  }
}