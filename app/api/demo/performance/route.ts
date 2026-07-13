import { NextRequest, NextResponse } from "next/server";
import { finalizePerformanceReport } from "@/lib/agent-v2/conversion-goal";
import {
  buildPerformanceChatInstructions,
  buildPerformanceReportInstructions,
  buildWorkspacePerformanceContext,
  emptyPerformanceReport,
  PERFORMANCE_REPORT_SCHEMA,
  type PerformanceReport,
} from "@/lib/agent-v2/performance-context";
import { requireDemoAdminWorkspaceSession } from "@/lib/openlesson-demo/demo-access";
import { callXaiResponses, callXaiResponsesWithFiles, DEFAULT_MODEL, type ResponsesInputMessage } from "@/lib/xai-client";

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

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const stylePrompt =
      typeof body.style_prompt === "string" ? body.style_prompt.trim() : "";
    const blockId = typeof body.block_id === "string" ? body.block_id : null;
    const orbitUiContext =
      typeof body.orbit_ui_context === "string" ? body.orbit_ui_context.trim() : "";

    const context = await buildWorkspacePerformanceContext({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId: workspaceId,
      blockId,
    });

    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";
    const storedConversionGoal = context.payload.workspace.conversion_goal;
    const contextCounts = context.payload.counts;

    if (
      contextCounts.proof_of_work_artifacts === 0 &&

      contextCounts.linked_sessions === 0 &&
      contextCounts.workspace_files === 0
    ) {
      const emptyReport = prompt
        ? null
        : finalizePerformanceReport(emptyPerformanceReport(), storedConversionGoal, {
            title: context.payload.workspace.title,
            description: context.payload.workspace.description,
            notes: context.payload.workspace.notes,
            root_topic: context.payload.workspace.root_topic,
          });

      return NextResponse.json({
        mode: prompt ? "chat" : "report",
        response: prompt
          ? stylePrompt
            ? "No evidence is attached to this workspace yet. Take a few actions in Orbit first, then ask what you should improve."
            : "No evidence is attached to this workspace yet. Take a few actions in Orbit first, then ask what to improve."
          : null,
        workspace_conversion_goal: emptyReport?.workspace_conversion_goal,
        conversion_goal_source: emptyReport?.conversion_goal_source,
        report: emptyReport?.report ?? null,
        proof_of_work_summary: contextCounts,
        file_ids: [],
      });
    }

    if (prompt) {
      const orbitContext = `You are working inside the Orbit issue-tracker demo (inbox triage, prioritization, assignment, status workflow, project scoping, Ship Sprint). Ground advice in your evidence and Orbit UI actions only. Only recommend actions that are available in the current UI snapshot — do not suggest triage when inbox unread is 0.`;

      const inputMessages: ResponsesInputMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                orbitContext,
                orbitUiContext ? `\nCurrent Orbit UI state:\n${orbitUiContext}` : "",
                `\n\n${prompt}`,
              ]
                .join("")
                .trim(),
            },
            ...context.fileIds.map((fileId) => ({ type: "input_file" as const, file_id: fileId })),
          ],
        },
      ];

      const chatResult = await callXaiResponses({
        model: DEFAULT_MODEL,
        instructions: buildPerformanceChatInstructions(blockId, stylePrompt),
        input: inputMessages,
        temperature: 0.6,
        maxOutputTokens: 2048,
        fetchTimeout: 120000,
      });

      if (!chatResult.success || !chatResult.text) {
        return NextResponse.json(
          { error: chatResult.error || "Failed to generate performance chat response" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        mode: "chat",
        response: chatResult.text,
        proof_of_work_summary: contextCounts,
        file_ids: context.fileIds,
      });
    }

    const reportPrompt = [
      `Generate a learning and gap analysis report for workspace "${workspaceTitle}".`,
      orbitUiContext
        ? `Current Orbit UI state (ground coaching in what is actually available — do not suggest triage when inbox unread is 0):\n${orbitUiContext}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const reportResult = await callXaiResponsesWithFiles<PerformanceReport>(
      reportPrompt,
      context.fileIds,
      {
        instructions: buildPerformanceReportInstructions(
          blockId,
          storedConversionGoal,
          stylePrompt
        ),
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

    const finalized = finalizePerformanceReport(reportResult.data, storedConversionGoal, {
      title: context.payload.workspace.title,
      description: context.payload.workspace.description,
      notes: context.payload.workspace.notes,
      root_topic: context.payload.workspace.root_topic,
    });

    return NextResponse.json({
      mode: "report",
      workspace_conversion_goal: finalized.workspace_conversion_goal,
      conversion_goal_source: finalized.conversion_goal_source,
      report: finalized.report,
      proof_of_work_summary: contextCounts,
      file_ids: context.fileIds,
    });
  } catch (error) {
    console.error("[demo/performance] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate performance response" },
      { status: 500 }
    );
  }
}