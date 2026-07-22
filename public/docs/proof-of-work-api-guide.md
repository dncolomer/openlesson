# Uncertain Systems Proof-of-Work API

The Proof-of-Work API exposes the workspace workflow on **UI-created** workspaces: upload proof of work, run an **LWM Snapshot** (`lwm-snapshot` — sole product score strategy; GHC secondary), issue Think Aloud Protocol (TAP) links, and poll TAP completion. Workspace creation is product UI only (`/workspace/new`).

Capture: `/api/v3/pow` · Evaluation: `/api/v3/eval`

Authenticate with `Authorization: Bearer <api_key>`.

## Evaluation modes

| Mode | Create | Schema | Scoring |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | **UI only** (`/workspace/new`) | `definition` | LWM Snapshot (`lwm_snapshot` + GHC) with semantic gap analysis |
| `opaque` | **UI only** (`/workspace/new`) | `definition_ref` + `contract.event_verbs` | `protocol_report` + structural scoring |

Opaque mode stores partner references (`goal_ref`, `external_refs`) without semantic inference. Upload metadata is allowlisted; tool payloads are plaintext-linted.

## Endpoints

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in a workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG linked to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/lwm-snapshot` | `workspaces:read` | LWM Snapshot score (0–100; LWM Snapshot strategy) + spider, analysis, next actions. **TAP/ILE end always use this path.** |
| `POST` | `/workspaces/{workspace_id}/tap-links` | `tap:write` | Request a private TAP link for the full workspace (optional body `block_id`). Links open `/tap/session/{token}`. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/tap-links` | `tap:write` | Request a private TAP link scoped to a single block. |
| `GET` | `/workspaces/{workspace_id}/tap-links` | `tap:read` | List existing TAP links and completion status. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

## Upload Proof of Work

`POST /api/v3/pow/workspaces/{workspace_id}/proof-of-work`

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

## Vertical scores

Each score endpoint returns **one** primary 0–100 score for that vertical, plus spider/radar `marker_scores`, analysis, and next actions. Shared request body:

```json
{ "block_id": "optional-block-uuid", "style_prompt": "optional voice/tone" }
```

| Path | MCP tool | Primary field |
| :--- | :--- | :--- |
| `POST .../lwm-snapshot` | `lwm_snapshot` | `lwm_snapshot_score` |

- **Verification** — learning verification (knowledge coverage). TAP/ILE end always run LWM Snapshot (`lwm-snapshot`).
- **Augmentation** — practice / improvement readiness.
- **Optimization** — progress toward the inferred `workspace_goal` (score units 0–100; replaces former conversion %).

## Create Workspace (UI only)

Programmatic create is **not available**. `POST /api/v3/pow/workspaces` and MCP `create_workspace` are rejected with `403 forbidden`. Create workspaces in the product UI at `/workspace/new`, then use list/get/progress APIs against that workspace ID.

## TAP Links

**Full workspace** (omit `block_id`):

`POST /api/v3/pow/workspaces/{workspace_id}/tap-links`

```json
{ "minutes": 15 }
```

**Single block** (path or body):

`POST /api/v3/pow/workspaces/{workspace_id}/blocks/{block_id}/tap-links`

```json
{ "minutes": 15 }
```

Returns a `private_url` for `/tap/session/{token}`. Workspace-scoped links evaluate the whole workspace; block-scoped links focus on that block. Poll `GET .../tap-links` for link `status`, then call `POST .../lwm-snapshot` to score TAP proof of work (verification only).

Identified gaps can be routed into Integrated Learning Environment (ILE) practice blocks for remediation.

## Guests

Org admins with `org:write` can call `POST /org/guests` to mint `gsk_` keys. Guests may upload proof of work, run vertical scores on their own artifacts, and use TAP links on accessible (UI-created) workspaces.
