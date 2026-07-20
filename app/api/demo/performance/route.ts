import { NextRequest, NextResponse } from "next/server";
import { finalizeVerticalScoreReport } from "@/lib/agent-v2/workspace-goal";
import {
  buildPerformanceChatInstructions,
  buildWorkspacePerformanceContext,
  emptyVerticalScoreReport,
} from "@/lib/agent-v2/performance-context";
import {
  SCORE_VERTICALS,
  type ScoreVertical,
} from "@/lib/agent-v2/performance-report";
import { generateWorkspaceVerticalScoreReport } from "@/lib/agent-v2/generate-performance-report";
import { requireDemoAdminWorkspaceSession } from "@/lib/product-demos/demo-access";
import { callXaiResponses, DEFAULT_MODEL, type ResponsesInputMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

function parseVertical(value: unknown): ScoreVertical {
  if (typeof value === "string" && (SCORE_VERTICALS as readonly string[]).includes(value)) {
    return value as ScoreVertical;
  }
  return "verification";
}

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
    const vertical = parseVertical(body.vertical);

    const context = await buildWorkspacePerformanceContext({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId: workspaceId,
      blockId,
    });

    const workspaceTitle = access.plan.title || access.plan.root_topic || "workspace";
    const storedWorkspaceGoal = context.payload.workspace.workspace_goal;
    const contextCounts = context.payload.counts;

    if (
      contextCounts.proof_of_work_artifacts === 0 &&
      contextCounts.linked_sessions === 0 &&
      contextCounts.workspace_files === 0
    ) {
      const emptyReport = prompt
        ? null
        : finalizeVerticalScoreReport(
            emptyVerticalScoreReport(vertical),
            storedWorkspaceGoal,
            {
              title: context.payload.workspace.title,
              description: context.payload.workspace.description,
              notes: context.payload.workspace.notes,
              root_topic: context.payload.workspace.root_topic,
            },
            vertical
          );

      return NextResponse.json({
        mode: prompt ? "chat" : "score",
        vertical: prompt ? undefined : vertical,
        response: prompt
          ? stylePrompt
            ? "No evidence is attached to this workspace yet. Take a few actions in Orbit first, then ask what you should improve."
            : "No evidence is attached to this workspace yet. Take a few actions in Orbit first, then ask what to improve."
          : null,
        workspace_goal: emptyReport?.workspace_goal,
        workspace_goal_source: emptyReport?.workspace_goal_source,
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

    const generation = await generateWorkspaceVerticalScoreReport({
      workspaceId,
      workspaceTitle,
      workspaceRootTopic: access.plan.root_topic,
      storedWorkspaceGoal,
      fileIds: context.fileIds,
      vertical,
      blockId,
      stylePrompt: [
        stylePrompt,
        orbitUiContext
          ? `Current Orbit UI state (ground coaching in what is actually available — do not suggest triage when inbox unread is 0):\n${orbitUiContext}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    if (!generation.success || !generation.data) {
      return NextResponse.json(
        { error: generation.error || "Failed to generate performance report" },
        { status: 500 }
      );
    }

    const finalized = finalizeVerticalScoreReport(
      generation.data,
      storedWorkspaceGoal,
      {
        title: context.payload.workspace.title,
        description: context.payload.workspace.description,
        notes: context.payload.workspace.notes,
        root_topic: context.payload.workspace.root_topic,
      },
      vertical
    );

    return NextResponse.json({
      mode: "score",
      vertical,
      workspace_goal: finalized.workspace_goal,
      workspace_goal_source: finalized.workspace_goal_source,
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
