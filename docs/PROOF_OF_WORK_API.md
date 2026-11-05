# Uncertain Systems Learning Map API

See [`docs/LEARNING_MAP_API.md`](LEARNING_MAP_API.md) and `/docs/learning-map-api`.

One family:

- **Learning Map and flow management (`/api/v3/workspaces`, `/api/v3/flows`)** — create and edit Learning Maps, Helios map tools, workspace settings, and **Solve / Calibration / Verification** flows (create, list, update, delete, place/link on map tiles).

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (Calibrate, Learn, and Verify).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (API Metered).

## Authentication

```http
Authorization: Bearer <api_key>
```

Each key is a single full-access token.

## Workspace and map management (base `/api/v3/workspaces`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_workspaces` | List accessible Learning Maps. |
| `POST` | `/` | `create_workspace` | Create a Learning Map (`kind: "learning"` / `standard`) only. |
| `GET` | `/{workspace_id}` | `get_workspace` | Metadata, kind, map summary, settings. |
| `PATCH` | `/{workspace_id}` | `update_workspace` | Edit settings, contents, and map. |

## Flows (base `/api/v3/flows`)

`list_flows`, `create_flow`, `get_flow`, `update_flow`, `delete_flow`, `link_flow`.

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
