import { NextRequest, NextResponse } from "next/server";
import { setWorkspaceArchived } from "@/lib/workspace-archive";
import { requireDemoAdminWorkspaceSession } from "@/lib/evidence-api-demo/demo-access";

export const runtime = "nodejs";

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

    const access = await requireDemoAdminWorkspaceSession(planId);
    if (access instanceof NextResponse) return access;

    const workspace = await setWorkspaceArchived(access.supabase, planId, access.userId, true);

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        status: workspace.status,
        archived_at: workspace.archived_at,
        title: workspace.title || workspace.root_topic,
      },
    });
  } catch (error) {
    console.error("[evidence-api-demo/archive] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive workspace" },
      { status: 500 }
    );
  }
}