import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_EVAL_DEFINITION,
  DEMO_INTEGRATION_NAME,
} from "@/lib/evidence-api-demo/flowstack";
import { generateWorkspaceEvidenceSpec } from "@/lib/agent-v2/evidence-integration";
import { parseEvidenceSchemaRequest } from "@/lib/agent-v2/evidence-schema";
import { requireWorkspaceOwnerSession } from "@/lib/agent-v2/workspace-session-access";

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

    const planId = typeof body.planId === "string" ? body.planId : "";
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const access = await requireWorkspaceOwnerSession(planId);
    if (access instanceof NextResponse) return access;

    const request =
      parseEvidenceSchemaRequest({
        definition:
          typeof body.definition === "string" && body.definition.trim()
            ? body.definition
            : DEMO_EVAL_DEFINITION,
        block_id: typeof body.block_id === "string" ? body.block_id : null,
        integration_hints: {
          tool_name: DEMO_INTEGRATION_NAME,
          partner_agent: DEMO_INTEGRATION_NAME,
          event_verbs: ["simulate_time_passage", "connect_slack", "invite_editor"],
          goals: ["trial_activation", "multidimensional_onboarding"],
        },
      }) ?? null;

    if (!request) {
      return NextResponse.json({ error: "Invalid evidence schema request" }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";

    const { spec, contextCounts, fileIds } = await generateWorkspaceEvidenceSpec({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId: planId,
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
    console.error("[evidence-api-demo/evidence-schema] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate evidence schema" },
      { status: 500 }
    );
  }
}