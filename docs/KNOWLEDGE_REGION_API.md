# Uncertain Systems Knowledge Regions API

Public agent family for **Knowledge Regions**. Separate from Protocol API (`create_protocol` / `/api/v3/protocols`).

See `/docs/proof-of-work-api`, `/skill.md`, and `/coding-agents.md`.

Cookie dashboard twins remain `/api/dashboard/knowledge-regions` and `/api/dashboard/region-simulation`. Agents use Bearer `/api/v3/knowledge-regions` (options at `/api/v3/knowledge-regions/options`).

**MCP (`POST /api/mcp`)** has 100% tool ↔ REST parity. Public bodies are **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`**.

Every call requires **`organization_id`** (query, JSON body, or header `X-Organization-Id`; MCP argument). Missing → `400` `organization_id_required`. The request org must be one the caller belongs to.

## Authentication

```http
Authorization: Bearer <api_key>
```

## Endpoints (base `/api/v3/knowledge-regions`)

| Method | Path | MCP tool | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `list_knowledge_regions` | List regions in the requested organization. Query `organization_id`. |
| `GET` | `/options` | `get_knowledge_region_options` | Wizard options: protocols, exploration strategies, AI-use catalog, sample bounds. |
| `POST` | `/` | `create_knowledge_region` | Create by running the simulation wizard. |
| `GET` | `/{knowledge_region_id}` | `get_knowledge_region` | Read one region: clusters, strategies, AI-use clusters, samples (no vectors). |
| `PATCH` | `/{knowledge_region_id}` | `update_knowledge_region` | Rename. |
| `DELETE` | `/{knowledge_region_id}` | `delete_knowledge_region` | Delete parent and simulation clusters. |
| `POST` | `/{knowledge_region_id}/simulation` | `simulate_knowledge_region` | Add exploration-strategy or AI-use samples. |
| `GET` | `/jobs/{job_id}` | `get_knowledge_region_job` | Poll a simulation job. |
| `GET` | `/{knowledge_region_id}/runs/{run_id}` | `get_knowledge_region_run` | Stored record for one sample. No person audio or video. |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}` | `get_knowledge_region_candidate` | Closed candidate metrics. Query `space=`. |
| `GET` | `/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model` | `get_knowledge_region_uncertainty_model` | Reference tree plus mapped walk. Query `run_id=`. |

## Create body (wizard)

Matches `/regions/new`:

- `organization_id` (required)
- `name` (required)
- `protocol_ids` (at least one)
- `strategy_ids` (at least one built-in or custom)
- `custom_strategies` optional prompt string, `{ prompt }`, or `{ name, prompt }` (`instructions` alias of `prompt`)
- `samples_per_strategy` 3–48, default 12
- `include_human_data` overlay real protocol sessions
- `ai_use_catalog_ids` from options (org OpenRouter key required)
- `samples_per_ai_use` 3–12, default 6

Built-in strategies: `exploit-heavy`, `information-seeking`, `novelty-seeking`, `balanced`, `narrow-and-deep`.

Jobs return HTTP `202` with `job_id`. Poll until `done` or `failed`. MCP cannot consume NDJSON; poll `GET /jobs/{job_id}` or wait for the sync JSON path.

## Retrieve

`GET /{id}` returns clusters, AI-use clusters, and samples (`run_id`, `identity`, strategy). No vectors.

`GET /{id}/runs/{run_id}` hydrates the stored record for one sample. No person audio or video.

`GET /{id}/candidates/{candidate_id}` is a closed metrics payload (unsys distance, cluster L2, path and pairwise L2). Query `space=` (default `path`). Unknown candidate: `200` with empty observations. No vectors, other people’s points, PoW, or transcripts.

`GET /{id}/candidates/{candidate_id}/uncertainty-model` returns the reference tree plus the mapped walk. Query `run_id=`.

`PATCH` renames. `POST /{id}/simulation` adds more exploration-strategy or AI-use samples. `DELETE` removes the parent and simulation cluster rows.
