# OpenLesson Evidence API

Use this skill when an agent needs to create Verification Workspaces, issue private Think Aloud Protocol (TAP) links, and read completion results via the OpenLesson Evidence API.

**Human-readable spec:** `/docs/agentic-v2`  
**Base URL:** `https://openlesson.academy` (or your self-hosted origin)

---

## Scope

The Evidence API supports **only** this workflow:

1. Create a Verification Workspace from an `initial_prompt` and optional files.
2. List blocks in that workspace.
3. *(Optional)* Generate an ideal evidence input JSON schema (`POST .../evidence-schema`) or a custom integration `skill.md` (`POST .../integration-skill`) from workspace context.
4. Upload performance evidence (tool usage, screenshots, video, EEG) to xAI storage, linked to the workspace and/or a block.
5. Request learning and gap analysis over workspace evidence (free-form Q&A or structured report).
6. Create a private TAP link for a block (`15` or `30` minutes).
7. List TAP links and completion status.
8. Read completed TAP results (marker scores + gap analysis).

**Out of scope** — do not describe or call removed features: blockchain tracking, proof anchoring, live tutoring session control, heartbeats, or plan adaptation. Legacy web-session upload routes (`/api/session-files/*`) are separate from this API; agents should use `POST .../evidence` for workspace-linked artifacts.

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

## MCP (full Evidence API transport)

MCP clients (Cursor, Claude Desktop, Grok, custom agents) can call **the same capabilities as REST** via JSON-RPC:

```http
POST /api/mcp
Authorization: Bearer <api_key>
Content-Type: application/json
```

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

**Client config example:**

```json
{
  "mcpServers": {
    "openlesson": {
      "url": "https://openlesson.academy/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**Tools (parity with Evidence API REST):**

| Tool | Scope | REST equivalent |
|------|-------|-----------------|
| `list_workspaces` | `workspaces:read` | — |
| `get_learning_progress` | `workspaces:read` | Progress snapshot + `recommended_next_actions` |
| `get_workspace` | `workspaces:read` | `GET .../workspaces/{id}` |
| `create_workspace` | `workspaces:write` | `POST .../workspaces` |
| `list_blocks` | `workspaces:read` | `GET .../workspaces/{id}/blocks` |
| `generate_evidence_schema` | `workspaces:read` | `POST .../evidence-schema` |
| `generate_integration_skill` | `workspaces:read` | `POST .../integration-skill` |
| `upload_evidence` | `workspaces:write` | `POST .../evidence` |
| `analyze_performance` | `workspaces:read` | `POST .../performance` |
| `list_tap_links` | `tap:read` | `GET .../tap-links` |
| `get_tap_results` | `tap:read` | `GET .../tap-links/{id}/results` |
| `create_tap_link` | `tap:write` | `POST .../blocks/{blockId}/tap-links` |

**Recommended MCP loop:** `get_learning_progress` → `generate_evidence_schema` → `upload_evidence` (repeat) → `analyze_performance` → regenerate schema/skill as evidence grows.

**Schema responses include dual discoverability:** every `generate_evidence_schema` / `POST .../evidence-schema` returns `continuous_evaluation` (REST paths), `continuous_evaluation_mcp` (tool names), `integration_surfaces`, `openlesson_scope`, and `recommended_next_actions`.

**MCP resources:** `resources/read` → `openlesson://integration-scope`, `openlesson://evidence-loop`.

`analyze_performance`: omit `prompt` for structured scorecard JSON; include `prompt` for chat Q&A. Optional `style_prompt` controls voice/tone.

**Authentication:** Teams API keys (`Authorization: Bearer <api_key>`) still work. OAuth 2.1 is also supported for MCP clients that require it (e.g. Grok):

- Protected resource metadata: `GET /.well-known/oauth-protected-resource/api/mcp`
- Authorization server metadata: `GET /.well-known/oauth-authorization-server`
- Dynamic client registration: `POST /api/oauth/register`
- Authorization: `GET /api/oauth/authorize` (PKCE + `resource=https://openlesson.academy/api/mcp`)
- Token exchange: `POST /api/oauth/token`

Unauthenticated MCP requests return `401` with a `WWW-Authenticate` header pointing at the protected-resource metadata document.

Treat API keys and OAuth tokens as secrets.

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

### `POST /api/v2/agent/workspaces/{workspace_id}/evidence-schema` — `workspaces:read`

Given workspace context (blocks, plan files on xAI, existing evidence metadata) plus an evaluation definition from the caller, Grok returns a JSON Schema describing the **ideal tool evidence payload** for optimal gap analysis.

Use this **before** uploading evidence when you want a concrete contract for what to serialize from your agent.

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
  "recommended_evidence_type": "tool",
  "required_fields": ["events"],
  "optional_fields": ["learner_reflection"],
  "collection_guidance": "Upload after each simulation run or when the learner publishes an artifact.",
  "workspace_id": "uuid",
  "block_id": null,
  "definition": "...",
  "workspace_summary": { "id": "uuid", "title": "...", "root_topic": "..." },
  "context_counts": { "blocks": 5, "plan_files": 2, "evidence_artifacts": 0 },
  "file_ids": ["file_..."]
}
```

---

### `POST /api/v2/agent/workspaces/{workspace_id}/integration-skill` — `workspaces:read`

Generate a workspace-specific `skill.md` integration guide (like `/pumadoc-evidence-performance-skill.md`) for a custom partner agent. Grok uses workspace blocks, topic, and plan files to tailor endpoints, payload examples, and checklists.

**Request:**

```json
{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls and objection handling",
  "block_id": "optional-block-uuid",
  "base_url": "https://openlesson.academy",
  "include_sections": ["purpose", "auth", "endpoints", "evidence_payload", "performance", "checklist"]
}
```

**Response `200`:**

```json
{
  "skill_md": "---\nname: acme-sales-copilot-openlesson-evidence-performance\n...",
  "skill_name": "acme-sales-copilot-openlesson-evidence-performance",
  "suggested_share_path": "/acme-sales-copilot-skill.md",
  "workspace_summary": {
    "id": "uuid",
    "title": "Discovery mastery",
    "root_topic": "B2B sales discovery",
    "block_count": 5
  },
  "context_counts": { "blocks": 5, "plan_files": 1 },
  "file_ids": ["file_..."]
}
```

Host the returned markdown at your suggested path or inject `skill_md` directly into your agent's skill system.

---

### `POST /api/v2/agent/workspaces/{workspace_id}/evidence` — `workspaces:write`

Upload open-format performance evidence to xAI Files and link it to a workspace, optionally scoped to a block or session.

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

Max **10 MB** per upload. Guest keys attach evidence to their guest identity; org members attach to the workspace org.

**Response `201`:**

```json
{
  "evidence": {
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

Analyze learning signals across workspace evidence, TAP results, linked sessions, and uploaded files.

**Report mode** (omit `prompt` or send empty string) — returns structured gaps and suggestions:

```json
{
  "block_id": "optional-block-uuid"
}
```

**Chat mode** — free-form Q&A over the same evidence bundle:

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

- First call with empty `file_ids` builds a workspace performance context JSON, uploads it to xAI, and attaches up to 19 artifact files (evidence, plan files, TAP artifacts).
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
          "evidence": "...",
          "severity": "medium",
          "suggested_repair": "..."
        }
      ],
      "next_practice": ["..."]
    },
    "suggestions": ["..."],
    "confidence": "developing"
  },
  "evidence_summary": {
    "blocks": 5,
    "tap_sessions": 2,
    "evidence_artifacts": 4,
    "linked_sessions": 1,
    "plan_files": 0
  },
  "file_ids": ["file_..."]
}
```

**Response `200` (chat):**

```json
{
  "mode": "chat",
  "response": "Markdown analysis...",
  "evidence_summary": { },
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
    "plan_id": "workspace_id",
    "plan_node_id": "block_id",
    "status": "pending",
    "requested_duration_seconds": 900,
    "private_url": "https://openlesson.academy/ghl-score/session/{token}"
  }
}
```

Legacy alias: `POST .../ghl-links` (same behavior).

---

### `GET /api/v2/agent/workspaces/{workspace_id}/tap-links` — `tap:read`

List TAP links for a workspace. Guests see only their own links; non-admin members see their own; org admins see org workspace links.

**Response `200`:** `{ "tap_links": [ ... ] }`

Legacy alias: `GET .../ghl-links`.

---

### `GET /api/v2/agent/workspaces/{workspace_id}/tap-links/{link_id}/results` — `tap:read`

Poll for completion and scores.

**Pending:**

```json
{
  "tap_result": {
    "id": "uuid",
    "status": "pending",
    "completed": false
  }
}
```

**Completed:**

```json
{
  "tap_result": {
    "id": "uuid",
    "workspace_id": "uuid",
    "block_id": "uuid",
    "status": "completed",
    "completed": true,
    "overall_score": 82,
    "marker_scores": [
      {
        "id": "conceptual_clarity",
        "label": "Conceptual Clarity",
        "score": 85,
        "rationale": "..."
      }
    ],
    "gap_analysis": {
      "summary": "...",
      "gaps": [
        {
          "title": "...",
          "evidence": "...",
          "severity": "medium",
          "suggested_repair": "..."
        }
      ],
      "next_practice": ["..."]
    },
    "analysis": { }
  }
}
```

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

- **Private link:** `/ghl-score/session/{token}` — bearer URL; learner needs **no** OpenLesson login or API key.
- **Workspace UI:** `/workspace/{workspace_id}/ghl-score` (authenticated web)
- **Live APIs:** `POST /api/workspace-ghl-score/chat`, `POST /api/workspace-ghl-score/complete` (use `privateToken` in body)

Facilitation style: Socratic — one concise question at a time, follow-ups from the learner's words, no lecturing unless asked.

**UI hotkeys:** `1`/`2`/`3` send thoughts; `Ctrl/Cmd+1/2/3` multi-select; `S` send selection; `Esc` skip to Thought Memory.

---

## Guest vs org-admin responsibilities

| Action | Org-admin / member key (`sk_`) | Guest key (`gsk_`) |
|--------|-------------------------------|---------------------|
| Create workspace | ✅ `workspaces:write` | ✅ `workspaces:write` |
| List blocks | ✅ | ✅ (org workspaces) |
| Evidence schema / integration skill | ✅ | ✅ |
| Upload evidence | ✅ | ✅ (own uploads) |
| Performance analysis | ✅ | ✅ (own evidence + links) |
| Create TAP link | ✅; admin can assign to guest | ✅ (self only) |
| List / read TAP results | ✅ | ✅ (own links) |
| Create guest + issue `gsk_` | ✅ `org:write` + `is_org_admin` | ❌ |

**Integration pattern:** Org admin provisions guests with `gsk_` keys. Each guest can create their own Verification Workspaces or use org-shared ones; they use their key for workspace creation, block reads, TAP links, and result polling.

---

## Quick integration checklist

1. Teams user creates org (`POST /api/organization`) and API key (`sk_` with default scopes).
2. `POST /workspaces` with task-specific `initial_prompt` (+ optional files).
3. `GET .../blocks` → map blocks to your workflow steps.
4. *(Optional)* `POST .../evidence-schema` with your eval definition → get ideal tool JSON schema; `POST .../integration-skill` → get a custom `skill.md` for your agent.
5. `POST .../evidence` as learners produce tool usage, screenshots, video, or EEG (optional `block_id`).
6. `POST .../performance` for gap reports, or include `prompt` for follow-up questions.
7. `POST .../tap-links` → send `private_url` to the learner.
8. Poll `GET .../results` until `status === "completed"`.
9. Re-run `POST .../performance` to synthesize TAP results with other evidence.
10. For external learners without accounts: `POST /org/guests` → give them `gsk_` + private TAP URL.