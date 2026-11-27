# Uncertain Systems Protocol API

Two families:

- **Protocol API (`/api/v3/protocols`)** — create, list, update, and delete **knowledge verification protocols**.
- **Knowledge Regions API (`/api/v3/knowledge-regions`)** — CRUD, simulation wizard (exploration strategies and AI-use), jobs, stored runs, candidate render, uncertainty-model walk.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (knowledge verification protocols).

Authenticate with `Authorization: Bearer <api_key>`. MCP (`POST /api/mcp`) has 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`). Every protocol and knowledge-region call requires `organization_id` (JSON, query, or header `X-Organization-Id`; MCP argument).

## Protocol management

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` / `POST` | `/api/v3/protocols` | `list_protocols` / `create_protocol` | List or create a knowledge verification protocol. Create uses one Author source: written `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), files (challenge generated when a learner opens), or `opening_canvas_scene`. Do not send `kind`. |
| `POST` | `/api/v3/protocols/files` | `upload_protocol_file` | Upload a Protocol Challenge context file; attach `file_id` on create/update. |
| `POST` | `/api/v3/protocols/unsys-seed` | `generate_protocol_unsys_seed` | Generate the Unsys model from The Protocol Challenge and artifacts. |
| `GET` | `/api/v3/protocols/{protocol_id}/url` | `get_protocol_url` | Public launch URL. Query `identity` (aliases `id`, `candidate_id`) to prepopulate the participant ID so Identify yourself is skipped. |
| `GET` / `PATCH` / `DELETE` | `/api/v3/protocols/{protocol_id}` | `get_protocol` / `update_protocol` / `delete_protocol` | Read, update, or delete one protocol. |

Cookie dashboard create remains `POST /api/dashboard/protocols`.

## Knowledge regions

| Method | Path | MCP tool | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` / `POST` | `/api/v3/knowledge-regions` | `list_knowledge_regions` / `create_knowledge_region` | List regions, or create by running the simulation wizard (`name`, `protocol_ids`, `strategy_ids`, optional AI-use). |
| `GET` | `/api/v3/knowledge-regions/options` | `get_knowledge_region_options` | Wizard options: protocols, exploration strategies, AI-use catalog, sample bounds. |
| `GET` / `PATCH` / `DELETE` | `/api/v3/knowledge-regions/{knowledge_region_id}` | `get_knowledge_region` / `update_knowledge_region` / `delete_knowledge_region` | Read (clusters + samples), rename, or delete. |
| `POST` | `/api/v3/knowledge-regions/{knowledge_region_id}/simulation` | `simulate_knowledge_region` | Add exploration-strategy or AI-use samples. |
| `GET` | `/api/v3/knowledge-regions/jobs/{job_id}` | `get_knowledge_region_job` | Poll a simulation job. |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}` | `get_knowledge_region_run` | Stored record for one sample. |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Closed render payload. Query `space=`. |
| `GET` | `/api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model` | `get_knowledge_region_uncertainty_model` | Reference tree plus mapped walk. |

MCP tools: `list_protocols`, `create_protocol`, `upload_protocol_file`, `generate_protocol_unsys_seed`, `get_protocol`, `get_protocol_url`, `update_protocol`, `delete_protocol`, `list_knowledge_regions`, `get_knowledge_region_options`, `create_knowledge_region`, `get_knowledge_region`, `update_knowledge_region`, `delete_knowledge_region`, `simulate_knowledge_region`, `get_knowledge_region_job`, `get_knowledge_region_run`, `get_knowledge_region_candidate`, `get_knowledge_region_uncertainty_model`. Expand each endpoint on `/docs/proof-of-work-api` for curl, JavaScript, and Python.

Coding agents: `/coding-agents.md`.

## Checklist

1. `list_protocols` with `organization_id`
2. `upload_protocol_file` (optional)
3. `generate_protocol_unsys_seed` (optional)
4. `create_protocol` with `challenge`. Choose one Author source: `challenge` (optional `exact_problem_on_canvas`), `artifacts` (challenge generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed`, `enforced_channels`, `duration_minutes`. Do not send `kind`.
5. `get_protocol`
6. `get_protocol_url` (optional `identity` query)
7. `update_protocol`
8. `delete_protocol` when a protocol should be removed
9. `get_knowledge_region_options` then `create_knowledge_region`
10. `get_knowledge_region` / `get_knowledge_region_candidate` / `get_knowledge_region_run`

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
