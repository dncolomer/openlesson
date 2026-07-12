# OpenLesson Proof-of-Work API

The Proof-of-Work API exposes the Verification Workspace workflow: create workspaces, upload proof of work, run unified performance analysis, issue Think Aloud Protocol (TAP) links, and poll TAP completion.

Base path: `/api/v2/agent`

Authenticate with `Authorization: Bearer <api_key>`.

## Evaluation modes

| Mode | Create | Schema | Performance |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | `initial_prompt` | `definition` | Semantic gap analysis |
| `opaque` | `evaluation_mode: "opaque"` + `protocol` | `definition_ref` + `contract.event_verbs` | `protocol_report` + structural scoring |

Opaque mode stores partner references (`goal_ref`, `external_refs`) without semantic inference. Upload metadata is allowlisted; tool payloads are plaintext-linted.

## Endpoints

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces` | `workspaces:write` | Create a workspace (semantic `initial_prompt` or opaque `protocol`). |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in a workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG linked to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/performance` | `workspaces:read` | Structured gap report or free-form performance Q&A. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/tap-links` | `tap:write` | Request a private Think Aloud Protocol (TAP) link for a block. Links open `/tap/session/{token}`. |
| `GET` | `/workspaces/{workspace_id}/tap-links` | `tap:read` | List existing TAP links and completion status. |

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

**Semantic:**

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

**Opaque:**

```json
{
  "evaluation_mode": "opaque",
  "protocol": {
    "protocol_id": "agent-trace-v3",
    "goal_ref": "goal_ref:partner-token-abc"
  },
  "external_refs": { "partner_run_id": "opaque-ref-001" }
}
```

Files are optional (max 5, 10 MB each). Response includes `evaluation_mode` and `privacy`.

## TAP Links

`POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/tap-links`

```json
{ "minutes": 15 }
```

Returns a `private_url` for `/tap/session/{token}`. Poll `GET .../tap-links` for link `status`, then call `POST .../performance` to score TAP proof of work.

Identified gaps can be routed into Integrated Learning Environment (ILE) practice blocks for remediation.

## Guests

Org admins with `org:write` can call `POST /org/guests` to mint `gsk_` keys. Guests may create workspaces, upload proof of work, run performance analysis on their own artifacts, and use TAP links.