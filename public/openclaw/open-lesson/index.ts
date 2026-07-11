interface JsonObject {
  [key: string]: unknown;
}

interface AgentToolContext {
  channel?: string;
  senderId?: string;
}

interface WorkspaceNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
}

interface WorkspaceResponse {
  workspaceId: string;
  topic: string;
  days: number;
  nodes: WorkspaceNode[];
}

interface SessionStartResponse {
  sessionId: string;
  problem: string;
  blockTitle?: string;
  workspaceId?: string;
  status: string;
  instructions?: {
    audioFormat: string;
    submitEndpoint: string;
    maxChunkDuration: number;
  };
}

interface AudioAnalysisResponse {
  sessionId: string;
  gapScore: number;
  signals: string[];
  transcript?: string;
  followUpQuestion: string;
  requiresFollowUp: boolean;
}

interface SessionEndResponse {
  success: boolean;
  sessionId: string;
  message: string;
  chunkCount: number;
  wordCount: number;
}

interface SessionSummaryResponse {
  ready: boolean;
  sessionId: string;
  report?: string;
  createdAt?: string;
  status: string;
  message?: string;
}

interface PluginConfig {
  apiKey: string;
  baseUrl: string;
}

function getConfig(api: { config: JsonObject }): PluginConfig {
  const cfg = api.config as { plugins?: { entries?: { "open-lesson"?: { config?: { apiKey?: string; baseUrl?: string } } } } };
  const pluginConfig = cfg.plugins?.entries?.["open-lesson"]?.config;
  return {
    apiKey: pluginConfig?.apiKey || process.env.OPENLESSON_API_KEY || "",
    baseUrl: pluginConfig?.baseUrl || "https://www.openlesson.academy",
  };
}

async function makeRequest(
  api: { logger: { error: (msg: string) => void } },
  config: PluginConfig,
  endpoint: string,
  method: string,
  body?: JsonObject
): Promise<unknown> {
  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    api.logger.error(`openLesson API error: ${error}`);
    throw error;
  }
}

export default function (api: {
  registerTool: (
    tool: JsonObject,
    handler: (ctx: AgentToolContext, params: JsonObject) => Promise<JsonObject>
  ) => void;
  config: JsonObject;
  logger: { error: (msg: string) => void };
}) {
  api.registerTool(
    {
      id: "generate_learning_plan",
      name: "Generate Learning Plan",
      description:
        "Generate a personalized learning plan as a directed graph of guided tutoring sessions for a given topic",
      inputSchema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The topic to create a learning plan for",
          },
          days: {
            type: "number",
            description:
              "Number of days to spread the plan across (default: 30, min: 7, max: 180)",
            minimum: 7,
            maximum: 180,
          },
        },
        required: ["topic"],
      },
    },
    async (_ctx: AgentToolContext, params: JsonObject): Promise<JsonObject> => {
      const config = getConfig(api);
      if (!config.apiKey) {
        throw new Error(
          "API key not configured. Set OPENLESSON_API_KEY or configure via plugins.entries.open-lesson.config.apiKey"
        );
      }

      const response = await makeRequest(
        api,
        config,
        "/api/agent/workspace",
        "POST",
        params
      ) as WorkspaceResponse;

      const startNode = response.nodes.find((n) => n.is_start);
      return {
        workspace_id: response.workspaceId,
        topic: response.topic,
        days: response.days,
        nodes: response.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          is_start: n.is_start,
          next_block_ids: n.next_block_ids,
          status: n.status,
        })),
        first_session_block_id: startNode?.id,
      };
    }
  );

  api.registerTool(
    {
      id: "start_session",
      name: "Start Session",
      description:
        "Start a new guided tutoring session. Returns session ID and audio submission instructions.",
      inputSchema: {
        type: "object",
        properties: {
          problem: {
            type: "string",
            description:
              "The problem or topic to explore in this session (e.g., 'Explain how gradient descent works')",
          },
          block_id: {
            type: "string",
            description:
              "Optional plan node ID to link this session to a learning plan",
          },
        },
        required: ["problem"],
      },
    },
    async (_ctx: AgentToolContext, params: JsonObject): Promise<JsonObject> => {
      const config = getConfig(api);
      if (!config.apiKey) {
        throw new Error(
          "API key not configured. Set OPENLESSON_API_KEY or configure via plugins.entries.open-lesson.config.apiKey"
        );
      }

      const response = await makeRequest(
        api,
        config,
        "/api/agent/session/start",
        "POST",
        params
      ) as SessionStartResponse;

      return {
        session_id: response.sessionId,
        problem: response.problem,
        block_title: response.blockTitle,
        workspace_id: response.workspaceId,
        status: response.status,
        audio_format: response.instructions?.audioFormat || "webm",
        max_chunk_duration_ms: response.instructions?.maxChunkDuration || 60000,
        analyze_endpoint: "/api/agent/session/analyze",
      };
    }
  );

  api.registerTool(
    {
      id: "analyze_audio",
      name: "Analyze Audio",
      description:
        "Submit an audio chunk for analysis. Returns reasoning gap score and follow-up questions. **IMPORTANT**: This endpoint only accepts audio input, NOT text.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from start_session",
          },
          audio_base64: {
            type: "string",
            description:
              "Base64-encoded audio data (webm, mp4, or ogg format)",
          },
          audio_format: {
            type: "string",
            enum: ["webm", "mp4", "ogg"],
            default: "webm",
            description: "Audio format (default: webm)",
          },
        },
        required: ["session_id", "audio_base64", "audio_format"],
      },
    },
    async (_ctx: AgentToolContext, params: JsonObject): Promise<JsonObject> => {
      const config = getConfig(api);
      if (!config.apiKey) {
        throw new Error(
          "API key not configured. Set OPENLESSON_API_KEY or configure via plugins.entries.open-lesson.config.apiKey"
        );
      }

      const response = await makeRequest(
        api,
        config,
        "/api/agent/session/analyze",
        "POST",
        params
      ) as AudioAnalysisResponse;

      return {
        session_id: response.sessionId,
        gap_score: response.gapScore,
        signals: response.signals,
        transcript: response.transcript,
        follow_up_question: response.followUpQuestion,
        requires_follow_up: response.requiresFollowUp,
        interpretation: interpretGapScore(response.gapScore),
      };
    }
  );

  api.registerTool(
    {
      id: "end_session",
      name: "End Session",
      description:
        "End an active tutoring session and generate a summary report",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from start_session",
          },
        },
        required: ["session_id"],
      },
    },
    async (_ctx: AgentToolContext, params: JsonObject): Promise<JsonObject> => {
      const config = getConfig(api);
      if (!config.apiKey) {
        throw new Error(
          "API key not configured. Set OPENLESSON_API_KEY or configure via plugins.entries.open-lesson.config.apiKey"
        );
      }

      const response = await makeRequest(
        api,
        config,
        "/api/agent/session/end",
        "POST",
        { session_id: params.session_id }
      ) as SessionEndResponse;

      return {
        success: response.success,
        session_id: response.sessionId,
        message: response.message,
        chunk_count: response.chunkCount,
        word_count: response.wordCount,
        summary_available: true,
        summary_endpoint: `/api/agent/session/summary?session_id=${params.session_id}`,
      };
    }
  );

  api.registerTool(
    {
      id: "get_session_summary",
      name: "Get Session Summary",
      description: "Retrieve the summary report of a completed tutoring session",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "The session ID from start_session",
          },
        },
        required: ["session_id"],
      },
    },
    async (_ctx: AgentToolContext, params: JsonObject): Promise<JsonObject> => {
      const config = getConfig(api);
      if (!config.apiKey) {
        throw new Error(
          "API key not configured. Set OPENLESSON_API_KEY or configure via plugins.entries.open-lesson.config.apiKey"
        );
      }

      const response = await makeRequest(
        api,
        config,
        `/api/agent/session/summary?session_id=${params.session_id}`,
        "GET"
      ) as SessionSummaryResponse;

      if (!response.ready) {
        return {
          ready: false,
          session_id: response.sessionId,
          status: response.status,
          message:
            response.message ||
            "Session report not ready. Call end_session first to generate the report.",
        };
      }

      return {
        ready: true,
        session_id: response.sessionId,
        report: response.report,
        created_at: response.createdAt,
        status: response.status,
      };
    }
  );
}

function interpretGapScore(score: number): string {
  if (score < 0.3) {
    return "Strong understanding - user demonstrates solid reasoning";
  } else if (score < 0.6) {
    return "Moderate understanding - some reasoning gaps identified";
  } else {
    return "Significant reasoning gaps - follow-up recommended";
  }
}
