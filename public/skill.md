---
name: protocol-api
description: Create, list, update, and delete Uncertain Systems knowledge verification protocols and knowledge regions over REST (/api/v3/protocols, /api/v3/knowledge-regions) and MCP (POST /api/mcp).
---

# Uncertain Systems Protocol API skill

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage knowledge verification protocols** or **knowledge regions**.

Public agent families:

1. **Protocol API** — `GET/POST /api/v3/protocols`, `GET/PATCH/DELETE /api/v3/protocols/{protocol_id}`, `GET /api/v3/protocols/{protocol_id}/url`, `POST /api/v3/protocols/files`, `POST /api/v3/protocols/unsys-seed`. Create with `create_protocol` using one Author source: written `challenge` (The Protocol Challenge; optional `exact_problem_on_canvas`), files (challenge generated when a learner opens), or `opening_canvas_scene`. Protocols are independent. Do not send `kind`. `get_protocol_url` returns the public `/v/{token}` launch URL. Pass `identity` (or `id`) to prepopulate the participant ID so the protocol does not ask for it.
2. **Knowledge Regions API** — `GET/POST /api/v3/knowledge-regions`, `GET /api/v3/knowledge-regions/options`, `GET/PATCH/DELETE /api/v3/knowledge-regions/{knowledge_region_id}`, `POST /api/v3/knowledge-regions/{knowledge_region_id}/simulation`, `GET /api/v3/knowledge-regions/jobs/{job_id}`, `GET /api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}`, `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`, `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model`. Create matches the dashboard wizard: protocols, exploration strategies, optional AI-use simulation.

**Skill file:** `/skill.md`
**Human docs:** `/docs/proof-of-work-api`
**Base URL:** `https://uncertain.systems` (or your self-hosted origin)
**MCP:** `POST /api/mcp` with `Authorization: Bearer <api_key>`

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

`list_protocols`, `create_protocol`, `upload_protocol_file`, `generate_protocol_unsys_seed`, `get_protocol`, `get_protocol_url`, `update_protocol`, `delete_protocol`, `list_knowledge_regions`, `get_knowledge_region_options`, `create_knowledge_region`, `get_knowledge_region`, `update_knowledge_region`, `delete_knowledge_region`, `simulate_knowledge_region`, `get_knowledge_region_job`, `get_knowledge_region_run`, `get_knowledge_region_candidate`, `get_knowledge_region_uncertainty_model`

**Partner agents:** `list_protocols`, then `upload_protocol_file` (optional) → `generate_protocol_unsys_seed` (optional) → `create_protocol` → `get_protocol` → `get_protocol_url` → `update_protocol`. Use `delete_protocol` when a protocol should be removed. Regions: `get_knowledge_region_options` → `create_knowledge_region` → `get_knowledge_region_job` → `get_knowledge_region`. Render a learner with `get_knowledge_region_candidate`.

---

## Checklist

1. `list_protocols` — knowledge verification protocols owned by this key
2. `upload_protocol_file` for Protocol Challenge context files (PDF, text, image)
3. `generate_protocol_unsys_seed` from The Protocol Challenge and artifacts (or pass `answers_model_seed` / `generate_unsys` on create)
4. `create_protocol` with `challenge`. Choose one Author source: `challenge` (optional `exact_problem_on_canvas`), `artifacts` (`generate_problem_on_open` — a new challenge when a learner opens), or `opening_canvas_scene`. Also `enforced_channels`, `answers_model_seed`, `duration_minutes`. Do not send `kind`.
5. `get_protocol`
6. `get_protocol_url` — public launch URL. Query `identity` (aliases `id`, `candidate_id`) to skip Identify yourself
7. `update_protocol`
8. `delete_protocol` when a protocol should be removed
9. `get_knowledge_region_options` — protocols, exploration strategies, AI-use catalog, sample bounds
10. `create_knowledge_region` with `name`, `protocol_ids`, `strategy_ids` (exploit-heavy, information-seeking, novelty-seeking, balanced, narrow-and-deep). Optional `custom_strategies` as a prompt string or `{ prompt }`, `samples_per_strategy`, `include_human_data`, `ai_use_catalog_ids`, `samples_per_ai_use`
11. `get_knowledge_region_job` while status is `queued` or `running`
12. `get_knowledge_region` — clusters, strategies, AI-use clusters, samples
13. `get_knowledge_region_run` with `run_id` from a sample
14. `get_knowledge_region_candidate` with `knowledge_region_id` and `candidate_id` (optional `space`)
15. `get_knowledge_region_uncertainty_model` for the hidden-state walk overlay

Do not call `start_session`, `upload_proof_of_work`, or `end_session`. Those tools are not on the public catalog.

## Error responses

Nested envelope `{ error: { code, message, details? } }` on every Protocol API and Knowledge Regions API failure.

### `unauthorized` (HTTP 401)

Bearer key missing or invalid.

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing or invalid Authorization header"
  }
}
```

#### curl

```curl
# HTTP 401
{
  "error": {
    "code": "unauthorized",
    "message": "Missing or invalid Authorization header"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 401
  // payload.error.code === "unauthorized"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "unauthorized",
  //     "message": "Missing or invalid Authorization header"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 401
    # payload["error"]["code"] == "unauthorized"
    print(payload)
    # {
    #   "error": {
    #     "code": "unauthorized",
    #     "message": "Missing or invalid Authorization header"
    #   }
    # }
```

### `key_revoked` (HTTP 401)

Key is inactive.

```json
{
  "error": {
    "code": "key_revoked",
    "message": "API key has been revoked"
  }
}
```

#### curl

```curl
# HTTP 401
{
  "error": {
    "code": "key_revoked",
    "message": "API key has been revoked"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 401
  // payload.error.code === "key_revoked"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "key_revoked",
  //     "message": "API key has been revoked"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 401
    # payload["error"]["code"] == "key_revoked"
    print(payload)
    # {
    #   "error": {
    #     "code": "key_revoked",
    #     "message": "API key has been revoked"
    #   }
    # }
```

### `key_expired` (HTTP 401)

Key past expires_at.

```json
{
  "error": {
    "code": "key_expired",
    "message": "API key has expired"
  }
}
```

#### curl

```curl
# HTTP 401
{
  "error": {
    "code": "key_expired",
    "message": "API key has expired"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 401
  // payload.error.code === "key_expired"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "key_expired",
  //     "message": "API key has expired"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 401
    # payload["error"]["code"] == "key_expired"
    print(payload)
    # {
    #   "error": {
    #     "code": "key_expired",
    #     "message": "API key has expired"
    #   }
    # }
```

### `api_plan_required` (HTTP 403)

Bearer endpoints require an active API Metered plan.

```json
{
  "error": {
    "code": "api_plan_required",
    "message": "API Metered plan required"
  }
}
```

#### curl

```curl
# HTTP 403
{
  "error": {
    "code": "api_plan_required",
    "message": "API Metered plan required"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 403
  // payload.error.code === "api_plan_required"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "api_plan_required",
  //     "message": "API Metered plan required"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 403
    # payload["error"]["code"] == "api_plan_required"
    print(payload)
    # {
    #   "error": {
    #     "code": "api_plan_required",
    #     "message": "API Metered plan required"
    #   }
    # }
```

### `forbidden` (HTTP 403)

Caller is not a member of the requested organization.

```json
{
  "error": {
    "code": "forbidden",
    "message": "Forbidden"
  }
}
```

#### curl

```curl
# HTTP 403
{
  "error": {
    "code": "forbidden",
    "message": "Forbidden"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 403
  // payload.error.code === "forbidden"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "forbidden",
  //     "message": "Forbidden"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 403
    # payload["error"]["code"] == "forbidden"
    print(payload)
    # {
    #   "error": {
    #     "code": "forbidden",
    #     "message": "Forbidden"
    #   }
    # }
```

### `organization_id_required` (HTTP 400)

Pass organization_id in JSON, query, or X-Organization-Id.

```json
{
  "error": {
    "code": "organization_id_required",
    "message": "organization_id is required"
  }
}
```

#### curl

```curl
# HTTP 400
{
  "error": {
    "code": "organization_id_required",
    "message": "organization_id is required"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 400
  // payload.error.code === "organization_id_required"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "organization_id_required",
  //     "message": "organization_id is required"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 400
    # payload["error"]["code"] == "organization_id_required"
    print(payload)
    # {
    #   "error": {
    #     "code": "organization_id_required",
    #     "message": "organization_id is required"
    #   }
    # }
```

### `rate_limit_exceeded` (HTTP 429)

120 requests per minute per key.

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 120,
      "remaining": 0
    }
  }
}
```

#### curl

```curl
# HTTP 429
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 120,
      "remaining": 0
    }
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 429
  // payload.error.code === "rate_limit_exceeded"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "rate_limit_exceeded",
  //     "message": "API rate limit exceeded",
  //     "details": {
  //       "limit": 120,
  //       "remaining": 0
  //     }
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 429
    # payload["error"]["code"] == "rate_limit_exceeded"
    print(payload)
    # {
    #   "error": {
    #     "code": "rate_limit_exceeded",
    #     "message": "API rate limit exceeded",
    #     "details": {
    #       "limit": 120,
    #       "remaining": 0
    #     }
    #   }
    # }
```

### `not_found` (HTTP 404)

Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

```json
{
  "error": {
    "code": "not_found",
    "message": "Protocol not found"
  }
}
```

#### curl

```curl
# HTTP 404
{
  "error": {
    "code": "not_found",
    "message": "Protocol not found"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 404
  // payload.error.code === "not_found"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "not_found",
  //     "message": "Protocol not found"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 404
    # payload["error"]["code"] == "not_found"
    print(payload)
    # {
    #   "error": {
    #     "code": "not_found",
    #     "message": "Protocol not found"
    #   }
    # }
```

### `validation_error` (HTTP 400)

Write bodies that fail authoring or wizard validation.

```json
{
  "error": {
    "code": "validation_error",
    "message": "challenge is required"
  }
}
```

#### curl

```curl
# HTTP 400
{
  "error": {
    "code": "validation_error",
    "message": "challenge is required"
  }
}
```

#### JavaScript

```javascript
if (!response.ok) {
  const payload = await response.json();
  // HTTP 400
  // payload.error.code === "validation_error"
  console.error(payload);
  // {
  //   "error": {
  //     "code": "validation_error",
  //     "message": "challenge is required"
  //   }
  // }
}
```

#### Python

```python
if not response.ok:
    payload = response.json()
    # HTTP 400
    # payload["error"]["code"] == "validation_error"
    print(payload)
    # {
    #   "error": {
    #     "code": "validation_error",
    #     "message": "challenge is required"
    #   }
    # }
```

## Schemas

### enforced_channels (request)

Channels the protocol run requires. Audio default on for written protocols.

Used by: `create_protocol`, `update_protocol`

```json
{
  "audio": true,
  "muse": false,
  "video": false,
  "screenshots": false
}
```

### canvas_capture (request)

Store mermaid documents of the Work canvas every N actions. Default off.

Used by: `create_protocol`, `update_protocol`

```json
{
  "enabled": true,
  "every_actions": 8
}
```

### answers_model_seed (request)

Uncertainty model. Canonical { model } with priced parent→child edges, or nested { title, children, weight }. Aliases uncertainty_model, unsys_model. JSON string accepted.

Used by: `create_protocol`, `update_protocol`, `generate_protocol_unsys_seed`

```json
{
  "model": {
    "rootId": "linear-systems",
    "branches": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parentId": null,
        "observation": "Ax = b",
        "children": [
          {
            "id": "row-reduce",
            "title": "Row reduce",
            "weight": 0.3
          },
          {
            "id": "inverse",
            "title": "Inverse",
            "weight": 0.8
          }
        ]
      }
    ]
  }
}
```

### opening_canvas_scene (request)

Prepared board source. The Work canvas is the challenge.

Used by: `create_protocol`, `update_protocol`

```json
{
  "elements": [],
  "appState": {},
  "files": {}
}
```

### artifacts (request)

From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data.

Used by: `create_protocol`, `update_protocol`, `generate_protocol_unsys_seed`

```json
[
  {
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "file_id": "file_…"
  }
]
```

### protocol (response)

Presented knowledge verification protocol.

Used by: `create_protocol`, `get_protocol`, `update_protocol`, `list_protocols`

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "questions": [
    "Solve Ax = b"
  ],
  "artifacts": [],
  "duration_minutes": null,
  "authoring_source": "problem",
  "exact_problem_on_canvas": true,
  "generate_problem_on_open": false,
  "opening_canvas_scene": null,
  "answers_model_seed": null,
  "enforced_channels": {
    "audio": true,
    "muse": false,
    "video": false,
    "screenshots": false
  },
  "canvas_capture": {
    "enabled": false,
    "everyActions": 8
  },
  "public_token": "vf_…",
  "workspace_id": null,
  "owner_user_id": "user_…",
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "protocol_setting_id": null,
  "created_at": "2026-11-27T00:00:00.000Z",
  "updated_at": "2026-11-27T00:00:00.000Z"
}
```

### protocol_url (response)

Public launch URL. identity is null when the learner will be asked for an ID.

Used by: `get_protocol_url`

```json
{
  "protocol_id": "11111111-1111-1111-1111-111111111111",
  "url": "https://uncertain.systems/v/vf_…?identity=learner-42",
  "path": "/v/vf_…?identity=learner-42",
  "identity": "learner-42"
}
```

### custom_strategies (request)

Custom exploration strategies for create_knowledge_region and simulate_knowledge_region. A prompt string, { prompt }, or { name, prompt } is enough. Included even when strategy_ids omits the generated custom id.

Used by: `create_knowledge_region`, `simulate_knowledge_region`

```json
[
  {
    "prompt": "Ask more questions before you commit to an answer."
  },
  {
    "name": "Stay on substitution",
    "prompt": "Pick substitution and stay with it."
  },
  "Stay on substitution and do not switch methods."
]
```

### create_knowledge_region (request)

Simulation wizard body. strategy_ids are built-in catalog ids. custom_strategies add prompt-defined walks.

Used by: `create_knowledge_region`, `simulate_knowledge_region`

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems region",
  "protocol_ids": [
    "11111111-1111-1111-1111-111111111111"
  ],
  "strategy_ids": [
    "exploit-heavy",
    "information-seeking"
  ],
  "custom_strategies": [
    {
      "prompt": "Ask more questions before you commit to an answer."
    }
  ],
  "samples_per_strategy": 12,
  "include_human_data": false,
  "ai_use_catalog_ids": [],
  "samples_per_ai_use": 6
}
```

### knowledge_region_options (response)

Wizard options: protocols, built-in strategies, AI-use catalog, sample bounds.

Used by: `get_knowledge_region_options`

```json
{
  "wizard_steps": [
    "name",
    "protocols",
    "explore",
    "ai-use",
    "run"
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy",
      "description": "Goes for the answer it already thinks is best and explores little."
    },
    {
      "id": "information-seeking",
      "name": "Information-seeking",
      "description": "Chooses steps that reduce uncertainty most, even if they are slower."
    },
    {
      "id": "novelty-seeking",
      "name": "Novelty-seeking",
      "description": "Goes for unfamiliar parts of the problem."
    },
    {
      "id": "balanced",
      "name": "Balanced",
      "description": "Explores early, then commits."
    },
    {
      "id": "narrow-and-deep",
      "name": "Narrow and deep",
      "description": "Stays with one approach and goes deep."
    }
  ],
  "default_samples_per_strategy": 12,
  "min_samples_per_strategy": 3,
  "max_samples_per_strategy": 48,
  "ai_use_catalog": [],
  "default_checked": [],
  "default_samples_per_ai_use": 6,
  "min_samples_per_ai_use": 3,
  "max_samples_per_ai_use": 12,
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems",
      "challenge": "Solve Ax = b",
      "question_count": 1,
      "real_session_count": 0
    }
  ]
}
```

### simulation_job (response)

202 body from create_knowledge_region / simulate_knowledge_region. Poll get_knowledge_region_job.

Used by: `create_knowledge_region`, `simulate_knowledge_region`, `get_knowledge_region_job`

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

### knowledge_region (response)

Region with clusters, strategies, and samples. No vectors.

Used by: `get_knowledge_region`, `list_knowledge_regions`

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "Linear systems region",
  "description": "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
  "created_at": "2026-11-27T00:00:00.000Z",
  "subject_count": 1,
  "workspace_id": "ws_…",
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems"
    }
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy"
    }
  ],
  "samples_per_strategy": 12,
  "simulated_count": 12,
  "cohort_count": 0,
  "analysis_count": 0,
  "real_session_count": 0,
  "clusters": [
    {
      "id": "cluster_…",
      "name": "Linear systems region · Exploit-heavy",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy",
      "sample_count": 12
    }
  ],
  "ai_use_clusters": [],
  "samples": [
    {
      "id": "emb_…",
      "identity": "Simulated · Exploit-heavy",
      "origin": "simulated",
      "point_kind": "simulated",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "workspace_id": "ws_…",
      "source": "simulated",
      "cluster_id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ]
}
```

### knowledge_region_candidate (response)

Closed metrics for one candidate in a named embedding space (default path).

Used by: `get_knowledge_region_candidate`

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "candidate_id": "learner-42",
  "embedding_model_id": "flowcfg-v1-d96",
  "space": "path",
  "dim": 96,
  "clusters": [
    {
      "id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ],
  "observations": [
    {
      "id": "emb_…",
      "created_at": "2026-11-27T00:00:00.000Z",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "nearest_cluster_id": "cluster_…",
      "unsys": {
        "distance": 0.4,
        "excess": 0.1,
        "steps": 3
      },
      "cluster_distances": [
        {
          "cluster_id": "cluster_…",
          "l2": 0.12,
          "nearest": true,
          "in_cluster": true
        }
      ]
    }
  ],
  "unsys": {
    "average": 0.4,
    "observation_count": 1,
    "scored_count": 1,
    "flows": []
  },
  "path": {
    "segments": [],
    "span": null
  },
  "pairwise": {
    "observation_ids": [
      "emb_…"
    ],
    "matrix": [
      [
        0
      ]
    ]
  }
}
```

### uncertainty_model (response)

Reference hidden-state tree plus the candidate walk overlay.

Used by: `get_knowledge_region_uncertainty_model`

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "candidate_id": "learner-42",
  "observation_id": "emb_…",
  "run_id": "44444444-4444-4444-4444-444444444444",
  "identity": "learner-42",
  "reference": {
    "root_id": "linear-systems",
    "hidden_states": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parent_id": null
      }
    ]
  },
  "mapped": {
    "sequence": [
      "linear-systems",
      "row-reduce"
    ],
    "hidden_states": []
  },
  "overlay": {
    "walk": [
      "linear-systems",
      "row-reduce"
    ]
  }
}
```

## Exploration strategies

`create_knowledge_region` and `simulate_knowledge_region` take `strategy_ids` from this catalog. Call `get_knowledge_region_options` for the live list.

- `exploit-heavy` · **Exploit-heavy**. Goes for the answer it already thinks is best and explores little.
- `information-seeking` · **Information-seeking**. Chooses steps that reduce uncertainty most, even if they are slower.
- `novelty-seeking` · **Novelty-seeking**. Goes for unfamiliar parts of the problem.
- `balanced` · **Balanced**. Explores early, then commits.
- `narrow-and-deep` · **Narrow and deep**. Stays with one approach and goes deep.

### Custom strategies

Pass `custom_strategies` as a prompt string, `{ prompt }`, or `{ name, prompt }`. `instructions` is an alias of `prompt`. Custom walks are included even when `strategy_ids` omits the generated `custom-<slug>-<tag>` id.

```json
{
  "strategy_ids": [
    "exploit-heavy"
  ],
  "custom_strategies": [
    {
      "prompt": "Ask more questions before you commit to an answer."
    },
    "Stay on substitution and do not switch methods."
  ]
}
```

## Endpoints

Each public tool has REST and MCP parity. REST bodies are snake_case. MCP arguments match the REST fields plus `organization_id`. Examples are curl, JavaScript (`fetch`), and Python (`requests`).

### list_protocols

- **MCP:** `list_protocols`
- **REST:** `GET /api/v3/protocols`
- **Family:** Protocol API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

List knowledge verification protocols in the requested organization.

List knowledge verification protocols owned by this key. REST: GET /api/v3/protocols. Do not send kind.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    }
  },
  "additionalProperties": false,
  "required": [
    "organization_id"
  ]
}
```

**Schemas**

#### protocol (response)

Presented knowledge verification protocol.

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "questions": [
    "Solve Ax = b"
  ],
  "artifacts": [],
  "duration_minutes": null,
  "authoring_source": "problem",
  "exact_problem_on_canvas": true,
  "generate_problem_on_open": false,
  "opening_canvas_scene": null,
  "answers_model_seed": null,
  "enforced_channels": {
    "audio": true,
    "muse": false,
    "video": false,
    "screenshots": false
  },
  "canvas_capture": {
    "enabled": false,
    "everyActions": 8
  },
  "public_token": "vf_…",
  "workspace_id": null,
  "owner_user_id": "user_…",
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "protocol_setting_id": null,
  "created_at": "2026-11-27T00:00:00.000Z",
  "updated_at": "2026-11-27T00:00:00.000Z"
}
```

**Response** (HTTP 200)

```json
{
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems",
      "challenge": "Solve Ax = b",
      "questions": [
        "Solve Ax = b"
      ],
      "artifacts": [],
      "duration_minutes": null,
      "authoring_source": "problem",
      "exact_problem_on_canvas": true,
      "generate_problem_on_open": false,
      "opening_canvas_scene": null,
      "answers_model_seed": null,
      "enforced_channels": {
        "audio": true,
        "muse": false,
        "video": false,
        "screenshots": false
      },
      "canvas_capture": {
        "enabled": false,
        "everyActions": 8
      },
      "public_token": "vf_…",
      "workspace_id": null,
      "owner_user_id": "user_…",
      "organization_id": "00000000-0000-0000-0000-000000000000",
      "protocol_setting_id": null,
      "created_at": "2026-11-27T00:00:00.000Z",
      "updated_at": "2026-11-27T00:00:00.000Z"
    }
  ]
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/protocols?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/protocols?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### create_protocol

- **MCP:** `create_protocol`
- **REST:** `POST /api/v3/protocols`
- **Family:** Protocol API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 201

Create a knowledge verification protocol.

Create a knowledge verification protocol (same Author sources as the dashboard wizard). REST: POST /api/v3/protocols. Choose exactly one Author source.

1. Written Protocol Challenge — send challenge (aliases topic, problem, goal). May set exact_problem_on_canvas so that text opens on the Work canvas as written. Artifacts may ride along as Unsys context. Do not set generate_problem_on_open or opening_canvas_scene.
2. From files — send artifacts or files. A new challenge statement is generated when a learner opens (generate_problem_on_open). Challenge may be empty; stored challenge falls back to name. The board stays empty. exact_problem_on_canvas is ignored.
3. Prepared board — send opening_canvas_scene. Challenge may be empty; stored challenge falls back to board text then name. exact_problem_on_canvas and generate_problem_on_open are ignored.

If more than one source is sent, the server keeps prepared board, then files with generate_problem_on_open, then written challenge. exact_problem_on_canvas is stored only with a written challenge.

Do not send kind. Create and list reject solve, calibration, calibrate, learn, mapping, and map.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "exact_problem_on_canvas": true,
  "enforced_channels": {
    "audio": true,
    "muse": false,
    "video": false,
    "screenshots": false
  }
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `name` (optional, string)
- `challenge` (optional, string · The Protocol Challenge. Required unless artifacts/files (challenge generated when a learner opens) or opening_canvas_scene.)
- `topic` (optional, string · Alias of challenge.)
- `goal` (optional, string · Alias of challenge.)
- `problem` (optional, string · Alias of challenge.)
- `questions` (optional, array)
- `duration_minutes` (optional, number · Run countdown in minutes.)
- `action_catalog` (optional, number, one of 4, 8, 16)
- `artifacts` (optional, array · From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data. As the challenge source, a new statement is generated when a learner opens.)
- `artifacts[].name` (optional, string)
- `artifacts[].mime_type` (optional, string)
- `artifacts[].file_id` (optional, string · Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store.)
- `artifacts[].data` (optional, string · Base64 file bytes. Uploaded then attached as context.)
- `files` (optional, array · Inline base64 uploads attached as artifacts (same as the wizard file picker).)
- `files[].name` (required, string)
- `files[].mime_type` (optional, string)
- `files[].data` (required, string · Base64 file bytes.)
- `exact_problem_on_canvas` (optional, boolean · Written Protocol Challenge source only (written problem source only). Puts challenge on the Work canvas as written. Ignored when artifacts are the challenge source or with opening_canvas_scene. Default false.)
- `generate_problem_on_open` (optional, boolean · From files source. Implied true when artifacts are the challenge: a new statement is generated when a learner opens. Challenge may be empty. Ignored when opening_canvas_scene is set.)
- `opening_canvas_scene` (optional, object · Prepared board source. The Work canvas is the challenge. Takes priority over generate_problem_on_open and exact_problem_on_canvas.)
- `answers_model_seed` (optional, object | string · Custom uncertainty model for this protocol. Canonical { model } with priced parent→child edges, or a generic tree spec: nested { title, children, weight }, or { nodes, edges } with weight/price. JSON string accepted. Same as uncertainty_model.)
- `uncertainty_model` (optional, object | string · Alias of answers_model_seed. Generic tree with weights (nodes/edges or nested children) or serialized JSON.)
- `unsys_model` (optional, object | string · Alias of answers_model_seed.)
- `generate_unsys` (optional, boolean · Generate an Unsys seed from The Protocol Challenge and artifacts when answers_model_seed is omitted.)
- `unsys_guidance` (optional, string · Optional prompt used when generate_unsys is true.)
- `enforced_channels` (optional, object · Channels the run requires (audio, muse, video, screenshots).)
- `enforced_channels.audio` (optional, boolean)
- `enforced_channels.muse` (optional, boolean)
- `enforced_channels.video` (optional, boolean)
- `enforced_channels.screenshots` (optional, boolean)
- `protocol_setting_id` (optional, string · Named protocol canvas setting from GET /api/v3/protocol-settings. Omit or pass empty/default to use the organization default.)
- `canvas_capture` (optional, object · Store mermaid documents of the Work canvas every N actions. Default off. Documents land on the stored record, never in the embedding.)
- `canvas_capture.enabled` (optional, boolean)
- `canvas_capture.every_actions` (optional, integer, min 2, max 48)
- `workspace_id` (optional, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "name": {
      "type": "string"
    },
    "challenge": {
      "type": "string",
      "description": "The Protocol Challenge. Required unless artifacts/files (challenge generated when a learner opens) or opening_canvas_scene."
    },
    "topic": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "goal": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "problem": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "duration_minutes": {
      "type": "number",
      "description": "Run countdown in minutes."
    },
    "action_catalog": {
      "type": "number",
      "enum": [
        4,
        8,
        16
      ]
    },
    "artifacts": {
      "type": "array",
      "description": "From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data. As the challenge source, a new statement is generated when a learner opens.",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "mime_type": {
            "type": "string"
          },
          "file_id": {
            "type": "string",
            "description": "Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store."
          },
          "data": {
            "type": "string",
            "description": "Base64 file bytes. Uploaded then attached as context."
          }
        },
        "additionalProperties": false
      }
    },
    "files": {
      "type": "array",
      "description": "Inline base64 uploads attached as artifacts (same as the wizard file picker).",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "mime_type": {
            "type": "string"
          },
          "data": {
            "type": "string",
            "description": "Base64 file bytes."
          }
        },
        "required": [
          "name",
          "data"
        ],
        "additionalProperties": false
      }
    },
    "exact_problem_on_canvas": {
      "type": "boolean",
      "description": "Written Protocol Challenge source only (written problem source only). Puts challenge on the Work canvas as written. Ignored when artifacts are the challenge source or with opening_canvas_scene. Default false."
    },
    "generate_problem_on_open": {
      "type": "boolean",
      "description": "From files source. Implied true when artifacts are the challenge: a new statement is generated when a learner opens. Challenge may be empty. Ignored when opening_canvas_scene is set."
    },
    "opening_canvas_scene": {
      "type": "object",
      "description": "Prepared board source. The Work canvas is the challenge. Takes priority over generate_problem_on_open and exact_problem_on_canvas."
    },
    "answers_model_seed": {
      "type": [
        "object",
        "string"
      ],
      "description": "Custom uncertainty model for this protocol. Canonical { model } with priced parent→child edges, or a generic tree spec: nested { title, children, weight }, or { nodes, edges } with weight/price. JSON string accepted. Same as uncertainty_model."
    },
    "uncertainty_model": {
      "type": [
        "object",
        "string"
      ],
      "description": "Alias of answers_model_seed. Generic tree with weights (nodes/edges or nested children) or serialized JSON."
    },
    "unsys_model": {
      "type": [
        "object",
        "string"
      ],
      "description": "Alias of answers_model_seed."
    },
    "generate_unsys": {
      "type": "boolean",
      "description": "Generate an Unsys seed from The Protocol Challenge and artifacts when answers_model_seed is omitted."
    },
    "unsys_guidance": {
      "type": "string",
      "description": "Optional prompt used when generate_unsys is true."
    },
    "enforced_channels": {
      "type": "object",
      "description": "Channels the run requires (audio, muse, video, screenshots).",
      "properties": {
        "audio": {
          "type": "boolean"
        },
        "muse": {
          "type": "boolean"
        },
        "video": {
          "type": "boolean"
        },
        "screenshots": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "protocol_setting_id": {
      "type": "string",
      "description": "Named protocol canvas setting from GET /api/v3/protocol-settings. Omit or pass empty/default to use the organization default."
    },
    "canvas_capture": {
      "type": "object",
      "description": "Store mermaid documents of the Work canvas every N actions. Default off. Documents land on the stored record, never in the embedding.",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "every_actions": {
          "type": "integer",
          "minimum": 2,
          "maximum": 48
        }
      },
      "additionalProperties": false
    },
    "workspace_id": {
      "type": "string"
    }
  },
  "additionalProperties": false,
  "required": [
    "organization_id"
  ]
}
```

**Schemas**

#### enforced_channels (request)

Channels the protocol run requires. Audio default on for written protocols.

```json
{
  "audio": true,
  "muse": false,
  "video": false,
  "screenshots": false
}
```

#### canvas_capture (request)

Store mermaid documents of the Work canvas every N actions. Default off.

```json
{
  "enabled": true,
  "every_actions": 8
}
```

#### answers_model_seed (request)

Uncertainty model. Canonical { model } with priced parent→child edges, or nested { title, children, weight }. Aliases uncertainty_model, unsys_model. JSON string accepted.

```json
{
  "model": {
    "rootId": "linear-systems",
    "branches": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parentId": null,
        "observation": "Ax = b",
        "children": [
          {
            "id": "row-reduce",
            "title": "Row reduce",
            "weight": 0.3
          },
          {
            "id": "inverse",
            "title": "Inverse",
            "weight": 0.8
          }
        ]
      }
    ]
  }
}
```

#### opening_canvas_scene (request)

Prepared board source. The Work canvas is the challenge.

```json
{
  "elements": [],
  "appState": {},
  "files": {}
}
```

#### artifacts (request)

From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data.

```json
[
  {
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "file_id": "file_…"
  }
]
```

#### protocol (response)

Presented knowledge verification protocol.

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "questions": [
    "Solve Ax = b"
  ],
  "artifacts": [],
  "duration_minutes": null,
  "authoring_source": "problem",
  "exact_problem_on_canvas": true,
  "generate_problem_on_open": false,
  "opening_canvas_scene": null,
  "answers_model_seed": null,
  "enforced_channels": {
    "audio": true,
    "muse": false,
    "video": false,
    "screenshots": false
  },
  "canvas_capture": {
    "enabled": false,
    "everyActions": 8
  },
  "public_token": "vf_…",
  "workspace_id": null,
  "owner_user_id": "user_…",
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "protocol_setting_id": null,
  "created_at": "2026-11-27T00:00:00.000Z",
  "updated_at": "2026-11-27T00:00:00.000Z"
}
```

**Response** (HTTP 201)

```json
{
  "protocol": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Linear systems",
    "challenge": "Solve Ax = b",
    "questions": [
      "Solve Ax = b"
    ],
    "artifacts": [],
    "duration_minutes": null,
    "authoring_source": "problem",
    "exact_problem_on_canvas": true,
    "generate_problem_on_open": false,
    "opening_canvas_scene": null,
    "answers_model_seed": null,
    "enforced_channels": {
      "audio": true,
      "muse": false,
      "video": false,
      "screenshots": false
    },
    "canvas_capture": {
      "enabled": false,
      "everyActions": 8
    },
    "public_token": "vf_…",
    "workspace_id": null,
    "owner_user_id": "user_…",
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "protocol_setting_id": null,
    "created_at": "2026-11-27T00:00:00.000Z",
    "updated_at": "2026-11-27T00:00:00.000Z"
  }
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X POST 'https://uncertain.systems/api/v3/protocols?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems",
    "challenge": "Solve Ax = b",
    "exact_problem_on_canvas": true,
    "enforced_channels": {
      "audio": true,
      "muse": false,
      "video": false,
      "screenshots": false
    }
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems",
    "challenge": "Solve Ax = b",
    "exact_problem_on_canvas": true,
    "enforced_channels": {
      "audio": true,
      "muse": false,
      "video": false,
      "screenshots": false
    }
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "POST",
    "https://uncertain.systems/api/v3/protocols?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "name": "Linear systems",
        "challenge": "Solve Ax = b",
        "exact_problem_on_canvas": true,
        "enforced_channels": {
            "audio": true,
            "muse": false,
            "video": false,
            "screenshots": false
        }
    },
)
print(response.json())
```

### upload_protocol_file

- **MCP:** `upload_protocol_file`
- **REST:** `POST /api/v3/protocols/files`
- **Family:** Protocol API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 201

Upload a Protocol Challenge context file (PDF, text, image) and get an artifact pointer for create_protocol / update_protocol.

Upload a Protocol Challenge context file (PDF, text, image). REST: POST /api/v3/protocols/files. Pass the returned file_id in create_protocol / update_protocol artifacts.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "brief.pdf",
  "mime_type": "application/pdf",
  "data": "<base64>"
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `name` (optional, string)
- `file_name` (optional, string)
- `mime_type` (optional, string)
- `data` (required, string · Base64 file bytes.)
- `workspace_id` (optional, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "name": {
      "type": "string"
    },
    "file_name": {
      "type": "string"
    },
    "mime_type": {
      "type": "string"
    },
    "data": {
      "type": "string",
      "description": "Base64 file bytes."
    },
    "workspace_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "data"
  ],
  "additionalProperties": false
}
```

**Response** (HTTP 201)

```json
{
  "artifact": {
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "file_id": "file_…"
  },
  "file_id": "file_…",
  "name": "brief.pdf",
  "mime_type": "application/pdf"
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X POST 'https://uncertain.systems/api/v3/protocols/files?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "data": "<base64>"
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols/files?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "data": "<base64>"
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "POST",
    "https://uncertain.systems/api/v3/protocols/files?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "name": "brief.pdf",
        "mime_type": "application/pdf",
        "data": "<base64>"
    },
)
print(response.json())
```

### generate_protocol_unsys_seed

- **MCP:** `generate_protocol_unsys_seed`
- **REST:** `POST /api/v3/protocols/unsys-seed`
- **Family:** Protocol API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Generate the Unsys model for a protocol from The Protocol Challenge, artifacts, and optional guidance.

Generate the Unsys model from The Protocol Challenge, artifacts, and optional guidance (wizard model step). REST: POST /api/v3/protocols/unsys-seed. Pass answers_model_seed into create_protocol / update_protocol.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems",
  "challenge": "Solve Ax = b"
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `name` (optional, string)
- `challenge` (optional, string)
- `topic` (optional, string · Alias of challenge.)
- `goal` (optional, string · Alias of challenge.)
- `problem` (optional, string · Alias of challenge.)
- `artifacts` (optional, array)
- `artifacts[].name` (optional, string)
- `artifacts[].mime_type` (optional, string)
- `artifacts[].file_id` (optional, string · Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store.)
- `artifacts[].data` (optional, string · Base64 file bytes. Uploaded then attached as context.)
- `guidance` (optional, string)
- `prompt` (optional, string)
- `unsys_guidance` (optional, string)
- `parent_id` (optional, string)
- `seed_model` (optional, object)
- `model` (optional, object)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "name": {
      "type": "string"
    },
    "challenge": {
      "type": "string"
    },
    "topic": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "goal": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "problem": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "mime_type": {
            "type": "string"
          },
          "file_id": {
            "type": "string",
            "description": "Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store."
          },
          "data": {
            "type": "string",
            "description": "Base64 file bytes. Uploaded then attached as context."
          }
        },
        "additionalProperties": false
      }
    },
    "guidance": {
      "type": "string"
    },
    "prompt": {
      "type": "string"
    },
    "unsys_guidance": {
      "type": "string"
    },
    "parent_id": {
      "type": "string"
    },
    "seed_model": {
      "type": "object"
    },
    "model": {
      "type": "object"
    }
  },
  "additionalProperties": false,
  "required": [
    "organization_id"
  ]
}
```

**Schemas**

#### answers_model_seed (request)

Uncertainty model. Canonical { model } with priced parent→child edges, or nested { title, children, weight }. Aliases uncertainty_model, unsys_model. JSON string accepted.

```json
{
  "model": {
    "rootId": "linear-systems",
    "branches": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parentId": null,
        "observation": "Ax = b",
        "children": [
          {
            "id": "row-reduce",
            "title": "Row reduce",
            "weight": 0.3
          },
          {
            "id": "inverse",
            "title": "Inverse",
            "weight": 0.8
          }
        ]
      }
    ]
  }
}
```

#### artifacts (request)

From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data.

```json
[
  {
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "file_id": "file_…"
  }
]
```

**Response** (HTTP 200)

```json
{
  "model": {
    "model": {
      "rootId": "linear-systems",
      "branches": [
        {
          "id": "linear-systems",
          "title": "Linear systems",
          "parentId": null,
          "observation": "Ax = b",
          "children": [
            {
              "id": "row-reduce",
              "title": "Row reduce",
              "weight": 0.3
            },
            {
              "id": "inverse",
              "title": "Inverse",
              "weight": 0.8
            }
          ]
        }
      ]
    }
  },
  "answers_model_seed": {
    "model": {
      "rootId": "linear-systems",
      "branches": [
        {
          "id": "linear-systems",
          "title": "Linear systems",
          "parentId": null,
          "observation": "Ax = b",
          "children": [
            {
              "id": "row-reduce",
              "title": "Row reduce",
              "weight": 0.3
            },
            {
              "id": "inverse",
              "title": "Inverse",
              "weight": 0.8
            }
          ]
        }
      ]
    }
  }
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X POST 'https://uncertain.systems/api/v3/protocols/unsys-seed?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems",
    "challenge": "Solve Ax = b"
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols/unsys-seed?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems",
    "challenge": "Solve Ax = b"
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "POST",
    "https://uncertain.systems/api/v3/protocols/unsys-seed?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "name": "Linear systems",
        "challenge": "Solve Ax = b"
    },
)
print(response.json())
```

### get_protocol

- **MCP:** `get_protocol`
- **REST:** `GET /api/v3/protocols/{protocol_id}`
- **Family:** Protocol API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Read one knowledge verification protocol.

Read one knowledge verification protocol. REST: GET /api/v3/protocols/{protocol_id}.

**Path parameters**

- `protocol_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `protocol_id` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "protocol_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "protocol_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### protocol (response)

Presented knowledge verification protocol.

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "questions": [
    "Solve Ax = b"
  ],
  "artifacts": [],
  "duration_minutes": null,
  "authoring_source": "problem",
  "exact_problem_on_canvas": true,
  "generate_problem_on_open": false,
  "opening_canvas_scene": null,
  "answers_model_seed": null,
  "enforced_channels": {
    "audio": true,
    "muse": false,
    "video": false,
    "screenshots": false
  },
  "canvas_capture": {
    "enabled": false,
    "everyActions": 8
  },
  "public_token": "vf_…",
  "workspace_id": null,
  "owner_user_id": "user_…",
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "protocol_setting_id": null,
  "created_at": "2026-11-27T00:00:00.000Z",
  "updated_at": "2026-11-27T00:00:00.000Z"
}
```

**Response** (HTTP 200)

```json
{
  "protocol": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Linear systems",
    "challenge": "Solve Ax = b",
    "questions": [
      "Solve Ax = b"
    ],
    "artifacts": [],
    "duration_minutes": null,
    "authoring_source": "problem",
    "exact_problem_on_canvas": true,
    "generate_problem_on_open": false,
    "opening_canvas_scene": null,
    "answers_model_seed": null,
    "enforced_channels": {
      "audio": true,
      "muse": false,
      "video": false,
      "screenshots": false
    },
    "canvas_capture": {
      "enabled": false,
      "everyActions": 8
    },
    "public_token": "vf_…",
    "workspace_id": null,
    "owner_user_id": "user_…",
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "protocol_setting_id": null,
    "created_at": "2026-11-27T00:00:00.000Z",
    "updated_at": "2026-11-27T00:00:00.000Z"
  }
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### get_protocol_url

- **MCP:** `get_protocol_url`
- **REST:** `GET /api/v3/protocols/{protocol_id}/url`
- **Family:** Protocol API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Public URL for a protocol. Optional identity (or id) is prepopulated; the learner is not asked for an ID.

Public launch URL for a protocol. Pass identity (or id) to prepopulate the participant ID so the flow does not ask for it. REST: GET /api/v3/protocols/{protocol_id}/url.

**Path parameters**

- `protocol_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)
- `identity`

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `protocol_id` (required, string)
- `identity` (optional, string · Participant ID to put on the URL. Omit for a URL that asks for identity.)
- `id` (optional, string · Alias of identity.)
- `candidate_id` (optional, string · Alias of identity.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "protocol_id": {
      "type": "string"
    },
    "identity": {
      "type": "string",
      "description": "Participant ID to put on the URL. Omit for a URL that asks for identity."
    },
    "id": {
      "type": "string",
      "description": "Alias of identity."
    },
    "candidate_id": {
      "type": "string",
      "description": "Alias of identity."
    }
  },
  "required": [
    "organization_id",
    "protocol_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### protocol_url (response)

Public launch URL. identity is null when the learner will be asked for an ID.

```json
{
  "protocol_id": "11111111-1111-1111-1111-111111111111",
  "url": "https://uncertain.systems/v/vf_…?identity=learner-42",
  "path": "/v/vf_…?identity=learner-42",
  "identity": "learner-42"
}
```

**Response** (HTTP 200)

```json
{
  "protocol_id": "11111111-1111-1111-1111-111111111111",
  "url": "https://uncertain.systems/v/vf_…?identity=learner-42",
  "path": "/v/vf_…?identity=learner-42",
  "identity": "learner-42"
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111/url?organization_id=00000000-0000-0000-0000-000000000000&identity=learner-42' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111/url?organization_id=00000000-0000-0000-0000-000000000000&identity=learner-42", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111/url?organization_id=00000000-0000-0000-0000-000000000000&identity=learner-42",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### update_protocol

- **MCP:** `update_protocol`
- **REST:** `PATCH /api/v3/protocols/{protocol_id}`
- **Family:** Protocol API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Update a knowledge verification protocol.

Update a knowledge verification protocol (same Author sources as create_protocol). REST: PATCH /api/v3/protocols/{protocol_id}. Choose exactly one Author source.

1. Written Protocol Challenge — send challenge (aliases topic, problem, goal). May set exact_problem_on_canvas so that text opens on the Work canvas as written. Artifacts may ride along as Unsys context. Do not set generate_problem_on_open or opening_canvas_scene.
2. From files — send artifacts or files. A new challenge statement is generated when a learner opens (generate_problem_on_open). Challenge may be empty; stored challenge falls back to name. The board stays empty. exact_problem_on_canvas is ignored.
3. Prepared board — send opening_canvas_scene. Challenge may be empty; stored challenge falls back to board text then name. exact_problem_on_canvas and generate_problem_on_open are ignored.

If more than one source is sent, the server keeps prepared board, then files with generate_problem_on_open, then written challenge. exact_problem_on_canvas is stored only with a written challenge.

Do not send kind. Create and list reject solve, calibration, calibrate, learn, mapping, and map.

**Path parameters**

- `protocol_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems (revised)"
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `protocol_id` (required, string)
- `name` (optional, string)
- `challenge` (optional, string · The Protocol Challenge. Required unless artifacts/files (challenge generated when a learner opens) or opening_canvas_scene.)
- `topic` (optional, string · Alias of challenge.)
- `goal` (optional, string · Alias of challenge.)
- `problem` (optional, string · Alias of challenge.)
- `questions` (optional, array)
- `duration_minutes` (optional, number · Run countdown in minutes.)
- `action_catalog` (optional, number, one of 4, 8, 16)
- `artifacts` (optional, array · From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data. As the challenge source, a new statement is generated when a learner opens.)
- `artifacts[].name` (optional, string)
- `artifacts[].mime_type` (optional, string)
- `artifacts[].file_id` (optional, string · Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store.)
- `artifacts[].data` (optional, string · Base64 file bytes. Uploaded then attached as context.)
- `files` (optional, array · Inline base64 uploads attached as artifacts (same as the wizard file picker).)
- `files[].name` (required, string)
- `files[].mime_type` (optional, string)
- `files[].data` (required, string · Base64 file bytes.)
- `exact_problem_on_canvas` (optional, boolean · Written Protocol Challenge source only (written problem source only). Puts challenge on the Work canvas as written. Ignored when artifacts are the challenge source or with opening_canvas_scene. Default false.)
- `generate_problem_on_open` (optional, boolean · From files source. Implied true when artifacts are the challenge: a new statement is generated when a learner opens. Challenge may be empty. Ignored when opening_canvas_scene is set.)
- `opening_canvas_scene` (optional, object · Prepared board source. The Work canvas is the challenge. Takes priority over generate_problem_on_open and exact_problem_on_canvas.)
- `answers_model_seed` (optional, object | string · Custom uncertainty model for this protocol. Canonical { model } with priced parent→child edges, or a generic tree spec: nested { title, children, weight }, or { nodes, edges } with weight/price. JSON string accepted. Same as uncertainty_model.)
- `uncertainty_model` (optional, object | string · Alias of answers_model_seed. Generic tree with weights (nodes/edges or nested children) or serialized JSON.)
- `unsys_model` (optional, object | string · Alias of answers_model_seed.)
- `generate_unsys` (optional, boolean · Generate an Unsys seed from The Protocol Challenge and artifacts when answers_model_seed is omitted.)
- `unsys_guidance` (optional, string · Optional prompt used when generate_unsys is true.)
- `enforced_channels` (optional, object · Channels the run requires (audio, muse, video, screenshots).)
- `enforced_channels.audio` (optional, boolean)
- `enforced_channels.muse` (optional, boolean)
- `enforced_channels.video` (optional, boolean)
- `enforced_channels.screenshots` (optional, boolean)
- `protocol_setting_id` (optional, string · Named protocol canvas setting from GET /api/v3/protocol-settings. Omit or pass empty/default to use the organization default.)
- `canvas_capture` (optional, object · Store mermaid documents of the Work canvas every N actions. Default off. Documents land on the stored record, never in the embedding.)
- `canvas_capture.enabled` (optional, boolean)
- `canvas_capture.every_actions` (optional, integer, min 2, max 48)
- `workspace_id` (optional, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "protocol_id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "challenge": {
      "type": "string",
      "description": "The Protocol Challenge. Required unless artifacts/files (challenge generated when a learner opens) or opening_canvas_scene."
    },
    "topic": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "goal": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "problem": {
      "type": "string",
      "description": "Alias of challenge."
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "duration_minutes": {
      "type": "number",
      "description": "Run countdown in minutes."
    },
    "action_catalog": {
      "type": "number",
      "enum": [
        4,
        8,
        16
      ]
    },
    "artifacts": {
      "type": "array",
      "description": "From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data. As the challenge source, a new statement is generated when a learner opens.",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "mime_type": {
            "type": "string"
          },
          "file_id": {
            "type": "string",
            "description": "Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store."
          },
          "data": {
            "type": "string",
            "description": "Base64 file bytes. Uploaded then attached as context."
          }
        },
        "additionalProperties": false
      }
    },
    "files": {
      "type": "array",
      "description": "Inline base64 uploads attached as artifacts (same as the wizard file picker).",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "mime_type": {
            "type": "string"
          },
          "data": {
            "type": "string",
            "description": "Base64 file bytes."
          }
        },
        "required": [
          "name",
          "data"
        ],
        "additionalProperties": false
      }
    },
    "exact_problem_on_canvas": {
      "type": "boolean",
      "description": "Written Protocol Challenge source only (written problem source only). Puts challenge on the Work canvas as written. Ignored when artifacts are the challenge source or with opening_canvas_scene. Default false."
    },
    "generate_problem_on_open": {
      "type": "boolean",
      "description": "From files source. Implied true when artifacts are the challenge: a new statement is generated when a learner opens. Challenge may be empty. Ignored when opening_canvas_scene is set."
    },
    "opening_canvas_scene": {
      "type": "object",
      "description": "Prepared board source. The Work canvas is the challenge. Takes priority over generate_problem_on_open and exact_problem_on_canvas."
    },
    "answers_model_seed": {
      "type": [
        "object",
        "string"
      ],
      "description": "Custom uncertainty model for this protocol. Canonical { model } with priced parent→child edges, or a generic tree spec: nested { title, children, weight }, or { nodes, edges } with weight/price. JSON string accepted. Same as uncertainty_model."
    },
    "uncertainty_model": {
      "type": [
        "object",
        "string"
      ],
      "description": "Alias of answers_model_seed. Generic tree with weights (nodes/edges or nested children) or serialized JSON."
    },
    "unsys_model": {
      "type": [
        "object",
        "string"
      ],
      "description": "Alias of answers_model_seed."
    },
    "generate_unsys": {
      "type": "boolean",
      "description": "Generate an Unsys seed from The Protocol Challenge and artifacts when answers_model_seed is omitted."
    },
    "unsys_guidance": {
      "type": "string",
      "description": "Optional prompt used when generate_unsys is true."
    },
    "enforced_channels": {
      "type": "object",
      "description": "Channels the run requires (audio, muse, video, screenshots).",
      "properties": {
        "audio": {
          "type": "boolean"
        },
        "muse": {
          "type": "boolean"
        },
        "video": {
          "type": "boolean"
        },
        "screenshots": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "protocol_setting_id": {
      "type": "string",
      "description": "Named protocol canvas setting from GET /api/v3/protocol-settings. Omit or pass empty/default to use the organization default."
    },
    "canvas_capture": {
      "type": "object",
      "description": "Store mermaid documents of the Work canvas every N actions. Default off. Documents land on the stored record, never in the embedding.",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "every_actions": {
          "type": "integer",
          "minimum": 2,
          "maximum": 48
        }
      },
      "additionalProperties": false
    },
    "workspace_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "protocol_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### enforced_channels (request)

Channels the protocol run requires. Audio default on for written protocols.

```json
{
  "audio": true,
  "muse": false,
  "video": false,
  "screenshots": false
}
```

#### canvas_capture (request)

Store mermaid documents of the Work canvas every N actions. Default off.

```json
{
  "enabled": true,
  "every_actions": 8
}
```

#### answers_model_seed (request)

Uncertainty model. Canonical { model } with priced parent→child edges, or nested { title, children, weight }. Aliases uncertainty_model, unsys_model. JSON string accepted.

```json
{
  "model": {
    "rootId": "linear-systems",
    "branches": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parentId": null,
        "observation": "Ax = b",
        "children": [
          {
            "id": "row-reduce",
            "title": "Row reduce",
            "weight": 0.3
          },
          {
            "id": "inverse",
            "title": "Inverse",
            "weight": 0.8
          }
        ]
      }
    ]
  }
}
```

#### opening_canvas_scene (request)

Prepared board source. The Work canvas is the challenge.

```json
{
  "elements": [],
  "appState": {},
  "files": {}
}
```

#### artifacts (request)

From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data.

```json
[
  {
    "name": "brief.pdf",
    "mime_type": "application/pdf",
    "file_id": "file_…"
  }
]
```

#### protocol (response)

Presented knowledge verification protocol.

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "questions": [
    "Solve Ax = b"
  ],
  "artifacts": [],
  "duration_minutes": null,
  "authoring_source": "problem",
  "exact_problem_on_canvas": true,
  "generate_problem_on_open": false,
  "opening_canvas_scene": null,
  "answers_model_seed": null,
  "enforced_channels": {
    "audio": true,
    "muse": false,
    "video": false,
    "screenshots": false
  },
  "canvas_capture": {
    "enabled": false,
    "everyActions": 8
  },
  "public_token": "vf_…",
  "workspace_id": null,
  "owner_user_id": "user_…",
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "protocol_setting_id": null,
  "created_at": "2026-11-27T00:00:00.000Z",
  "updated_at": "2026-11-27T00:00:00.000Z"
}
```

**Response** (HTTP 200)

```json
{
  "protocol": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Linear systems",
    "challenge": "Solve Ax = b",
    "questions": [
      "Solve Ax = b"
    ],
    "artifacts": [],
    "duration_minutes": null,
    "authoring_source": "problem",
    "exact_problem_on_canvas": true,
    "generate_problem_on_open": false,
    "opening_canvas_scene": null,
    "answers_model_seed": null,
    "enforced_channels": {
      "audio": true,
      "muse": false,
      "video": false,
      "screenshots": false
    },
    "canvas_capture": {
      "enabled": false,
      "everyActions": 8
    },
    "public_token": "vf_…",
    "workspace_id": null,
    "owner_user_id": "user_…",
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "protocol_setting_id": null,
    "created_at": "2026-11-27T00:00:00.000Z",
    "updated_at": "2026-11-27T00:00:00.000Z"
  }
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X PATCH 'https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems (revised)"
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "PATCH",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems (revised)"
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "PATCH",
    "https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "name": "Linear systems (revised)"
    },
)
print(response.json())
```

### delete_protocol

- **MCP:** `delete_protocol`
- **REST:** `DELETE /api/v3/protocols/{protocol_id}`
- **Family:** Protocol API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Delete a knowledge verification protocol.

Delete a knowledge verification protocol. REST: DELETE /api/v3/protocols/{protocol_id}.

**Path parameters**

- `protocol_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `protocol_id` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "protocol_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "protocol_id"
  ],
  "additionalProperties": false
}
```

**Response** (HTTP 200)

```json
{
  "deleted": true,
  "protocol_id": "11111111-1111-1111-1111-111111111111"
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X DELETE 'https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "DELETE",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "DELETE",
    "https://uncertain.systems/api/v3/protocols/11111111-1111-1111-1111-111111111111?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### list_knowledge_regions

- **MCP:** `list_knowledge_regions`
- **REST:** `GET /api/v3/knowledge-regions`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

List knowledge regions in the requested organization.

List knowledge regions in the active organization. REST: GET /api/v3/knowledge-regions.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    }
  },
  "additionalProperties": false,
  "required": [
    "organization_id"
  ]
}
```

**Schemas**

#### knowledge_region (response)

Region with clusters, strategies, and samples. No vectors.

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "Linear systems region",
  "description": "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
  "created_at": "2026-11-27T00:00:00.000Z",
  "subject_count": 1,
  "workspace_id": "ws_…",
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems"
    }
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy"
    }
  ],
  "samples_per_strategy": 12,
  "simulated_count": 12,
  "cohort_count": 0,
  "analysis_count": 0,
  "real_session_count": 0,
  "clusters": [
    {
      "id": "cluster_…",
      "name": "Linear systems region · Exploit-heavy",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy",
      "sample_count": 12
    }
  ],
  "ai_use_clusters": [],
  "samples": [
    {
      "id": "emb_…",
      "identity": "Simulated · Exploit-heavy",
      "origin": "simulated",
      "point_kind": "simulated",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "workspace_id": "ws_…",
      "source": "simulated",
      "cluster_id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ]
}
```

**Response** (HTTP 200)

```json
{
  "knowledge_regions": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Linear systems region",
      "description": "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
      "workspace_id": "ws_…",
      "subject_count": 1,
      "created_at": "2026-11-27T00:00:00.000Z"
    }
  ]
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### get_knowledge_region_options

- **MCP:** `get_knowledge_region_options`
- **REST:** `GET /api/v3/knowledge-regions/options`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Wizard options for creating a knowledge region: protocols, exploration strategies, AI-use catalog, and sample bounds.

Wizard options for knowledge-region create: protocols, exploration strategies, AI-use catalog, sample bounds. REST: GET /api/v3/knowledge-regions/options.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    }
  },
  "additionalProperties": false,
  "required": [
    "organization_id"
  ]
}
```

**Schemas**

#### knowledge_region_options (response)

Wizard options: protocols, built-in strategies, AI-use catalog, sample bounds.

```json
{
  "wizard_steps": [
    "name",
    "protocols",
    "explore",
    "ai-use",
    "run"
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy",
      "description": "Goes for the answer it already thinks is best and explores little."
    },
    {
      "id": "information-seeking",
      "name": "Information-seeking",
      "description": "Chooses steps that reduce uncertainty most, even if they are slower."
    },
    {
      "id": "novelty-seeking",
      "name": "Novelty-seeking",
      "description": "Goes for unfamiliar parts of the problem."
    },
    {
      "id": "balanced",
      "name": "Balanced",
      "description": "Explores early, then commits."
    },
    {
      "id": "narrow-and-deep",
      "name": "Narrow and deep",
      "description": "Stays with one approach and goes deep."
    }
  ],
  "default_samples_per_strategy": 12,
  "min_samples_per_strategy": 3,
  "max_samples_per_strategy": 48,
  "ai_use_catalog": [],
  "default_checked": [],
  "default_samples_per_ai_use": 6,
  "min_samples_per_ai_use": 3,
  "max_samples_per_ai_use": 12,
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems",
      "challenge": "Solve Ax = b",
      "question_count": 1,
      "real_session_count": 0
    }
  ]
}
```

**Response** (HTTP 200)

```json
{
  "wizard_steps": [
    "name",
    "protocols",
    "explore",
    "ai-use",
    "run"
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy",
      "description": "Goes for the answer it already thinks is best and explores little."
    },
    {
      "id": "information-seeking",
      "name": "Information-seeking",
      "description": "Chooses steps that reduce uncertainty most, even if they are slower."
    },
    {
      "id": "novelty-seeking",
      "name": "Novelty-seeking",
      "description": "Goes for unfamiliar parts of the problem."
    },
    {
      "id": "balanced",
      "name": "Balanced",
      "description": "Explores early, then commits."
    },
    {
      "id": "narrow-and-deep",
      "name": "Narrow and deep",
      "description": "Stays with one approach and goes deep."
    }
  ],
  "default_samples_per_strategy": 12,
  "min_samples_per_strategy": 3,
  "max_samples_per_strategy": 48,
  "ai_use_catalog": [],
  "default_checked": [],
  "default_samples_per_ai_use": 6,
  "min_samples_per_ai_use": 3,
  "max_samples_per_ai_use": 12,
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems",
      "challenge": "Solve Ax = b",
      "question_count": 1,
      "real_session_count": 0
    }
  ]
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions/options?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/options?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions/options?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### create_knowledge_region

- **MCP:** `create_knowledge_region`
- **REST:** `POST /api/v3/knowledge-regions`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 202

Create a knowledge region by running the simulation wizard (protocols, exploration strategies, optional AI-use).

Create a knowledge region by running the simulation wizard (same options as /regions/new). REST: POST /api/v3/knowledge-regions.

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems region",
  "protocol_ids": [
    "11111111-1111-1111-1111-111111111111"
  ],
  "strategy_ids": [
    "exploit-heavy",
    "information-seeking"
  ],
  "custom_strategies": [
    {
      "prompt": "Ask more questions before you commit to an answer."
    }
  ],
  "samples_per_strategy": 12
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `name` (required, string · Knowledge region name.)
- `protocol_ids` (optional, array · Protocol ids from get_knowledge_region_options. Alias protocolIds.)
- `strategy_ids` (optional, array · Built-in exploration strategy ids: exploit-heavy, information-seeking, novelty-seeking, balanced, narrow-and-deep. Custom strategies from custom_strategies are included even when their generated ids are omitted here. Alias strategyIds.)
- `custom_strategies` (optional, array · Custom exploration strategies. Pass a prompt string, { prompt }, or { name, prompt }. Included in the run even if strategy_ids omits the generated custom id. Alias customStrategies.)
- `custom_strategies[].id` (optional, string)
- `custom_strategies[].name` (optional, string · Optional display name. Derived from prompt when omitted.)
- `custom_strategies[].instructions` (optional, string · Exploration prompt. Alias of prompt.)
- `custom_strategies[].prompt` (optional, string · Exploration prompt. Enough on its own: { prompt } or a string item. Alias of instructions.)
- `custom_strategies[].description` (optional, string)
- `samples_per_strategy` (optional, integer · Samples per exploration strategy (3–48, default 12). Alias samplesPerStrategy.)
- `include_human_data` (optional, boolean · Overlay real protocol sessions on the simulated region. Alias includeHumanData.)
- `ai_use_catalog_ids` (optional, array · AI-use catalog ids from get_knowledge_region_options (requires an org OpenRouter key). Alias aiUseCatalogIds.)
- `samples_per_ai_use` (optional, integer · Samples per AI-use model (3–12, default 6). Alias samplesPerAiUse.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "name": {
      "type": "string",
      "description": "Knowledge region name."
    },
    "protocol_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Protocol ids from get_knowledge_region_options. Alias protocolIds."
    },
    "strategy_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Built-in exploration strategy ids: exploit-heavy, information-seeking, novelty-seeking, balanced, narrow-and-deep. Custom strategies from custom_strategies are included even when their generated ids are omitted here. Alias strategyIds."
    },
    "custom_strategies": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "type": "string",
            "description": "Prompt-only custom strategy. Name is derived from the prompt."
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "name": {
                "type": "string",
                "description": "Optional display name. Derived from prompt when omitted."
              },
              "instructions": {
                "type": "string",
                "description": "Exploration prompt. Alias of prompt."
              },
              "prompt": {
                "type": "string",
                "description": "Exploration prompt. Enough on its own: { prompt } or a string item. Alias of instructions."
              },
              "description": {
                "type": "string"
              }
            },
            "additionalProperties": false
          }
        ]
      },
      "description": "Custom exploration strategies. Pass a prompt string, { prompt }, or { name, prompt }. Included in the run even if strategy_ids omits the generated custom id. Alias customStrategies."
    },
    "samples_per_strategy": {
      "type": "integer",
      "description": "Samples per exploration strategy (3–48, default 12). Alias samplesPerStrategy."
    },
    "include_human_data": {
      "type": "boolean",
      "description": "Overlay real protocol sessions on the simulated region. Alias includeHumanData."
    },
    "ai_use_catalog_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "AI-use catalog ids from get_knowledge_region_options (requires an org OpenRouter key). Alias aiUseCatalogIds."
    },
    "samples_per_ai_use": {
      "type": "integer",
      "description": "Samples per AI-use model (3–12, default 6). Alias samplesPerAiUse."
    }
  },
  "required": [
    "organization_id",
    "name"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### custom_strategies (request)

Custom exploration strategies for create_knowledge_region and simulate_knowledge_region. A prompt string, { prompt }, or { name, prompt } is enough. Included even when strategy_ids omits the generated custom id.

```json
[
  {
    "prompt": "Ask more questions before you commit to an answer."
  },
  {
    "name": "Stay on substitution",
    "prompt": "Pick substitution and stay with it."
  },
  "Stay on substitution and do not switch methods."
]
```

#### create_knowledge_region (request)

Simulation wizard body. strategy_ids are built-in catalog ids. custom_strategies add prompt-defined walks.

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems region",
  "protocol_ids": [
    "11111111-1111-1111-1111-111111111111"
  ],
  "strategy_ids": [
    "exploit-heavy",
    "information-seeking"
  ],
  "custom_strategies": [
    {
      "prompt": "Ask more questions before you commit to an answer."
    }
  ],
  "samples_per_strategy": 12,
  "include_human_data": false,
  "ai_use_catalog_ids": [],
  "samples_per_ai_use": 6
}
```

#### simulation_job (response)

202 body from create_knowledge_region / simulate_knowledge_region. Poll get_knowledge_region_job.

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

**Response** (HTTP 202)

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X POST 'https://uncertain.systems/api/v3/knowledge-regions?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems region",
    "protocol_ids": [
      "11111111-1111-1111-1111-111111111111"
    ],
    "strategy_ids": [
      "exploit-heavy",
      "information-seeking"
    ],
    "custom_strategies": [
      {
        "prompt": "Ask more questions before you commit to an answer."
      }
    ],
    "samples_per_strategy": 12
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems region",
    "protocol_ids": [
      "11111111-1111-1111-1111-111111111111"
    ],
    "strategy_ids": [
      "exploit-heavy",
      "information-seeking"
    ],
    "custom_strategies": [
      {
        "prompt": "Ask more questions before you commit to an answer."
      }
    ],
    "samples_per_strategy": 12
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "POST",
    "https://uncertain.systems/api/v3/knowledge-regions?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "name": "Linear systems region",
        "protocol_ids": [
            "11111111-1111-1111-1111-111111111111"
        ],
        "strategy_ids": [
            "exploit-heavy",
            "information-seeking"
        ],
        "custom_strategies": [
            {
                "prompt": "Ask more questions before you commit to an answer."
            }
        ],
        "samples_per_strategy": 12
    },
)
print(response.json())
```

### get_knowledge_region

- **MCP:** `get_knowledge_region`
- **REST:** `GET /api/v3/knowledge-regions/{knowledge_region_id}`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Read one knowledge region: clusters, strategies, AI-use clusters, and samples (no vectors).

Read one knowledge region with clusters, strategies, AI-use clusters, and samples (no vectors). REST: GET /api/v3/knowledge-regions/{knowledge_region_id}.

**Path parameters**

- `knowledge_region_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### knowledge_region (response)

Region with clusters, strategies, and samples. No vectors.

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "Linear systems region",
  "description": "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
  "created_at": "2026-11-27T00:00:00.000Z",
  "subject_count": 1,
  "workspace_id": "ws_…",
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems"
    }
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy"
    }
  ],
  "samples_per_strategy": 12,
  "simulated_count": 12,
  "cohort_count": 0,
  "analysis_count": 0,
  "real_session_count": 0,
  "clusters": [
    {
      "id": "cluster_…",
      "name": "Linear systems region · Exploit-heavy",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy",
      "sample_count": 12
    }
  ],
  "ai_use_clusters": [],
  "samples": [
    {
      "id": "emb_…",
      "identity": "Simulated · Exploit-heavy",
      "origin": "simulated",
      "point_kind": "simulated",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "workspace_id": "ws_…",
      "source": "simulated",
      "cluster_id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ]
}
```

**Response** (HTTP 200)

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "Linear systems region",
  "description": "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
  "created_at": "2026-11-27T00:00:00.000Z",
  "subject_count": 1,
  "workspace_id": "ws_…",
  "protocols": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Linear systems"
    }
  ],
  "strategies": [
    {
      "id": "exploit-heavy",
      "name": "Exploit-heavy"
    }
  ],
  "samples_per_strategy": 12,
  "simulated_count": 12,
  "cohort_count": 0,
  "analysis_count": 0,
  "real_session_count": 0,
  "clusters": [
    {
      "id": "cluster_…",
      "name": "Linear systems region · Exploit-heavy",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy",
      "sample_count": 12
    }
  ],
  "ai_use_clusters": [],
  "samples": [
    {
      "id": "emb_…",
      "identity": "Simulated · Exploit-heavy",
      "origin": "simulated",
      "point_kind": "simulated",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "workspace_id": "ws_…",
      "source": "simulated",
      "cluster_id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ]
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### update_knowledge_region

- **MCP:** `update_knowledge_region`
- **REST:** `PATCH /api/v3/knowledge-regions/{knowledge_region_id}`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Rename a knowledge region.

Rename a knowledge region. REST: PATCH /api/v3/knowledge-regions/{knowledge_region_id}.

**Path parameters**

- `knowledge_region_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems region (revised)"
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)
- `name` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id",
    "name"
  ],
  "additionalProperties": false
}
```

**Response** (HTTP 200)

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "Linear systems region",
  "description": "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
  "workspace_id": "ws_…",
  "subject_count": 1,
  "created_at": "2026-11-27T00:00:00.000Z"
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X PATCH 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems region (revised)"
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "PATCH",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "name": "Linear systems region (revised)"
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "PATCH",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "name": "Linear systems region (revised)"
    },
)
print(response.json())
```

### delete_knowledge_region

- **MCP:** `delete_knowledge_region`
- **REST:** `DELETE /api/v3/knowledge-regions/{knowledge_region_id}`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Delete a knowledge region and its simulation clusters.

Delete a knowledge region and its simulation clusters. REST: DELETE /api/v3/knowledge-regions/{knowledge_region_id}.

**Path parameters**

- `knowledge_region_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id"
  ],
  "additionalProperties": false
}
```

**Response** (HTTP 200)

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "deleted_ids": [
    "22222222-2222-2222-2222-222222222222"
  ]
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X DELETE 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "DELETE",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "DELETE",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### simulate_knowledge_region

- **MCP:** `simulate_knowledge_region`
- **REST:** `POST /api/v3/knowledge-regions/{knowledge_region_id}/simulation`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:write`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 202

Add exploration-strategy or AI-use samples to an existing knowledge region.

Add exploration-strategy or AI-use samples to an existing knowledge region. REST: POST /api/v3/knowledge-regions/{knowledge_region_id}/simulation.

**Path parameters**

- `knowledge_region_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**JSON body**

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "strategy_ids": [
    "novelty-seeking"
  ],
  "custom_strategies": [
    "Stay on substitution and do not switch methods."
  ],
  "samples_per_strategy": 12
}
```

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)
- `protocol_ids` (optional, array · Protocol ids from get_knowledge_region_options. Alias protocolIds.)
- `strategy_ids` (optional, array · Built-in exploration strategy ids: exploit-heavy, information-seeking, novelty-seeking, balanced, narrow-and-deep. Custom strategies from custom_strategies are included even when their generated ids are omitted here. Alias strategyIds.)
- `custom_strategies` (optional, array · Custom exploration strategies. Pass a prompt string, { prompt }, or { name, prompt }. Included in the run even if strategy_ids omits the generated custom id. Alias customStrategies.)
- `custom_strategies[].id` (optional, string)
- `custom_strategies[].name` (optional, string · Optional display name. Derived from prompt when omitted.)
- `custom_strategies[].instructions` (optional, string · Exploration prompt. Alias of prompt.)
- `custom_strategies[].prompt` (optional, string · Exploration prompt. Enough on its own: { prompt } or a string item. Alias of instructions.)
- `custom_strategies[].description` (optional, string)
- `samples_per_strategy` (optional, integer · Samples per exploration strategy (3–48, default 12). Alias samplesPerStrategy.)
- `include_human_data` (optional, boolean · Overlay real protocol sessions on the simulated region. Alias includeHumanData.)
- `ai_use_catalog_ids` (optional, array · AI-use catalog ids from get_knowledge_region_options (requires an org OpenRouter key). Alias aiUseCatalogIds.)
- `samples_per_ai_use` (optional, integer · Samples per AI-use model (3–12, default 6). Alias samplesPerAiUse.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    },
    "protocol_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Protocol ids from get_knowledge_region_options. Alias protocolIds."
    },
    "strategy_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Built-in exploration strategy ids: exploit-heavy, information-seeking, novelty-seeking, balanced, narrow-and-deep. Custom strategies from custom_strategies are included even when their generated ids are omitted here. Alias strategyIds."
    },
    "custom_strategies": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "type": "string",
            "description": "Prompt-only custom strategy. Name is derived from the prompt."
          },
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "name": {
                "type": "string",
                "description": "Optional display name. Derived from prompt when omitted."
              },
              "instructions": {
                "type": "string",
                "description": "Exploration prompt. Alias of prompt."
              },
              "prompt": {
                "type": "string",
                "description": "Exploration prompt. Enough on its own: { prompt } or a string item. Alias of instructions."
              },
              "description": {
                "type": "string"
              }
            },
            "additionalProperties": false
          }
        ]
      },
      "description": "Custom exploration strategies. Pass a prompt string, { prompt }, or { name, prompt }. Included in the run even if strategy_ids omits the generated custom id. Alias customStrategies."
    },
    "samples_per_strategy": {
      "type": "integer",
      "description": "Samples per exploration strategy (3–48, default 12). Alias samplesPerStrategy."
    },
    "include_human_data": {
      "type": "boolean",
      "description": "Overlay real protocol sessions on the simulated region. Alias includeHumanData."
    },
    "ai_use_catalog_ids": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "AI-use catalog ids from get_knowledge_region_options (requires an org OpenRouter key). Alias aiUseCatalogIds."
    },
    "samples_per_ai_use": {
      "type": "integer",
      "description": "Samples per AI-use model (3–12, default 6). Alias samplesPerAiUse."
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### custom_strategies (request)

Custom exploration strategies for create_knowledge_region and simulate_knowledge_region. A prompt string, { prompt }, or { name, prompt } is enough. Included even when strategy_ids omits the generated custom id.

```json
[
  {
    "prompt": "Ask more questions before you commit to an answer."
  },
  {
    "name": "Stay on substitution",
    "prompt": "Pick substitution and stay with it."
  },
  "Stay on substitution and do not switch methods."
]
```

#### create_knowledge_region (request)

Simulation wizard body. strategy_ids are built-in catalog ids. custom_strategies add prompt-defined walks.

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "name": "Linear systems region",
  "protocol_ids": [
    "11111111-1111-1111-1111-111111111111"
  ],
  "strategy_ids": [
    "exploit-heavy",
    "information-seeking"
  ],
  "custom_strategies": [
    {
      "prompt": "Ask more questions before you commit to an answer."
    }
  ],
  "samples_per_strategy": 12,
  "include_human_data": false,
  "ai_use_catalog_ids": [],
  "samples_per_ai_use": 6
}
```

#### simulation_job (response)

202 body from create_knowledge_region / simulate_knowledge_region. Poll get_knowledge_region_job.

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

**Response** (HTTP 202)

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.
- `validation_error` · HTTP 400 · Write bodies that fail authoring or wizard validation.

**Examples**

#### curl

```bash
curl -sS -X POST 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/simulation?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "strategy_ids": [
      "novelty-seeking"
    ],
    "custom_strategies": [
      "Stay on substitution and do not switch methods."
    ],
    "samples_per_strategy": 12
  }'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/simulation?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "organization_id": "00000000-0000-0000-0000-000000000000",
    "strategy_ids": [
      "novelty-seeking"
    ],
    "custom_strategies": [
      "Stay on substitution and do not switch methods."
    ],
    "samples_per_strategy": 12
  }),
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "POST",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/simulation?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
    json={
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "strategy_ids": [
            "novelty-seeking"
        ],
        "custom_strategies": [
            "Stay on substitution and do not switch methods."
        ],
        "samples_per_strategy": 12
    },
)
print(response.json())
```

### get_knowledge_region_job

- **MCP:** `get_knowledge_region_job`
- **REST:** `GET /api/v3/knowledge-regions/jobs/{job_id}`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Read a knowledge-region simulation job.

Read a knowledge-region simulation job. REST: GET /api/v3/knowledge-regions/jobs/{job_id}.

**Path parameters**

- `job_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `job_id` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "job_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "job_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### simulation_job (response)

202 body from create_knowledge_region / simulate_knowledge_region. Poll get_knowledge_region_job.

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

**Response** (HTTP 200)

```json
{
  "type": "job",
  "job_id": "33333333-3333-3333-3333-333333333333",
  "family": "exploration",
  "status": "queued",
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "follow_up_job_id": null,
  "progress": [],
  "cost_usd": 0,
  "error": null,
  "plan_cursor": 0,
  "plan_length": 24
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions/jobs/33333333-3333-3333-3333-333333333333?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/jobs/33333333-3333-3333-3333-333333333333?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions/jobs/33333333-3333-3333-3333-333333333333?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### get_knowledge_region_run

- **MCP:** `get_knowledge_region_run`
- **REST:** `GET /api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Retrieve stored proof-of-work for one sample run in a knowledge region (no person audio or video).

Retrieve stored proof-of-work for one sample run (no person audio or video). REST: GET /api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}.

**Path parameters**

- `knowledge_region_id` (string, required)
- `run_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)
- `run_id` (required, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    },
    "run_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id",
    "run_id"
  ],
  "additionalProperties": false
}
```

**Response** (HTTP 200)

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "run_id": "44444444-4444-4444-4444-444444444444",
  "identity": "Simulated · Exploit-heavy",
  "protocol_id": "11111111-1111-1111-1111-111111111111"
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/runs/44444444-4444-4444-4444-444444444444?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/runs/44444444-4444-4444-4444-444444444444?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/runs/44444444-4444-4444-4444-444444444444?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### get_knowledge_region_candidate

- **MCP:** `get_knowledge_region_candidate`
- **REST:** `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Render metrics for one candidate in a knowledge region: unsys distance, cluster L2, path and pairwise L2.

Render one candidate in a knowledge region (unsys distance, cluster L2, pairwise L2). REST: GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}.

**Path parameters**

- `knowledge_region_id` (string, required)
- `candidate_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)
- `space`

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)
- `candidate_id` (required, string)
- `space` (optional, string · Embedding space. This client reads Path (flowcfg-v1-d96) only.)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    },
    "candidate_id": {
      "type": "string"
    },
    "space": {
      "type": "string",
      "description": "Embedding space. This client reads Path (flowcfg-v1-d96) only."
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id",
    "candidate_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### knowledge_region_candidate (response)

Closed metrics for one candidate in a named embedding space (default path).

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "candidate_id": "learner-42",
  "embedding_model_id": "flowcfg-v1-d96",
  "space": "path",
  "dim": 96,
  "clusters": [
    {
      "id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ],
  "observations": [
    {
      "id": "emb_…",
      "created_at": "2026-11-27T00:00:00.000Z",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "nearest_cluster_id": "cluster_…",
      "unsys": {
        "distance": 0.4,
        "excess": 0.1,
        "steps": 3
      },
      "cluster_distances": [
        {
          "cluster_id": "cluster_…",
          "l2": 0.12,
          "nearest": true,
          "in_cluster": true
        }
      ]
    }
  ],
  "unsys": {
    "average": 0.4,
    "observation_count": 1,
    "scored_count": 1,
    "flows": []
  },
  "path": {
    "segments": [],
    "span": null
  },
  "pairwise": {
    "observation_ids": [
      "emb_…"
    ],
    "matrix": [
      [
        0
      ]
    ]
  }
}
```

**Response** (HTTP 200)

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "candidate_id": "learner-42",
  "embedding_model_id": "flowcfg-v1-d96",
  "space": "path",
  "dim": 96,
  "clusters": [
    {
      "id": "cluster_…",
      "strategy_id": "exploit-heavy",
      "strategy_name": "Exploit-heavy"
    }
  ],
  "observations": [
    {
      "id": "emb_…",
      "created_at": "2026-11-27T00:00:00.000Z",
      "flow_id": "11111111-1111-1111-1111-111111111111",
      "run_id": "44444444-4444-4444-4444-444444444444",
      "nearest_cluster_id": "cluster_…",
      "unsys": {
        "distance": 0.4,
        "excess": 0.1,
        "steps": 3
      },
      "cluster_distances": [
        {
          "cluster_id": "cluster_…",
          "l2": 0.12,
          "nearest": true,
          "in_cluster": true
        }
      ]
    }
  ],
  "unsys": {
    "average": 0.4,
    "observation_count": 1,
    "scored_count": 1,
    "flows": []
  },
  "path": {
    "segments": [],
    "span": null
  },
  "pairwise": {
    "observation_ids": [
      "emb_…"
    ],
    "matrix": [
      [
        0
      ]
    ]
  }
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/candidates/learner-42?organization_id=00000000-0000-0000-0000-000000000000&space=path' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/candidates/learner-42?organization_id=00000000-0000-0000-0000-000000000000&space=path", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/candidates/learner-42?organization_id=00000000-0000-0000-0000-000000000000&space=path",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```

### get_knowledge_region_uncertainty_model

- **MCP:** `get_knowledge_region_uncertainty_model`
- **REST:** `GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model`
- **Family:** Knowledge Regions API
- **Scope:** `workspaces:read`
- **Auth:** `Authorization: Bearer <api_key>`
- **Success:** HTTP 200

Overlay one candidate walk on the region’s reference uncertainty model.

Overlay one candidate walk on the region’s reference uncertainty model. REST: GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model.

**Path parameters**

- `knowledge_region_id` (string, required)
- `candidate_id` (string, required)

**Query**

- `organization_id` (required; also JSON body or `X-Organization-Id`)

**MCP / REST arguments**

- `organization_id` (required, string · Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.)
- `knowledge_region_id` (required, string)
- `candidate_id` (required, string)
- `run_id` (optional, string)

**Input JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "organization_id": {
      "type": "string",
      "description": "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId."
    },
    "knowledge_region_id": {
      "type": "string"
    },
    "candidate_id": {
      "type": "string"
    },
    "run_id": {
      "type": "string"
    }
  },
  "required": [
    "organization_id",
    "knowledge_region_id",
    "candidate_id"
  ],
  "additionalProperties": false
}
```

**Schemas**

#### uncertainty_model (response)

Reference hidden-state tree plus the candidate walk overlay.

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "candidate_id": "learner-42",
  "observation_id": "emb_…",
  "run_id": "44444444-4444-4444-4444-444444444444",
  "identity": "learner-42",
  "reference": {
    "root_id": "linear-systems",
    "hidden_states": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parent_id": null
      }
    ]
  },
  "mapped": {
    "sequence": [
      "linear-systems",
      "row-reduce"
    ],
    "hidden_states": []
  },
  "overlay": {
    "walk": [
      "linear-systems",
      "row-reduce"
    ]
  }
}
```

**Response** (HTTP 200)

```json
{
  "knowledge_region_id": "22222222-2222-2222-2222-222222222222",
  "candidate_id": "learner-42",
  "observation_id": "emb_…",
  "run_id": "44444444-4444-4444-4444-444444444444",
  "identity": "learner-42",
  "reference": {
    "root_id": "linear-systems",
    "hidden_states": [
      {
        "id": "linear-systems",
        "title": "Linear systems",
        "parent_id": null
      }
    ]
  },
  "mapped": {
    "sequence": [
      "linear-systems",
      "row-reduce"
    ],
    "hidden_states": []
  },
  "overlay": {
    "walk": [
      "linear-systems",
      "row-reduce"
    ]
  }
}
```

**Errors**

- `unauthorized` · HTTP 401 · Bearer key missing or invalid.
- `key_revoked` · HTTP 401 · Key is inactive.
- `key_expired` · HTTP 401 · Key past expires_at.
- `api_plan_required` · HTTP 403 · Bearer endpoints require an active API Metered plan.
- `forbidden` · HTTP 403 · Caller is not a member of the requested organization.
- `organization_id_required` · HTTP 400 · Pass organization_id in JSON, query, or X-Organization-Id.
- `rate_limit_exceeded` · HTTP 429 · 120 requests per minute per key.
- `not_found` · HTTP 404 · Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.

**Examples**

#### curl

```bash
curl -sS -X GET 'https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/candidates/learner-42/uncertainty-model?organization_id=00000000-0000-0000-0000-000000000000' \
  -H 'Authorization: Bearer sk_…' \
  -H 'Content-Type: application/json'
```

#### JavaScript

```javascript
const response = await fetch("https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/candidates/learner-42/uncertainty-model?organization_id=00000000-0000-0000-0000-000000000000", {
  method: "GET",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  },
});
const data = await response.json();
```

#### Python

```python
import requests

response = requests.request(
    "GET",
    "https://uncertain.systems/api/v3/knowledge-regions/22222222-2222-2222-2222-222222222222/candidates/learner-42/uncertainty-model?organization_id=00000000-0000-0000-0000-000000000000",
    headers={
        "Authorization": "Bearer sk_…",
        "Content-Type": "application/json",
    },
)
print(response.json())
```
