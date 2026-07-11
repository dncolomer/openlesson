"""Tool handlers for the openLesson Hermes agent plugin.

All handlers use only the Python standard library (urllib.request) so the
plugin has zero external dependencies.
"""

import json
import os
import urllib.request
import urllib.error

BASE_URL = "https://www.openlesson.academy"


def _api_request(method: str, path: str, body: dict | None = None) -> dict:
    """Make an authenticated request to the openLesson v2 API.

    Returns the parsed JSON response body on success, or raises on HTTP errors.
    """
    api_key = os.environ["OPENLESSON_API_KEY"]
    url = f"{BASE_URL}{path}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        try:
            return json.loads(error_body)
        except json.JSONDecodeError:
            return {"error": {"code": str(exc.code), "message": error_body}}


def _ok(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False)


def _err(message: str) -> str:
    return json.dumps({"error": {"code": "plugin_error", "message": message}})


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------


def create_plan(args: dict, **kwargs) -> str:
    """Create a learning plan."""
    try:
        body: dict = {"topic": args["topic"]}
        for key in ("duration_days", "difficulty", "user_context"):
            if key in args:
                body[key] = args[key]
        result = _api_request("POST", "/api/v2/agent/plans", body)
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def adapt_plan(args: dict, **kwargs) -> str:
    """Adapt an existing learning plan."""
    try:
        workspace_id = args["workspace_id"]
        body: dict = {"instruction": args["instruction"]}
        if "preserve_completed" in args:
            body["preserve_completed"] = args["preserve_completed"]
        result = _api_request("POST", f"/api/v2/agent/plans/{workspace_id}/adapt", body)
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def plan_from_video(args: dict, **kwargs) -> str:
    """Create a learning plan from a YouTube video."""
    try:
        body: dict = {"youtube_url": args["youtube_url"]}
        if "duration_days" in args:
            body["duration_days"] = args["duration_days"]
        result = _api_request("POST", "/api/v2/agent/plans/from-video", body)
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def start_session(args: dict, **kwargs) -> str:
    """Start a tutoring session (standalone or linked to a plan)."""
    try:
        body: dict = {"topic": args["topic"]}
        for key in ("workspace_id", "block_id", "tutoring_language"):
            if key in args:
                body[key] = args[key]
        result = _api_request("POST", "/api/v2/agent/sessions", body)
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def analyze(args: dict, **kwargs) -> str:
    """Submit an analysis heartbeat with multimodal inputs."""
    try:
        session_id = args["session_id"]
        inputs: list[dict] = []

        if "text_input" in args:
            inputs.append({"type": "text", "content": args["text_input"]})
        if "audio_base64" in args:
            audio_input: dict = {"type": "audio", "data": args["audio_base64"]}
            if "audio_format" in args:
                audio_input["format"] = args["audio_format"]
            inputs.append(audio_input)
        if "image_base64" in args:
            image_input: dict = {"type": "image", "data": args["image_base64"]}
            if "image_mime_type" in args:
                image_input["mime_type"] = args["image_mime_type"]
            inputs.append(image_input)

        body: dict = {"inputs": inputs} if inputs else {}
        result = _api_request(
            "POST", f"/api/v2/agent/sessions/{session_id}/analyze", body
        )
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def pause_session(args: dict, **kwargs) -> str:
    """Pause an active session."""
    try:
        session_id = args["session_id"]
        body: dict = {}
        if "reason" in args:
            body["reason"] = args["reason"]
        result = _api_request(
            "POST", f"/api/v2/agent/sessions/{session_id}/pause", body
        )
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def resume_session(args: dict, **kwargs) -> str:
    """Resume a paused session."""
    try:
        session_id = args["session_id"]
        body: dict = {}
        if "continuation_context" in args:
            body["continuation_context"] = args["continuation_context"]
        result = _api_request(
            "POST", f"/api/v2/agent/sessions/{session_id}/resume", body
        )
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def end_session(args: dict, **kwargs) -> str:
    """End a session and get the summary report."""
    try:
        session_id = args["session_id"]
        body: dict = {}
        if "completion_status" in args:
            body["completion_status"] = args["completion_status"]
        result = _api_request("POST", f"/api/v2/agent/sessions/{session_id}/end", body)
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def ask_assistant(args: dict, **kwargs) -> str:
    """Ask the teaching assistant a question during a session."""
    try:
        session_id = args["session_id"]
        body: dict = {"question": args["question"]}
        if "conversation_id" in args:
            body["conversation_id"] = args["conversation_id"]
        result = _api_request("POST", f"/api/v2/agent/sessions/{session_id}/ask", body)
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))


def get_analytics(args: dict, **kwargs) -> str:
    """Retrieve the user's learning analytics."""
    try:
        result = _api_request("GET", "/api/v2/agent/analytics/user")
        return _ok(result)
    except Exception as exc:
        return _err(str(exc))
