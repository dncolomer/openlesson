# OpenLesson Proof-of-Work API

The Proof-of-Work API exposes the performance-workspace workflow: create workspaces, upload proof of work, analyze learning gaps, issue Think Aloud Protocol (TAP) links, and read results.

Base path: `/api/v2/agent`

Authenticate with `Authorization: Bearer <api_key>`.

## Endpoints

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces` | `workspaces:write` | Create a Verification Workspace from an initial prompt and optional files. |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in a workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG linked to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/performance` | `workspaces:read` | Structured gap report or free-form performance Q&A. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/tap-links` | `tap:write` | Request a private TAP link for a block. Links open the TAP Score Session UI. |
| `GET` | `/workspaces/{workspace_id}/tap-links` | `tap:read` | List existing TAP links and completion status. |
| `GET` | `/workspaces/{workspace_id}/tap-links/{link_id}/results` | `tap:read` | Read completed TAP link results. Incomplete links return status with `null` result fields. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

## Upload Proof of Work

`POST /api/v2/agent/workspaces/{workspace_id}/proof-of-work`

```json
{
  "type": "screen",
  "mime_type": "image/png",
  "data": "base64-encoded-bytes",
  "block_id": "optional-block-uuid",
  "metadata": { "step": "discovery-call" }
}
```

Supported `type` values: `tool`, `screen` (alias `screenshot`), `video`, `eeg`. Max 10 MB.

## Performance Analysis

`POST /api/v2/agent/workspaces/{workspace_id}/performance`

Report mode (empty body or only `block_id`):

```json
{ "block_id": "optional-block-uuid" }
```

Chat mode:

```json
{
  "prompt": "Summarize readiness risks across this workspace.",
  "conversation_history": []
}
```

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

## TAP Links

`POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/tap-links`

```json
{ "minutes": 15 }
```

Returns a `private_url` for `/ghl-score/session/{token}`. Poll `GET .../tap-links/{link_id}/results` for marker scores and `gap_analysis`.

Identified gaps can be routed into Integrated Learning Environment (ILE) practice blocks for remediation.

## Guests

Org admins with `org:write` can call `POST /org/guests` to mint `gsk_` keys. Guests may create workspaces, upload proof of work, run performance analysis on their own artifacts, and use TAP links.