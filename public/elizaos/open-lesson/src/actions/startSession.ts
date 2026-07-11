import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { apiRequest } from "../client";
import type { StartSessionResponse } from "../types";

export const startSessionAction: Action = {
  name: "START_SESSION",
  similes: [
    "BEGIN_SESSION",
    "START_TUTORING",
    "NEW_SESSION",
    "OPEN_SESSION",
  ],
  description:
    "Start a new tutoring session. Requires a topic; optionally linked to a plan via workspace_id/block_id. Sessions can be standalone.",

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

    // Extract topic — after common trigger words
    const topicMatch = text.match(
      /(?:session (?:about|on|for)|tutor(?:ing)? (?:on|about|for)|study|learn about)\s+(.+)/i
    );
    const topic = topicMatch ? topicMatch[1].trim() : text.trim();

    if (!topic) {
      callback({
        text: "Please specify a topic for the session.",
        action: "START_SESSION",
      });
      return true;
    }

    // Optional plan linkage from state or message
    const workspaceIdMatch = text.match(/plan[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i);
    const workspaceId =
      workspaceIdMatch?.[1] ??
      (state as Record<string, unknown>)?.workspace_id as string | undefined;

    const blockIdMatch = text.match(
      /node[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const blockId =
      blockIdMatch?.[1] ??
      (state as Record<string, unknown>)?.block_id as string | undefined;

    try {
      const body: Record<string, unknown> = { topic };
      if (workspaceId) body.workspace_id = workspaceId;
      if (blockId) body.block_id = blockId;

      const data = await apiRequest<StartSessionResponse>(
        runtime,
        "POST",
        "/sessions",
        body
      );

      callback({
        text: `Tutoring session started for "${data.topic}". Session ID: ${data.session_id}. Status: ${data.status}.`,
        action: "START_SESSION",
      });
    } catch (error) {
      callback({
        text: `Failed to start session: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "START_SESSION",
      });
    }

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Start a tutoring session about gradient descent" },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Tutoring session started for "gradient descent". Session ID: sess_abc123. Status: active.',
          action: "START_SESSION",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "I want to study linear algebra" },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Tutoring session started for "linear algebra". Session ID: sess_def456. Status: active.',
          action: "START_SESSION",
        },
      },
    ],
  ],
};
