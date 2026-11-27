# Uncertain Systems agent APIs

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage knowledge verification protocols** or **knowledge regions**.

Public agent families:

1. **Protocol API** — `GET/POST /api/v3/protocols`, `GET/PATCH/DELETE /api/v3/protocols/{protocol_id}`, `POST /api/v3/protocols/files`, `POST /api/v3/protocols/unsys-seed`. Create with `create_protocol` using one Author source: written `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), files (challenge generated when a learner opens), or `opening_canvas_scene`. Protocols are independent. Do not send `kind`.
2. **Knowledge Regions API** — `GET/POST /api/v3/knowledge-regions`, `GET /api/v3/knowledge-regions/options`, `GET/PATCH/DELETE /api/v3/knowledge-regions/{knowledge_region_id}`, `POST /api/v3/knowledge-regions/{knowledge_region_id}/simulation`, `GET /api/v3/knowledge-regions/jobs/{job_id}`, `GET /api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}`, `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`, `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model`. Create matches the dashboard wizard: protocols, exploration strategies, optional AI-use simulation.

**Human-readable spec:** `/docs/proof-of-work-api`  
**Coding agents:** `/coding-agents.md`  
**Knowledge Regions spec:** see `/docs/proof-of-work-api` endpoint index  
**Base URL:** `https://uncertain.systems` (or your self-hosted origin)  
**MCP:** `POST /api/mcp` with `Authorization: Bearer <api_key>`

Proof of work is recorded in the product UI (knowledge verification protocols). Headless `start_session` → `upload_proof_of_work` → `end_session` is **not** a public agent API. Snapshot and Stash are retired.

**API Metered plan required.** Plan-gate failures return **`403` with `error.code = "api_plan_required"`**.

**`organization_id` is required** on every protocol and knowledge-region call (users belong to multiple orgs). REST: body, query, or header `X-Organization-Id`. MCP: tool argument `organization_id`. Missing → `400` `organization_id_required`.

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

`list_protocols`, `create_protocol`, `upload_protocol_file`, `generate_protocol_unsys_seed`, `get_protocol`, `update_protocol`, `delete_protocol`, `list_knowledge_regions`, `get_knowledge_region_options`, `create_knowledge_region`, `get_knowledge_region`, `update_knowledge_region`, `delete_knowledge_region`, `simulate_knowledge_region`, `get_knowledge_region_job`, `get_knowledge_region_run`, `get_knowledge_region_candidate`, `get_knowledge_region_uncertainty_model`

**Partner agents:** `list_protocols`, then `upload_protocol_file` (optional) → `generate_protocol_unsys_seed` (optional) → `create_protocol` → `get_protocol` → `update_protocol`. Use `delete_protocol` when a protocol should be removed. Regions: `get_knowledge_region_options` → `create_knowledge_region` → `get_knowledge_region_job` → `get_knowledge_region`. Render a learner with `get_knowledge_region_candidate`.

---

## Checklist

1. `list_protocols` — knowledge verification protocols owned by this key
2. `upload_protocol_file` for Protocol Challenge context files (PDF, text, image)
3. `generate_protocol_unsys_seed` from The Protocol Challenge and artifacts (or pass `answers_model_seed` / `generate_unsys` on create)
4. `create_protocol` with `challenge`. Choose one Author source: `challenge` (optional `exact_problem_on_canvas`), `artifacts` (`generate_problem_on_open` — a new challenge when a learner opens), or `opening_canvas_scene`. Also `enforced_channels`, `answers_model_seed`, `duration_minutes`. Do not send `kind`.
5. `get_protocol`
6. `update_protocol`
7. `delete_protocol` when a protocol should be removed
8. `get_knowledge_region_options` — protocols, exploration strategies, AI-use catalog, sample bounds
9. `create_knowledge_region` with `name`, `protocol_ids`, `strategy_ids`. Optional `custom_strategies`, `samples_per_strategy`, `include_human_data`, `ai_use_catalog_ids`, `samples_per_ai_use`
10. `get_knowledge_region_job` while status is `queued` or `running`
11. `get_knowledge_region` — clusters, strategies, AI-use clusters, samples
12. `get_knowledge_region_run` with `run_id` from a sample
13. `get_knowledge_region_candidate` with `knowledge_region_id` and `candidate_id` (optional `space`)
14. `get_knowledge_region_uncertainty_model` for the hidden-state walk overlay

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
