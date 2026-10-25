# Uncertain Systems agent APIs

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage workspaces** or **run Calibrate, Learn, and Verify flows headless**.

There are **two** public agent APIs:

1. **Workspace management** — `GET/POST /api/v3/workspaces`, `GET/PATCH /api/v3/workspaces/{id}`, map blocks, workspace settings, account settings (`/api/v3/account`). Create and edit **Learning** workspaces (`kind: "learning"` / `standard`). Verification and Calibration flows use `POST /api/dashboard/flows`.
2. **Headless proof-of-work** — `POST /api/v3/pow/workspaces/{id}/sessions` (`start_session` with `flow_kind` calibrate | learn | verify), submit proof of work, `end_session`. The server prepares the answers-model tree, infers the path from proof plus actions (catalogs **4 / 8 / 16**), and enforces the session clock.

**Human-readable spec:** `/docs/proof-of-work-api`  
**Base URL:** `https://uncertain.systems` (or your self-hosted origin)
**MCP:** `POST /api/mcp` with `Authorization: Bearer <api_key>`

Snapshot (`/api/v3/snapshot`) and Stash (`/api/v3/stash`) are retired. They are **not** public agent APIs.

**Teams tier required.** Plan-gate failures return **`403` with `error.code = "api_plan_required"`**.

---

## Evaluation modes

| Mode | When to use | Create | Schema | Performance |
|------|-------------|--------|--------|-------------|
| `semantic` | Default — full learning verification | `POST /api/v3/workspaces` or `/workspace/new` | `definition` | Headless session (`start_session` → `end_session`) infers the path on the answers-model tree |
| `opaque` | Privacy-preserving structural verification | `POST /api/v3/workspaces` or `/workspace/new` | `definition_ref` + `contract.event_verbs` | `protocol_report`, `privacy`; no semantic inference |

**Opaque guardrails:**
- `goal_ref`, `definition_ref`, and `external_refs` are stored but **never interpreted** into domain meaning.
- Upload `metadata` allowlist: `trace_token`, `goal_ref`, `anon`, `event_count`, `schema_version`, `protocol_id`, `phase_id`, `allow_plaintext`.
- Tool payloads are plaintext-linted (file paths rejected unless `metadata.allow_plaintext=true`).
- Canonical protocol `agent-trace-v3`: phases `enumerate`, `fingerprint`, `aggregate`, `emit`, `validate`.

---

## Authentication

Send API keys on every request:

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

| Key type | Prefix | Created via |
|----------|--------|-------------|
| Organization member (Teams admin) | `sk_` | Dashboard **Usage → API Access**, or `POST /api/v3/pow/keys` (browser session) |
| Organization guest | `gsk_` | `POST /api/v3/pow/org/guests` (org-admin key with `org:write`) |

**Default scopes** for new member keys: `workspaces:read`, `workspaces:write`, `sessions:read`, `sessions:write`.

**Organization scopes** `org:read` and `org:write` may only be assigned to keys owned by an **organization admin** (`is_org_admin`). Non-admin Teams users cannot add `org:*` scopes to their keys.

**Guest keys** are always issued with: `workspaces:read`, `workspaces:write`, `sessions:read`, `sessions:write` — no `org:*`.

**Rate limit:** 120 requests per minute per key (best-effort per server instance). Exceeded → `429` with `error.code = "rate_limit_exceeded"`.

**Error shape:**

```json
{
  "error": {
    "code": "forbidden",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

Common codes: `unauthorized`, `forbidden`, `api_plan_required`, `validation_error`, `workspace_not_found`, `block_not_found`, `tap_link_not_found`, `rate_limit_exceeded`, `no_new_pow`.

---

## Predictive interruptions (expected free energy)

Every Proof-of-Work API **success** response includes top-level `interruption` — object or `null`.

| Value | Meaning |
|-------|---------|
| `null` | No intervention predicted |
| object | Schedule `intervention` after `delay_ms` unless superseded by a later API response |

```json
{
  "interruption": {
    "interruption_id": "int_upload_proof_of_work_ws1_a1b2c3d4",
    "delay_ms": 75000,
    "intervention": {
      "type": "reflection_prompt",
      "message": "Briefly note why you chose that action before continuing.",
      "rationale": "Tool trace benefits from explicit rationale.",
      "consumer_action": "present_reflection_prompt",
      "block_id": null
    },
    "confidence": "medium",
    "predicted_at": "2026-07-10T12:00:00.000Z"
  }
}
```

**Consumer integration pattern:**

1. On each response, read `interruption`.
2. If non-null, start a timer for `delay_ms` and prepare `intervention.message` / `consumer_action`.
3. If another Proof-of-Work API response arrives first, cancel the pending timer and apply the new `interruption` (or do nothing if null).
4. Never stack timers — always supersede.

Intervention types: `reflection_prompt`, `checkpoint_probe`, `coaching_nudge`, `proof_of_work_reminder`, `performance_review`, `chapter_map_expand`.

Headless session responses (`start_session`, `upload_proof_of_work`, `end_session`) also return `interruption_contract` semantics via top-level `interruption`, and may include workspace-specific `predicted_interruption` from Grok.

MCP resource: `resources/read uncertain-systems://predictive-interruptions`

---

## MCP (optional transport)

Grok and other MCP clients can call tools via JSON-RPC:

```http
POST /api/mcp (Authorization: Bearer <api_key>)
Content-Type: application/json
```

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

**Tools (100% parity with public agent REST under `/api/v3/workspaces` and `/api/v3/pow`; two families only; key CRUD is browser-session only):**

`list_workspaces`, `get_workspace`, `create_workspace`, `update_workspace`, `list_blocks`, `update_blocks`, `list_map_tools`, `apply_map_tool`, `get_workspace_settings`, `update_workspace_settings`, `get_account_settings`, `update_account_settings`, `generate_integration_skill`, `start_session`, `get_session`, `upload_proof_of_work`, `end_session`, `list_flow_embeddings`, `get_flow_embedding`

**Partner agents:** `create_workspace` or `get_workspace`, then `start_session` → `upload_proof_of_work` → `end_session`. PumaDoc policy snippets: `/customer-agent-uncertain-systems-policy.md`, `/pumaclaw-mentor-uncertain-systems-policy.md`.

Every MCP tool result includes `interruption` (expected free energy) with the same semantics as REST.

REST and MCP both use `Authorization: Bearer <api_key>` with Teams API keys from the dashboard. Treat API keys as secrets.

MCP resources: `uncertain-systems://integration-scope`, `uncertain-systems://proof-of-work-loop`, `uncertain-systems://predictive-interruptions`

---

## Endpoints

### `POST /api/v3/workspaces` — `workspaces:write` — create_workspace

Create a **Learning** workspace only (`kind: "learning"` / `standard`). Verification and Calibration flows use `POST /api/dashboard/flows`. Optional `title`, `description`, `workspace_goal`, `learning_model_size` (4 | 8 | 16), `blocks` (map), or `initial_prompt` to generate. MCP: `create_workspace`.

---

### `GET /api/v3/pow/workspaces` — `workspaces:read`

List workspaces accessible to the API key. MCP: `list_workspaces`.

Query: `status`, `limit` (1–100, default 20), `offset`.

**Response `200`:** `{ "workspaces": [ ... ], "pagination": { "total", "limit", "offset", "has_more" } }`

---

### `GET /api/v3/pow/workspaces/{workspace_id}` — `workspaces:read`

Workspace metadata including `workspace_goal`. MCP: `get_workspace`.

---

### `GET /api/v3/pow/workspaces/{workspace_id}/blocks` — `workspaces:read`

List assessable blocks. Organization members and guests may read **organization-owned** workspaces.

**Response `200`:** `{ "blocks": [ ... ] }`

---

### `POST /api/v3/pow/workspaces/{workspace_id}/proof-of-work-schema` — `workspaces:read`

Given workspace context plus an evaluation definition, returns a JSON Schema for the ideal tool proof-of-work payload. Use **before** first upload.

**Semantic request:**

```json
{
  "definition": "Evaluate whether the learner can articulate a crisp ICP with segment rationale and validation plan",
  "block_id": "optional-block-uuid",
  "integration_hints": {
    "tool_name": "pumadoc",
    "partner_agent": "PumaDoc Customer Agent",
    "event_verbs": ["run_simulation", "edit_field", "publish_artifact"],
    "goals": ["simulation_completed", "artifact_published"]
  }
}
```

**Opaque request** (opaque workspace or `evaluation_mode: "opaque"`):

```json
{
  "evaluation_mode": "opaque",
  "definition_ref": "trace-audit-v3",
  "contract": {
    "event_verbs": ["enumerate", "fingerprint", "aggregate", "emit", "validate"],
    "goal_tokens": ["goal_ref:partner-token-abc"]
  },
  "block_id": "optional-block-uuid"
}
```

**Response `200`:**

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "events": { "type": "array", "items": { "type": "object" } },
      "goals_achieved": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["events"]
  },
  "schema_name": "eval_input_icp_clarity",
  "rationale": "Why these fields capture optimal eval signal for this workspace",
  "example_payload": { "events": [], "goals_achieved": ["simulation_completed"] },
  "recommended_mime_type": "application/json",
  "recommended_proof_of_work_type": "tool",
  "required_fields": ["events"],
  "optional_fields": ["learner_reflection"],
  "collection_guidance": "Upload after each simulation run or when the learner publishes an artifact.",
  "workspace_id": "uuid",
  "block_id": null,
  "definition": "...",
  "workspace_summary": { "id": "uuid", "title": "...", "root_topic": "..." },
  "context_counts": { "blocks": 5, "workspace_files": 2, "proof_of_work_artifacts": 0 },
  "interruption_contract": { "description": "Expected-free-energy interruption contract...", "supersession_rule": "..." },
  "file_ids": ["file_..."],
  "interruption": {
    "interruption_id": "int_start_session_ws1_x1y2z3",
    "delay_ms": 30000,
    "intervention": {
      "type": "proof_of_work_reminder",
      "message": "Upload your first proof-of-work artifact using the tool_submissions contract.",
      "consumer_action": "call_upload_proof_of_work"
    },
    "confidence": "high",
    "predicted_at": "2026-07-10T12:00:00.000Z"
  }
}
```

---

### `POST /api/v3/pow/workspaces/{workspace_id}/integration-skill` — `workspaces:read`

Generate a workspace-specific `skill.md` integration guide via `POST .../integration-skill` for a custom partner agent. Grok uses workspace blocks, topic, and plan files to tailor endpoints, payload examples, and checklists.

**Request:**

```json
{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls and objection handling",
  "block_id": "optional-block-uuid",
  "base_url": "https://uncertain.systems",
  "include_sections": ["purpose", "auth", "endpoints", "proof_of_work_payload", "performance", "checklist"]
}
```

**Response `200`:**

```json
{
  "skill_md": "---\nname: acme-sales-copilot-uncertain-systems-proof-of-work-performance\n...",
  "skill_name": "acme-sales-copilot-uncertain-systems-proof-of-work-performance",
  "suggested_share_path": "/acme-sales-copilot-skill.md",
  "workspace_summary": {
    "id": "uuid",
    "title": "Discovery mastery",
    "root_topic": "B2B sales discovery",
    "block_count": 5
  },
  "context_counts": { "blocks": 5, "workspace_files": 1 },
  "file_ids": ["file_..."]
}
```

Host the returned markdown at your suggested path or inject `skill_md` directly into your agent's skill system.

---

### `POST /api/v3/pow/workspaces/{workspace_id}/sessions` — `workspaces:write` — `start_session`

Start a headless **Calibrate**, **Learn**, or **Verify** session. The server prepares the answers-model tree and starts the session clock (1–120 minutes, default 15).

**Request:**

```json
{
  "flow_kind": "calibrate",
  "catalog_size": 8,
  "duration_minutes": 15,
  "block_id": "optional-block-uuid",
  "chapter_title": "optional",
  "chapter_brief": "optional"
}
```

`flow_kind`: `calibrate` | `learn` | `verify`. `catalog_size`: `4` | `8` | `16`.

**Response `201`:** session_id, remaining_ms, answers_model (catalog_size, focus, branch_count), status.

---

### `POST /api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work` — `workspaces:write` — `upload_proof_of_work`

Submit proof of work into a live headless session. The server infers the path on the prepared tree from those events plus actions. Expired sessions reject further work (`401` `session_expired`).

**Request:**

```json
{
  "events": [
    {
      "type": "tool",
      "tool_name": "canvas",
      "tool_action": "board_prompt",
      "metadata": { "prompt": "I close this observation." },
      "timestamp_ms": 1710000000000
    }
  ]
}
```

You may also send a single event at the top level (`tool_action` + `metadata`). Stored type is `tool` for simulated session.

**Response `200`:** remaining_ms, sequence (inferred path), proof_count, focus, answers_model.

---

### `GET /api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}` — `workspaces:read` — `get_session`

Read remaining time, inferred path, current focus, and the answers model.

---

### `POST /api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/end` — `workspaces:write` — `end_session`

End the session: score the inferred path against the prepared tree and persist the flow embedding (`flowcfg-v1-d96`). Outcome is answers-model + inferred path + proof of work.

---

### `POST /api/v3/pow/org/guests` — `org:write`

Create (or look up) a guest by email and mint a **new** guest API key. Caller must be an **organization admin** with `org:write` on their key.

**Request:** `{ "email": "learner@example.com" }`

**Response `201` (new guest) or `200` (existing guest):**

```json
{
  "guest_user": {
    "id": "uuid",
    "organization_id": "uuid",
    "email": "learner@example.com",
    "status": "active"
  },
  "api_key": "gsk_...",
  "key": {
    "id": "uuid",
    "key_prefix": "gsk_...",
    "scopes": ["workspaces:read", "sessions:read", "sessions:write"],
    "rate_limit": 120
  }
}
```

Store `api_key` securely — shown once. Re-calling for the same email issues another key (previous keys may remain active).

When the guest later signs up with the same email, they inherit org membership, session history, and guest keys.

---

## Organization setup (browser session, not Bearer)

Create an org with the logged-in Teams user (cookie session):

```http
POST /api/organization
Content-Type: application/json
```

```json
{ "name": "Acme Enablement" }
```

Requires `pro_teams` active. Returns `{ "organization", "is_org_admin": true }`.

Then create a member API key from the dashboard or `POST /api/v3/pow/keys` (session auth).

---

## Session behavior

- **Private links:** `/calibrate/session/{token}`, `/learn/session/{token}`, `/verify/session/{token}` — bearer URL; learner needs **no** Uncertain Systems login or API key.
- **Workspace UI:** `/workspace/{workspace_id}` (authenticated web)
- **Live APIs:** `POST /api/workspace-tap-score/chat`, `POST /api/workspace-tap-score/complete` (use `privateToken` in body).

Facilitation style: Socratic — one concise question at a time, follow-ups from the learner's words, no lecturing unless asked.

**UI hotkeys:** `1`/`2`/`3` send thoughts; `Ctrl/Cmd+1/2/3` multi-select; `S` send selection; `Esc` skip to Thought Memory.

---

## Guest vs org-admin responsibilities

| Action | Org-admin / member key (`sk_`) | Guest key (`gsk_`) |
|--------|-------------------------------|---------------------|
| Create workspace | ✅ `POST /api/v3/workspaces` / `create_workspace` | ✅ (org workspaces) |
| List / edit map and settings | ✅ | ✅ (org workspaces) |
| Integration skill | ✅ | ✅ |
| Start / run / end headless session | ✅ | ✅ |
| Create guest + issue `gsk_` | ✅ `org:write` + `is_org_admin` | ❌ |

**Integration pattern:** Org admin provisions guests with `gsk_` keys. Guests (or ChatGPT / Claude with those keys) create or open a workspace, then `start_session` → `upload_proof_of_work` → `end_session`.

---

## Quick integration checklist

1. Teams user creates org (`POST /api/organization`) and API key (`sk_` with default scopes).
2. `create_workspace` / `POST /api/v3/workspaces` for a Learning workspace (`kind: "learning"` / `standard`), or `get_workspace` if it already exists. Verification and Calibration flows use `POST /api/dashboard/flows`.
3. `list_blocks` / `GET .../blocks` → map contents to your workflow steps. On Learning workspaces, `list_map_tools` / `GET .../map-tools` lists the Helios builder catalog; `apply_map_tool` / `POST .../map-tools` applies those tools atomically.
4. *(Optional)* `POST .../integration-skill` for a custom `skill.md`.
5. `start_session` with `flow_kind` calibrate | learn | verify.
6. `upload_proof_of_work` as the agent produces tool events (repeat until the clock expires).
7. `end_session` to persist the answers-model tree, inferred path, and flow embedding.
8. For external learners without accounts: `POST /org/guests` → give them `gsk_` so their agent can run the same loop.