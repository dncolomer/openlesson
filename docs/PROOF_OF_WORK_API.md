# Uncertain Systems Protocol API

See `/docs/proof-of-work-api`, `/skill.md`, and `/coding-agents.md`.

Public families:

- **Protocol API (`/api/v3/protocols`)** — create, list, update, and delete **knowledge verification protocols**.
- **Knowledge Regions API (`/api/v3/knowledge-regions`)** — CRUD, simulation wizard (exploration strategies and AI-use), jobs, stored runs, candidate render, uncertainty-model walk.

Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (knowledge verification protocols).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD remains browser-session (`/api/dashboard/api-keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (API Metered).

Every protocol and knowledge-region call requires **`organization_id`** (JSON, query `?organization_id=`, or header `X-Organization-Id`; MCP argument). Users belong to multiple orgs. Missing → `400` `organization_id_required`. Not a member → `403` `forbidden`.

## Authentication

```http
Authorization: Bearer <api_key>
```

Each key is a single full-access token.

## Protocols (base `/api/v3/protocols`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_protocols` | List knowledge verification protocols in the requested organization. Query `organization_id`. Do not send `kind`. |
| `POST` | `/` | `create_protocol` | Create an independent protocol. Choose one Author source: `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), `artifacts` / `files` (challenge generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed` or `generate_unsys`, `enforced_channels`, `duration_minutes`. Do not send `kind`. |
| `POST` | `/files` | `upload_protocol_file` | Upload a Protocol Challenge context file. Pass `xai_file_id` in `artifacts`. |
| `POST` | `/unsys-seed` | `generate_protocol_unsys_seed` | Generate the Unsys model from The Protocol Challenge and artifacts. |
| `GET` | `/{protocol_id}` | `get_protocol` | Read one protocol. |
| `PATCH` | `/{protocol_id}` | `update_protocol` | Update one protocol (same wizard fields as create). |
| `DELETE` | `/{protocol_id}` | `delete_protocol` | Delete one protocol. |

## Knowledge regions (base `/api/v3/knowledge-regions`)

Full spec: `docs/KNOWLEDGE_REGION_API.md`.

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_knowledge_regions` | List regions in the requested organization. Query `organization_id`. |
| `GET` | `/options` | `get_knowledge_region_options` | Wizard options: protocols, exploration strategies, AI-use catalog, sample bounds. |
| `POST` | `/` | `create_knowledge_region` | Create by running the simulation wizard (`name`, `protocol_ids`, `strategy_ids`, optional `custom_strategies`, `samples_per_strategy`, `include_human_data`, `ai_use_catalog_ids`, `samples_per_ai_use`). |
| `GET` | `/{knowledge_region_id}` | `get_knowledge_region` | Clusters, strategies, AI-use clusters, samples (no vectors). |
| `PATCH` | `/{knowledge_region_id}` | `update_knowledge_region` | Rename. |
| `DELETE` | `/{knowledge_region_id}` | `delete_knowledge_region` | Delete parent and clusters. |
| `POST` | `/{knowledge_region_id}/simulation` | `simulate_knowledge_region` | Add exploration-strategy or AI-use samples. |
| `GET` | `/jobs/{job_id}` | `get_knowledge_region_job` | Poll a simulation job. |
| `GET` | `/{knowledge_region_id}/runs/{run_id}` | `get_knowledge_region_run` | Stored record for one sample. |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Unsys distance, cluster L2, path and pairwise L2. Query `space=` (`path` default). |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model` | `get_knowledge_region_uncertainty_model` | Reference tree plus mapped walk. Query `run_id=`. |

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.
