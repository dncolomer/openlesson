"""Tool schemas for the openLesson Hermes agent plugin."""

CREATE_PLAN = {
    "name": "openlesson_create_plan",
    "description": (
        "Create a structured learning plan on openLesson. Generates a directed graph of "
        "tutoring sessions for a given topic. Use this when a user wants to learn something "
        "new and needs a structured multi-session curriculum. Returns the plan with its "
        "session nodes, dependencies, and a cryptographic proof."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "topic": {
                "type": "string",
                "description": "The subject or topic the user wants to learn (e.g. 'Quantum Computing', 'Rust ownership model').",
            },
            "duration_days": {
                "type": "integer",
                "description": "Number of days to spread the plan over. Defaults to 14 if omitted.",
                "minimum": 1,
                "maximum": 365,
            },
            "difficulty": {
                "type": "string",
                "description": "Difficulty level for the plan content.",
                "enum": ["beginner", "intermediate", "advanced"],
            },
            "user_context": {
                "type": "string",
                "description": "Optional background about the learner (e.g. 'I have a CS degree but no ML experience').",
            },
        },
        "required": ["topic"],
    },
}

ADAPT_PLAN = {
    "name": "openlesson_adapt_plan",
    "description": (
        "Adapt an existing openLesson learning plan using natural language instructions. "
        "Use this when a user wants to modify, restructure, skip, or extend parts of their "
        "current plan. Completed sessions are preserved by default. Returns the updated plan "
        "graph and a proof."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "workspace_id": {
                "type": "string",
                "description": "UUID of the plan to adapt.",
            },
            "instruction": {
                "type": "string",
                "description": "Natural language instruction describing how to change the plan (e.g. 'Skip the intro sessions and add more on neural networks').",
            },
            "preserve_completed": {
                "type": "boolean",
                "description": "Whether to keep completed nodes unchanged. Defaults to true.",
            },
        },
        "required": ["workspace_id", "instruction"],
    },
}

PLAN_FROM_VIDEO = {
    "name": "openlesson_plan_from_video",
    "description": (
        "Create a learning plan from a YouTube video on openLesson. The platform extracts "
        "the video content and generates a structured curriculum from it. Use this when a "
        "user shares a YouTube link and wants to learn the material covered in the video."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "youtube_url": {
                "type": "string",
                "description": "Full YouTube URL (e.g. 'https://youtube.com/watch?v=abc123').",
            },
            "duration_days": {
                "type": "integer",
                "description": "Number of days to spread the plan over. Defaults to 14 if omitted.",
                "minimum": 1,
                "maximum": 365,
            },
        },
        "required": ["youtube_url"],
    },
}

START_SESSION = {
    "name": "openlesson_start_session",
    "description": (
        "Start a tutoring session on openLesson. Sessions can be standalone (just a topic) "
        "or linked to a specific node in a learning plan. Returns the session details, a "
        "session plan with goals and strategy, an opening Socratic probe, and a proof. "
        "Use this when the user is ready to begin learning a topic."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "topic": {
                "type": "string",
                "description": "The topic for this tutoring session.",
            },
            "workspace_id": {
                "type": "string",
                "description": "UUID of the learning plan this session belongs to (optional, for plan-linked sessions).",
            },
            "block_id": {
                "type": "string",
                "description": "UUID of the specific plan node this session covers (optional, for plan-linked sessions).",
            },
            "tutoring_language": {
                "type": "string",
                "description": "ISO 639-1 language code for the session (e.g. 'en', 'es', 'fr'). Defaults to 'en'.",
            },
        },
        "required": ["topic"],
    },
}

ANALYZE = {
    "name": "openlesson_analyze",
    "description": (
        "Submit an analysis heartbeat to an active openLesson tutoring session. Sends the "
        "user's response (text, audio, or image) for real-time Socratic analysis. Returns a "
        "gap score, signals, session plan updates, and the next probe. Use this each time "
        "the user provides input during a session. Gap scores below 0.3 indicate strong "
        "understanding; above 0.6 needs follow-up."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": "UUID of the active session.",
            },
            "text_input": {
                "type": "string",
                "description": "The user's text response to the current probe.",
            },
            "audio_base64": {
                "type": "string",
                "description": "Base64-encoded audio data of the user's spoken response.",
            },
            "audio_format": {
                "type": "string",
                "description": "Format of the audio data.",
                "enum": ["webm", "mp4", "ogg", "wav"],
            },
            "image_base64": {
                "type": "string",
                "description": "Base64-encoded image data (e.g. whiteboard photo, diagram).",
            },
            "image_mime_type": {
                "type": "string",
                "description": "MIME type of the image (e.g. 'image/png', 'image/jpeg').",
            },
        },
        "required": ["session_id"],
    },
}

PAUSE_SESSION = {
    "name": "openlesson_pause_session",
    "description": (
        "Pause an active openLesson tutoring session. The session state is preserved and "
        "can be resumed later. Use this when the user needs to take a break."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": "UUID of the session to pause.",
            },
            "reason": {
                "type": "string",
                "description": "Optional reason for pausing (e.g. 'Taking a break').",
            },
        },
        "required": ["session_id"],
    },
}

RESUME_SESSION = {
    "name": "openlesson_resume_session",
    "description": (
        "Resume a previously paused openLesson tutoring session. Restores the full session "
        "context and returns a reorientation probe to get the user back on track. Use this "
        "when the user wants to continue a paused session."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": "UUID of the session to resume.",
            },
            "continuation_context": {
                "type": "string",
                "description": "Optional context about what the user has done since pausing.",
            },
        },
        "required": ["session_id"],
    },
}

END_SESSION = {
    "name": "openlesson_end_session",
    "description": (
        "End an active openLesson tutoring session. Returns a session summary, generated "
        "report, statistics, plan updates (if linked), and a proof. Use this when the user "
        "is done learning or wants to finish the current session."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": "UUID of the session to end.",
            },
            "completion_status": {
                "type": "string",
                "description": "How the session ended.",
                "enum": ["completed", "abandoned", "deferred"],
            },
        },
        "required": ["session_id"],
    },
}

ASK = {
    "name": "openlesson_ask",
    "description": (
        "Ask the openLesson teaching assistant a question during an active session. "
        "Maintains conversation history for context. Use this when the user is stuck on a "
        "concept or wants clarification without ending the session. Prefer this over ending "
        "and restarting."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "description": "UUID of the active session.",
            },
            "question": {
                "type": "string",
                "description": "The question to ask the teaching assistant.",
            },
            "conversation_id": {
                "type": "string",
                "description": "UUID of an existing conversation to continue. Omit to start a new conversation thread.",
            },
        },
        "required": ["session_id", "question"],
    },
}

ANALYTICS = {
    "name": "openlesson_analytics",
    "description": (
        "Retrieve the user's learning analytics from openLesson. Returns an overview of "
        "total plans, sessions, completion rates, performance trends, learning history, and "
        "achievements. Use this when the user wants to see their progress or stats."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
