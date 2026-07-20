# Uncertain Systems Proof-of-Work API

Capture base path: **`/api/v3/pow`**  
Evaluation base path: **`/api/v3/eval`**

- **PoW (`/api/v3/pow`)** — workspace read, proof-of-work upload, proof-of-work schema, integration skill, blocks, TAP links, API keys, org guests. **Workspace creation is UI-only** (`/workspace/new`); `POST /workspaces` is not available.
- **Eval (`/api/v3/eval`)** — vertical scores (`verification-score`, `augmentation-score`, `optimization-score`), durable learning world model, knowledge-config latest + trajectory, and pure **Knowledge distance** geometry (user ↔ knowledge region; not a vertical Eval).

There is no `/api/v2/*` agent surface.

## Evaluation API (scores, world model, knowledge config)

Base path: `/api/v3/eval`

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/workspaces/{id}/world-model` | `workspaces:read` | Durable merged **learning world model** for a workspace × subject (`?user_id=` / `guest_user_id=` unique IDs; omit to default to the authenticated caller UUID). |
| `GET` | `/workspaces/{id}/knowledge-config` | `workspaces:read` | Latest **knowledge configuration** embedding (`knowledgecfg-v1-d64`, D=64). Address subject with `user_id` / `guest_user_id`. |
| `GET` | `/workspaces/{id}/knowledge-config/trajectory` | `workspaces:read` | Time series of knowledge config snapshots + fixed 2D projection (`?from=&to=&max_points=&project=`). Subject via unique `user_id` / `guest_user_id`. |
| `GET` / `POST` | `/workspaces/{id}/knowledge-distance` | `workspaces:read` | **Knowledge distance** between a user (`user_id` / `guest_user_id`) and a custom knowledge region (`region_id`). Pure embedding geometry — **not** a vertical Eval and **not** written to `eval_run_history`. |
| `GET` | `/workspaces/{id}/eval-history` | `workspaces:read` | Append-only **eval run history** (full scorecards). Filter by unique `user_id` / `guest_user_id`, multi-user cohort `user_ids=a,b`, guests `guest_user_ids=`, `vertical=`, `from=`, `to=`, `limit=`. Non-admins are scoped to self; owners/org admins may list workspace or group cohorts. |
| `POST` | `/workspaces/{id}/verification-score` | `workspaces:read` | Learning verification score + optional `learning_world_model` / `knowledge_config` after persistence. |
| `POST` | `/workspaces/{id}/augmentation-score` | `workspaces:read` | Learning augmentation / practice-readiness score. |
| `POST` | `/workspaces/{id}/optimization-score` | `workspaces:read` | Learning optimization score toward `workspace_goal`. |

**Knowledge config contract:** all vectors share model id `knowledgecfg-v1-d64` (dimension 64). Vectors with different model ids are not comparable. Workspace scopes trajectories; the axes are global so expert regions and cross-user distance are well-defined.

**Subject addressing:** Evaluation APIs address learners with unique `user_id` and/or `guest_user_id` only. There is no `subject=me` / `subject=self` token — pass the caller's UUID explicitly, or omit IDs to default to the authenticated identity.

**Learning world model:** symbolic state (exploration, evidence appetite, scores). Co-evolves with knowledge config on each vertical score. Score responses may include `learning_world_model` and `knowledge_config` after a successful evaluation.

**Eval run history:** every successful vertical score appends an immutable row (`eval_run_history`) with the full report JSON, workspace, subject, vertical, and timestamp. Use this for retroactive inspection; LWM/knowledge config remain latest-state and geometry, not scorecard archives.

**Re-run gate:** re-running the **same** vertical (`verification` / `augmentation` / `optimization`) for the same subject requires **new proof of work** since that vertical’s last eval (`ran_at`). Other verticals stay independent. Without new PoW, score endpoints return `409` with `code: no_new_pow`.

## Authentication

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`, `org:read`, `org:write`, and `*`.

## Evaluation Modes

Workspaces support two evaluation modes (stored on `workspaces.evaluation_mode`):

| Mode | How workspaces are created | Schema | Performance |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | **UI only** (`/workspace/new`) | `definition` rubric text | Vertical scores (`verification_score` / `augmentation_score` / `optimization_score` each with `marker_scores`, analysis, next actions) |
| `opaque` | **UI only** (`/workspace/new`) | `definition_ref` + `contract.event_verbs` | Structural protocol report (`protocol_report`, `privacy`; no semantic inference) |

**Opaque mode** is for privacy-preserving verification: partner-owned references (`goal_ref`, `definition_ref`, `external_refs`) are stored but never semantically interpreted. Upload metadata is allowlisted; tool payloads are plaintext-linted (file paths rejected unless `metadata.allow_plaintext=true`).

Canonical protocol `agent-trace-v3` phases: `enumerate` → `fingerprint` → `aggregate` → `emit` → `validate`.

## Endpoints (capture — base `/api/v3/pow`)

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | List available blocks in the workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work-schema` | `workspaces:read` | Grok-generated JSON Schema for ideal tool proof of work input given workspace context + eval definition. |
| `POST` | `/workspaces/{workspace_id}/integration-skill` | `workspaces:read` | Grok-generated workspace-specific `skill.md` integration guide for a partner agent. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | Upload tool usage, screenshots, video, or EEG to xAI and link to workspace/block. |
| `POST` | `/workspaces/{workspace_id}/tap-links` | `tap:write` | Request a private Think Aloud Protocol (TAP) link for the full workspace (optional body `block_id` scopes to a block). |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/tap-links` | `tap:write` | Request a private TAP link scoped to a single block. |
| `GET` | `/workspaces/{workspace_id}/tap-links` | `tap:read` | List existing TAP links and completion status. TAP evidence is uploaded to proof-of-work; score with `POST /api/v3/eval/.../verification-score`. |
| `POST` | `/org/guests` | `org:write` | Organization admins create guest users by email and issue guest API keys. |

## Endpoints (evaluation — base `/api/v3/eval`)

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/workspaces/{workspace_id}/verification-score` | `workspaces:read` | Learning verification score (0–100) + spider, analysis, next actions. TAP auto-results use this only. |
| `POST` | `/workspaces/{workspace_id}/augmentation-score` | `workspaces:read` | Learning augmentation / practice-readiness score (0–100). |
| `POST` | `/workspaces/{workspace_id}/optimization-score` | `workspaces:read` | Learning optimization score toward `workspace_goal` (0–100). |
| `GET` | `/workspaces/{workspace_id}/world-model` | `workspaces:read` | Durable learning world model for a subject. |
| `GET` | `/workspaces/{workspace_id}/knowledge-config` | `workspaces:read` | Latest knowledge config embedding (`knowledgecfg-v1-d64`). |
| `GET` | `/workspaces/{workspace_id}/knowledge-config/trajectory` | `workspaces:read` | Knowledge config trajectory + optional 2D projection. |
| `GET` / `POST` | `/workspaces/{workspace_id}/knowledge-distance` | `workspaces:read` | Knowledge distance (user ↔ region) in knowledgecfg space. Query/body: `region_id`, `user_id` and/or `guest_user_id` (unique IDs; omit to default to the authenticated caller). Returns `knowledge_distance`, `l2_distance`, `cosine_similarity`, `cosine_distance`, `in_region`. Not a score endpoint and does not archive history. |
| `GET` | `/workspaces/{workspace_id}/eval-history` | `workspaces:read` | Prior vertical eval scorecards; workspace / subject / multi-user (`user_ids`) filters. |

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

MCP resource: `uncertain-systems://predictive-interruptions`

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

## Vertical scores

Three dedicated score endpoints — one primary 0–100 score per call (not a multi-vertical unified card):

| Path | MCP tool | Primary field | Meaning |
| :--- | :--- | :--- | :--- |
| `POST .../verification-score` | `verification_score` | `verification_score` | Learning verification. **TAP auto-results use this only.** |
| `POST .../augmentation-score` | `augmentation_score` | `augmentation_score` | Practice / improvement readiness |
| `POST .../optimization-score` | `optimization_score` | `optimization_score` | Progress toward `workspace_goal` (0–100 score units) |

**Request body** (all three):

```json
{ "block_id": "optional-block-uuid", "style_prompt": "optional voice/tone" }
```

Score responses always include:
- `mode: "score"`, `vertical`
- `score` / named primary field (`verification_score` | `augmentation_score` | `optimization_score`) — one 0–100 score per vertical call
- `workspace_goal` (inferred or owner-set workspace goal)
- `marker_scores[]` (spider/radar competency axes: `id`, `label`, `score`, `rationale`)
- `summary` analysis, strengths, growth_areas
- `gap_analysis.gaps[]` with `severity` and `suggested_repair`
- `gap_analysis.next_steps` (`directions[]`, `events[]`)

**Opaque workspaces** also return `evaluation_mode`, `privacy`, `workspace_goal_source: "opaque_ref"`, and `protocol_report` (structural compliance: `protocol_compliance_score`, `phase_coverage`, `trace_integrity`, `structural_gaps`).

## Create Workspace (UI only)

**Workspace creation is not available via REST or MCP.** `POST /api/v3/pow/workspaces` and the MCP tool `create_workspace` are rejected with `403 forbidden` and a message that create is UI-only.

Create workspaces manually in the product UI at **`/workspace/new`** (blank, template, or files+goal modes). Semantic and opaque evaluation modes still apply to existing workspaces; integrators `list_workspaces` / `get_workspace` / `get_learning_progress` against IDs created in the UI.

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

Users on the Teams tier can create an organization with `POST /api/organization` and become its admin. Organization admins can use `POST /api/v3/pow/org/guests` with an `org:write` API key to create guest users by email. Guest users receive individual API keys scoped to workspace reading, proof-of-work upload, and TAP link usage (`workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`). Workspace **creation** remains UI-only.

Organization-owned workspaces are visible to all real users and guest users in that organization. When a guest signs up later with the same email, their real user account inherits the guest organization membership, TAP sessions, and guest API keys.

## TAP Evidence

Think Aloud Protocol sessions upload proof of work (`tap-thought-trace`, `tap-transcript`) to the workspace. Poll `GET .../tap-links` for link `status`, then call `POST .../verification-score` for verification scoring (TAP auto-results are always verification-only).

## Removed From Proof-of-Work API

The Proof-of-Work API does not expose proof tracking, blockchain anchoring, live tutoring sessions, heartbeats, or plan adaptation. Use `POST .../proof-of-work` for workspace-linked artifacts instead of legacy web-session upload routes.