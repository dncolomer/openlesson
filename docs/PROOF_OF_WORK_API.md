# Uncertain Systems Proof-of-Work API

Base path: `/api/v2/agent`

The Proof-of-Work API supports Verification Workspace creation, proof-of-work upload, unified performance analysis, block discovery, Think Aloud Protocol (TAP) link issuance and status polling, and ILE (Integrated Learning Environment) practice routing from gap findings.

## Authentication

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`, `org:read`, `org:write`, and `*`.

## Evaluation Modes

Workspaces support two evaluation modes (stored on `workspaces.evaluation_mode`):

| Mode | Create with | Schema | Performance |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | `initial_prompt` (+ optional `files`) | `definition` rubric text | Semantic gap analysis (`overall_score`, `marker_scores`, `gap_analysis`) |
| `opaque` | `evaluation_mode: "opaque"` + `protocol` | `definition_ref` + `contract.event_verbs` | Structural protocol report (`protocol_report`, `privacy`; no semantic inference) |

**Opaque mode** is for privacy-preserving verification: partner-owned references (`goal_ref`, `definition_ref`, `external_refs`) are stored but never semantically interpreted. Upload metadata is allowlisted; tool payloads are plaintext-linted (file paths rejected unless `metadata.allow_plaintext=true`).

Canonical protocol `agent-trace-v3` phases: `enumerate` → `fingerprint` → `aggregate` → `emit` → `validate`.

## Endpoints

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces` | `workspaces:write` | Create a Verification Workspace (semantic `initial_prompt` or opaque `protocol`). |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in the workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work-schema` | `workspaces:read` | Grok-generated JSON Schema for ideal tool proof of work input given workspace context + eval definition. |
| `POST` | `/workspaces/{workspace_id}/integration-skill` | `workspaces:read` | Grok-generated workspace-specific `skill.md` integration guide for a partner agent. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG to xAI and link to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/performance` | `workspaces:read` | Structured gap report or free-form Q&A over workspace proof of work. |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/tap-links` | `tap:write` | Request a private Think Aloud Protocol (TAP) link for a block. |
| `GET` | `/workspaces/{workspace_id}/tap-links` | `tap:read` | List existing TAP links and completion status. TAP evidence is uploaded to proof-of-work; use `POST .../performance` to score. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

## Predictive Interruptions (TIM)

Every Proof-of-Work API success response (REST and MCP) includes a top-level `interruption` field powered by the **Trace Interruption Model (TIM)**.

- **`interruption: null`** — no intervention predicted for this moment.
- **`interruption: { ... }`** — consumer systems should schedule `intervention` after `delay_ms` unless a later Proof-of-Work API response supersedes it.

```json
{
  "interruption": {
    "interruption_id": "int_upload_proof_of_work_ws1_a1b2c3d4",
    "delay_ms": 75000,
    "intervention": {
      "type": "reflection_prompt",
      "message": "Briefly note why you chose that action before continuing the workflow.",
      "rationale": "Tool trace benefits from explicit rationale.",
      "consumer_action": "present_reflection_prompt",
      "block_id": "optional-block-uuid"
    },
    "confidence": "medium",
    "predicted_at": "2026-07-10T12:00:00.000Z"
  }
}
```

**Consumer obligations:**

1. Read `interruption` on every response.
2. When non-null, schedule the intervention after `delay_ms`.
3. When a new response arrives before the timer fires, cancel the pending timer and apply the newest `interruption` (or clear if null).
4. Never stack duplicate timers for the same workspace session.

`POST .../proof-of-work-schema` responses also include `interruption_contract` (machine-readable TIM spec) and may include LLM-authored `predicted_interruption` in the generated spec. Proof-of-work spec version is **1.3**.

Intervention types: `reflection_prompt`, `checkpoint_probe`, `coaching_nudge`, `proof_of_work_reminder`, `performance_review`.

MCP resource: `openlesson://predictive-interruptions`

## Proof-of-Work Input Schema

Use before uploading proof of work when you want a concrete JSON contract for what your agent should serialize.

**Semantic workspace:**

```json
{
  "definition": "Evaluate whether the learner can articulate a crisp ICP with segment rationale",
  "block_id": "optional-block-uuid",
  "integration_hints": {
    "tool_name": "pumadoc",
    "partner_agent": "PumaDoc Customer Agent",
    "event_verbs": ["run_simulation", "edit_field"],
    "goals": ["simulation_completed"]
  }
}
```

**Opaque workspace:**

```json
{
  "evaluation_mode": "opaque",
  "definition_ref": "trace-audit-v3",
  "contract": {
    "event_verbs": ["enumerate", "fingerprint", "aggregate", "emit", "validate"],
    "goal_tokens": ["goal_ref:abc123"],
    "required_event_fields": ["verb", "timestamp_ms"],
    "token_fields": ["path", "fingerprint", "artifact_ref", "aggregate_fp"]
  },
  "block_id": "optional-block-uuid"
}
```

Response includes `schema` (JSON Schema), `schema_name`, `rationale`, `example_payload`, `recommended_mime_type`, `recommended_proof_of_work_type`, `collection_guidance`, and `file_ids`. Opaque responses also include `evaluation_mode`, `definition_ref`, and `privacy`.

## Integration Skill

Generate a custom `skill.md` via `POST .../integration-skill` tailored to a workspace:

```json
{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls",
  "base_url": "https://uncertain.systems",
  "include_sections": ["purpose", "auth", "endpoints", "proof_of_work_payload", "performance", "checklist"]
}
```

Response includes `skill_md`, `skill_name`, `suggested_share_path`, and `workspace_summary`.

## Upload Proof of Work

```json
{
  "type": "tool",
  "file_name": "events.json",
  "mime_type": "application/json",
  "data": "base64-encoded-bytes",
  "block_id": "optional-block-uuid",
  "session_id": "optional-session-uuid",
  "metadata": {},
  "tool_name": "canvas",
  "tool_action": "draw"
}
```

Types: `tool`, `screen` (`screenshot` alias), `video`, `eeg`. Max 10 MB per file.

**Opaque workspaces:** `metadata` is filtered to an allowlist (`trace_token`, `goal_ref`, `anon`, `event_count`, `schema_version`, `protocol_id`, `phase_id`, `allow_plaintext`). Tool uploads are plaintext-linted; responses may include `evaluation_mode`, `privacy`, and `plaintext_lint`.

## Performance Analysis

**Structured report** (no `prompt`):

```json
{ "block_id": "optional-block-uuid" }
```

**Free-form Q&A**:

```json
{
  "prompt": "Where are the biggest readiness gaps?",
  "block_id": "optional-block-uuid",
  "conversation_history": [],
  "file_ids": []
}
```

Report responses always include:
- `overall_score` (0–100 integer readiness score)
- `marker_scores[]` (spider/radar competency axes: `id`, `label`, `score`, `rationale`)
- `gap_analysis.gaps[]` with `severity` and `suggested_repair`

**Opaque workspaces** also return `evaluation_mode`, `privacy`, `conversion_goal_source: "opaque_ref"`, and `protocol_report` (structural compliance: `protocol_compliance_score`, `phase_coverage`, `trace_integrity`, `structural_gaps`).

Chat responses return markdown in `response`.

## Create Workspace

**Semantic (default):**

```json
{
  "initial_prompt": "Prepare me to explain vector databases in a technical interview.",
  "files": [
    {
      "name": "notes.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-file"
    }
  ]
}
```

**Opaque:**

```json
{
  "evaluation_mode": "opaque",
  "protocol": {
    "protocol_id": "agent-trace-v3",
    "goal_ref": "goal_ref:partner-token-abc",
    "goal_tokens": ["goal_ref:partner-token-abc"]
  },
  "external_refs": {
    "partner_run_id": "opaque-partner-ref-001"
  }
}
```

- Semantic: `initial_prompt` required; Grok generates title, blocks, and conversion goal.
- Opaque: `protocol.protocol_id` and `protocol.goal_ref` required; blocks are generated from protocol phases (canonical `agent-trace-v3` if phases omitted). `initial_prompt` is not stored.
- `files` optional in both modes (max 5; PDF, text, Markdown, JPEG, PNG, WebP; 10 MB each).
- Create response includes `evaluation_mode` and `privacy` metadata.

## Request TAP Link

```json
{
  "minutes": 15,
  "guest_user_id": "optional-guest-id",
  "guest_email": "optional-guest-email"
}
```

Only `15` and `30` minute sessions are supported. Any other value defaults to `15`.

The response includes a private URL for the TAP session UI. Think Aloud Protocol (TAP) captures live human cognition. The private URL is a bearer link: opening `/tap/session/{token}` authenticates that TAP session directly without requiring an Uncertain Systems login or an Proof-of-Work API key.

## Organizations And Guests

Users on the Teams tier can create an organization with `POST /api/organization` and become its admin. Organization admins can use `POST /api/v2/agent/org/guests` with an `org:write` API key to create guest users by email. Guest users receive individual API keys scoped to workspace creation, workspace reading, and TAP link usage (`workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`).

Organization-owned workspaces are visible to all real users and guest users in that organization. When a guest signs up later with the same email, their real user account inherits the guest organization membership, TAP sessions, and guest API keys.

## TAP Evidence

Think Aloud Protocol sessions upload proof of work (`tap-thought-trace`, `tap-transcript`) to the workspace. Poll `GET .../tap-links` for link `status`, then call `POST .../performance` for unified scoring alongside other artifacts.

## Removed From Proof-of-Work API

The Proof-of-Work API does not expose proof tracking, blockchain anchoring, live tutoring sessions, heartbeats, or plan adaptation. Use `POST .../proof-of-work` for workspace-linked artifacts instead of legacy web-session upload routes.