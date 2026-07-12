import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizePerformanceReport } from "@/lib/agent-v2/conversion-goal";
import { generateWorkspacePerformanceReport } from "@/lib/agent-v2/generate-performance-report";
import { buildWorkspacePerformanceContext } from "@/lib/agent-v2/performance-context";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const { data: plan } = await supabase
      .from("workspaces")
      .select("id, user_id, title, root_topic, description, notes, conversion_goal")
      .eq("id", workspaceId)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const context = await buildWorkspacePerformanceContext({
      supabase,
      auth: {
        user_id: user.id,
        guest_user_id: null,
        organization_id: null,
        is_org_admin: false,
        key_id: "web",
        scopes: ["workspaces:read"],
      },
      workspaceId: workspaceId,
    });

    if (
      context.payload.counts.proof_of_work_artifacts === 0 &&
      context.payload.counts.linked_sessions === 0 &&
      context.payload.counts.workspace_files === 0
    ) {
      return NextResponse.json({
        error: "No performance proof of work yet. Complete sessions, upload proof of work, or run a TAP block first.",
      }, { status: 400 });
    }

    const generation = await generateWorkspacePerformanceReport({
      workspaceId,
      workspaceTitle: plan.title,
      workspaceRootTopic: plan.root_topic,
      storedConversionGoal: plan.conversion_goal,
      fileIds: context.fileIds,
    });

    if (!generation.success || !generation.data) {
      return NextResponse.json(
        {
          error: generation.error || "Failed to generate report",
          code: generation.code || "performance_report_generation_failed",
        },
        { status: 502 },
      );
    }

    const finalized = finalizePerformanceReport(generation.data, plan.conversion_goal, {
      title: plan.title,
      description: plan.description,
      notes: plan.notes,
      root_topic: plan.root_topic,
    });

    return NextResponse.json({ report: finalized.report });
  } catch (error) {
    console.error("[performance-report] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}