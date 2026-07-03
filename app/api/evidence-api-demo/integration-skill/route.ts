import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_EVAL_DEFINITION,
  DEMO_INTEGRATION_NAME,
} from "@/lib/evidence-api-demo/flowstack";
import {
  buildEvidenceSchemaRequestFromIntegration,
  generateWorkspaceEvidenceSpec,
} from "@/lib/agent-v2/evidence-integration";
import {
  buildIntegrationSkillInstructions,
  buildIntegrationSkillPrompt,
  deriveSkillName,
  deriveSuggestedSharePath,
} from "@/lib/agent-v2/integration-skill";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";
import { requireWorkspaceOwnerSession } from "@/lib/agent-v2/workspace-session-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const planId = typeof body.planId === "string" ? body.planId : "";
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const access = await requireWorkspaceOwnerSession(planId);
    if (access instanceof NextResponse) return access;

    const origin = req.nextUrl.origin;
    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";
    const prefetchEvidenceSpec = body.prefetch_evidence_spec !== false;

    const [{ data: blocks }, contextResult] = await Promise.all([
      access.supabase
        .from("plan_nodes")
        .select("id, title, description, is_start")
        .eq("plan_id", planId)
        .order("created_at", { ascending: true }),
      buildWorkspacePerformanceContext({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId: planId,
      }).catch((error) => {
        console.error("[evidence-api-demo/integration-skill] Context build failed:", error);
        return null;
      }),
    ]);

    let evidenceSpec = null;
    let evidenceSpecContextCounts = null;

    if (prefetchEvidenceSpec) {
      const evidenceSchemaRequest = buildEvidenceSchemaRequestFromIntegration(
        DEMO_EVAL_DEFINITION,
        DEMO_INTEGRATION_NAME,
        "Non-linear FlowStack trial simulator with time-gap modeling",
        null
      );

      if (evidenceSchemaRequest) {
        try {
          const evidenceSpecResult = await generateWorkspaceEvidenceSpec({
            supabase: access.supabase,
            auth: access.auth,
            workspaceId: planId,
            workspaceTitle,
            request: evidenceSchemaRequest,
            baseUrl: origin,
          });
          evidenceSpec = evidenceSpecResult.spec;
          evidenceSpecContextCounts = evidenceSpecResult.contextCounts;
        } catch (error) {
          console.error("[evidence-api-demo/integration-skill] Evidence spec prefetch failed:", error);
        }
      }
    }

    const fileIds = contextResult?.fileIds || [];

    const skillResult = await callXaiResponsesWithFiles(
      buildIntegrationSkillPrompt(workspaceTitle, DEMO_INTEGRATION_NAME),
      fileIds,
      {
        instructions: buildIntegrationSkillInstructions(
          {
            integration_name: DEMO_INTEGRATION_NAME,
            partner_description:
              "Simulates non-linear SaaS trial onboarding with branching actions and idle time gaps.",
            eval_definition: DEMO_EVAL_DEFINITION,
            base_url: origin,
            prefetch_evidence_spec: prefetchEvidenceSpec,
          },
          {
            id: planId,
            title: access.plan.title,
            root_topic: access.plan.root_topic,
            description: access.plan.description,
          },
          blocks || [],
          null,
          evidenceSpec
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
      skill_name: deriveSkillName(DEMO_INTEGRATION_NAME),
      suggested_share_path: deriveSuggestedSharePath(DEMO_INTEGRATION_NAME),
      workspace_summary: {
        id: planId,
        title: access.plan.title || access.plan.root_topic || "Untitled",
        root_topic: access.plan.root_topic,
        block_count: blocks?.length || 0,
      },
      evidence_spec: evidenceSpec,
      evidence_spec_prefetched: !!evidenceSpec,
      context_counts: contextResult?.payload.counts || evidenceSpecContextCounts || null,
      file_ids: fileIds,
    });
  } catch (error) {
    console.error("[evidence-api-demo/integration-skill] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate integration skill" },
      { status: 500 }
    );
  }
}