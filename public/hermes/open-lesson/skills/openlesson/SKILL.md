# openLesson Agent API v2 Skill

You are an AI agent that can interact with the openLesson tutoring platform via its v2 API.

## Overview

openLesson is a Socratic tutoring system that helps users learn through guided questioning rather than giving answers. The platform supports:
- **Learning Plans** — directed graphs of sessions generated from topics or YouTube videos
- **Tutoring Sessions** — real-time multimodal analysis (audio, text, images) with session plan tracking
- **Teaching Assistant** — in-session Q&A with conversation history
- **Cryptographic Proofs** — SHA-256 fingerprints for every action, Merkle-batched per session
- **Analytics** — deep insights on plans, sessions, and user progress

## Important: No Browser Tool Required

You do not need a browser tool. You only need shell tools (e.g., curl) to make API calls to openLesson.

## Authentication

Include your API key in the Authorization header:
```
Authorization: Bearer YOUR_API_KEY
```

**Important**: Always use `https://www.openlesson.academy` for API calls.

API keys can be generated from the user's dashboard at `/dashboard`. Keys support scoped permissions (`plans:read`, `sessions:write`, `proofs:anchor`, etc.) and optional expiration.

## Credentials

- **Environment variable**: `OPENLESSON_API_KEY`
- **How to obtain**: Generate from the user's dashboard at `/dashboard`
- **No calendar access needed**: "Reminders" means the agent proactively notifies the human when a session is due — this is behavioral, not a technical integration.

## Bash Command Patterns

When running API calls as shell commands, use this pattern to avoid JSON escaping issues:

### Basic POST with JSON body

```bash
bash -c 'printf "{\"topic\":\"Quantum Computing\",\"duration_days\":30}" | curl -X POST "https://www.openlesson.academy/api/v2/agent/plans" -H "Authorization: Bearer $OPENLESSON_API_KEY" -H "Content-Type: application/json" --data-binary @-'
```

### GET with query params

```bash
curl "https://www.openlesson.academy/api/v2/agent/plans?status=active&limit=10" \
  -H "Authorization: Bearer $OPENLESSON_API_KEY"
```

## Endpoints

### 1. Create Learning Plan

Creates a directed graph of learning sessions for a given topic.

**Endpoint**: `POST /api/v2/agent/plans`

**Request**:
```json
{
  "topic": "Machine Learning Fundamentals",
  "duration_days": 30,
  "difficulty": "intermediate",
  "user_context": "I have a CS degree but no ML experience"
}
```

**Response**:
```json
{
  "plan": {
    "id": "uuid",
    "title": "ML Foundations",
    "root_topic": "Machine Learning Fundamentals",
    "status": "active",
    "nodes": [
      {
        "id": "uuid",
        "title": "Introduction to ML",
        "description": "Basic concepts and overview",
        "is_start": true,
        "next_block_ids": ["uuid2"],
        "status": "available"
      }
    ]
  },
  "proof": { "id": "uuid", "type": "plan_created", "fingerprint": "sha256:..." }
}
```

### 2. Create Plan from YouTube Video

**Endpoint**: `POST /api/v2/agent/plans/from-video`

**Request**:
```json
{
  "youtube_url": "https://youtube.com/watch?v=...",
  "duration_days": 14
}
```

### 3. Adapt Plan

Modify a plan using natural language instructions. Completed nodes are preserved.

**Endpoint**: `POST /api/v2/agent/plans/{id}/adapt`

**Request**:
```json
{
  "instruction": "I already know linear algebra, skip those sessions and add more on neural networks",
  "preserve_completed": true
}
```

### 4. Start Session

Start a tutoring session. Sessions can be standalone or linked to a plan node.

**Endpoint**: `POST /api/v2/agent/sessions`

**Request (standalone)**:
```json
{
  "topic": "Explain how gradient descent works"
}
```

**Request (linked to plan)**:
```json
{
  "topic": "Gradient Descent",
  "workspace_id": "uuid",
  "block_id": "uuid",
  "tutoring_language": "en"
}
```

**Response** includes: session details, session plan (goal, strategy, steps), opening probe, and a proof.

### 5. Analysis Heartbeat

Submit multimodal inputs for real-time analysis. Supports audio, text, and images.

**Endpoint**: `POST /api/v2/agent/sessions/{id}/analyze`

**Request**:
```json
{
  "inputs": [
    { "type": "audio", "data": "base64-encoded-audio", "format": "webm" }
  ],
  "context": {
    "active_probe_ids": ["probe-uuid"],
    "tools_in_use": ["notebook"]
  }
}
```

**Text input** (alternative to audio):
```json
{
  "inputs": [
    { "type": "text", "content": "I think gradient descent works by..." }
  ]
}
```

**Response** includes: analysis (gap_score, signals, transcript), session_plan_update, guidance (next_probe, probes_to_archive), and proof.

### 6. Pause Session

**Endpoint**: `POST /api/v2/agent/sessions/{id}/pause`

**Request**:
```json
{
  "reason": "Taking a break",
  "estimated_resume_minutes": 30
}
```

### 7. Resume Session

**Endpoint**: `POST /api/v2/agent/sessions/{id}/resume`

Returns current context and a reorientation probe.

### 8. End Session

**Endpoint**: `POST /api/v2/agent/sessions/{id}/end`

**Request**:
```json
{
  "completion_status": "completed",
  "user_feedback": "Great session, learned a lot"
}
```

**Response** includes: session summary, generated report, statistics, plan_updates (if linked), and proof.

### 9. Ask Teaching Assistant

Ask a question during a session. Maintains conversation history.

**Endpoint**: `POST /api/v2/agent/sessions/{id}/ask`

**Request**:
```json
{
  "question": "Can you explain what a learning rate is?",
  "conversation_id": "uuid"
}
```

**Response**:
```json
{
  "response": {
    "id": "msg-uuid",
    "content": "A learning rate controls how much...",
    "suggested_follow_up": "Try varying the learning rate..."
  },
  "conversation": { "id": "uuid", "message_count": 4 },
  "proof": { "id": "uuid", "type": "assistant_query", "fingerprint": "sha256:..." }
}
```

### 10. Get Analytics

**Endpoint**: `GET /api/v2/agent/analytics/user`

Returns overview (total plans, sessions, completion rates), performance trends, learning history, and achievements.

## Complete Agent Workflow

```python
import base64, requests, os

API_KEY = os.environ["OPENLESSON_API_KEY"]
BASE = "https://www.openlesson.academy"
H = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Step 1: Create a learning plan
plan = requests.post(f"{BASE}/api/v2/agent/plans",
    json={"topic": "Quantum Computing", "duration_days": 14}, headers=H).json()

workspace_id = plan["plan"]["id"]
nodes = plan["plan"]["nodes"]
start_node = next(n for n in nodes if n["is_start"])

# Step 2: Adapt the plan if needed
requests.post(f"{BASE}/api/v2/agent/plans/{workspace_id}/adapt",
    json={"instruction": "Skip intro material, I know the basics"}, headers=H)

# Step 3: Start a session (can be standalone or linked)
session = requests.post(f"{BASE}/api/v2/agent/sessions",
    json={
        "topic": start_node["title"],
        "workspace_id": workspace_id,
        "block_id": start_node["id"]
    }, headers=H).json()

session_id = session["session"]["id"]
print(f"Opening probe: {session['opening_probe']}")

# Step 4: Submit analysis (text or audio)
analysis = requests.post(f"{BASE}/api/v2/agent/sessions/{session_id}/analyze",
    json={"inputs": [{"type": "text", "content": "I think qubits use superposition to..."}]},
    headers=H).json()

print(f"Gap score: {analysis['analysis']['gap_score']}")
print(f"Next probe: {analysis['guidance']['next_probe']['text']}")

# Step 5: Ask the teaching assistant
answer = requests.post(f"{BASE}/api/v2/agent/sessions/{session_id}/ask",
    json={"question": "What exactly is phase kickback?"}, headers=H).json()

print(f"Assistant: {answer['response']['content']}")

# Step 6: End session
report = requests.post(f"{BASE}/api/v2/agent/sessions/{session_id}/end",
    json={"completion_status": "completed"}, headers=H).json()

print(f"Report: {report['report']}")
```

## Error Handling

All errors follow this format:
```json
{
  "error": {
    "code": "not_found",
    "message": "Session not found"
  }
}
```

Common codes:
- **401** `unauthorized` — Invalid or expired API key
- **403** `forbidden` — Missing required scope, or `subscription_lapsed`
- **404** `not_found` — Resource not found
- **422** `validation_error` — Invalid request body
- **429** `rate_limit_exceeded` — Too many requests (120/min)
- **500** `internal_error` — Server error

## Tips for Agents

1. **Multimodal inputs**: The analyze endpoint accepts audio (base64, webm/mp4/ogg), text, and images. Use text for typed responses, audio for speech.
2. **Standalone sessions**: You don't need a plan to start a session. Just provide a topic.
3. **Track gap scores**: Scores below 0.3 indicate strong understanding. Above 0.6 needs follow-up.
4. **Use the teaching assistant**: When stuck on a concept, use `/ask` instead of ending the session.
5. **Pause and resume**: Long learning sessions can be paused and resumed later with full context restoration.
6. **Every action creates a proof**: Proofs can be verified via `GET /api/v2/agent/proofs/{id}/verify`.
7. **Schedule all sessions**: When you generate a learning plan, remind your human when sessions are due.
8. **Adapt plans freely**: Use natural language to restructure plans — the AI preserves completed work.
