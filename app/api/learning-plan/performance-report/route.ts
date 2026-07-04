import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizePerformanceReport } from "@/lib/agent-v2/conversion-goal";
import {
  buildPerformanceReportInstructions,
  buildWorkspacePerformanceContext,
  emptyPerformanceReport,
  PERFORMANCE_REPORT_SCHEMA,
  type PerformanceReport,
} from "@/lib/agent-v2/performance-context";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

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

    const { planId } = await req.json();
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const { data: plan } = await supabase
      .from("learning_plans")
      .select("id, user_id, title, root_topic, description, notes, conversion_goal")
      .eq("id", planId)
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
      workspaceId: planId,
    });

    if (
      context.payload.counts.evidence_artifacts === 0 &&
      context.payload.counts.tap_sessions === 0 &&
      context.payload.counts.linked_sessions === 0 &&
      context.payload.counts.plan_files === 0
    ) {
      return NextResponse.json({
        error: "No performance evidence yet. Complete sessions, upload evidence, or run a TAP block first.",
      }, { status: 400 });
    }

    const reportResult = await callXaiResponsesWithFiles<PerformanceReport>(
      `Generate a learning and gap analysis report for workspace "${plan.title || plan.root_topic}".`,
      context.fileIds,
      {
        instructions: buildPerformanceReportInstructions(null, plan.conversion_goal),
        temperature: 0.35,
        maxOutputTokens: 2500,
        fetchTimeout: 120000,
        jsonSchema: PERFORMANCE_REPORT_SCHEMA,
      },
    );

    if (!reportResult.success || !reportResult.data) {
      return NextResponse.json({ error: reportResult.error || "Failed to generate report" }, { status: 502 });
    }

    const finalized = finalizePerformanceReport(reportResult.data, plan.conversion_goal, {
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