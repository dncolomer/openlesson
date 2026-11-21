# Uncertain Systems agent APIs

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage Solve, Calibration, and Verification flows** or **read a knowledge-region candidate**.

Public agent families:

1. **Flow management** — `GET/POST /api/v3/flows`, `GET/PATCH/DELETE /api/v3/flows/{flow_id}`, `POST /api/v3/flows/files`, `POST /api/v3/flows/unsys-seed`. Create Solve, Calibration, and Verification with `create_flow` using one Author source: written `topic` (optional `exact_problem_on_canvas`), files (problem generated when a learner opens), or `opening_canvas_scene`. Flows are independent.
2. **Knowledge region candidate** — `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`. Optional query `space` (`path`, `path+audio`, …).

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

**Tools (parity with REST):**

`list_flows`, `create_flow`, `upload_flow_file`, `generate_flow_unsys_seed`, `get_flow`, `update_flow`, `delete_flow`, `get_knowledge_region_candidate`

**Partner agents:** `list_flows`, then `upload_flow_file` (optional) → `generate_flow_unsys_seed` (optional) → `create_flow` → `get_flow` → `update_flow`. Use `delete_flow` when a flow should be removed. Render a learner with `get_knowledge_region_candidate`.

---

## Checklist

1. `list_flows` — independent Solve, Calibration, and Verification flows
2. `upload_flow_file` for Problem-context files (PDF, text, image)
3. `generate_flow_unsys_seed` from the Problem and artifacts (or pass `answers_model_seed` / `generate_unsys` on create)
4. `create_flow` with `kind` `solve` | `calibration` | `verification`. Choose one Author source: `topic` (optional `exact_problem_on_canvas`), `artifacts` (`generate_problem_on_open` — a new problem when a learner opens), or `opening_canvas_scene`. Also `enforced_channels`, `answers_model_seed`, `duration_minutes`.
5. `get_flow`
6. `update_flow`
7. `delete_flow` when a flow should be removed
8. `get_knowledge_region_candidate` with `knowledge_region_id` and `candidate_id` (optional `space`)

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
