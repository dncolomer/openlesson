# OpenLesson Proof-of-Work API

Use this skill when an agent needs to create Verification Workspaces, issue private Think Aloud Protocol (TAP) links, and run unified performance analysis via the OpenLesson Proof-of-Work API.

**Human-readable spec:** `/docs/proof-of-work-api`  
**Base URL:** `https://openlesson.academy` (or your self-hosted origin)

---

## Scope

The Proof-of-Work API supports **only** this workflow:

1. Create a Verification Workspace from an `initial_prompt` and optional files.
2. List blocks in that workspace.
3. *(Optional)* Generate an ideal proof-of-work input JSON schema (`POST .../proof-of-work-schema`) or a custom integration `skill.md` (`POST .../integration-skill`) from workspace context.
4. Upload performance proof of work (tool usage, screenshots, video, EEG) to xAI storage, linked to the workspace and/or a block.
5. Request learning and gap analysis over workspace proof of work (free-form Q&A or structured report).
6. Create a private TAP link for a block (`15` or `30` minutes).
7. List TAP links and completion status.
8. Poll TAP completion (`list_tap_links` / `GET .../tap-links`); score TAP proof of work via `POST .../performance`.

**Out of scope** — do not describe or call removed features: blockchain tracking, proof anchoring, live tutoring session control, heartbeats, or plan adaptation. Legacy web-session upload routes (`/api/session-files/*`) are separate from this API; agents should use `POST .../proof-of-work` for workspace-linked artifacts.

**Teams tier required.** All `/api/v2/agent/*` routes require an active `pro_teams` subscription (platform admins bypass). Individual-tier keys are rejected with `403 teams_required`.

---

## Authentication

Send API keys on every request:

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

| Key type | Prefix | Created via |
|----------|--------|-------------|
| Organization member (Teams admin) | `sk_` | Dashboard **Usage → API Access**, or `POST /api/v2/agent/keys` (browser session) |
| Organization guest | `gsk_` | `POST /api/v2/agent/org/guests` (org-admin key with `org:write`) |

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

Common codes: `unauthorized`, `forbidden`, `teams_required`, `validation_error`, `workspace_not_found`, `block_not_found`, `tap_link_not_found`, `rate_limit_exceeded`.

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

MCP resource: `resources/read openlesson://predictive-interruptions`

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

**Tools (full REST parity):** `list_workspaces`, `get_workspace`, `get_learning_progress`, `create_workspace`, `list_blocks`, `generate_proof_of_work_schema`, `generate_integration_skill`, `upload_proof_of_work`, `analyze_performance`, `list_tap_links`, `create_tap_link`

**Partner agents:** call `get_learning_progress` to orient, then `generate_integration_skill` for a workspace-specific `skill.md` — use that skill's checkpoint policy with `upload_proof_of_work` and `analyze_performance`. PumaDoc examples: `/customer-agent-openlesson-skill.md`, `/pumaclaw-mentor-openlesson-skill.md`.

Every MCP tool result includes `interruption` (TIM) with the same semantics as REST.

REST and MCP both use `Authorization: Bearer <api_key>` with Teams API keys from the dashboard. Treat API keys as secrets.

MCP resources: `openlesson://integration-scope`, `openlesson://proof-of-work-loop`, `openlesson://predictive-interruptions`

---

## Endpoints

### `POST /api/v2/agent/workspaces` — `workspaces:write`

Create a Verification Workspace. Guest keys with `workspaces:write` may call this; the workspace is owned by the organization and tagged with `guest_user_id`.

**Request:**

```json
{
  "initial_prompt": "Prepare the learner to explain vector databases for interview prep.",
  "files": [
    {
      "name": "brief.md",
      "mime_type": "text/markdown",
      "data": "<base64>"
    }
  ]
}
```

- `initial_prompt` (required, string)
- `files` (optional, max 5; PDF, text, markdown, JPEG, PNG, WebP; 10 MB each)

**Response `201`:**

```json
{
  "workspace": {
    "id": "uuid",
    "title": "Generated title",
    "root_topic": "...",
    "status": "active",
    "created_at": "..."
  },
  "blocks": [
    {
      "id": "uuid",
      "title": "Block title",
      "description": "...",
      "is_start": true,
      "status": "available"
    }
  ],
  "files": []
}
```

---

### `GET /api/v2/agent/workspaces/{workspace_id}/blocks` — `workspaces:read`

List assessable blocks. Organization members and guests may read **organization-owned** workspaces.

**Response `200`:** `{ "blocks": [ ... ] }`

---

### `POST /api/v2/agent/workspaces/{workspace_id}/proof-of-work-schema` — `workspaces:read`

Given workspace context (blocks, plan files on xAI, existing proof-of-work metadata) plus an evaluation definition from the caller, Grok returns a JSON Schema describing the **ideal tool proof-of-work payload** for optimal gap analysis.

Use this **before** uploading proof of work when you want a concrete contract for what to serialize from your agent.

**Request:**

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

### `POST /api/v2/agent/workspaces/{workspace_id}/integration-skill` — `workspaces:read`

Generate a workspace-specific `skill.md` integration guide (like `/pumadoc-proof-of-work-performance-skill.md`) for a custom partner agent. Grok uses workspace blocks, topic, and plan files to tailor endpoints, payload examples, and checklists.

**Request:**

```json
{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls and objection handling",
  "block_id": "optional-block-uuid",
  "base_url": "https://openlesson.academy",
  "include_sections": ["purpose", "auth", "endpoints", "proof_of_work_payload", "performance", "checklist"]
}
```

**Response `200`:**

```json
{
  "skill_md": "---\nname: acme-sales-copilot-openlesson-proof-of-work-performance\n...",
  "skill_name": "acme-sales-copilot-openlesson-proof-of-work-performance",
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

### `POST /api/v2/agent/workspaces/{workspace_id}/proof-of-work` — `workspaces:write`

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

**Response `201`:**

```json
{
  "proof_of_work": {
    "id": "uuid",
    "workspace_id": "uuid",
    "block_id": "uuid-or-null",
    "session_id": "uuid-or-null",
    "type": "tool",
    "file_name": "canvas-events.json",
    "mime_type": "application/json",
    "xai_file_id": "file_...",
    "timestamp_ms": 1710000000000,
    "metadata": {},
    "created_at": "..."
  }
}
```

---

### `POST /api/v2/agent/workspaces/{workspace_id}/performance` — `workspaces:read`

Analyze learning signals across workspace proof of work (including TAP thought traces and transcripts), linked ILE sessions, and uploaded files.

**Report mode** (omit `prompt` or send empty string) — returns structured gaps and suggestions:

```json
{
  "block_id": "optional-block-uuid"
}
```

**Chat mode** — free-form Q&A over the same proof-of-work bundle:

```json
{
  "prompt": "Which blocks show the weakest causal reasoning?",
  "block_id": "optional-block-uuid",
  "conversation_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "file_ids": []
}
```

- First call with empty `file_ids` builds a workspace performance context JSON, uploads it to xAI, and attaches up to 19 artifact files (proof of work, plan files, TAP artifacts).
- Pass returned `file_ids` on follow-up calls to reuse the same context without rebuilding.

**Response `200` (report):**

Every report includes `overall_score` (learning verification), `conversion_score` (estimated goal conversion %), `conversion_goal`, spider/radar `marker_scores`, and `gap_analysis.gaps`.

```json
{
  "mode": "report",
  "report": {
    "overall_score": 72,
    "conversion_score": 58,
    "conversion_goal": "Trial-to-paid subscription activation",
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
      "next_practice": ["..."]
    },
    "suggestions": ["..."],
    "confidence": "developing"
  },
  "proof_of_work_summary": {
    "blocks": 5,
    "tap_sessions": 2,
    "proof_of_work_artifacts": 4,
    "linked_sessions": 1,
    "workspace_files": 0
  },
  "file_ids": ["file_..."]
}
```

**Response `200` (chat):**

```json
{
  "mode": "chat",
  "response": "Markdown analysis...",
  "proof_of_work_summary": { },
  "file_ids": ["file_..."]
}
```

---

### `POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/tap-links` — `tap:write`

Create a private Think Aloud Protocol (TAP) link for a block.

**Request:**

```json
{
  "minutes": 15,
  "guest_user_id": "optional-uuid",
  "guest_email": "optional@example.com"
}
```

- `minutes`: `15` or `30` only (anything else → `15`)
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
    "private_url": "https://openlesson.academy/tap/session/{token}"
  }
}
```

---

### `GET /api/v2/agent/workspaces/{workspace_id}/tap-links` — `tap:read`

List TAP links for a workspace. Guests see only their own links; non-admin members see their own; org admins see org workspace links.

**Response `200`:** `{ "tap_links": [ ... ] }`

---

### `POST /api/v2/agent/org/guests` — `org:write`

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

Then create a member API key from the dashboard or `POST /api/v2/agent/keys` (session auth).

---

## TAP session behavior

- **Private link:** `/tap/session/{token}` — bearer URL; learner needs **no** OpenLesson login or API key.
- **Workspace UI:** `/workspace/{workspace_id}/tap` (authenticated web)
- **Live APIs:** `POST /api/workspace-tap-score/chat`, `POST /api/workspace-tap-score/complete` (use `privateToken` in body).

Facilitation style: Socratic — one concise question at a time, follow-ups from the learner's words, no lecturing unless asked.

**UI hotkeys:** `1`/`2`/`3` send thoughts; `Ctrl/Cmd+1/2/3` multi-select; `S` send selection; `Esc` skip to Thought Memory.

---

## Guest vs org-admin responsibilities

| Action | Org-admin / member key (`sk_`) | Guest key (`gsk_`) |
|--------|-------------------------------|---------------------|
| Create workspace | ✅ `workspaces:write` | ✅ `workspaces:write` |
| List blocks | ✅ | ✅ (org workspaces) |
| Proof-of-work schema / integration skill | ✅ | ✅ |
| Upload proof of work | ✅ | ✅ (own uploads) |
| Performance analysis | ✅ | ✅ (own proof of work + links) |
| Create TAP link | ✅; admin can assign to guest | ✅ (self only) |
| List TAP link status | ✅ | ✅ (own links) |
| Create guest + issue `gsk_` | ✅ `org:write` + `is_org_admin` | ❌ |

**Integration pattern:** Org admin provisions guests with `gsk_` keys. Each guest can create their own Verification Workspaces or use org-shared ones; they use their key for workspace creation, block reads, and TAP links. TAP transcripts and thought traces land in proof-of-work — score with `POST .../performance`.

---

## Quick integration checklist

1. Teams user creates org (`POST /api/organization`) and API key (`sk_` with default scopes).
2. `POST /workspaces` with task-specific `initial_prompt` (+ optional files).
3. `GET .../blocks` → map blocks to your workflow steps.
4. *(Optional)* `POST .../proof-of-work-schema` with your eval definition → get ideal tool JSON schema; `POST .../integration-skill` → get a custom `skill.md` for your agent.
5. `POST .../proof-of-work` as learners produce tool usage, screenshots, video, or EEG (optional `block_id`).
6. `POST .../performance` for gap reports, or include `prompt` for follow-up questions.
7. `POST .../tap-links` → send `private_url` to the learner.
8. Poll `GET .../tap-links` until the link `status === "completed"`.
9. `POST .../performance` to score TAP proof of work together with other artifacts.
10. For external learners without accounts: `POST /org/guests` → give them `gsk_` + private TAP URL.