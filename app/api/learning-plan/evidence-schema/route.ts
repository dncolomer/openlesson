import { NextRequest, NextResponse } from "next/server";
import {
  buildEvidenceSchemaInstructions,
  buildEvidenceSchemaPrompt,
  EVIDENCE_EVAL_SCHEMA_OUTPUT,
  parseEvidenceSchemaRequest,
  type EvidenceEvalSchemaResult,
} from "@/lib/agent-v2/evidence-schema";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";
import { requireWorkspaceOwnerSession } from "@/lib/agent-v2/workspace-session-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

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
  const definition =
    typeof body.definition === "string" && body.definition.trim()
      ? body.definition.trim()
      : plan.notes?.trim() || plan.description?.trim() || plan.root_topic?.trim() || plan.title?.trim() || "";

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

  let context;
  try {
    context = await buildWorkspacePerformanceContext({
      supabase,
      auth,
      workspaceId: planId,
      blockId,
    });
  } catch (error) {
    console.error("[learning-plan/evidence-schema] Context build failed:", error);
    return NextResponse.json({ error: "Failed to prepare workspace context" }, { status: 500 });
  }

  const workspaceTitle = plan.title || plan.root_topic || "workspace";
  const schemaResult = await callXaiResponsesWithFiles<EvidenceEvalSchemaResult>(
    buildEvidenceSchemaPrompt(workspaceTitle),
    context.fileIds,
    {
      instructions: buildEvidenceSchemaInstructions(request, blockId),
      temperature: 0.25,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
      jsonSchema: EVIDENCE_EVAL_SCHEMA_OUTPUT,
    }
  );

  if (!schemaResult.success || !schemaResult.data) {
    return NextResponse.json(
      { error: schemaResult.error || "Failed to generate evidence schema" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...schemaResult.data,
    workspace_id: planId,
    block_id: blockId,
    definition: request.definition,
    workspace_summary: {
      id: plan.id,
      title: plan.title,
      root_topic: plan.root_topic,
    },
    context_counts: context.payload.counts,
    file_ids: context.fileIds,
  });
}