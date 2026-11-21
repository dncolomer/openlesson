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
| `POST` | `/` | `create_flow` | Independent flow. Optional `workspace_id`. One Author source: `topic` (optional `exact_problem_on_canvas`), `artifacts` / `files` (problem generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed` / `generate_unsys`, `enforced_channels`, `duration_minutes`. |
| `POST` | `/files` | `upload_flow_file` | Upload Problem-context file. |
| `POST` | `/unsys-seed` | `generate_flow_unsys_seed` | Generate Unsys model from Problem + artifacts. |
| `GET` | `/{flow_id}` | `get_flow` | Read one flow. |
| `PATCH` | `/{flow_id}` | `update_flow` | Update. |
| `DELETE` | `/{flow_id}` | `delete_flow` | Hard delete. |

## Knowledge regions (base `/api/v3/knowledge-regions`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Closed render payload for one candidate. Query `space=` (`path` default, e.g. `path+audio`). |

Interactive reference: `/docs/learning-map-api`. Skill: `/skill.md`.
