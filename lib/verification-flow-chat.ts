/**
 * Public Verification canvas chat: system prompt and user turn for xAI.
 * Used by POST /api/verification-flow/public/[token]/chat.
 */
import { composePrompt } from "@/lib/prompt-kernel/compose";
import {
  TAP_SELECTIVE_THOUGHT_OVERLAY,
  TAP_SURFACE,
} from "@/lib/prompt-kernel/surfaces/tap";
import { assemblePromptWorkspaceContext } from "@/lib/prompt-workspace-context";
import { tapWorkCanvasTurnContextMessage } from "@/lib/tap-work-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";

export function buildVerificationFlowChatSystemPrompt(topic: string): string {
  const subject = topic.trim() || "this topic";
  return composePrompt({
    ontology: "none",
    surface: TAP_SURFACE,
    task: `The learner is in a timed Verification session on: ${subject}.

${TAP_SELECTIVE_THOUGHT_OVERLAY}

Co-author the session Work canvas. Answer the latest canvas command. Reply as JSON with "text" (the coaching the learner reads) and optional "elements" only when a diagram is necessary.`,
  });
}

export function buildVerificationFlowChatUserMessage(input: {
  thought: string;
  messages?: Array<{ role?: string; content?: string }> | null;
  workCanvasScene?: IleWorkCanvasScene | null;
  workspaceTitle?: string | null;
}): string {
  const history = (input.messages ?? [])
    .slice(-12)
    .map((message) => {
      const role = message.role === "assistant" ? "Coach" : "Learner";
      return `${role}: ${String(message.content || "").slice(0, 2000)}`;
    })
    .join("\n\n");
  const canvasContext = input.workCanvasScene
    ? `\n\n${tapWorkCanvasTurnContextMessage(input.workCanvasScene, {
        workspace: assemblePromptWorkspaceContext({
          workspaceTitle: input.workspaceTitle,
        }),
      })}`
    : "";
  return `Conversation so far:\n${history || "None"}\n\nLatest canvas command:\n${input.thought.trim()}${canvasContext}`;
}
