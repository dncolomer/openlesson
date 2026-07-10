# OpenLesson Evidence API

Base path: `/api/v2/agent`

The Evidence API supports Verification Workspace creation, evidence upload, learning analysis, block discovery, Think Aloud Protocol (TAP) link/result access, and ILE (Integrated Learning Environment) practice routing from gap findings.

## Authentication

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`, `org:read`, `org:write`, and `*`.

## Endpoints

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces` | `workspaces:write` | Create a Verification Workspace with an initial prompt and optional files. |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in the workspace. |
| `POST` | `/workspaces/{workspace_id}/evidence-schema` | `workspaces:read` | Grok-generated JSON Schema for ideal tool evidence input given workspace context + eval definition. |
| `POST` | `/workspaces/{workspace_id}/integration-skill` | `workspaces:read` | Grok-generated workspace-specific `skill.md` integration guide for a partner agent. |
| `POST` | `/workspaces/{workspace_id}/evidence` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG to xAI and link to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/performance` | `workspaces:read` | Structured gap report or free-form Q&A over workspace evidence. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/ghl-links` | `ghl:write` | Request a private Think Aloud Protocol (TAP) link for a block. |
| `GET` | `/workspaces/{workspace_id}/ghl-links` | `ghl:read` | List existing TAP links and completion status. |
| `GET` | `/workspaces/{workspace_id}/ghl-links/{link_id}/results` | `ghl:read` | Request completed TAP session results. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

## Evidence Input Schema

Use before uploading evidence when you want a concrete JSON contract for what your agent should serialize.

```json
{
  "definition": "Evaluate whether the learner can articulate a crisp ICP with segment rationale",
  "block_id": "optional-block-uuid",
  "integration_hints": {
    "tool_name": "pumadoc",
    "partner_agent": "PumaDoc Customer Agent",
    "event_verbs": ["run_simulation", "edit_field"],
    "goals": ["simulation_completed"]
  }
}
```

Response includes `schema` (JSON Schema), `schema_name`, `rationale`, `example_payload`, `recommended_mime_type`, `recommended_evidence_type`, `collection_guidance`, and `file_ids`.

## Integration Skill

Generate a custom `skill.md` (like `/pumadoc-evidence-performance-skill.md`) tailored to a workspace:

```json
{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls",
  "base_url": "https://openlesson.academy",
  "include_sections": ["purpose", "auth", "endpoints", "evidence_payload", "performance", "checklist"]
}
```

Response includes `skill_md`, `skill_name`, `suggested_share_path`, and `workspace_summary`.

## Upload Evidence

```json
{
  "type": "tool",
  "file_name": "events.json",
  "mime_type": "application/json",
  "data": "base64-encoded-bytes",
  "block_id": "optional-block-uuid",
  "session_id": "optional-session-uuid",
  "metadata": {},
  "tool_name": "canvas",
  "tool_action": "draw"
}
```

Types: `tool`, `screen` (`screenshot` alias), `video`, `eeg`. Max 10 MB per file.

## Performance Analysis

**Structured report** (no `prompt`):

```json
{ "block_id": "optional-block-uuid" }
```

**Free-form Q&A**:

```json
{
  "prompt": "Where are the biggest readiness gaps?",
  "block_id": "optional-block-uuid",
  "conversation_history": [],
  "file_ids": []
}
```

Report responses always include:
- `overall_score` (0–100 integer readiness score)
- `marker_scores[]` (spider/radar competency axes: `id`, `label`, `score`, `rationale`)
- `gap_analysis.gaps[]` with `severity` and `suggested_repair`

Chat responses return markdown in `response`.

## Create Workspace

```json
{
  "initial_prompt": "Prepare me to explain vector databases in a technical interview.",
  "files": [
    {
      "name": "notes.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-file"
    }
  ]
}
```

Files are optional. Supported file types are PDF, text, Markdown, JPEG, PNG, and WebP. Limits are 5 files per workspace and 10 MB per file.

## Request TAP Link

```json
{
  "minutes": 15,
  "guest_user_id": "optional-guest-id",
  "guest_email": "optional-guest-email"
}
```

Only `15` and `30` minute sessions are supported. Any other value defaults to `15`.

The response includes a private URL for the TAP session UI. Think Aloud Protocol (TAP) captures live human cognition. The private URL is a bearer link: opening `/ghl-score/session/{token}` authenticates that TAP session directly without requiring an OpenLesson login or an Evidence API key.

## Organizations And Guests

Users on the Teams tier can create an organization with `POST /api/organization` and become its admin. Organization admins can use `POST /api/v2/agent/org/guests` with an `org:write` API key to create guest users by email. Guest users receive individual API keys scoped to workspace creation, workspace reading, and TAP link usage (`ghl:read`, `ghl:write` scopes) (`workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`).

Organization-owned workspaces are visible to all real users and guest users in that organization. When a guest signs up later with the same email, their real user account inherits the guest organization membership, TAP sessions, and guest API keys.

## TAP Results

Completed results include the spider score markers plus a gap analysis:

```json
{
  "ghl_result": {
    "status": "completed",
    "completed": true,
    "overall_score": 82,
    "marker_scores": [
      { "id": "conceptual_clarity", "label": "Conceptual Clarity", "score": 85, "rationale": "string" }
    ],
    "gap_analysis": {
      "summary": "string",
      "gaps": [{ "title": "string", "evidence": "string", "severity": "low | medium | high", "suggested_repair": "string" }],
      "next_practice": ["string"]
    },
    "analysis": {
      "overall_score": 82,
      "markers": [],
      "gap_analysis": {},
      "overall_reflection": "string",
      "strengths": [],
      "growth_areas": [],
      "follow_up_prompts": [],
      "confidence": "emerging | developing | clear | well-connected"
    }
  }
}
```

## Removed From Evidence API

The Evidence API does not expose proof tracking, blockchain anchoring, live tutoring sessions, heartbeats, or plan adaptation. Use `POST .../evidence` for workspace-linked artifacts instead of legacy web-session upload routes.