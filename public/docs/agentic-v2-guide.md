# OpenLesson Agentic API

The Agentic API exposes only the performance-workspace and GHL-link workflow. It no longer exposes tutoring-session control, analytics, proofs, blockchain anchoring, or tool-usage tracking.

Base path: `/api/v2/agent`

Authenticate with `Authorization: Bearer <api_key>`.

## Endpoints

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces` | `workspaces:write` | Create a Performance Workspace from an initial prompt and optional files. |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in a workspace. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/ghl-links` | `ghl:write` | Request a private GHL link for a block. Links open the GHL Score Session UI. |
| `GET` | `/workspaces/{workspace_id}/ghl-links` | `ghl:read` | List existing GHL links and completion status. |
| `GET` | `/workspaces/{workspace_id}/ghl-links/{link_id}/results` | `ghl:read` | Read completed GHL link results. Incomplete links return status with `null` result fields. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

## Create Workspace

`POST /api/v2/agent/workspaces`

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

Files are optional. Supported types are PDF, plain text, Markdown, JPEG, PNG, and WebP. A workspace can start with up to 5 files, each up to 10 MB.

## GHL Links

GHL means Genuine Human Learning Score. A GHL link opens a private score session URL such as `/ghl-score/session/{token}`. The URL is a bearer link and authenticates the learner directly into that GHL session without requiring an OpenLesson login or Agentic API key.

Request body:

```json
{
  "minutes": 15,
  "guest_user_id": "optional-guest-id",
  "guest_email": "optional-guest-email"
}
```

Only `15` and `30` minute sessions are supported. Results include marker spider scores and `gap_analysis`.

## Organizations And Guests

Teams-tier users can create an organization through `POST /api/organization` and become its admin. Org admins can create guest users with `POST /api/v2/agent/org/guests` by providing an email. Guests receive individual API keys and can access organization workspaces and GHL links. If a guest later signs up with the same email, their real user inherits the guest's organization membership, GHL sessions, and guest API keys.

## Removed Surface

The Agentic API no longer includes proof anchoring, proof lists, plan adaptation, live tutoring sessions, analysis heartbeats, Helios chat, transcript routes, or analytics routes.
