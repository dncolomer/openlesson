import { NextRequest, NextResponse } from "next/server";
import {
  buildPerformanceReportInstructions,
  buildWorkspacePerformanceContext,
  type PerformanceReport,
} from "@/lib/agent-v2/performance-context";
import { requireWorkspaceOwnerSession } from "@/lib/agent-v2/workspace-session-access";
import { callXaiResponsesWithFiles } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

const PERFORMANCE_REPORT_SCHEMA = {
  name: "workspace_performance_report",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      growth_areas: { type: "array", items: { type: "string" } },
      gap_analysis: {
        type: "object",
        properties: {
          summary: { type: "string" },
          gaps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                evidence: { type: "string" },
                severity: { type: "string", enum: ["low", "medium", "high"] },
                suggested_repair: { type: "string" },
              },
              required: ["title", "evidence", "severity", "suggested_repair"],
              additionalProperties: false,
            },
          },
          next_practice: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "gaps", "next_practice"],
        additionalProperties: false,
      },
      suggestions: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["emerging", "developing", "clear", "well-connected"] },
    },
    required: ["summary", "strengths", "growth_areas", "gap_analysis", "suggestions", "confidence"],
    additionalProperties: false,
  },
};

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

    const blockId = typeof body.block_id === "string" ? body.block_id : null;

    const context = await buildWorkspacePerformanceContext({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId: planId,
      blockId,
    });

    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";

    const reportResult = await callXaiResponsesWithFiles<PerformanceReport>(
      `Generate a learning and gap analysis report for workspace "${workspaceTitle}".`,
      context.fileIds,
      {
        instructions: buildPerformanceReportInstructions(blockId),
        temperature: 0.35,
        maxOutputTokens: 2500,
        fetchTimeout: 120000,
        jsonSchema: PERFORMANCE_REPORT_SCHEMA,
      }
    );

    if (!reportResult.success || !reportResult.data) {
      return NextResponse.json(
        { error: reportResult.error || "Failed to generate performance report" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mode: "report",
      report: reportResult.data,
      evidence_summary: context.payload.counts,
      file_ids: context.fileIds,
    });
  } catch (error) {
    console.error("[evidence-api-demo/performance] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate performance report" },
      { status: 500 }
    );
  }
}