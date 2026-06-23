# OpenLesson Agentic API v2

Use this skill when an agent needs to create Performance Workspaces, issue private GHL Score links, and read completion results via the OpenLesson Agentic API.

**Human-readable spec:** `/docs/agentic-v2`  
**Base URL:** `https://openlesson.academy` (or your self-hosted origin)

---

## Scope

The Agentic API supports **only** this workflow:

1. Create a Performance Workspace from an `initial_prompt` and optional files.
2. List blocks in that workspace.
3. Create a private GHL link for a block (`15` or `30` minutes).
4. List GHL links and completion status.
5. Read completed GHL results (marker scores + gap analysis).

**Out of scope** — do not describe or call removed features: blockchain tracking, proof anchoring, tool-usage tracking, live tutoring session control, analytics, or plan adaptation.

**Teams tier required.** All `/api/v2/agent/*` routes require an active `pro_teams` subscription (platform admins bypass). Regular-tier keys are rejected with `403 teams_required`.

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

**Default scopes** for new member keys: `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`.

**Organization scopes** `org:read` and `org:write` may only be assigned to keys owned by an **organization admin** (`is_org_admin`). Non-admin Teams users cannot add `org:*` scopes to their keys.

**Guest keys** are always issued with: `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write` — no `org:*`.

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

Common codes: `unauthorized`, `forbidden`, `teams_required`, `validation_error`, `workspace_not_found`, `block_not_found`, `ghl_link_not_found`, `rate_limit_exceeded`.

---

## MCP (optional transport)

Grok and other MCP clients can call tools via JSON-RPC:

```http
POST /api/mcp/{url_encoded_api_key}
Content-Type: application/json
```

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

**Read tools:** `list_workspaces`, `list_blocks`, `list_ghl_links`, `get_ghl_results`

Prefer `Authorization: Bearer` on REST routes when the client supports it. Treat MCP URLs as secrets (they embed the raw key).

---

## Endpoints

### `POST /api/v2/agent/workspaces` — `workspaces:write`

Create a Performance Workspace. Guest keys with `workspaces:write` may call this; the workspace is owned by the organization and tagged with `guest_user_id`.

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

### `POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links` — `ghl:write`

Create a private GHL Score link for a block.

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
  "ghl_link": {
    "id": "uuid",
    "plan_id": "workspace_id",
    "plan_node_id": "block_id",
    "status": "pending",
    "requested_duration_seconds": 900,
    "private_url": "https://openlesson.academy/ghl-score/session/{token}"
  }
}
```

---

### `GET /api/v2/agent/workspaces/{workspace_id}/ghl-links` — `ghl:read`

List GHL links for a workspace. Guests see only their own links; non-admin members see their own; org admins see org workspace links.

**Response `200`:** `{ "ghl_links": [ ... ] }`

---

### `GET /api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results` — `ghl:read`

Poll for completion and scores.

**Pending:**

```json
{
  "ghl_result": {
    "id": "uuid",
    "status": "pending",
    "completed": false
  }
}
```

**Completed:**

```json
{
  "ghl_result": {
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
    "scopes": ["workspaces:read", "ghl:read", "ghl:write"],
    "rate_limit": 120
  }
}
```

Store `api_key` securely — shown once. Re-calling for the same email issues another key (previous keys may remain active).

When the guest later signs up with the same email, they inherit org membership, GHL history, and guest keys.

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

## GHL session behavior

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
| Create GHL link | ✅; admin can assign to guest | ✅ (self only) |
| List / read GHL results | ✅ | ✅ (own links) |
| Create guest + issue `gsk_` | ✅ `org:write` + `is_org_admin` | ❌ |

**Integration pattern:** Org admin provisions guests with `gsk_` keys. Each guest can create their own Performance Workspaces or use org-shared ones; they use their key for workspace creation, block reads, GHL links, and result polling.

---

## Quick integration checklist

1. Teams user creates org (`POST /api/organization`) and API key (`sk_` with default scopes).
2. `POST /workspaces` with task-specific `initial_prompt` (+ optional files).
3. `GET .../blocks` → map blocks to your workflow steps.
4. `POST .../ghl-links` → send `private_url` to the learner.
5. Poll `GET .../results` until `status === "completed"`.
6. For external learners without accounts: `POST /org/guests` → give them `gsk_` + private GHL URL.