# Uncertain Systems Proof-of-Work API

Capture base path: **`/api/v3/pow`**  
Snapshot base path: **`/api/v3/snapshot`**  
Stash base path: **`/api/v3/stash`** (TAP buffer; TAPBench timed sessions supported)

- **PoW (`/api/v3/pow`)** — list/get workspaces, proof-of-work upload, schema, integration skill, blocks, TAP links, API keys (browser session), org guests. **Workspace creation is UI-only** (`/workspace/new`); `POST /workspaces` is not available. Scores live on Snapshot (`lwm_snapshot`).
- **Snapshot (`/api/v3/snapshot`)** — vertical scores, learning world model, knowledge-config + trajectory, knowledge distance, snapshot-history, custom verification models.
- **Stash (`/api/v3/stash`)** — temporary PoW buffer, then **stash** (System 1) or **submit** (System 2) flush into regular PoW.

**MCP (`POST /api/mcp`)** exposes the same agent workspace ops with 100% tool ↔ REST parity (workspace create and key CRUD remain non-MCP: UI-only create; browser-session keys).

There is no `/api/v2/*` agent surface.

Public agent bodies use **snake_case**. Plan-gate failures return **`403` with `error.code = "api_plan_required"`** (Teams tier).

## Snapshot API (scores, world model, knowledge config)

Base path: `/api/v3/snapshot`

| Method | Path | Scope | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/workspaces/{id}/world-model` | `workspaces:read` | Durable merged **learning world model** for a workspace × subject (`?user_id=` / `guest_user_id=` unique IDs; omit to default to the authenticated caller UUID). |
| `GET` | `/workspaces/{id}/knowledge-config` | `workspaces:read` | Latest **knowledge configuration** embedding (`knowledgecfg-v1-d64`, D=64). Address subject with `user_id` / `guest_user_id`. |
| `GET` | `/workspaces/{id}/knowledge-config/trajectory` | `workspaces:read` | Time series of knowledge config snapshots + fixed 2D projection (`?from=&to=&max_points=&project=`). Subject via unique `user_id` / `guest_user_id`. |
| `GET` / `POST` | `/workspaces/{id}/knowledge-distance` | `workspaces:read` | **Knowledge distance** between a user (`user_id` / `guest_user_id`) and a custom knowledge region (`region_id`). Pure embedding geometry — **not** a vertical Eval and **not** written to `eval_run_history`. |
| `GET` | `/workspaces/{id}/snapshot-history` | `workspaces:read` | Append-only **eval run history** (full scorecards). Filter by unique `user_id` / `guest_user_id`, multi-user cohort `user_ids=a,b`, guests `guest_user_ids=`, `vertical=`, `from=`, `to=`, `limit=`. Non-admins are scoped to self; owners/org admins may list workspace or group cohorts. |
| `POST` | `/workspaces/{id}/lwm-snapshot` | `workspaces:read` | LWM Snapshot (sole strategy) + optional `learning_world_model` / `knowledge_config` after persistence. |

**Knowledge config contract:** all vectors share model id `knowledgecfg-v1-d64` (dimension 64). Vectors with different model ids are not comparable. Workspace scopes trajectories; the axes are global so expert regions and cross-user distance are well-defined.

**Subject addressing:** Snapshot APIs address learners with unique `user_id` and/or `guest_user_id` only. There is no `subject=me` / `subject=self` token — pass the caller's UUID explicitly, or omit IDs to default to the authenticated identity.

**Learning world model:** symbolic state (exploration, evidence appetite, scores). Co-evolves with knowledge config on each vertical score. Score responses may include `learning_world_model` and `knowledge_config` after a successful evaluation.

**Eval run history:** every successful vertical score appends an immutable row (`eval_run_history`) with the full report JSON, workspace, subject, vertical, and timestamp. Use this for retroactive inspection; LWM/knowledge config remain latest-state and geometry, not scorecard archives.

**Re-run gate:** re-running an **LWM Snapshot** for the same subject requires **new proof of work** since the last snapshot (`ran_at`). Single strategy only. Without new PoW, score endpoints return `409` with `code: no_new_pow`.

### LWM Snapshot response (plain language)

`POST .../lwm-snapshot` (MCP `lwm_snapshot`) returns one scorecard. Canonical field inventory + client labels live in `lib/pow-api/lwm-snapshot-interpretability.ts` (`listLwmSnapshotResponseFields`, `explainLwmSnapshotReport`).

| Field | Client-friendly name | What it means |
| :--- | :--- | :--- |
| `score` / `lwm_snapshot_score` | **Skill / readiness** (0–100) | How well the person demonstrated skill and explored the workspace. **Primary** score. |
| `ghc_score` + `ghc_confidence` | **Authenticity of work** (0–100) | How genuine the *process* looks (think-aloud / System 1 vs 2 patterns). **Secondary** — not skill. |
| `workspace_goal` | What success looks like | Goal the score is judged against. |
| `marker_scores[]` | Skill breakdown | Spider axes: `id`, `label`, `score`, `rationale`. |
| `summary`, `strengths`, `growth_areas` | Narrative | Human-readable analysis. |
| `gap_analysis` | Gaps + next steps | `gaps[]` plus `next_steps.directions` / `events`. |
| `suggestions`, `confidence` | Tips + evidence clarity | Action tips; evidence confidence band. |
| `temporal_summary` | Timing patterns | Optional pacing note. |
| `learning_world_model` / `knowledge_config` | Side payloads | Durable state / embedding after score — not letter grades. |

**Important:** Skill and authenticity answer different questions. A short session can score ~30 skill and ~70+ authenticity if traces look structured but shallow.

## Authentication

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`, `org:read`, `org:write`, and `*`.

## Evaluation Modes

Workspaces support two evaluation modes (stored on `workspaces.evaluation_mode`):

| Mode | How workspaces are created | Schema | Performance |
| :--- | :--- | :--- | :--- |
| `semantic` (default) | **UI only** (`/workspace/new`) | `definition` rubric text | LWM Snapshot (`lwm_snapshot` / score + GHC secondary) |
| `opaque` | **UI only** (`/workspace/new`) | `definition_ref` + `contract.event_verbs` | Structural protocol report (`protocol_report`, `privacy`; no semantic inference) |

**Opaque mode** is for privacy-preserving verification: partner-owned references (`goal_ref`, `definition_ref`, `external_refs`) are stored but never semantically interpreted. Upload metadata is allowlisted; tool payloads are plaintext-linted (file paths rejected unless `metadata.allow_plaintext=true`).

Canonical protocol `agent-trace-v3` phases: `enumerate` → `fingerprint` → `aggregate` → `emit` → `validate`.

## Endpoints (capture — base `/api/v3/pow`)

| Method | Path | Scope | MCP tool | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/workspaces` | `workspaces:read` | `list_workspaces` | List accessible workspaces (`?status=&limit=&offset=`). |
| `GET` | `/workspaces/{workspace_id}` | `workspaces:read` | `get_workspace` | Workspace metadata + `workspace_goal`. |
| `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` | `list_blocks` | List available blocks in the workspace. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work-schema` | `workspaces:read` | `generate_proof_of_work_schema` | Grok-generated JSON Schema for ideal tool proof of work input. |
| `POST` | `/workspaces/{workspace_id}/integration-skill` | `workspaces:read` | `generate_integration_skill` | Grok-generated workspace-specific `skill.md`. |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | `upload_proof_of_work` | Upload tool usage, screenshots, video, or EEG. |
| `POST` | `/workspaces/{workspace_id}/tap-links` | `tap:write` | `create_tap_link` | Request a private TAP link (optional body `block_id`). |
| `POST` | `/workspaces/{workspace_id}/blocks/{block_id}/tap-links` | `tap:write` | `create_tap_link` | Block-scoped TAP link. |
| `GET` | `/workspaces/{workspace_id}/tap-links` | `tap:read` | `list_tap_links` | List TAP links and completion status. |
| `POST` | `/org/guests` | `org:write` | — | Org admins create guest users (not an MCP tool). |
| `GET`/`POST`/`DELETE`/`PATCH` | `/keys…` | browser session | — | API key CRUD is browser-session only (not MCP). |

## Endpoints (snapshot — base `/api/v3/snapshot`)

| Method | Path | Scope | MCP tool | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/workspaces/{workspace_id}/lwm-snapshot` | `workspaces:read` | `lwm_snapshot` | LWM Snapshot score (0–100; sole strategy). Manual / explicit API (not auto on TAP/ILE end). |
| `GET` | `/workspaces/{workspace_id}/world-model` | `workspaces:read` | `get_world_model` | Durable learning world model for a subject. |
| `GET` | `/workspaces/{workspace_id}/knowledge-config` | `workspaces:read` | `get_knowledge_config` | Latest knowledge config embedding (`knowledgecfg-v1-d64`). |
| `GET` | `/workspaces/{workspace_id}/knowledge-config/trajectory` | `workspaces:read` | `get_knowledge_config_trajectory` | Knowledge config trajectory + optional 2D projection. |
| `GET` / `POST` | `/workspaces/{workspace_id}/knowledge-distance` | `workspaces:read` | `knowledge_distance` | Knowledge distance (user ↔ region). Body/query: `region_id`, `user_id` / `guest_user_id` (snake_case). Not a vertical Eval. |
| `GET` | `/workspaces/{workspace_id}/snapshot-history` | `workspaces:read` | `list_snapshot_history` | Prior vertical eval scorecards. |
| `GET` | `/workspaces/{workspace_id}/custom-knowledge-regions` | `workspaces:read` | `list_custom_knowledge_regions` | List custom knowledge regions + subjects with knowledge config. |
| `POST` | `/workspaces/{workspace_id}/custom-knowledge-regions` | `workspaces:write` | `create_custom_knowledge_region` / `eval_custom_knowledge_region` | Body `action`: `create` (default) or `eval` (`model_id` + subject). |

## Endpoints (stash / TAP — base `/api/v3/stash`)

| Method | Path | Scope | MCP tool | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/workspaces/{workspace_id}/proof-of-work` | `workspaces:write` | `buffer_proof_of_work` | Buffer a PoW unit (same payload as PoW upload) until stash/submit. With a TAPBench session token (`X-Tapbench-Session`), response includes exercise + remaining time. |
| `POST` | `/workspaces/{workspace_id}/stash` | `workspaces:write` | `stash_proof_of_work` | Flush buffer as System 1 (stash) into regular PoW. TAPBench sessions flag flushed PoW as tapbench pow; expired tokens are rejected. |
| `POST` | `/workspaces/{workspace_id}/submit` | `workspaces:write` | `submit_stashed_proof_of_work` | Flush buffer as System 2 (submit) into regular PoW. Same TAPBench rules as stash. |

### TAPBench

TAPBench keys and tasks are issued on `/tapbench`, not via TAP/ILE mint APIs. Agent APIs mint TAP (`create_tap_link`) and ILE sessions only. Existing timed session tokens still resolve at `GET /api/tapbench/{token}` / `/tapbench/{token}`; pass `session_token` as `X-Tapbench-Session` on Stash if you have one.

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
| `POST .../lwm-snapshot` | `lwm_snapshot` | `lwm_snapshot_score` / `score` | LWM Snapshot primary. Manual Knowledge UI or this Snapshot API/MCP tool. |

**Request body** (all three):

```json
{ "block_id": "optional-block-uuid", "style_prompt": "optional voice/tone" }
```

Score responses always include:
- `mode: "score"`, `vertical`
- `score` / named primary field `lwm_snapshot_score` — 0–100 LWM Snapshot (sole strategy); GHC is secondary on the same report
- `workspace_goal` (inferred or owner-set workspace goal)
- `marker_scores[]` (spider/radar competency axes: `id`, `label`, `score`, `rationale`)
- `summary` analysis, strengths, growth_areas
- `gap_analysis.gaps[]` with `severity` and `suggested_repair`
- `gap_analysis.next_steps` (`directions[]`, `events[]`)

**Opaque workspaces** also return `evaluation_mode`, `privacy`, `workspace_goal_source: "opaque_ref"`, and `protocol_report` (structural compliance: `protocol_compliance_score`, `phase_coverage`, `trace_integrity`, `structural_gaps`).

## Create Workspace (UI only)

**Workspace creation is not available via REST or MCP.** `POST /api/v3/pow/workspaces` and the MCP tool `create_workspace` are rejected with `403 forbidden` and a message that create is UI-only.

Create workspaces manually in the product UI at **`/workspace/new`** (blank, template, or files+goal modes). Semantic and opaque evaluation modes still apply to existing workspaces; integrators `list_workspaces` / `get_workspace` against IDs created in the UI. Scores: `lwm_snapshot`.

## Request TAP Link

```json
{
  "minutes": 15,
  "guest_user_id": "optional-guest-id",
  "guest_email": "optional-guest-email"
}
```

Session length: **1–120 minutes** (default **15**). Values outside the range are clamped.

The response includes a private URL for the TAP session UI. Think Aloud Protocol (TAP) captures live human cognition. The private URL is a bearer link: opening `/tap/session/{token}` authenticates that TAP session directly without requiring an Uncertain Systems login or an Proof-of-Work API key.

## Organizations And Guests

Users on the Teams tier can create an organization with `POST /api/organization` and become its admin. Organization admins can use `POST /api/v3/pow/org/guests` with an `org:write` API key to create guest users by email. Guest users receive individual API keys scoped to workspace reading, proof-of-work upload, and TAP link usage (`workspaces:read`, `workspaces:write`, `tap:read`, `tap:write`). Workspace **creation** remains UI-only.

Organization-owned workspaces are visible to all real users and guest users in that organization. When a guest signs up later with the same email, their real user account inherits the guest organization membership, TAP sessions, and guest API keys.

## TAP Evidence

Think Aloud Protocol sessions upload proof of work continuously during the session (`tap-thought-trace` system1/system2, `tap-helios-chat`, `tap-speech-segment`, `tap-idle-heartbeat`) and a final `tap-transcript` on complete. LWM Snapshot is **not** auto-run on TAP end — generate via Knowledge UI **Generate new snapshot** or `POST .../lwm-snapshot` (MCP `lwm_snapshot`). Integrators can poll `GET .../tap-links` for link `status`, then call the Snapshot API when ready.

**Reusable guest links:** TAP and ILE private URLs are multi-use. Reopening the same link starts another run while keeping `guest_user_id` stable (so embeddings / eval history stay on the same subject). Creating a new link with body `guest_user_id` reuses that guest when the caller owns the workspace or is an org admin for that guest.

## Removed From Proof-of-Work API

The Proof-of-Work API does not expose proof tracking, blockchain anchoring, live tutoring sessions, heartbeats, or plan adaptation. Use `POST .../proof-of-work` for workspace-linked artifacts instead of legacy web-session upload routes.