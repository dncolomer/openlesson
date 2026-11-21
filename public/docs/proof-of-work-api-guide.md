# Uncertain Systems Flow API

One family:

- **Flow management (`/api/v3/flows`)** — create, list, update, and delete independent **Solve / Calibration / Verification** flows.
- **Knowledge region candidate (`/api/v3/knowledge-regions/{id}/candidates/{candidate_id}`)** — closed render payload for one person in one region. Query `space=`.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (Calibrate, Learn, and Verify).

Authenticate with `Authorization: Bearer <api_key>`. MCP (`POST /api/mcp`) has 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

## Flow management

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` / `POST` | `/api/v3/flows` | `list_flows` / `create_flow` | List or create independent Solve, Calibration, or Verification (`kind`). Create uses one Author source: written `topic` (optional `exact_problem_on_canvas`), files (problem generated when a learner opens), or `opening_canvas_scene`. |
| `POST` | `/api/v3/flows/files` | `upload_flow_file` | Upload a Problem-context file; attach `xai_file_id` on create/update. |
| `POST` | `/api/v3/flows/unsys-seed` | `generate_flow_unsys_seed` | Generate the Unsys model from the Problem and artifacts. |
| `GET` / `PATCH` / `DELETE` | `/api/v3/flows/{flow_id}` | `get_flow` / `update_flow` / `delete_flow` | Read, update, or delete one flow. |

Cookie dashboard create remains `POST /api/dashboard/flows`.

MCP tools: `list_flows`, `create_flow`, `upload_flow_file`, `generate_flow_unsys_seed`, `get_flow`, `update_flow`, `delete_flow`, `get_knowledge_region_candidate`.

## Checklist

1. `list_flows`
2. `upload_flow_file` (optional)
3. `generate_flow_unsys_seed` (optional)
4. `create_flow` with `kind` `solve` | `calibration` | `verification`. Choose one Author source: `topic` (optional `exact_problem_on_canvas`), `artifacts` (problem generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed`, `enforced_channels`, `duration_minutes`.
5. `get_flow`
6. `update_flow`
7. `delete_flow` when a flow should be removed

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
