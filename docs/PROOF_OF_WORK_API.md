# Uncertain Systems Protocol API

See `/docs/proof-of-work-api` and `/skill.md`.

Public families:

- **Protocol management (`/api/v3/protocols`)** — create, list, update, and delete **knowledge verification protocols**.
- **Knowledge region candidate (`/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`)** — closed render payload. Query `space=`.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (knowledge verification protocols).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

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
| `GET` | `/` | `list_protocols` | List accessible knowledge verification protocols. Do not send `kind`. |
| `POST` | `/` | `create_protocol` | Create an independent protocol. Choose one Author source: `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), `artifacts` / `files` (challenge generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed` or `generate_unsys`, `enforced_channels`, `duration_minutes`. Do not send `kind`. |
| `POST` | `/files` | `upload_protocol_file` | Upload a Protocol Challenge context file. Pass `xai_file_id` in `artifacts`. |
| `POST` | `/unsys-seed` | `generate_protocol_unsys_seed` | Generate the Unsys model from The Protocol Challenge and artifacts. |
| `GET` | `/{protocol_id}` | `get_protocol` | Read one protocol. |
| `PATCH` | `/{protocol_id}` | `update_protocol` | Update one protocol (same wizard fields as create). |
| `DELETE` | `/{protocol_id}` | `delete_protocol` | Delete one protocol. |

## Knowledge regions (base `/api/v3/knowledge-regions`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Unsys distance, cluster L2, path and pairwise L2. Query `space=` (`path` default). |

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
