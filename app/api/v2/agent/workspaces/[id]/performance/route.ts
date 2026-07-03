import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { finalizePerformanceReport } from "@/lib/agent-v2/conversion-goal";
import {
  buildPerformanceChatInstructions,
  buildPerformanceReportInstructions,
  buildWorkspacePerformanceContext,
  emptyPerformanceReport,
  PERFORMANCE_REPORT_SCHEMA,
  type PerformanceConversationMessage,
  type PerformanceReport,
} from "@/lib/agent-v2/performance-context";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { callXaiResponses, callXaiResponsesWithFiles, type ResponsesInputMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

function parseConversationHistory(value: unknown): PerformanceConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is PerformanceConversationMessage => {
      const item = entry as Partial<PerformanceConversationMessage>;
      return (item.role === "user" || item.role === "assistant") && typeof item.content === "string";
    })
    .map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, 8000),
    }))
    .slice(-12);
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("learning_plans")
    .select("id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, conversion_goal")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const conversationHistory = parseConversationHistory(body.conversation_history);
  const persistedFileIds = Array.isArray(body.file_ids)
    ? body.file_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (blockId) {
    const { data: block } = await supabase
      .from("plan_nodes")
      .select("id")
      .eq("id", blockId)
      .eq("plan_id", workspaceId)
      .single();
    if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
  }

  let activeFileIds = persistedFileIds;
  let contextCounts = null;
  let performanceContext = null;

  if (activeFileIds.length === 0) {
    try {
      const context = await buildWorkspacePerformanceContext({
        supabase,
        auth,
        workspaceId,
        blockId,
      });
      activeFileIds = context.fileIds;
      contextCounts = context.payload.counts;
      performanceContext = context.payload;

      if (
        context.payload.counts.evidence_artifacts === 0 &&
        context.payload.counts.tap_sessions === 0 &&
        context.payload.counts.linked_sessions === 0 &&
        context.payload.counts.plan_files === 0
      ) {
        const emptyReport = prompt
          ? null
          : finalizePerformanceReport(emptyPerformanceReport(), workspace.conversion_goal, {
              title: workspace.title,
              description: workspace.description,
              notes: workspace.notes,
              root_topic: workspace.root_topic,
            });

        return NextResponse.json({
          mode: prompt ? "chat" : "report",
          response: prompt
            ? "No performance evidence is attached to this workspace yet. Upload tool usage, screenshots, video, or EEG via POST /evidence, complete a Think Aloud Protocol (TAP) session, or link session data before asking detailed questions."
            : null,
          report: emptyReport?.report ?? null,
          workspace_conversion_goal: emptyReport?.workspace_conversion_goal,
          conversion_goal_source: emptyReport?.conversion_goal_source,
          evidence_summary: contextCounts,
          file_ids: [],
        });
      }
    } catch (error) {
      console.error("[agent/performance] Context build failed:", error);
      return errorResponse(500, "internal_error", "Failed to prepare workspace performance context");
    }
  }

  if (prompt) {
    const inputMessages: ResponsesInputMessage[] = conversationHistory.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    inputMessages.push({
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        ...activeFileIds.map((fileId) => ({ type: "input_file" as const, file_id: fileId })),
      ],
    });

    const chatResult = await callXaiResponses({
      model: "grok-4.3",
      instructions: buildPerformanceChatInstructions(blockId),
      input: inputMessages,
      temperature: 0.6,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
    });

    if (!chatResult.success || !chatResult.text) {
      return errorResponse(500, "internal_error", chatResult.error || "Failed to generate performance response");
    }

    return NextResponse.json({
      mode: "chat",
      response: chatResult.text,
      evidence_summary: contextCounts,
      file_ids: activeFileIds,
    });
  }

  const storedConversionGoal =
    performanceContext?.workspace.conversion_goal ?? workspace.conversion_goal;

  const reportResult = await callXaiResponsesWithFiles<PerformanceReport>(
    `Generate a learning and gap analysis report for workspace "${workspace.title || workspace.root_topic}".`,
    activeFileIds,
    {
      instructions: buildPerformanceReportInstructions(blockId, storedConversionGoal),
      temperature: 0.35,
      maxOutputTokens: 2500,
      fetchTimeout: 120000,
      jsonSchema: PERFORMANCE_REPORT_SCHEMA,
    }
  );

  if (!reportResult.success || !reportResult.data) {
    return errorResponse(500, "internal_error", reportResult.error || "Failed to generate performance report");
  }

  const finalized = finalizePerformanceReport(reportResult.data, storedConversionGoal, {
    title: workspace.title,
    description: workspace.description,
    notes: workspace.notes,
    root_topic: workspace.root_topic,
  });

  return NextResponse.json({
    mode: "report",
    workspace_conversion_goal: finalized.workspace_conversion_goal,
    conversion_goal_source: finalized.conversion_goal_source,
    report: finalized.report,
    evidence_summary: contextCounts,
    file_ids: activeFileIds,
  });
}