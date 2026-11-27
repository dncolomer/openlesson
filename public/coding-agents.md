# Uncertain Systems — coding agents

Use this file as the skill for Cursor, Claude Code, Codex, Grok, and other coding agents that talk to Uncertain Systems over REST or MCP.

Load this document plus `/skill.md`. Human docs: `/docs/proof-of-work-api`.

## What you can do

Two public families, 1:1 REST ↔ MCP:

1. **Protocol API** (`/api/v3/protocols`) — create, list, update, delete knowledge verification protocols. Match the protocol wizard: one Author source (`challenge`, files, or `opening_canvas_scene`), Unsys seed, enforced channels.
2. **Knowledge Regions API** (`/api/v3/knowledge-regions`) — full CRUD plus the region wizard (protocols, exploration strategies, AI-use simulation) and retrieve (details, jobs, stored runs, candidate render, uncertainty-model walk).

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Do not send `kind` on protocols. Bodies are **snake_case**.

Users belong to **multiple organizations**. Every Protocol and Knowledge Region call requires `organization_id` (the org to target). Missing → `400` `organization_id_required`. Not a member → `403` `forbidden`. An API key bound to one org cannot target another.

REST: JSON `organization_id` (alias `organizationId`), query `?organization_id=`, or header `X-Organization-Id`. MCP: required tool argument `organization_id`.

## Auth

```http
Authorization: Bearer sk_…
Content-Type: application/json
```

Mint the key in dashboard Integrations. API Metered plan required (`403` `api_plan_required`). Rate limit 120 req/min (`429` `rate_limit_exceeded`).

MCP:

```http
POST /api/mcp
Authorization: Bearer sk_…
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

## Protocol API

| Method | Path | MCP |
| :--- | :--- | :--- |
| `GET` | `/api/v3/protocols` | `list_protocols` |
| `POST` | `/api/v3/protocols` | `create_protocol` |
| `POST` | `/api/v3/protocols/files` | `upload_protocol_file` |
| `POST` | `/api/v3/protocols/unsys-seed` | `generate_protocol_unsys_seed` |
| `GET` | `/api/v3/protocols/{protocol_id}` | `get_protocol` |
| `PATCH` | `/api/v3/protocols/{protocol_id}` | `update_protocol` |
| `DELETE` | `/api/v3/protocols/{protocol_id}` | `delete_protocol` |

Create example:

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "exact_problem_on_canvas": true,
  "enforced_channels": { "audio": true, "muse": false, "video": false, "screenshots": false }
}
```

List: `GET /api/v3/protocols?organization_id=<uuid>`.

## Knowledge Regions API

Create uses the same options as `/regions/new`: name → protocols → exploration strategies → optional AI-use → run.

| Method | Path | MCP |
| :--- | :--- | :--- |
| `GET` | `/api/v3/knowledge-regions` | `list_knowledge_regions` |
| `GET` | `/api/v3/knowledge-regions/options` | `get_knowledge_region_options` |
| `POST` | `/api/v3/knowledge-regions` | `create_knowledge_region` |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}` | `get_knowledge_region` |
| `PATCH` | `/api/v3/knowledge-regions/{knowledge_region_id}` | `update_knowledge_region` |
| `DELETE` | `/api/v3/knowledge-regions/{knowledge_region_id}` | `delete_knowledge_region` |
| `POST` | `/api/v3/knowledge-regions/{knowledge_region_id}/simulation` | `simulate_knowledge_region` |
| `GET` | `/api/v3/knowledge-regions/jobs/{job_id}` | `get_knowledge_region_job` |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}` | `get_knowledge_region_run` |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model` | `get_knowledge_region_uncertainty_model` |

### Wizard options

`GET /api/v3/knowledge-regions/options` returns:

- `wizard_steps`: `name`, `protocols`, `explore`, `ai-use`, `run`
- `strategies` — built-in exploration strategies (`exploit-heavy`, `information-seeking`, `novelty-seeking`, `balanced`, `narrow-and-deep`)
- `protocols` — ids you may pass as `protocol_ids`
- `ai_use_catalog` — ids you may pass as `ai_use_catalog_ids` (org OpenRouter key required)
- sample bounds for strategies and AI-use

### Create

```json
{
  "name": "Limits cohort",
  "protocol_ids": ["vf_…"],
  "strategy_ids": ["exploit-heavy", "balanced"],
  "samples_per_strategy": 12,
  "include_human_data": true,
  "ai_use_catalog_ids": ["grok-low"],
  "samples_per_ai_use": 6,
  "custom_strategies": [
    { "name": "Stay on substitution", "instructions": "Pick substitution and stay with it." }
  ]
}
```

Jobs return `202` with `job_id` and `status`. Poll `get_knowledge_region_job` until `done` or `failed`. Then `get_knowledge_region`.

### Retrieve

- `get_knowledge_region` — clusters, AI-use clusters, samples (`run_id`, `identity`, strategy). No vectors.
- `get_knowledge_region_run` — stored record for one sample (`run_id`). No person audio or video.
- `get_knowledge_region_candidate` — closed metrics for one person. Query `space=` (default `path`).
- `get_knowledge_region_uncertainty_model` — reference tree plus mapped walk. Optional `run_id`.

`PATCH` renames. `POST …/simulation` adds more strategy or AI-use samples. `DELETE` removes the parent and cluster rows.

## Agent loop

1. `list_protocols` / `create_protocol` / `get_protocol`
2. `get_knowledge_region_options`
3. `create_knowledge_region`
4. `get_knowledge_region_job` until done
5. `get_knowledge_region`
6. `get_knowledge_region_candidate` or `get_knowledge_region_run` as needed
