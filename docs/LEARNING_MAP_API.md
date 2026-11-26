# Uncertain Systems Learning Map API

Public agent families:

- **Protocol management** (`/api/v3/protocols`) — create, list, update, and delete knowledge verification protocols. Optional `workspace_id`.
- **Knowledge region candidate** (`/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`).

Learning Map management (`/api/v3/workspaces`) is retired from the public agent surface. Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (knowledge verification protocols).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD is browser-session (`/api/dashboard/api-keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (API Metered).

## Authentication

```http
Authorization: Bearer <api_key>
```

Each key is a single full-access token.

## Protocols (base `/api/v3/protocols`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_protocols` | Owner-scoped list. Query `workspace_id=`. Do not send `kind`. |
| `POST` | `/` | `create_protocol` | Independent protocol. Optional `workspace_id`. One Author source: `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), `artifacts` / `files` (challenge generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed` / `generate_unsys`, `enforced_channels`, `duration_minutes`. Do not send `kind`. |
| `POST` | `/files` | `upload_protocol_file` | Upload Protocol Challenge context file. |
| `POST` | `/unsys-seed` | `generate_protocol_unsys_seed` | Generate Unsys model from The Protocol Challenge + artifacts. |
| `GET` | `/{protocol_id}` | `get_protocol` | Read one protocol. |
| `PATCH` | `/{protocol_id}` | `update_protocol` | Update. |
| `DELETE` | `/{protocol_id}` | `delete_protocol` | Hard delete. |

## Knowledge regions (base `/api/v3/knowledge-regions`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Closed render payload for one candidate. Query `space=` (`path` default, e.g. `path+audio`). |

Interactive reference: `/docs/proof-of-work-api`. Skill: `/skill.md`.
