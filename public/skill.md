# Uncertain Systems agent APIs

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage Learning Maps** plus **Solve, Calibration, and Verification flows**.

There is **one** public agent family:

1. **Learning Map and flow management** — `GET/POST /api/v3/workspaces`, `GET/PATCH /api/v3/workspaces/{id}`, map blocks, Helios `map-tools`, workspace settings, and independent flows (`GET/POST /api/v3/flows`, `GET/PATCH/DELETE /api/v3/flows/{flow_id}`, `POST /api/v3/flows/{flow_id}/link`). Create Learning Maps (`kind: "learning"` / `standard`). Create Solve, Calibration, and Verification with `create_flow`. Flows are independent unless `workspace_id` is set.

**Human-readable spec:** `/docs/learning-map-api`  
**Base URL:** `https://uncertain.systems` (or your self-hosted origin)  
**MCP:** `POST /api/mcp` with `Authorization: Bearer <api_key>`

Proof of work is recorded in the product UI (Calibrate, Learn, and Verify). Headless `start_session` → `upload_proof_of_work` → `end_session` is **not** a public agent API. Snapshot and Stash are retired.

**API Metered plan required.** Plan-gate failures return **`403` with `error.code = "api_plan_required"`**.

---

## Authentication

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

| Key type | Prefix | Created via |
|----------|--------|-------------|
| Organization member | `sk_` | Dashboard Integrations |

Each key is a single full-access token.

**Rate limit:** 120 requests per minute per key. Exceeded → `429` with `error.code = "rate_limit_exceeded"`.

---

## MCP

```http
POST /api/mcp (Authorization: Bearer <api_key>)
Content-Type: application/json
```

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

**Tools (parity with REST under `/api/v3/workspaces` and `/api/v3/flows`):**

`list_workspaces`, `get_workspace`, `create_workspace`, `update_workspace`, `list_blocks`, `update_blocks`, `list_map_tools`, `apply_map_tool`, `get_workspace_settings`, `update_workspace_settings`, `list_flows`, `create_flow`, `get_flow`, `update_flow`, `delete_flow`, `link_flow`

**Partner agents:** `create_workspace` or `get_workspace`, then `list_map_tools` / `apply_map_tool`, then `create_flow` → `link_flow`.

---

## Checklist

1. `create_workspace` (`kind: "learning"`) or `get_workspace`
2. `list_map_tools` / `apply_map_tool` (or `update_blocks`) to shape the Learning Map
3. `create_flow` with `kind` `solve` | `calibration` | `verification` (independent unless `workspace_id` is set)
4. `link_flow` with `workspace_id` and `block_id` to place the flow on a tile

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
