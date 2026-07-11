// src/client.ts
var BASE_URL = "https://www.openlesson.academy";
var API_VERSION = "v2";
function getApiKey(runtime) {
  const key = runtime.getSetting("OPENLESSON_API_KEY");
  if (!key) {
    throw new Error(
      "OPENLESSON_API_KEY not configured. Set it in your character settings."
    );
  }
  return key;
}
async function apiRequest(runtime, method, path, body) {
  const apiKey = getApiKey(runtime);
  const url = `${BASE_URL}/api/${API_VERSION}/agent${path}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  const init = { method, headers };
  if (body !== void 0) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return await response.json();
}

// src/actions/createPlan.ts
var createPlanAction = {
  name: "CREATE_WORKSPACE",
  similes: [
    "GENERATE_WORKSPACE",
    "MAKE_WORKSPACE",
    "BUILD_STUDY_WORKSPACE",
    "CREATE_STUDY_WORKSPACE"
  ],
  description: "Create a verification workspace as a directed graph of tutoring sessions for a given topic",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? "";
    const topicMatch = text.match(
      /(?:workspace (?:for|about|on)|learn|study|workspace for)\s+(.+?)(?:\s+in\s+(\d+)\s*(days?|weeks?))?$/i
    );
    const topic = topicMatch ? topicMatch[1].replace(/\s+in\s+\d+\s*(days?|weeks?)$/i, "").trim() : text.trim();
    let duration_days;
    const durationMatch = text.match(/(\d+)\s*(days?|weeks?)/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      duration_days = unit.startsWith("week") ? num * 7 : num;
    }
    if (!topic) {
      callback({
        text: "Please specify a topic for the workspace.",
        action: "CREATE_WORKSPACE"
      });
      return true;
    }
    try {
      const body = { topic };
      if (duration_days) body.duration_days = duration_days;
      const data = await apiRequest(
        runtime,
        "POST",
        "/workspaces",
        body
      );
      const startNode = data.nodes.find((n) => n.is_start);
      callback({
        text: `Workspace created for "${data.topic}" spanning ${data.duration_days} days with ${data.nodes.length} blocks. Workspace ID: ${data.workspace_id}. First block: "${startNode?.title ?? "N/A"}".`,
        action: "CREATE_WORKSPACE"
      });
    } catch (error) {
      callback({
        text: `Failed to create workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "CREATE_WORKSPACE"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Create a workspace for quantum computing" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Workspace created for "quantum computing" spanning 30 days with 8 blocks. Workspace ID: ws_abc123. First block: "Introduction to Qubits".',
          action: "CREATE_WORKSPACE"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "I want to learn Python in 2 weeks" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Workspace created for "Python" spanning 14 days with 6 blocks. Workspace ID: ws_def456. First block: "Python Basics".',
          action: "CREATE_WORKSPACE"
        }
      }
    ]
  ]
};

// src/actions/adaptPlan.ts
var adaptPlanAction = {
  name: "ADAPT_WORKSPACE",
  similes: [
    "MODIFY_WORKSPACE",
    "CHANGE_WORKSPACE",
    "UPDATE_WORKSPACE",
    "ADJUST_WORKSPACE"
  ],
  description: "Adapt an existing workspace by giving a natural-language instruction (e.g. skip intro, add practice)",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const idMatch = text.match(/plan[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i);
    const workspaceId = idMatch?.[1] ?? state?.workspace_id;
    if (!workspaceId) {
      callback({
        text: "Please provide a plan ID to adapt. Example: 'Adapt plan plan_abc123: skip the intro sessions'.",
        action: "ADAPT_WORKSPACE"
      });
      return true;
    }
    const instruction = text.replace(/plan[_\s]?(?:id)?[:\s]*[a-zA-Z0-9_-]+/i, "").replace(/^[\s:,]+/, "").trim() || text.trim();
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        `/workspaces/${workspaceId}/adapt`,
        { instruction }
      );
      callback({
        text: `Plan ${data.workspace_id} adapted: "${data.instruction}". Now has ${data.nodes.length} sessions.`,
        action: "ADAPT_WORKSPACE"
      });
    } catch (error) {
      callback({
        text: `Failed to adapt plan: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "ADAPT_WORKSPACE"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Adapt plan plan_abc123: skip the intro sessions"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Plan plan_abc123 adapted: "skip the intro sessions". Now has 6 sessions.',
          action: "ADAPT_WORKSPACE"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Add more practice problems to plan plan_def456" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Plan plan_def456 adapted: "Add more practice problems". Now has 9 sessions.',
          action: "ADAPT_WORKSPACE"
        }
      }
    ]
  ]
};

// src/actions/createPlanFromVideo.ts
var createPlanFromVideoAction = {
  name: "CREATE_PLAN_FROM_VIDEO",
  similes: [
    "PLAN_FROM_YOUTUBE",
    "VIDEO_WORKSPACE",
    "YOUTUBE_PLAN",
    "LEARN_FROM_VIDEO"
  ],
  description: "Create a workspace derived from a YouTube video URL",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? "";
    const urlMatch = text.match(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+/i
    );
    const youtubeUrl = urlMatch?.[0];
    if (!youtubeUrl) {
      callback({
        text: "Please provide a YouTube URL. Example: 'Create a plan from this video: https://youtube.com/watch?v=...'",
        action: "CREATE_PLAN_FROM_VIDEO"
      });
      return true;
    }
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        "/workspaces/from-video",
        { youtube_url: youtubeUrl }
      );
      const startNode = data.nodes.find((n) => n.is_start);
      callback({
        text: `Workspace created from video for "${data.topic}" spanning ${data.duration_days} days with ${data.nodes.length} blocks. Workspace ID: ${data.workspace_id}. First block: "${startNode?.title ?? "N/A"}".`,
        action: "CREATE_PLAN_FROM_VIDEO"
      });
    } catch (error) {
      callback({
        text: `Failed to create plan from video: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "CREATE_PLAN_FROM_VIDEO"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create a plan from this video: https://youtube.com/watch?v=dQw4w9WgXcQ"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Learning plan created from video for "Music Theory Basics" spanning 14 days with 5 sessions. Plan ID: plan_vid789. First session: "Melody and Harmony".',
          action: "CREATE_PLAN_FROM_VIDEO"
        }
      }
    ]
  ]
};

// src/actions/startSession.ts
var startSessionAction = {
  name: "START_SESSION",
  similes: [
    "BEGIN_SESSION",
    "START_TUTORING",
    "NEW_SESSION",
    "OPEN_SESSION"
  ],
  description: "Start a new tutoring session. Requires a topic; optionally linked to a plan via workspace_id/block_id. Sessions can be standalone.",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const topicMatch = text.match(
      /(?:session (?:about|on|for)|tutor(?:ing)? (?:on|about|for)|study|learn about)\s+(.+)/i
    );
    const topic = topicMatch ? topicMatch[1].trim() : text.trim();
    if (!topic) {
      callback({
        text: "Please specify a topic for the session.",
        action: "START_SESSION"
      });
      return true;
    }
    const workspaceIdMatch = text.match(/plan[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i);
    const workspaceId = workspaceIdMatch?.[1] ?? state?.workspace_id;
    const blockIdMatch = text.match(
      /node[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const blockId = blockIdMatch?.[1] ?? state?.block_id;
    try {
      const body = { topic };
      if (workspaceId) body.workspace_id = workspaceId;
      if (blockId) body.block_id = blockId;
      const data = await apiRequest(
        runtime,
        "POST",
        "/sessions",
        body
      );
      callback({
        text: `Tutoring session started for "${data.topic}". Session ID: ${data.session_id}. Status: ${data.status}.`,
        action: "START_SESSION"
      });
    } catch (error) {
      callback({
        text: `Failed to start session: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "START_SESSION"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Start a tutoring session about gradient descent" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Tutoring session started for "gradient descent". Session ID: sess_abc123. Status: active.',
          action: "START_SESSION"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "I want to study linear algebra" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Tutoring session started for "linear algebra". Session ID: sess_def456. Status: active.',
          action: "START_SESSION"
        }
      }
    ]
  ]
};

// src/actions/analyzeHeartbeat.ts
function interpretGapScore(score) {
  if (score < 0.3) {
    return "Strong understanding \u2014 solid reasoning demonstrated";
  } else if (score < 0.6) {
    return "Moderate understanding \u2014 some reasoning gaps identified";
  }
  return "Significant reasoning gaps \u2014 follow-up recommended";
}
var analyzeHeartbeatAction = {
  name: "ANALYZE_HEARTBEAT",
  similes: [
    "SUBMIT_HEARTBEAT",
    "ANALYZE_RESPONSE",
    "CHECK_UNDERSTANDING",
    "SEND_HEARTBEAT"
  ],
  description: "Submit a heartbeat (text, audio, or image input) for analysis during an active session. Returns gap score and probing questions.",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const sessionMatch = text.match(
      /session[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const sessionId = sessionMatch?.[1] ?? state?.session_id;
    if (!sessionId) {
      callback({
        text: "Please provide a session ID. Example: 'Analyze session sess_abc123: my explanation is...'",
        action: "ANALYZE_HEARTBEAT"
      });
      return true;
    }
    const contentText = text.replace(/session[_\s]?(?:id)?[:\s]*[a-zA-Z0-9_-]+/i, "").replace(/^[\s:,]+/, "").trim();
    const inputs = [];
    if (contentText) {
      inputs.push({ type: "text", content: contentText });
    }
    if (inputs.length === 0) {
      callback({
        text: "Please provide some content (text, audio, or image) to analyze.",
        action: "ANALYZE_HEARTBEAT"
      });
      return true;
    }
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        `/sessions/${sessionId}/analyze`,
        { inputs }
      );
      const interpretation = interpretGapScore(data.gap_score);
      let responseText = `Analysis complete (gap score: ${data.gap_score.toFixed(2)}). ${interpretation}.`;
      if (data.probes.length > 0) {
        responseText += "\n\nProbing questions:";
        data.probes.forEach((p, i) => {
          responseText += `
${i + 1}. ${p.question}`;
        });
      }
      callback({
        text: responseText,
        action: "ANALYZE_HEARTBEAT"
      });
    } catch (error) {
      callback({
        text: `Failed to analyze heartbeat: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "ANALYZE_HEARTBEAT"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Analyze session sess_abc123: I think gradient descent works by following the slope downhill"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Analysis complete (gap score: 0.35). Moderate understanding \u2014 some reasoning gaps identified.\n\nProbing questions:\n1. What determines the size of each step?",
          action: "ANALYZE_HEARTBEAT"
        }
      }
    ]
  ]
};

// src/actions/pauseSession.ts
var pauseSessionAction = {
  name: "PAUSE_SESSION",
  similes: ["HOLD_SESSION", "SUSPEND_SESSION", "BREAK_SESSION"],
  description: "Pause an active tutoring session",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const sessionMatch = text.match(
      /session[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const sessionId = sessionMatch?.[1] ?? state?.session_id;
    if (!sessionId) {
      callback({
        text: "Please provide a session ID to pause.",
        action: "PAUSE_SESSION"
      });
      return true;
    }
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        `/sessions/${sessionId}/pause`
      );
      callback({
        text: `Session ${data.session_id} paused. ${data.message}`,
        action: "PAUSE_SESSION"
      });
    } catch (error) {
      callback({
        text: `Failed to pause session: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "PAUSE_SESSION"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Pause session sess_abc123" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Session sess_abc123 paused. You can resume any time.",
          action: "PAUSE_SESSION"
        }
      }
    ]
  ]
};

// src/actions/resumeSession.ts
var resumeSessionAction = {
  name: "RESUME_SESSION",
  similes: ["CONTINUE_SESSION", "UNPAUSE_SESSION", "RESTART_SESSION"],
  description: "Resume a previously paused tutoring session",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const sessionMatch = text.match(
      /session[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const sessionId = sessionMatch?.[1] ?? state?.session_id;
    if (!sessionId) {
      callback({
        text: "Please provide a session ID to resume.",
        action: "RESUME_SESSION"
      });
      return true;
    }
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        `/sessions/${sessionId}/resume`
      );
      callback({
        text: `Session ${data.session_id} resumed. ${data.message}`,
        action: "RESUME_SESSION"
      });
    } catch (error) {
      callback({
        text: `Failed to resume session: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "RESUME_SESSION"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Resume session sess_abc123" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Session sess_abc123 resumed. Pick up where you left off.",
          action: "RESUME_SESSION"
        }
      }
    ]
  ]
};

// src/actions/endSession.ts
var endSessionAction = {
  name: "END_SESSION",
  similes: [
    "STOP_SESSION",
    "FINISH_SESSION",
    "CLOSE_SESSION",
    "COMPLETE_SESSION"
  ],
  description: "End an active tutoring session and trigger report generation",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const sessionMatch = text.match(
      /session[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const sessionId = sessionMatch?.[1] ?? state?.session_id;
    if (!sessionId) {
      callback({
        text: "Please provide a session ID to end.",
        action: "END_SESSION"
      });
      return true;
    }
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        `/sessions/${sessionId}/end`
      );
      callback({
        text: `Session ${data.session_id} ended. ${data.message}`,
        action: "END_SESSION"
      });
    } catch (error) {
      callback({
        text: `Failed to end session: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "END_SESSION"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "End session sess_abc123" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Session sess_abc123 ended. Your report is being generated.",
          action: "END_SESSION"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "I'm done with this session" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Session ended. Your summary report will be available shortly.",
          action: "END_SESSION"
        }
      }
    ]
  ]
};

// src/actions/askAssistant.ts
var askAssistantAction = {
  name: "ASK_ASSISTANT",
  similes: [
    "ASK_TUTOR",
    "ASK_QUESTION",
    "SESSION_QUESTION",
    "HELP_ME"
  ],
  description: "Ask the teaching assistant a question within an active session",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const text = message.content.text ?? "";
    const sessionMatch = text.match(
      /session[_\s]?(?:id)?[:\s]*([a-zA-Z0-9_-]+)/i
    );
    const sessionId = sessionMatch?.[1] ?? state?.session_id;
    if (!sessionId) {
      callback({
        text: "Please provide a session ID. Example: 'Ask session sess_abc123: What is backpropagation?'",
        action: "ASK_ASSISTANT"
      });
      return true;
    }
    const question = text.replace(/session[_\s]?(?:id)?[:\s]*[a-zA-Z0-9_-]+/i, "").replace(/^[\s:,]+/, "").trim() || text.trim();
    if (!question) {
      callback({
        text: "Please include a question to ask the assistant.",
        action: "ASK_ASSISTANT"
      });
      return true;
    }
    try {
      const data = await apiRequest(
        runtime,
        "POST",
        `/sessions/${sessionId}/ask`,
        { question }
      );
      callback({
        text: data.answer,
        action: "ASK_ASSISTANT"
      });
    } catch (error) {
      callback({
        text: `Failed to ask assistant: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "ASK_ASSISTANT"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Ask session sess_abc123: What is backpropagation?"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Backpropagation is the algorithm used to compute gradients in a neural network by propagating errors backward from the output layer to the input layer.",
          action: "ASK_ASSISTANT"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you explain the learning rate to me?"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "The learning rate controls how large each update step is during optimization. A high rate may overshoot, while a low rate converges slowly.",
          action: "ASK_ASSISTANT"
        }
      }
    ]
  ]
};

// src/actions/getAnalytics.ts
var getAnalyticsAction = {
  name: "GET_ANALYTICS",
  similes: [
    "SHOW_ANALYTICS",
    "VIEW_ANALYTICS",
    "MY_STATS",
    "LEARNING_STATS",
    "SHOW_PROGRESS"
  ],
  description: "Retrieve user analytics \u2014 total sessions, plans, average gap score, and per-session stats",
  validate: async (runtime, _message) => {
    return !!runtime.getSetting("OPENLESSON_API_KEY");
  },
  handler: async (runtime, _message, _state, _options, callback) => {
    try {
      const data = await apiRequest(
        runtime,
        "GET",
        "/analytics/user"
      );
      let text = `Analytics: ${data.total_sessions} sessions, ${data.total_plans} plans, average gap score ${data.average_gap_score.toFixed(2)}.`;
      if (data.sessions.length > 0) {
        text += "\n\nRecent sessions:";
        data.sessions.slice(0, 5).forEach((s) => {
          text += `
- ${s.topic} (${s.status}) \u2014 gap: ${s.average_gap_score.toFixed(2)}, heartbeats: ${s.heartbeat_count}`;
        });
        if (data.sessions.length > 5) {
          text += `
... and ${data.sessions.length - 5} more.`;
        }
      }
      callback({ text, action: "GET_ANALYTICS" });
    } catch (error) {
      callback({
        text: `Failed to get analytics: ${error instanceof Error ? error.message : "Unknown error"}`,
        action: "GET_ANALYTICS"
      });
    }
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Show me my learning analytics" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Analytics: 12 sessions, 3 plans, average gap score 0.42.\n\nRecent sessions:\n- Gradient Descent (completed) \u2014 gap: 0.35, heartbeats: 8\n- Linear Algebra (active) \u2014 gap: 0.50, heartbeats: 3",
          action: "GET_ANALYTICS"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "How am I doing with my studies?" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Analytics: 5 sessions, 1 plan, average gap score 0.28.",
          action: "GET_ANALYTICS"
        }
      }
    ]
  ]
};

// src/index.ts
var openLessonPlugin = {
  name: "open-lesson",
  description: "openLesson Proof-of-Work API \u2014 verification workspaces, blocks, and Think Aloud Protocol (TAP) links",
  actions: [
    createPlanAction,
    adaptPlanAction,
    createPlanFromVideoAction,
    startSessionAction,
    analyzeHeartbeatAction,
    pauseSessionAction,
    resumeSessionAction,
    endSessionAction,
    askAssistantAction,
    getAnalyticsAction
  ],
  providers: [],
  services: [],
  evaluators: []
};
var index_default = openLessonPlugin;
export {
  adaptPlanAction,
  analyzeHeartbeatAction,
  askAssistantAction,
  createPlanAction,
  createPlanFromVideoAction,
  index_default as default,
  endSessionAction,
  getAnalyticsAction,
  openLessonPlugin,
  pauseSessionAction,
  resumeSessionAction,
  startSessionAction
};
//# sourceMappingURL=index.js.map