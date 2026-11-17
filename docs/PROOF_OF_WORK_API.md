# Uncertain Systems Flow API

See `/docs/proof-of-work-api` and `/skill.md`.

Public families:

- **Flow management (`/api/v3/flows`)** — create, list, update, and delete independent **Solve / Calibration / Verification** flows.
- **Knowledge region candidate (`/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`)** — closed render payload. Query `space=`.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (Calibrate, Learn, and Verify).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (API Metered).

## Authentication

```http
Authorization: Bearer <api_key>
```

Each key is a single full-access token.

## Flows (base `/api/v3/flows`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_flows` | List accessible Solve, Calibration, and Verification flows. |
| `POST` | `/` | `create_flow` | Create an independent flow (`kind`: `solve` \| `calibration` \| `verification`). Body matches the dashboard wizard: `name`, `topic` (Problem), `artifacts` / `files`, `answers_model_seed` or `generate_unsys`, `exact_problem_on_canvas` (Solve / Verification), `enforced_channels` (Solve / Verification), `duration_minutes` (Verification / Calibration). |
| `POST` | `/files` | `upload_flow_file` | Upload a Problem-context file. Pass `xai_file_id` in `artifacts`. |
| `POST` | `/unsys-seed` | `generate_flow_unsys_seed` | Generate the Unsys model from the Problem and artifacts. |
| `GET` | `/{flow_id}` | `get_flow` | Read one flow. |
| `PATCH` | `/{flow_id}` | `update_flow` | Update one flow (same wizard fields as create). |
| `DELETE` | `/{flow_id}` | `delete_flow` | Delete one flow. |

## Knowledge regions (base `/api/v3/knowledge-regions`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Unsys distance, cluster L2, path and pairwise L2. Query `space=` (`path` default). |

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
