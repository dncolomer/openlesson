import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { finalizePerformanceReport } from "@/lib/agent-v2/conversion-goal";
import {
  buildOpaquePerformanceChatInstructions,
  buildPrivacyMetadata,
  extractGoalRefFromConversionGoal,
  finalizeOpaquePerformanceReport,
  isOpaqueWorkspace,
  parseWorkspaceEvaluationMeta,
} from "@/lib/agent-v2/opaque-evaluation";
import {
  buildPerformanceChatInstructions,
  buildWorkspacePerformanceContext,
  emptyPerformanceReport,
  type PerformanceConversationMessage,
} from "@/lib/agent-v2/performance-context";
import { generateWorkspacePerformanceReport } from "@/lib/agent-v2/generate-performance-report";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import { callXaiResponses, DEFAULT_MODEL, type ResponsesInputMessage } from "@/lib/xai-client";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";

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
    .from("workspaces")
    .select(
      "id, user_id, organization_id, guest_user_id, title, root_topic, description, notes, conversion_goal, evaluation_mode, protocol_config, external_refs"
    )
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
  const stylePrompt =
    typeof body.style_prompt === "string" ? body.style_prompt.trim() : "";
  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const conversationHistory = parseConversationHistory(body.conversation_history);
  const persistedFileIds = Array.isArray(body.file_ids)
    ? body.file_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (blockId) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
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
        context.payload.counts.proof_of_work_artifacts === 0 &&
        context.payload.counts.linked_sessions === 0 &&
        context.payload.counts.workspace_files === 0
      ) {
        const emptyReport = prompt
          ? null
          : finalizePerformanceReport(emptyPerformanceReport(), workspace.conversion_goal, {
              title: workspace.title,
              description: workspace.description,
              notes: workspace.notes,
              root_topic: workspace.root_topic,
            });

        return NextResponse.json(
          await withProofOfWorkApiResponse(
            {
              mode: prompt ? "chat" : "report",
              response: prompt
                ? "No performance proof of work is attached to this workspace yet. Upload tool usage, screenshots, video, or EEG via POST /proof-of-work, or complete a Think Aloud Protocol (TAP) / ILE session so traces and transcripts are recorded before asking detailed questions."
                : null,
              report: emptyReport?.report ?? null,
              workspace_conversion_goal: emptyReport?.workspace_conversion_goal,
              conversion_goal_source: emptyReport?.conversion_goal_source,
              proof_of_work_summary: contextCounts,
              file_ids: [],
            },
            {
              endpoint: "analyze_performance",
              workspace_id: workspaceId,
              block_id: blockId,
              mode: prompt ? "chat" : "report",
              report: emptyReport?.report ?? null,
              proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
              workspace_title: workspace.title || workspace.root_topic || null,
              conversion_goal: workspace.conversion_goal,
              artifact_summary: prompt || "Empty workspace performance request",
            }
          )
        );
      }
    } catch (error) {
      console.error("[agent/performance] Context build failed:", error);
      return errorResponse(500, "internal_error", "Failed to prepare workspace performance context");
    }
  }

  const evalMeta = parseWorkspaceEvaluationMeta(workspace);
  const opaque = isOpaqueWorkspace(evalMeta);
  const privacy = buildPrivacyMetadata(evalMeta);
  const goalRef =
    extractGoalRefFromConversionGoal(workspace.conversion_goal) || evalMeta.protocol_config?.goal_ref || null;

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
      model: DEFAULT_MODEL,
      instructions: opaque
        ? buildOpaquePerformanceChatInstructions(blockId)
        : buildPerformanceChatInstructions(blockId, stylePrompt),
      input: inputMessages,
      temperature: 0.6,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
    });

    if (!chatResult.success || !chatResult.text) {
      return errorResponse(500, "internal_error", chatResult.error || "Failed to generate performance response");
    }

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        {
          mode: "chat",
          evaluation_mode: evalMeta.evaluation_mode,
          privacy,
          response: chatResult.text,
          proof_of_work_summary: contextCounts,
          file_ids: activeFileIds,
        },
        {
          endpoint: "analyze_performance",
          workspace_id: workspaceId,
          block_id: blockId,
          mode: "chat",
          proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
          workspace_title: workspace.title || workspace.root_topic || null,
          conversion_goal: workspace.conversion_goal,
          artifact_summary: `Performance chat — learner asked: "${prompt.slice(0, 400)}"`,
          artifact_metadata: {
            learner_prompt: prompt,
            helios_response_preview: chatResult.text.slice(0, 500),
          },
        }
      )
    );
  }

  const storedConversionGoal =
    performanceContext?.workspace.conversion_goal ?? workspace.conversion_goal;

  const generation = await generateWorkspacePerformanceReport({
    workspaceId,
    workspaceTitle: workspace.title,
    workspaceRootTopic: workspace.root_topic,
    storedConversionGoal,
    fileIds: activeFileIds,
    blockId,
    stylePrompt,
    opaque,
    goalRef,
  });

  if (!generation.success || !generation.data) {
    return errorResponse(
      500,
      generation.code ?? "internal_error",
      generation.error || "Failed to generate performance report",
    );
  }

  const finalized = opaque
    ? finalizeOpaquePerformanceReport(generation.data, goalRef, evalMeta.protocol_config)
    : {
        ...finalizePerformanceReport(generation.data, storedConversionGoal, {
          title: workspace.title,
          description: workspace.description,
          notes: workspace.notes,
          root_topic: workspace.root_topic,
        }),
        protocol_report: undefined,
      };

  return NextResponse.json(
    await withProofOfWorkApiResponse(
      {
        mode: "report",
        evaluation_mode: evalMeta.evaluation_mode,
        privacy,
        workspace_conversion_goal: finalized.workspace_conversion_goal,
        conversion_goal_source: finalized.conversion_goal_source,
        report: finalized.report,
        protocol_report: opaque ? finalized.protocol_report : undefined,
        proof_of_work_summary: contextCounts,
        file_ids: activeFileIds,
      },
      {
        endpoint: "analyze_performance",
        workspace_id: workspaceId,
        block_id: blockId,
        mode: "report",
        report: finalized.report,
        proof_of_work_artifacts: contextCounts?.proof_of_work_artifacts,
        workspace_title: workspace.title || workspace.root_topic || null,
        conversion_goal: workspace.conversion_goal,
        artifact_summary: finalized.report.summary || `Performance report score ${finalized.report.overall_score}`,
      }
    )
  );
}