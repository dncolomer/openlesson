import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { apiRequest } from "../client";
import type { CreatePlanFromVideoResponse } from "../types";

export const createPlanFromVideoAction: Action = {
  name: "CREATE_PLAN_FROM_VIDEO",
  similes: [
    "PLAN_FROM_YOUTUBE",
    "VIDEO_WORKSPACE",
    "YOUTUBE_PLAN",
    "LEARN_FROM_VIDEO",
  ],
  description:
    "Create a workspace derived from a YouTube video URL",

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

    const urlMatch = text.match(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+/i
    );
    const youtubeUrl = urlMatch?.[0];

    if (!youtubeUrl) {
      callback({
        text: "Please provide a YouTube URL. Example: 'Create a plan from this video: https://youtube.com/watch?v=...'",
        action: "CREATE_PLAN_FROM_VIDEO",
      });
      return true;
    }

    try {
      const data = await apiRequest<CreatePlanFromVideoResponse>(
        runtime,
        "POST",
        "/workspaces/from-video",
        { youtube_url: youtubeUrl }
      );

      const startNode = data.nodes.find((n) => n.is_start);

      callback({
        text: `Workspace created from video for "${data.topic}" spanning ${data.duration_days} days with ${data.nodes.length} blocks. Workspace ID: ${data.workspace_id}. First block: "${startNode?.title ?? "N/A"}".`,
        action: "CREATE_PLAN_FROM_VIDEO",
      });
    } catch (error) {
      callback({
        text: `Failed to create plan from video: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "CREATE_PLAN_FROM_VIDEO",
      });
    }

    return true;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create a plan from this video: https://youtube.com/watch?v=dQw4w9WgXcQ",
        },
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Learning plan created from video for "Music Theory Basics" spanning 14 days with 5 sessions. Plan ID: plan_vid789. First session: "Melody and Harmony".',
          action: "CREATE_PLAN_FROM_VIDEO",
        },
      },
    ],
  ],
};
