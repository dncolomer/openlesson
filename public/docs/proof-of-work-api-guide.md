# Uncertain Systems Protocol API

One family:

- **Protocol management (`/api/v3/protocols`)** — create, list, update, and delete **knowledge verification protocols**.
- **Knowledge region candidate (`/api/v3/knowledge-regions/{id}/candidates/{candidate_id}`)** — closed render payload for one person in one region. Query `space=`.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (knowledge verification protocols).

Authenticate with `Authorization: Bearer <api_key>`. MCP (`POST /api/mcp`) has 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

## Protocol management

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` / `POST` | `/api/v3/protocols` | `list_protocols` / `create_protocol` | List or create a knowledge verification protocol. Create uses one Author source: written `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), files (challenge generated when a learner opens), or `opening_canvas_scene`. Do not send `kind`. |
| `POST` | `/api/v3/protocols/files` | `upload_protocol_file` | Upload a Protocol Challenge context file; attach `xai_file_id` on create/update. |
| `POST` | `/api/v3/protocols/unsys-seed` | `generate_protocol_unsys_seed` | Generate the Unsys model from The Protocol Challenge and artifacts. |
| `GET` / `PATCH` / `DELETE` | `/api/v3/protocols/{protocol_id}` | `get_protocol` / `update_protocol` / `delete_protocol` | Read, update, or delete one protocol. |

Cookie dashboard create remains `POST /api/dashboard/protocols`.

MCP tools: `list_protocols`, `create_protocol`, `upload_protocol_file`, `generate_protocol_unsys_seed`, `get_protocol`, `update_protocol`, `delete_protocol`, `get_knowledge_region_candidate`.

## Checklist

1. `list_protocols`
2. `upload_protocol_file` (optional)
3. `generate_protocol_unsys_seed` (optional)
4. `create_protocol` with `challenge`. Choose one Author source: `challenge` (optional `exact_problem_on_canvas`), `artifacts` (challenge generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed`, `enforced_channels`, `duration_minutes`. Do not send `kind`.
5. `get_protocol`
6. `update_protocol`
7. `delete_protocol` when a protocol should be removed

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
