# Uncertain Systems Proof-of-Work API

The Proof-of-Work API exposes the Verification Workspace workflow on **UI-created** workspaces: upload proof of work, run **three vertical scores** (verification, augmentation, optimization), issue Think Aloud Protocol (TAP) links, and poll TAP completion. Workspace creation is product UI only (`/workspace/new`).

Capture: `/api/v3/pow` · Evaluation: `/api/v3/eval`

Authenticate with `Authorization: Bearer <api_key>`.

## Evaluation modes

| Mode | Create | Schema | Scoring |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | **UI only** (`/workspace/new`) | `definition` | Vertical scores with semantic gap analysis |
| `opaque` | **UI only** (`/workspace/new`) | `definition_ref` + `contract.event_verbs` | `protocol_report` + structural scoring |

Opaque mode stores partner references (`goal_ref`, `external_refs`) without semantic inference. Upload metadata is allowlisted; tool payloads are plaintext-linted.

## Endpoints

| Method | Path | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in a workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG linked to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/verification-score` | `workspaces:read` | Learning verification score (0–100) + spider, analysis, next actions. **TAP auto-results use this only.** |
| `POST` | `/workspaces/{workspace_id}/augmentation-score` | `workspaces:read` | Learning augmentation / practice-readiness score (0–100). |
| `POST` | `/workspaces/{workspace_id}/optimization-score` | `workspaces:read` | Learning optimization score toward `workspace_goal` (0–100). |
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
| `POST .../verification-score` | `verification_score` | `verification_score` |
| `POST .../augmentation-score` | `augmentation_score` | `augmentation_score` |
| `POST .../optimization-score` | `optimization_score` | `optimization_score` |

- **Verification** — learning verification (knowledge coverage). TAP is a verification tool and auto-results always call verification-score only.
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

Returns a `private_url` for `/tap/session/{token}`. Workspace-scoped links evaluate the whole workspace; block-scoped links focus on that block. Poll `GET .../tap-links` for link `status`, then call `POST .../verification-score` to score TAP proof of work (verification only).

Identified gaps can be routed into Integrated Learning Environment (ILE) practice blocks for remediation.

## Guests

Org admins with `org:write` can call `POST /org/guests` to mint `gsk_` keys. Guests may upload proof of work, run vertical scores on their own artifacts, and use TAP links on accessible (UI-created) workspaces.
