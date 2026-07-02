import { NextRequest, NextResponse } from "next/server";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
  parseIntegrationSkillRequest,
  slugifyIntegrationName,
} from "@/lib/agent-v2/integration-skill";
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
  const origin = req.nextUrl.origin;
  const defaultIntegrationName = slugifyIntegrationName(plan.title || plan.root_topic || "workspace");

  const request = parseIntegrationSkillRequest({
    integration_name:
      typeof body.integration_name === "string" && body.integration_name.trim()
        ? body.integration_name.trim()
        : defaultIntegrationName,
    partner_description:
      typeof body.partner_description === "string" && body.partner_description.trim()
        ? body.partner_description.trim()
        : plan.description?.trim() || plan.notes?.trim() || undefined,
    block_id: typeof body.block_id === "string" ? body.block_id : undefined,
    base_url: typeof body.base_url === "string" ? body.base_url : origin,
    include_sections: body.include_sections,
  });

  if (!request) {
    return NextResponse.json({ error: "integration_name is required" }, { status: 400 });
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

  const blocksQuery = supabase
    .from("plan_nodes")
    .select("id, title, description, is_start")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  const [{ data: blocks }, contextResult] = await Promise.all([
    blockId ? blocksQuery.eq("id", blockId) : blocksQuery,
    buildWorkspacePerformanceContext({
      supabase,
      auth,
      workspaceId: planId,
      blockId,
    }).catch((error) => {
      console.error("[learning-plan/integration-skill] Context build failed:", error);
      return null;
    }),
  ]);

  const fileIds = contextResult?.fileIds || [];
  const workspaceTitle = plan.title || plan.root_topic || "workspace";

  const skillResult = await callXaiResponsesWithFiles(
    buildIntegrationSkillPrompt(workspaceTitle, request.integration_name),
    fileIds,
    {
      instructions: buildIntegrationSkillInstructions(
        request,
        {
          id: plan.id,
          title: plan.title,
          root_topic: plan.root_topic,
          description: plan.description,
        },
        blocks || [],
        blockId
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
    skill_name: deriveSkillName(request.integration_name),
    suggested_share_path: deriveSuggestedSharePath(request.integration_name),
    workspace_summary: {
      id: plan.id,
      title: plan.title || plan.root_topic || "Untitled",
      root_topic: plan.root_topic,
      block_count: blocks?.length || 0,
    },
    context_counts: contextResult?.payload.counts || null,
    file_ids: fileIds,
  });
}