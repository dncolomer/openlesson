# Uncertain Systems public agent APIs

Two families:

- **Workspace management (`/api/v3/workspaces`, `/api/v3/account`)** — create and edit Learning and Verification workspaces, map/contents, workspace settings, account settings.
- **Headless proof-of-work (`/api/v3/pow`)** — start, run, and end Calibrate, Learn, and Verify sessions. Submit proof of work; the server prepares the answers-model tree, infers the path (catalogs 4 / 8 / 16), and enforces the session clock.

Snapshot (`/api/v3/snapshot`) and Stash (`/api/v3/stash`) are product-UI routes, not public agent APIs.

**MCP (`POST /api/mcp`)** exposes the same two APIs with 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/v3/pow/keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (Teams tier).

## Authentication

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`, `org:read`, `org:write`, and `*`.

## Evaluation Modes

Workspaces support two evaluation modes (stored on `workspaces.evaluation_mode`):

| Mode | How workspaces are created | Schema | Performance |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | `POST /api/v3/workspaces` or `/workspace/new` | `definition` rubric text | Headless session (`start_session` → `end_session`) |
| `opaque` | `POST /api/v3/workspaces` or `/workspace/new` | `definition_ref` + `contract.event_verbs` | Structural protocol report (`protocol_report`, `privacy`; no semantic inference) |

**Opaque mode** is for privacy-preserving verification: partner-owned references (`goal_ref`, `definition_ref`, `external_refs`) are stored but never semantically interpreted. Upload metadata is allowlisted; tool payloads are plaintext-linted (file paths rejected unless `metadata.allow_plaintext=true`).

Canonical protocol `agent-trace-v3` phases: `enumerate` → `fingerprint` → `aggregate` → `emit` → `validate`.

## Workspace management (base `/api/v3/workspaces`)

| Method | Path | Scope | MCP tool | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `workspaces:read` | `list_workspaces` | List accessible Learning and Verification workspaces. |
| `POST` | `/` | `workspaces:write` | `create_workspace` | Create a Learning (`kind: "learning"`) or Verification (`kind: "verification"`) workspace. Optional map `blocks`, settings, `initial_prompt`. |
| `GET` | `/{workspace_id}` | `workspaces:read` | `get_workspace` | Metadata, kind, map summary, settings, `workspace_goal`. |
| `PATCH` | `/{workspace_id}` | `workspaces:write` | `update_workspace` | Edit settings, contents, and map. |
| `GET` | `/{workspace_id}/blocks` | `workspaces:read` | `list_blocks` | Map blocks / contents. |
| `PATCH` | `/{workspace_id}/blocks` | `workspaces:write` | `update_blocks` | Replace or patch the map. |
| `GET` | `/{workspace_id}/map-tools` | `workspaces:read` | `list_map_tools` | Helios Learning Map builder catalog + current snapshot (blocks, unusable ground, notes, drawing layers). Learning workspaces only. |
| `POST` | `/{workspace_id}/map-tools` | `workspaces:write` | `apply_map_tool` | Apply one Helios map tool or an atomic `tool_calls` batch (same catalog as in-app Helios). |
| `GET` | `/{workspace_id}/settings` | `workspaces:read` | `get_workspace_settings` | Workspace settings. |
| `PATCH` | `/{workspace_id}/settings` | `workspaces:write` | `update_workspace_settings` | Patch workspace settings. |
| `POST` | `/{workspace_id}/integration-skill` | `workspaces:read` | `generate_integration_skill` | Partner `skill.md` so ChatGPT / Claude can authorize and run the two APIs. |
| `GET` / `PATCH` | `/api/v3/account` | `workspaces:read` / `write` | `get_account_settings` / `update_account_settings` | Account settings for this key. |

## Headless proof-of-work (base `/api/v3/pow`)

| Method | Path | Scope | MCP tool | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/workspaces/{workspace_id}/sessions` | `workspaces:write` | `start_session` | Start Calibrate, Learn, or Verify. Prepares the answers-model tree and starts the clock (1–120 minutes, default 15). |
| `GET` | `/workspaces/{workspace_id}/sessions/{session_id}` | `workspaces:read` | `get_session` | Remaining time, inferred path, focus, answers model. |
| `POST` | `/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work` | `workspaces:write` | `upload_proof_of_work` | Ingest proof events; infer the path on the prepared tree. Expired sessions reject further work (`session_expired`). |
| `POST` | `/workspaces/{workspace_id}/sessions/{session_id}/end` | `workspaces:write` | `end_session` | Score the inferred path and persist the flow embedding. |
| `GET` | `/workspaces/{workspace_id}/flow-embeddings` | `workspaces:read` | `list_flow_embeddings` / `get_flow_embedding` | Recoverable Calibrate / Learn / Verify embeddings (`flowcfg-v1-d96`). |
| `POST` | `/org/guests` | `org:write` | — | Org admins create guest users (not an MCP tool). |
| `GET`/`POST`/`DELETE`/`PATCH` | `/keys…` | browser session | — | API key CRUD is browser-session only (not MCP). |

`flow_kind`: `calibrate` | `learn` | `verify`. `catalog_size`: `4` | `8` | `16`.

Session state (tree, clock, proof, sequence) is persisted so `start_session` then a later `upload_proof_of_work` / `end_session` from another agent instance does not 404.

## Predictive Interruptions (expected free energy)

Every Proof-of-Work API success response (REST and MCP) includes a top-level `interruption` field from the **expected-free-energy interruption policy**.

- **`interruption: null`** — no intervention predicted for this moment.
- **`interruption: { ... }`** — consumer systems should schedule `intervention` after `delay_ms` unless a later Proof-of-Work API response supersedes it.

MCP resource: `uncertain-systems://predictive-interruptions`

## Integration Skill

Generate a custom `skill.md` via `POST /api/v3/workspaces/{workspace_id}/integration-skill` tailored to a workspace.

Response includes `skill_md`, `skill_name`, `suggested_share_path`, and `workspace_summary`.

## Upload Proof of Work (headless session)

```json
{
  "events": [
    {
      "type": "tool",
      "tool_name": "canvas",
      "tool_action": "board_prompt",
      "metadata": { "prompt": "I close this observation." },
      "timestamp_ms": 1710000000000
    }
  ]
}
```

Types: `tool`, `screen` (`screenshot` alias), `video`, `eeg`. Simulated canvas work is stored type `tool`.

**Opaque workspaces:** `metadata` is filtered to an allowlist (`trace_token`, `goal_ref`, `anon`, `event_count`, `schema_version`, `protocol_id`, `phase_id`, `allow_plaintext`). Tool uploads are plaintext-linted; responses may include `evaluation_mode`, `privacy`, and `plaintext_lint`.

## Create Workspace

`POST /api/v3/workspaces` and MCP `create_workspace` create a Learning (`kind: "learning"`) or Verification (`kind: "verification"`) workspace. Optional map `blocks`, settings, and `initial_prompt`. The product UI at `/workspace/new` uses the same core.

## Organizations And Guests

Users on the Teams tier can create an organization with `POST /api/organization` and become its admin. Organization admins can use `POST /api/v3/pow/org/guests` with an `org:write` API key to create guest users by email. Guest users receive individual API keys scoped to workspace management and headless proof-of-work (`workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`). Workspace **creation** is available via `POST /api/v3/workspaces` and MCP `create_workspace`.

Organization-owned workspaces are visible to all real users and guest users in that organization. When a guest signs up later with the same email, their real user account inherits the guest organization membership, practice sessions, and guest API keys.

## Removed From Proof-of-Work API

The public agent surface does not expose Snapshot, Stash, guest practice-link mint, proof tracking, blockchain anchoring, live tutoring sessions, heartbeats, or plan adaptation. Use `start_session` → `upload_proof_of_work` → `end_session` for workspace-linked artifacts.
