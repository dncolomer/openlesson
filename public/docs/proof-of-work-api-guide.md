# Uncertain Systems Proof-of-Work API

The two public agent APIs are **workspace management** (`/api/v3/workspaces`) and **headless proof-of-work** (`/api/v3/pow`). Create Learning or Verification workspaces, then start, run, and end Calibrate, Learn, and Verify sessions. Snapshot and Stash are retired.

Authenticate with `Authorization: Bearer <api_key>`.

## Evaluation modes

| Mode | Create | Schema | Scoring |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | `POST /api/v3/workspaces` or `/workspace/new` | `definition` | Headless session (`start_session` → `end_session`) |
| `opaque` | `POST /api/v3/workspaces` or `/workspace/new` | `definition_ref` + `contract.event_verbs` | `protocol_report` + structural scoring |

Opaque mode stores partner references (`goal_ref`, `external_refs`) without semantic inference. Upload metadata is allowlisted; tool payloads are plaintext-linted.

## Workspace management

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v3/workspaces` | `workspaces:write` | Create a Learning or Verification workspace (map, settings optional). |
| `GET` / `PATCH` | `/api/v3/workspaces/{workspace_id}` | `workspaces:read` / `write` | Read or edit workspace, map, and settings. |
| `GET` | `/api/v3/workspaces/{workspace_id}/blocks` | `workspaces:read` | List map blocks. |
| `GET` / `PATCH` | `/api/v3/account` | `workspaces:read` / `write` | Account settings. |

## Headless proof-of-work

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v3/pow/workspaces/{workspace_id}/sessions` | `workspaces:write` | Start Calibrate, Learn, or Verify (`flow_kind`). Prepares the answers-model tree and starts the clock. |
| `POST` | `/api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work` | `workspaces:write` | Upload proof events; infer the path (catalogs 4 / 8 / 16). Expired sessions reject further work. |
| `GET` | `/api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}` | `workspaces:read` | Remaining time, inferred path, answers model. |
| `POST` | `/api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/end` | `workspaces:write` | Score the inferred path and persist the flow embedding. |
| `POST` | `/api/v3/pow/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

MCP twins: `create_workspace`, `start_session`, `upload_proof_of_work`, `end_session`.

## Upload Proof of Work

`POST /api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work`

```json
{
  "events": [
    {
      "type": "tool",
      "tool_action": "board_prompt",
      "metadata": { "prompt": "I close this observation." }
    }
  ]
}
```

Supported `type` values: `tool`, `screen` (alias `screenshot`), `video`, `eeg`. Simulated canvas work is stored type `tool`.

## Create Workspace

`POST /api/v3/workspaces` and MCP `create_workspace` create a Learning or Verification workspace. Then run Calibrate, Learn, or Verify through the headless proof-of-work API (`start_session` → `upload_proof_of_work` → `end_session`).

## Guests

Org admins with `org:write` can call `POST /org/guests` to mint `gsk_` keys. Guests may create and edit workspaces they can access and run headless sessions (`start_session` → `upload_proof_of_work` → `end_session`).
