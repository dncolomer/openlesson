# Uncertain Systems Learning Map API

Public agent families:

- **Protocol API** (`/api/v3/protocols`) — create, list, update, and delete knowledge verification protocols. Optional `workspace_id`.
- **Knowledge Regions API** (`/api/v3/knowledge-regions`) — CRUD, simulation wizard, jobs, stored runs, candidate render, uncertainty-model walk.

Learning Map management (`/api/v3/workspaces`) is retired from the public agent surface. Headless proof-of-work (`/api/v3/pow` sessions, upload, end, embeddings, schema), Snapshot, and Stash are not public agent APIs. Proof of work is recorded in the product UI (knowledge verification protocols).

**MCP (`POST /api/mcp`)** exposes the same family with 100% tool ↔ REST parity. Key CRUD is browser-session (`/api/dashboard/api-keys`).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (API Metered).

## Authentication

```http
Authorization: Bearer <api_key>
```

Each key is a single full-access token.

## Protocols (base `/api/v3/protocols`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_protocols` | Organization-scoped list. Query `organization_id` (required) and optional `workspace_id=`. Do not send `kind`. |
| `POST` | `/` | `create_protocol` | Independent protocol. Optional `workspace_id`. One Author source: `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), `artifacts` / `files` (challenge generated when a learner opens), or `opening_canvas_scene`. Also `answers_model_seed` / `generate_unsys`, `enforced_channels`, `duration_minutes`. Do not send `kind`. |
| `POST` | `/files` | `upload_protocol_file` | Upload Protocol Challenge context file. |
| `POST` | `/unsys-seed` | `generate_protocol_unsys_seed` | Generate Unsys model from The Protocol Challenge + artifacts. |
| `GET` | `/{protocol_id}` | `get_protocol` | Read one protocol. |
| `PATCH` | `/{protocol_id}` | `update_protocol` | Update. |
| `DELETE` | `/{protocol_id}` | `delete_protocol` | Hard delete. |

## Knowledge regions (base `/api/v3/knowledge-regions`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_knowledge_regions` | List regions in the active organization. |
| `GET` | `/options` | `get_knowledge_region_options` | Wizard options: protocols, exploration strategies, AI-use catalog, sample bounds. |
| `POST` | `/` | `create_knowledge_region` | Create by running the simulation wizard. |
| `GET` | `/{knowledge_region_id}` | `get_knowledge_region` | Clusters, strategies, AI-use clusters, samples (no vectors). |
| `PATCH` | `/{knowledge_region_id}` | `update_knowledge_region` | Rename. |
| `DELETE` | `/{knowledge_region_id}` | `delete_knowledge_region` | Delete parent and clusters. |
| `POST` | `/{knowledge_region_id}/simulation` | `simulate_knowledge_region` | Add exploration-strategy or AI-use samples. |
| `GET` | `/jobs/{job_id}` | `get_knowledge_region_job` | Poll a simulation job. |
| `GET` | `/{knowledge_region_id}/runs/{run_id}` | `get_knowledge_region_run` | Stored record for one sample. |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Closed render payload for one candidate. Query `space=` (`path` default, e.g. `path+audio`). |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model` | `get_knowledge_region_uncertainty_model` | Reference tree plus mapped walk. Query `run_id=`. |

Interactive reference: `/docs/proof-of-work-api`. Skill: `/skill.md`. Coding agents: `/coding-agents.md`. Full region spec: `docs/KNOWLEDGE_REGION_API.md`.
