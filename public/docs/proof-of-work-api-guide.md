# Uncertain Systems Flow API

One family:

- **Flow management (`/api/v3/flows`)** — create, list, update, and delete independent **Solve / Calibration / Verification** flows.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (Calibrate, Learn, and Verify).

Authenticate with `Authorization: Bearer <api_key>`. MCP (`POST /api/mcp`) has 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

## Flow management

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` / `POST` | `/api/v3/flows` | `list_flows` / `create_flow` | List or create independent Solve, Calibration, or Verification (`kind`). |
| `GET` / `PATCH` / `DELETE` | `/api/v3/flows/{flow_id}` | `get_flow` / `update_flow` / `delete_flow` | Read, update, or delete one flow. |

Cookie dashboard create remains `POST /api/dashboard/flows`.

MCP tools: `list_flows`, `create_flow`, `get_flow`, `update_flow`, `delete_flow`.

## Checklist

1. `list_flows`
2. `create_flow` with `kind` `solve` | `calibration` | `verification`
3. `get_flow`
4. `update_flow`
5. `delete_flow` when a flow should be removed

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
