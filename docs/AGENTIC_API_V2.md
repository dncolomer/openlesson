# OpenLesson Agentic API

Base path: `/api/v2/agent`

The Agentic API supports only Performance Workspace creation, block discovery, and GHL link/result access.

## Authentication

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`, `org:read`, `org:write`, and `*`.

## Endpoints

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces` | `workspaces:write` | Create a Performance Workspace with an initial prompt and optional files. |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in the workspace. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/ghl-links` | `ghl:write` | Request a private GHL link for a block. |
| `GET` | `/workspaces/{workspace_id}/ghl-links` | `ghl:read` | List existing GHL links and completion status. |
| `GET` | `/workspaces/{workspace_id}/ghl-links/{link_id}/results` | `ghl:read` | Request completed GHL link results. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

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

## Request GHL Link

```json
{
  "minutes": 15,
  "guest_user_id": "optional-guest-id",
  "guest_email": "optional-guest-email"
}
```

Only `15` and `30` minute sessions are supported. Any other value defaults to `15`.

The response includes a private URL for the GHL Score Session UI. GHL means Genuine Human Learning Score. The private URL is a bearer link: opening `/ghl-score/session/{token}` authenticates that GHL session directly without requiring an OpenLesson login or an Agentic API key.

## Organizations And Guests

Users on the Teams tier can create an organization with `POST /api/organization` and become its admin. Organization admins can use `POST /api/v2/agent/org/guests` with an `org:write` API key to create guest users by email. Guest users receive individual API keys scoped to workspace reading and GHL link usage.

Organization-owned workspaces are visible to all real users and guest users in that organization. When a guest signs up later with the same email, their real user account inherits the guest organization membership, GHL sessions, and guest API keys.

## GHL Results

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

## Removed From Agentic API

The Agentic API does not expose proof tracking, blockchain anchoring, tool-usage tracking, live tutoring sessions, heartbeats, chat, analytics, or plan adaptation.
