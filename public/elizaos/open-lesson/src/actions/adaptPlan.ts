import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { apiRequest } from "../client";
import type { AdaptPlanResponse } from "../types";

export const adaptPlanAction: Action = {
  name: "ADAPT_WORKSPACE",
  similes: [
    "MODIFY_WORKSPACE",
    "CHANGE_WORKSPACE",
    "UPDATE_WORKSPACE",
    "ADJUST_WORKSPACE",
  ],
  description:
    "Adapt an existing workspace by giving a natural-language instruction (e.g. skip intro, add practice)",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: unknown,
    callback: HandlerCallback
  ) => {
    const text = (message.content as { text?: string }).text ?? "";

    // Try to extract workspace_id from the message or recent state
    const idMatch = text.match(/plan[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i);
    const workspaceId =
      idMatch?.[1] ??
      (state as Record<string, unknown>)?.workspace_id as string | undefined;

    if (!workspaceId) {
      callback({
        text: "Please provide a plan ID to adapt. Example: 'Adapt plan plan_abc123: skip the intro sessions'.",
        action: "ADAPT_WORKSPACE",
      });
      return true;
    }

    // The instruction is the rest of the message (or the whole text if no plan ID pattern)
    const instruction = text
      .replace(/plan[_\s]?(?:id)?[:\s]*[a-zA-Z0-9_-]+/i, "")
      .replace(/^[\s:,]+/, "")
      .trim() || text.trim();

    try {
      const data = await apiRequest<AdaptPlanResponse>(
        runtime,
        "POST",
        `/workspaces/${workspaceId}/adapt`,
        { instruction }
      );

      callback({
        text: `Plan ${data.workspace_id} adapted: "${data.instruction}". Now has ${data.nodes.length} sessions.`,
        action: "ADAPT_WORKSPACE",
      });
    } catch (error) {
      callback({
        text: `Failed to adapt plan: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "ADAPT_WORKSPACE",
      });
    }

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Adapt plan plan_abc123: skip the intro sessions",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Plan plan_abc123 adapted: "skip the intro sessions". Now has 6 sessions.',
          action: "ADAPT_WORKSPACE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Add more practice problems to plan plan_def456" },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Plan plan_def456 adapted: "Add more practice problems". Now has 9 sessions.',
          action: "ADAPT_WORKSPACE",
        },
      },
    ],
  ],
};
