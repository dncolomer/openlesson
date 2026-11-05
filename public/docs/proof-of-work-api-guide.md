# Uncertain Systems Learning Map API

One family:

- **Learning Map and flow management (`/api/v3/workspaces`, `/api/v3/flows`)** — create and edit Learning Maps, Helios map tools, workspace settings, and **Solve / Calibration / Verification** flows (create, list, update, delete, place/link on map tiles).

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (Calibrate, Learn, and Verify).

Authenticate with `Authorization: Bearer <api_key>`. MCP (`POST /api/mcp`) has 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

## Workspace and map management

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v3/workspaces` | `create_workspace` | Create a Learning Map (`kind: "learning"` / `standard`) only. |
| `GET` / `PATCH` | `/api/v3/workspaces/{workspace_id}` | `get_workspace` / `update_workspace` | Read or edit workspace, map, and settings. |
| `GET` / `PATCH` | `/api/v3/workspaces/{workspace_id}/blocks` | `list_blocks` / `update_blocks` | Map tiles. |
| `GET` / `POST` | `/api/v3/workspaces/{workspace_id}/map-tools` | `list_map_tools` / `apply_map_tool` | Helios Learning Map builder. |

## Flow management

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` / `POST` | `/api/v3/flows` | `list_flows` / `create_flow` | List or create independent Solve, Calibration, or Verification (`kind`). |
| `GET` / `PATCH` / `DELETE` | `/api/v3/flows/{flow_id}` | `get_flow` / `update_flow` / `delete_flow` | Read, update, or delete one flow. |
| `POST` | `/api/v3/flows/{flow_id}/link` | `link_flow` | Place the flow on a map tile (`workspace_id`, `block_id`). |

Cookie dashboard create remains `POST /api/dashboard/flows`.

MCP tools: `create_workspace`, `list_map_tools`, `apply_map_tool`, `create_flow`, `link_flow`.

## Checklist

1. `create_workspace` (`kind: "learning"`) or `get_workspace`
2. `list_map_tools` / `apply_map_tool` (or `update_blocks`) to shape the Learning Map
3. `create_flow` with `kind` `solve` | `calibration` | `verification`
4. `link_flow` with `workspace_id` and `block_id` to place the flow on a tile

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
