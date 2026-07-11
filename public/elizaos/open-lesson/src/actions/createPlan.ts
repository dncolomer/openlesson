import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { apiRequest } from "../client";
import type { CreatePlanResponse } from "../types";

export const createPlanAction: Action = {
  name: "CREATE_WORKSPACE",
  similes: [
    "GENERATE_WORKSPACE",
    "MAKE_WORKSPACE",
    "BUILD_STUDY_WORKSPACE",
    "CREATE_STUDY_WORKSPACE",
  ],
  description:
    "Create a verification workspace as a directed graph of tutoring sessions for a given topic",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: unknown,
    callback: HandlerCallback
  ) => {
    const text = (message.content as { text?: string }).text ?? "";

    // Extract topic — everything after common trigger phrases
    const topicMatch = text.match(
      /(?:workspace (?:for|about|on)|learn|study|workspace for)\s+(.+?)(?:\s+in\s+(\d+)\s*(days?|weeks?))?$/i
    );
    const topic = topicMatch ? topicMatch[1].replace(/\s+in\s+\d+\s*(days?|weeks?)$/i, "").trim() : text.trim();
    let duration_days: number | undefined;

    const durationMatch = text.match(/(\d+)\s*(days?|weeks?)/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      duration_days = unit.startsWith("week") ? num * 7 : num;
    }

    if (!topic) {
      callback({
        text: "Please specify a topic for the workspace.",
        action: "CREATE_WORKSPACE",
      });
      return true;
    }

    try {
      const body: Record<string, unknown> = { topic };
      if (duration_days) body.duration_days = duration_days;

      const data = await apiRequest<CreatePlanResponse>(
        runtime,
        "POST",
        "/workspaces",
        body
      );

      const startNode = data.nodes.find((n) => n.is_start);

      callback({
        text: `Workspace created for "${data.topic}" spanning ${data.duration_days} days with ${data.nodes.length} blocks. Workspace ID: ${data.workspace_id}. First block: "${startNode?.title ?? "N/A"}".`,
        action: "CREATE_WORKSPACE",
      });
    } catch (error) {
      callback({
        text: `Failed to create workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "CREATE_WORKSPACE",
      });
    }

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Create a workspace for quantum computing" },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Workspace created for "quantum computing" spanning 30 days with 8 blocks. Workspace ID: ws_abc123. First block: "Introduction to Qubits".',
          action: "CREATE_WORKSPACE",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "I want to learn Python in 2 weeks" },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Workspace created for "Python" spanning 14 days with 6 blocks. Workspace ID: ws_def456. First block: "Python Basics".',
          action: "CREATE_WORKSPACE",
        },
      },
    ],
  ],
};
