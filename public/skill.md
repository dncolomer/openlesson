# Uncertain Systems Proof-of-Work API

Use this skill when an agent needs to work with existing Verification Workspaces (created in the product UI), issue private Think Aloud Protocol (TAP) links, upload proof of work, and run unified performance analysis via the Uncertain Systems Proof-of-Work API.

**Human-readable spec:** `/docs/proof-of-work-api`  
**Base URL:** `https://uncertain.systems` (or your self-hosted origin)

---

## Scope

The Proof-of-Work API supports **only** this workflow:

1. Resolve an existing Verification Workspace created in the product UI (`/workspace/new`) — use `list_workspaces` / `get_workspace` / `get_learning_progress` (REST + MCP). **Do not** call `POST /workspaces` or MCP `create_workspace` (rejected: create is UI-only).
2. List blocks in that workspace.
3. *(Optional)* Generate an ideal proof-of-work input JSON schema (`POST .../proof-of-work-schema`) or a custom integration `skill.md` (`POST .../integration-skill`) from workspace context.
4. Upload proof of work (`POST .../proof-of-work`) **or** buffer via Stash API then stash/submit.
5. Run LWM Snapshot (`lwm-snapshot` / `lwm_snapshot`) and optional eval reads (world-model, knowledge-config, snapshot-history).
6. Create a private TAP link (minutes **1–120**, default **15**).
7. List TAP links and completion status; score TAP via `POST .../lwm-snapshot` only.

**Out of scope** — programmatic workspace create, blockchain tracking, proof anchoring, live tutoring session control, heartbeats, or plan adaptation. Key CRUD is browser-session only (`/api/v3/pow/keys`). Legacy `/api/session-files/*` is separate from this API.

**Teams tier required.** Agent routes under `/api/v3/{pow,snapshot,stash}` require Teams (platform admins bypass). Plan-gate failures return **`403` with `error.code = "api_plan_required"`**.

---

## Evaluation modes

| Mode | When to use | Create | Schema | Performance |
|------|-------------|--------|--------|-------------|
| `semantic` | Default — full learning verification | **UI only** (`/workspace/new`) | `definition` | LWM Snapshot (`lwm_snapshot` + GHC secondary), semantic gap analysis |
| `opaque` | Privacy-preserving structural verification | **UI only** (`/workspace/new`) | `definition_ref` + `contract.event_verbs` | `protocol_report`, `privacy`; no semantic inference |

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

**Default scopes** for new member keys: `workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`.

**Organization scopes** `org:read` and `org:write` may only be assigned to keys owned by an **organization admin** (`is_org_admin`). Non-admin Teams users cannot add `org:*` scopes to their keys.

**Guest keys** are always issued with: `workspaces:read`, `workspaces:write`, `tap:read`, `tap:write` — no `org:*`.

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

## Predictive interruptions (TIM)

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

Intervention types: `reflection_prompt`, `checkpoint_probe`, `coaching_nudge`, `proof_of_work_reminder`, `performance_review`.

Proof-of-work spec responses (`POST .../proof-of-work-schema`, MCP `generate_proof_of_work_schema`) also return `interruption_contract` and may include workspace-specific `predicted_interruption` from Grok (spec version **1.3**).

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

**Tools (100% parity with public agent REST under `/api/v3/{pow,snapshot,stash}`; create is UI-only; key CRUD is browser-session only):**

`list_workspaces`, `get_workspace`, `get_learning_progress`, `list_blocks`, `generate_proof_of_work_schema`, `generate_integration_skill`, `upload_proof_of_work`, `lwm_snapshot` (LWM Snapshot), `list_tap_links`, `create_tap_link`, `list_tapbench_links`, `create_tapbench_link`, `get_world_model`, `get_knowledge_config`, `get_knowledge_config_trajectory`, `knowledge_distance`, `list_snapshot_history`, `list_custom_knowledge_regions`, `create_custom_knowledge_region`, `eval_custom_knowledge_region`, `buffer_proof_of_work`, `stash_proof_of_work`, `submit_stashed_proof_of_work`

Workspace creation is **not** available via MCP or REST — create workspaces in the product UI at `/workspace/new`.

**Partner agents:** call `get_learning_progress` to orient, then `upload_proof_of_work` (or Stash buffer tools) and vertical scores. PumaDoc policy snippets: `/customer-agent-uncertain-systems-policy.md`, `/pumaclaw-mentor-uncertain-systems-policy.md`.

Every MCP tool result includes `interruption` (TIM) with the same semantics as REST.

REST and MCP both use `Authorization: Bearer <api_key>` with Teams API keys from the dashboard. Treat API keys as secrets.

MCP resources: `uncertain-systems://integration-scope`, `uncertain-systems://proof-of-work-loop`, `uncertain-systems://predictive-interruptions`

---

## Endpoints

### `POST /api/v3/pow/workspaces` — not available (UI-only create)

Programmatic workspace creation is **disabled**. This endpoint returns `403 forbidden` with a message that create is UI-only. MCP `create_workspace` is not in the tool catalog and hard-fails with the same message if called.

**Create workspaces in the product UI** at `/workspace/new` (blank, template, or files+goal). Then use `list_workspaces` / `get_workspace` / `get_learning_progress` with the resulting workspace ID.

**Response `403`:**

```json
{
  "error": {
    "code": "forbidden",
    "message": "Workspace creation is not available via API or MCP. Create workspaces manually in the product UI at /workspace/new."
  }
}
```

---

### `GET /api/v3/pow/workspaces` — `workspaces:read`

List workspaces accessible to the API key. MCP: `list_workspaces`.

Query: `status`, `limit` (1–100, default 20), `offset`.

**Response `200`:** `{ "workspaces": [ ... ], "pagination": { "total", "limit", "offset", "has_more" } }`

---

### `GET /api/v3/pow/workspaces/{workspace_id}` — `workspaces:read`

Workspace metadata including `workspace_goal`. MCP: `get_workspace`.

---

### `GET /api/v3/pow/workspaces/{workspace_id}/learning-progress` — `workspaces:read`

One-call progress snapshot (goal, blocks, counts, recommended next actions). MCP: `get_learning_progress`.

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
  "interruption_contract": { "description": "TIM contract...", "supersession_rule": "..." },
  "file_ids": ["file_..."],
  "interruption": {
    "interruption_id": "int_generate_proof_of_work_schema_ws1_x1y2z3",
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

### `POST /api/v3/pow/workspaces/{workspace_id}/proof-of-work` — `workspaces:write`

Upload open-format performance proof of work to xAI Files and link it to a workspace, optionally scoped to a block or session.

**Request:**

```json
{
  "type": "tool",
  "file_name": "canvas-events.json",
  "mime_type": "application/json",
  "data": "<base64>",
  "block_id": "optional-block-uuid",
  "session_id": "optional-session-uuid",
  "timestamp_ms": 1710000000000,
  "chunk_index": 0,
  "metadata": { "source": "custom-agent" },
  "tool_name": "canvas",
  "tool_action": "draw",
  "band_powers": { "alpha": 0.2, "beta": 0.4 },
  "device_name": "Muse",
  "sample_count": 256
}
```

**`type` values:** `tool`, `screen` (alias: `screenshot`), `video`, `eeg`

| Type | Typical MIME types |
|------|-------------------|
| `tool` | `application/json`, `text/plain`, `text/markdown` |
| `screen` | `image/png`, `image/jpeg`, `image/webp` |
| `video` | `video/mp4`, `video/webm`, `video/quicktime` |
| `eeg` | `application/json`, `text/plain` |

Max **10 MB** per upload. Guest keys attach proof of work to their guest identity; org members attach to the workspace org.

**Opaque workspaces:** `metadata` is filtered to the allowlist above. Tool payloads are plaintext-linted (reject file paths unless `metadata.allow_plaintext=true`). Response may include `evaluation_mode`, `privacy`, and `plaintext_lint`.

**Response `201`:**

```json
{
  "proof_of_work": {
    "id": "uuid",
    "workspace_id": "uuid",
    "type": "tool",
    "xai_file_id": "file_...",
    "metadata": {},
    "created_at": "..."
  },
  "evaluation_mode": "opaque",
  "privacy": { "semantic_inference": "disabled", "plaintext_lint": "enforced" },
  "plaintext_lint": { "passed": true, "violations": [] }
}
```

---

### LWM Snapshot — `workspaces:read`

Sole product score strategy (one primary 0–100 score per call + GHC secondary). Returns spider/radar `marker_scores`, analysis (`summary`, strengths/growth/gaps), and next actions (`gap_analysis.next_steps`). Run via Knowledge UI or Snapshot API/MCP (not auto on TAP/ILE end).

| Method | Path | MCP tool | Primary field |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v3/snapshot/workspaces/{workspace_id}/lwm-snapshot` | `lwm_snapshot` | `lwm_snapshot_score` / `score` |

**Product name:** LWM Snapshot (Learning World Model Snapshot). Do not present `verification_score` or “verification score” as the product score type.

**Request:**

```json
{
  "block_id": "optional-block-uuid",
  "style_prompt": "optional voice/tone"
}
```

**Response `200`:**

```json
{
  "mode": "score",
  "strategy": "lwm_snapshot",
  "label": "LWM Snapshot",
  "workspace_goal": "Trial-to-paid subscription activation",
  "workspace_goal_source": "workspace",
  "report": {
    "score": 72,
    "lwm_snapshot_score": 72,
    "workspace_goal": "Trial-to-paid subscription activation",
    "marker_scores": [
      {
        "id": "workflow_execution",
        "label": "Workflow Execution",
        "score": 78,
        "rationale": "Completed core steps with consistent tool traces."
      },
      {
        "id": "decision_quality",
        "label": "Decision Quality",
        "score": 65,
        "rationale": "Choices were reasonable but lacked quantified tradeoff analysis."
      }
    ],
    "summary": "...",
    "strengths": ["..."],
    "growth_areas": ["..."],
    "gap_analysis": {
      "summary": "...",
      "gaps": [
        {
          "title": "...",
          "proof_of_work": "...",
          "severity": "medium",
          "suggested_repair": "..."
        }
      ],
      "next_steps": {
        "directions": ["..."],
        "events": ["..."]
      }
    },
    "suggestions": ["..."],
    "confidence": "developing"
  },
  "proof_of_work_summary": {
    "blocks": 5,
    "proof_of_work_artifacts": 4,
    "linked_sessions": 1,
    "workspace_files": 0
  },
  "file_ids": ["file_..."]
}
```

**Opaque workspaces** also return `evaluation_mode`, `privacy`, `workspace_goal_source: "opaque_ref"`, and `protocol_report`.

---

### `POST /api/v3/pow/workspaces/{workspace_id}/blocks/{block_id}/tap-links` — `tap:write`

Create a private Think Aloud Protocol (TAP) link for a block.

**Request:**

```json
{
  "minutes": 15,
  "guest_user_id": "optional-uuid",
  "guest_email": "optional@example.com"
}
```

- `minutes`: integer **1–120** (default **15**; values outside the range are clamped)
- Org **admins** may assign a link to a guest via `guest_user_id` or `guest_email`
- **Guest keys** automatically attach the link to their own guest identity (no extra fields)

**Response `201`:**

```json
{
  "tap_link": {
    "id": "uuid",
    "workspace_id": "workspace_id",
    "block_id": "block_id",
    "status": "pending",
    "requested_duration_seconds": 900,
    "private_url": "https://uncertain.systems/tap/session/{token}"
  }
}
```

---

### `GET /api/v3/pow/workspaces/{workspace_id}/tap-links` — `tap:read`

List TAP links for a workspace. Guests see only their own links; non-admin members see their own; org admins see org workspace links.

**Response `200`:** `{ "tap_links": [ ... ] }`

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
    "scopes": ["workspaces:read", "tap:read", "tap:write"],
    "rate_limit": 120
  }
}
```

Store `api_key` securely — shown once. Re-calling for the same email issues another key (previous keys may remain active).

When the guest later signs up with the same email, they inherit org membership, TAP session history, and guest keys.

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

## TAP session behavior

- **Private link:** `/tap/session/{token}` — bearer URL; learner needs **no** Uncertain Systems login or API key.
- **Workspace UI:** `/workspace/{workspace_id}/tap` (authenticated web)
- **Live APIs:** `POST /api/workspace-tap-score/chat`, `POST /api/workspace-tap-score/complete` (use `privateToken` in body).

Facilitation style: Socratic — one concise question at a time, follow-ups from the learner's words, no lecturing unless asked.

**UI hotkeys:** `1`/`2`/`3` send thoughts; `Ctrl/Cmd+1/2/3` multi-select; `S` send selection; `Esc` skip to Thought Memory.

---

## Guest vs org-admin responsibilities

| Action | Org-admin / member key (`sk_`) | Guest key (`gsk_`) |
|--------|-------------------------------|---------------------|
| Create workspace | ❌ UI only (`/workspace/new`) | ❌ UI only |
| List blocks | ✅ | ✅ (org workspaces) |
| Proof-of-work schema / integration skill | ✅ | ✅ |
| Upload proof of work | ✅ | ✅ (own uploads) |
| Performance analysis | ✅ | ✅ (own proof of work + links) |
| Create TAP link | ✅; admin can assign to guest | ✅ (self only) |
| List TAP link status | ✅ | ✅ (own links) |
| Create guest + issue `gsk_` | ✅ `org:write` + `is_org_admin` | ❌ |

**Integration pattern:** Org admin provisions guests with `gsk_` keys. Workspaces are created in the product UI; guests use their keys for proof-of-work upload, block reads, and TAP links on accessible workspaces. TAP transcripts and thought traces land in proof-of-work — score with `POST .../lwm-snapshot` only.

---

## Quick integration checklist

1. Teams user creates org (`POST /api/organization`) and API key (`sk_` with default scopes).
2. Create a Verification Workspace in the product UI at `/workspace/new` (not via API).
3. `list_workspaces` / `GET .../blocks` → map blocks to your workflow steps.
4. *(Optional)* `POST .../proof-of-work-schema` — semantic: `definition`; opaque: `definition_ref` + `contract.event_verbs`; or `POST .../integration-skill` for a custom `skill.md`.
5. `POST .../proof-of-work` as learners produce tool usage, screenshots, video, or EEG (optional `block_id`).
6. `POST .../lwm-snapshot` (LWM Snapshot) for scorecards.
7. `POST .../tap-links` → send `private_url` to the learner.
8. Poll `GET .../tap-links` until the link `status === "completed"`.
9. `POST .../lwm-snapshot` to score TAP proof of work (verification only) together with other artifacts.
10. For external learners without accounts: `POST /org/guests` → give them `gsk_` + private TAP URL.