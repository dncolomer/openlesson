import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import {
  buildPerformanceChatInstructions,
  buildPerformanceReportInstructions,
  buildWorkspacePerformanceContext,
  type PerformanceConversationMessage,
  type PerformanceReport,
} from "@/lib/agent-v2/performance-context";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { callXaiResponses, callXaiResponsesWithFiles, type ResponsesInputMessage } from "@/lib/xai-client";

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
    .select("id, user_id, organization_id, guest_user_id, title, root_topic")
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

      if (
        context.payload.counts.evidence_artifacts === 0 &&
        context.payload.counts.ghl_sessions === 0 &&
        context.payload.counts.linked_sessions === 0 &&
        context.payload.counts.plan_files === 0
      ) {
        return NextResponse.json({
          mode: prompt ? "chat" : "report",
          response: prompt
            ? "No performance evidence is attached to this workspace yet. Upload tool usage, screenshots, video, or EEG via POST /evidence, complete a GHL session, or link session data before asking detailed questions."
            : null,
          report: prompt
            ? null
            : {
                summary:
                  "No performance evidence is available yet for this workspace. Collect GHL sessions, workspace evidence uploads, or linked session reports before generating a gap analysis.",
                strengths: [],
                growth_areas: ["Collect baseline performance evidence before assessing readiness."],
                gap_analysis: {
                  summary: "Insufficient data to identify specific learning gaps.",
                  gaps: [],
                  next_practice: [
                    "Upload tool usage or screenshots for key blocks",
                    "Run a GHL Score session on the highest-risk block",
                  ],
                },
                suggestions: [
                  "POST /api/v2/agent/workspaces/{workspace_id}/evidence with type tool, screen, video, or eeg",
                ],
                confidence: "emerging",
              },
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

  const reportResult = await callXaiResponsesWithFiles<PerformanceReport>(
    `Generate a learning and gap analysis report for workspace "${workspace.title || workspace.root_topic}".`,
    activeFileIds,
    {
      instructions: buildPerformanceReportInstructions(blockId),
      temperature: 0.35,
      maxOutputTokens: 2500,
      fetchTimeout: 120000,
      jsonSchema: PERFORMANCE_REPORT_SCHEMA,
    }
  );

  if (!reportResult.success || !reportResult.data) {
    return errorResponse(500, "internal_error", reportResult.error || "Failed to generate performance report");
  }

  return NextResponse.json({
    mode: "report",
    report: reportResult.data,
    evidence_summary: contextCounts,
    file_ids: activeFileIds,
  });
}