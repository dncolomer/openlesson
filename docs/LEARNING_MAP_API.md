# Uncertain Systems Learning Map API

One public agent family:

- **Learning Map and flow management** (`/api/v3/workspaces`, `/api/v3/flows`) — create and edit Learning Maps, Helios map tools, workspace settings, and **Solve / Calibration / Verification** flows (create, list, update, delete, place/link on map tiles). Flows are independent unless `workspace_id` is set.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (Calibrate, Learn, and Verify).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD is browser-session (`/api/dashboard/api-keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (API Metered).

## Authentication

```http
Authorization: Bearer <api_key>
```

Each key is a single full-access token.

## Learning Maps (base `/api/v3/workspaces`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_workspaces` | List accessible Learning Maps. |
| `POST` | `/` | `create_workspace` | Create a Learning Map (`kind: "learning"` / `standard`) only. |
| `GET` | `/{workspace_id}` | `get_workspace` | Metadata, kind, map summary, settings. |
| `PATCH` | `/{workspace_id}` | `update_workspace` | Edit settings, contents, and map. |
| `GET` | `/{workspace_id}/blocks` | `list_blocks` | Map tiles. |
| `PATCH` | `/{workspace_id}/blocks` | `update_blocks` | Replace map. |
| `GET` | `/{workspace_id}/map-tools` | `list_map_tools` | Helios catalog + snapshot. |
| `POST` | `/{workspace_id}/map-tools` | `apply_map_tool` | Apply Helios tools. |
| `GET` | `/{workspace_id}/settings` | `get_workspace_settings` | Settings. |
| `PATCH` | `/{workspace_id}/settings` | `update_workspace_settings` | Patch settings. |

## Flows (base `/api/v3/flows`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_flows` | Owner-scoped list. Query `kind=`, `workspace_id=`. |
| `POST` | `/` | `create_flow` | Independent flow. Optional `workspace_id`. |
| `GET` | `/{flow_id}` | `get_flow` | Read one flow. |
| `PATCH` | `/{flow_id}` | `update_flow` | Update. |
| `DELETE` | `/{flow_id}` | `delete_flow` | Hard delete. |
| `POST` | `/{flow_id}/link` | `link_flow` | Body `{ workspace_id, block_id }`. |

Nested `/api/v3/workspaces/{workspace_id}/flows` still creates or lists flows on that map.

Interactive reference: `/docs/learning-map-api`. Skill: `/skill.md`.
