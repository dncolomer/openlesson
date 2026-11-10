# Uncertain Systems agent APIs

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage Solve, Calibration, and Verification flows**.

There is **one** public agent family:

1. **Flow management** — `GET/POST /api/v3/flows`, `GET/PATCH/DELETE /api/v3/flows/{flow_id}`. Create Solve, Calibration, and Verification with `create_flow`. Flows are independent.

**Human-readable spec:** `/docs/proof-of-work-api`  
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

**Tools (parity with REST under `/api/v3/flows`):**

`list_flows`, `create_flow`, `get_flow`, `update_flow`, `delete_flow`

**Partner agents:** `list_flows`, then `create_flow` → `get_flow` → `update_flow`. Use `delete_flow` when a flow should be removed.

---

## Checklist

1. `list_flows` — independent Solve, Calibration, and Verification flows
2. `create_flow` with `kind` `solve` | `calibration` | `verification`
3. `get_flow`
4. `update_flow`
5. `delete_flow` when a flow should be removed

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
