---
name: pumadoc-customer-agent-openlesson-evidence-performance
description: "[Superseded] Use /customer-agent-openlesson-skill.md — background verification with validation-step learning next actions."
---

# PumaDoc Customer Agent — OpenLesson Evidence & Performance

> **Superseded** by [`/customer-agent-openlesson-skill.md`](/customer-agent-openlesson-skill.md) (concise Customer Agent flow) and [`/pumaclaw-mentor-openlesson-skill.md`](/pumaclaw-mentor-openlesson-skill.md) (PumaClaw Mentor mode). This document remains as a detailed REST reference.

This skill teaches the PumaDoc Customer Agent how to verify customer-development learning by **serializing what the user did**, **uploading evidence** through OpenLesson's Evidence API, and **requesting performance analysis** that returns structured gap reports or follow-up Q&A.

**Canonical API reference:** `/skill.md` (`https://openlesson.academy/skill.md`) and `/docs/agentic-v2`. When this document and the live API differ, follow `skill.md`.

**Share URL for this integration:** `/pumadoc-evidence-performance-skill.md`

---

## Purpose

PumaDoc verifies that users understand customer-development work — not only that artifacts look finished. OpenLesson scores **genuine cognition** from serialized tool usage and optional media, then returns a **structured gap report** or **follow-up Q&A** grounded in that evidence.

```text
PumaDoc decides when → serialize & upload evidence → (optionally) request performance → update Knowledge / gate progress
```

**Minimum viable path:** a single `type: "tool"` upload is enough for performance scores to compute. Screenshots, screen recording (with voice), and EEG are **optional enrichments** — not prerequisites.

OpenLesson is **checkpoint-agnostic**. It does not mandate per-step cadence, fixed rubrics, or PumaDoc step boundaries. **PumaDoc alone decides** when to submit evidence and when to call performance — after a simulation, mid-step, at journey end, on mentor request, or never until enough signal accumulates.

---

## Design principles

### Checkpoint-agnostic — PumaDoc controls timing

OpenLesson exposes storage and analysis primitives; **PumaDoc owns the checkpoint policy**. Examples of valid PumaDoc strategies (all supported):

| Strategy | When to upload | When to score |
|----------|----------------|---------------|
| Per Customer Agent step | After each step completes | Immediately after that upload (`block_id` scoped) |
| Simulation gate | Only when user runs or finishes a simulation | Right after simulation evidence |
| Batch / journey | Incremental uploads during work | Once before unlocking a major milestone |
| Workspace rollup | Ongoing tool traces without `block_id` | End of week with **workspace-global** performance (no `block_id`) |
| On demand | User asks “how am I doing?” | Chat-mode performance anytime |

There is no required 1:1 mapping between PumaDoc steps and OpenLesson API calls. Upload zero, one, or many evidence rows between performance requests; re-run performance as often as needed.

### Block-scoped vs workspace-global analysis

Both evidence upload and performance accept an optional `block_id`.

| Scope | Evidence `block_id` | Performance body | Analyzes |
|-------|---------------------|------------------|----------|
| **Block-level** | Set to block UUID | `{ "block_id": "uuid" }` | Evidence, blocks, and context for **one** assessable block |
| **Workspace-global** | Omit or mix scoped + unscoped rows | `{}` or omit `block_id` | **All** evidence and blocks in the workspace |

Use **block-level** performance when PumaDoc wants a focused score on the current Customer Agent step (or a mapped block). Use **workspace-global** performance for journey retrospectives, CEO dashboards, or “overall founder readiness” summaries across multiple steps.

`file_ids` from a prior report can be reused in chat mode at either scope; use the same `block_id` (or omit it) as the report you are extending.

### Open evidence, not a fixed schema

PumaDoc does **not** need to declare learning goals, rubrics, or step semantics upfront in OpenLesson. Serialize an honest trace of what happened in PumaDoc (and any supporting tools). OpenLesson **infers** step intent, artifact quality, and cognition gaps from:

- workspace `initial_prompt` and uploaded context files
- block titles from `GET /blocks`
- the tool-usage payload (events, summaries, goals achieved)
- optional media attached to the same `block_id`

Use `metadata` on the evidence row for PumaDoc correlation (`pumadoc_step_id`, `artifact_id`, etc.). The JSON **inside** `data` is intentionally open.

### Tool usage is the core signal

`type: "tool"` accepts `application/json`, `text/plain`, or `text/markdown` (max **10 MB**). This is the primary integration surface: a time-ordered event log, outcome summaries, and **goals achieved** — including high-level accomplishments OpenLesson can interpret without PumaDoc pre-registering them.

Examples of goals PumaDoc can serialize (no upfront OpenLesson configuration required):

- `"goal": "simulation_completed"` with `simulation_id`, `inputs`, `outcomes`, `learner_notes`
- `"goal": "artifact_published"` with `artifact_type`, `version`, `summary`
- `"goal": "validation_interview_scheduled"` with `hypothesis`, `script_outline`
- `"goal": "segment_reprioritized"` with `before`, `after`, `rationale`

OpenLesson maps these to block learning markers during `POST .../performance`.

### Optional evidence formats

| API `type` | Role | Required? |
|------------|------|-----------|
| `tool` | Open tool-usage / event serialization | **Yes** — sufficient alone for scoring |
| `screen` | Screenshot of artifact UI (alias: `screenshot`) | Optional |
| `video` | Screen recording; may include learner voice-over | Optional |
| `eeg` | Muse or compatible EEG chunk (`application/json`) | Optional |

Voice is not a separate evidence type. Capture speech via **screen recording** (`video`) or reflect spoken reasoning inside the **tool JSON** (e.g. `learner_reflection`, transcribed notes). Do not block step progression waiting for optional media.

---

## Authentication

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

Base path: `/api/v2/agent`

| Key | Prefix | PumaDoc use |
|-----|--------|-------------|
| Org admin / member | `sk_` | Provision guests, create workspaces, upload evidence, run analysis |
| Guest learner | `gsk_` | Create own workspace, upload own evidence, run analysis on own uploads |

**Teams tier required.** Rate limit: 120 req/min per key.

**Scopes used by this skill:** `workspaces:read`, `workspaces:write` (plus `org:write` when provisioning guests).

---

## Endpoints used

| Step | Method | Path | Scope |
|------|--------|------|-------|
| Create guest (optional) | `POST` | `/org/guests` | `org:write` |
| Create workspace | `POST` | `/workspaces` | `workspaces:write` |
| List blocks | `GET` | `/workspaces/{workspace_id}/blocks` | `workspaces:read` |
| Upload evidence | `POST` | `/workspaces/{workspace_id}/evidence` | `workspaces:write` |
| Performance report | `POST` | `/workspaces/{workspace_id}/performance` | `workspaces:read` |
| Performance Q&A | `POST` | `/workspaces/{workspace_id}/performance` | `workspaces:read` |

---

## PumaDoc ↔ OpenLesson state

Store integration state in PumaDoc session (extend as needed):

```json
{
  "openlesson": {
    "workspace_id": "uuid",
    "step_blocks": {
      "customer.icp.define": "block-uuid",
      "customer.segment.prioritize": "block-uuid"
    },
    "performance_file_ids_by_scope": {
      "block:customer.icp.define": ["file_..."],
      "workspace": ["file_..."]
    },
    "last_performance_at": "2026-06-25T12:00:00Z"
  }
}
```

**`step_blocks` is optional convenience** — a lookup table from PumaDoc step IDs to OpenLesson block UUIDs when you want block-scoped evidence or scores. If PumaDoc prefers workspace-global checkpoints only, skip the map and omit `block_id` on uploads and performance calls.

When using block scope, set `block_id` on evidence and performance; keep `pumadoc_step_id` in `metadata` for traceability. OpenLesson infers learning intent from workspace context — PumaDoc does not register checkpoints with OpenLesson in advance.

---

## Integration workflow

### 0. Bootstrap (once per customer journey)

**Org admin** provisions a guest if the learner has no OpenLesson account:

```http
POST /api/v2/agent/org/guests
```

```json
{ "email": "founder@startup.example" }
```

Store `api_key` (`gsk_...`) securely — shown once.

**Create Verification Workspace** from the Customer Agent journey prompt (OpenLesson generates blocks; no per-step goal manifest required):

```http
POST /api/v2/agent/workspaces
```

```json
{
  "initial_prompt": "Customer development journey: ICP definition, segment prioritization, persona creation, objection capture, and validation interview prep for [product context from PumaDoc].",
  "files": [
    {
      "name": "pumadoc-context.md",
      "mime_type": "text/markdown",
      "data": "<base64 of exported PumaDoc step summary>"
    }
  ]
}
```

**List blocks** and map each Customer Agent step ID to a block UUID:

```http
GET /api/v2/agent/workspaces/{workspace_id}/blocks
```

Optionally tell the user which OpenLesson block relates to the current PumaDoc step (block `title`, not UUID) when using block-scoped analysis.

---

### 1. Serialize and upload evidence (when PumaDoc chooses)

Upload whenever PumaDoc defines a checkpoint — not on a fixed OpenLesson schedule. Each upload is independent; batch multiple events into one tool JSON or send incremental traces.

#### Required signal: tool usage trace (`type: "tool"`)

At least one tool trace must exist **in scope** before a performance call at that scope (block-level: evidence for that `block_id`; workspace-global: any evidence on the workspace). A single tool upload is sufficient.

**Envelope** (API request body):

```json
{
  "type": "tool",
  "file_name": "pumadoc-step-icp-define.json",
  "mime_type": "application/json",
  "data": "<base64-encoded JSON below>",
  "block_id": "{block_uuid_for_this_step — omit for workspace-level evidence}",
  "metadata": {
    "pumadoc_step_id": "customer.icp.define",
    "pumadoc_artifact_id": "artifact-123",
    "source": "pumadoc-customer-agent"
  },
  "tool_name": "pumadoc",
  "tool_action": "step_completed"
}
```

**Recommended open JSON payload** (inside `data` — extend freely; unknown fields are preserved in storage and considered at analysis time):

```json
{
  "integration": "pumadoc-customer-agent",
  "step_id": "customer.icp.define",
  "step_title": "Define ICP",
  "started_at": "2026-06-25T10:00:00Z",
  "completed_at": "2026-06-25T10:18:00Z",
  "events": [
    { "ts_ms": 0, "tool": "pumadoc", "action": "open_step", "detail": { "step_id": "customer.icp.define" } },
    { "ts_ms": 4200, "tool": "pumadoc", "action": "edit_field", "detail": { "field": "icp.industry", "value": "B2B SaaS" } },
    { "ts_ms": 15200, "tool": "pumadoc", "action": "run_simulation", "detail": { "simulation_id": "icp-fit-v1", "inputs": { "segment": "mid-market CS leaders" } } },
    { "ts_ms": 28400, "tool": "pumadoc", "action": "simulation_completed", "detail": { "simulation_id": "icp-fit-v1", "outcomes": { "fit_score": 0.72, "top_risk": "budget authority unclear" } } },
    { "ts_ms": 30100, "tool": "notes", "action": "add_note", "detail": { "text": "Founder realized ICP was too broad." } }
  ],
  "goals_achieved": [
    {
      "goal": "simulation_completed",
      "simulation_id": "icp-fit-v1",
      "summary": "Ran in-app ICP fit simulation; identified budget-authority risk."
    },
    {
      "goal": "artifact_updated",
      "artifact_type": "icp_canvas",
      "summary": "Narrowed ICP to mid-market CS leaders with PLG + sales-assist motion."
    }
  ],
  "artifact_summary": "ICP canvas v2 focused on CS leaders at 200–800 employee SaaS vendors.",
  "learner_reflection": "Optional free-text from PumaDoc chat — what they think they learned or are unsure about."
}
```

**Serialization guidelines for PumaDoc implementers:**

- **`events`** — append-only, millisecond timestamps; include UI edits, simulation start/end, exports, chat commands, and external tool calls.
- **`goals_achieved`** — declare outcomes PumaDoc already knows (simulation run, artifact publish, interview scheduled). No OpenLesson pre-registration; analysis infers relevance to the block.
- **`detail`** — nested objects welcome; prefer stable `action` verbs (`run_simulation`, `simulation_completed`, `edit_field`, `approve_knowledge`).
- **Plain text fallback** — `mime_type: "text/markdown"` with a human-readable step log is valid when JSON event capture is not yet implemented.

#### Optional enrichments (same `block_id`)

Upload only when available. Never delay performance analysis waiting for these.

**Screenshot** (`type: "screen"`):

```json
{
  "type": "screen",
  "file_name": "icp-canvas.png",
  "mime_type": "image/png",
  "data": "<base64>",
  "block_id": "{block_uuid}",
  "metadata": {
    "pumadoc_step_id": "customer.icp.define",
    "caption": "ICP canvas after simulation"
  }
}
```

**Screen recording** (`type: "video"`) — optional voice-over / walkthrough:

```json
{
  "type": "video",
  "file_name": "icp-walkthrough.webm",
  "mime_type": "video/webm",
  "data": "<base64>",
  "block_id": "{block_uuid}",
  "metadata": {
    "pumadoc_step_id": "customer.icp.define",
    "includes_audio": true
  }
}
```

**EEG** (`type: "eeg"`) — optional Muse chunk during focused work:

```json
{
  "type": "eeg",
  "file_name": "eeg-chunk.json",
  "mime_type": "application/json",
  "data": "<base64>",
  "block_id": "{block_uuid}",
  "device_name": "Muse-2",
  "sample_count": 256
}
```

**Response `201`:**

```json
{
  "evidence": {
    "id": "uuid",
    "workspace_id": "uuid",
    "block_id": "uuid",
    "type": "tool",
    "xai_file_id": "file_...",
    "created_at": "..."
  }
}
```

---

### 2. Request performance analysis (when PumaDoc chooses)

Call performance only when PumaDoc wants a score or gap report — not automatically after every upload. You may upload many evidence rows and score once, or score repeatedly as the journey progresses.

#### Report mode — structured gap analysis

**Do not send `prompt`.**

**Block-level** (focused on one step / block):

```http
POST /api/v2/agent/workspaces/{workspace_id}/performance
```

```json
{
  "block_id": "{block_uuid}"
}
```

**Workspace-global** (full journey synthesis):

```json
{}
```

or an empty body. Omit `block_id` to analyze all blocks and all workspace evidence together.

**Response `200`:**

```json
{
  "mode": "report",
  "report": {
    "summary": "...",
    "strengths": ["..."],
    "growth_areas": ["..."],
    "gap_analysis": {
      "summary": "...",
      "gaps": [
        {
          "title": "...",
          "evidence": "...",
          "severity": "low | medium | high",
          "suggested_repair": "..."
        }
      ],
      "next_practice": ["..."]
    },
    "suggestions": ["..."],
    "confidence": "emerging | developing | clear | well-connected"
  },
  "evidence_summary": {
    "blocks": 1,
    "evidence_artifacts": 1,
    "linked_sessions": 0,
    "plan_files": 1
  },
  "file_ids": ["file_...", "file_..."]
}
```

**Save `file_ids`** under the scope you used (`block:…` or `workspace`) for follow-up questions.

If only tool evidence exists, `evidence_artifacts` may be `1` — that is expected and sufficient.

#### Chat mode — follow-up question

Send a non-empty `prompt`. Reuse `file_ids` from the matching scoped report. Use the same `block_id` as that report, or omit `block_id` for workspace-wide Q&A.

**Block-scoped:**

```json
{
  "block_id": "{block_uuid}",
  "prompt": "What is the single biggest gap in how this founder defined their ICP?",
  "file_ids": ["file_...", "file_..."]
}
```

**Workspace-global:**

```json
{
  "prompt": "Across this customer-development journey, where is the founder least ready for live validation?",
  "file_ids": ["file_...", "file_..."]
}
```

**Response `200`:**

```json
{
  "mode": "chat",
  "response": "Markdown answer grounded in evidence...",
  "file_ids": ["file_..."]
}
```

---

### 3. Act on results (PumaDoc policy)

OpenLesson returns analysis; **PumaDoc decides what to do**. After `mode: "report"`, typical Customer Agent actions:

1. Summarize `report.summary` in plain chat language.
2. Add `report.gap_analysis.gaps` as **repair missions** (title + `suggested_repair`).
3. Write `report.strengths` into PumaDoc Knowledge as validated signals.
4. Store `report.gap_analysis.next_practice` as suggested next actions.
5. Optionally gate progress — e.g. unlock the next Customer Agent step only when `confidence` is `developing` or better, or when high-severity gaps have an accepted repair mission. **This gating is PumaDoc logic, not an OpenLesson requirement.**

If `confidence` is `emerging`, PumaDoc may request more work, upload additional tool traces, and re-run performance at block or workspace scope.

---

## User-facing chat templates

**Before evidence upload:**

```text
Nice work on [step name]. I'm saving a learning snapshot of what you did in PumaDoc — including [simulation / artifact / etc. if applicable] — so we can verify you understand the decisions, not just that the doc looks finished.
```

**After report:**

```text
Here's what your work shows:

**Strengths:** [1–2 from report.strengths]

**Gap to address:** [top gap title] — [suggested_repair in plain language]

**Next practice:** [first item from next_practice]

We'll update your PumaDoc Knowledge and then [unlock next step / schedule a repair loop].
```

Keep messages short. Do not expose raw API JSON to end users.

---

## Error handling

| Code | Action |
|------|--------|
| `403 teams_required` | Tell user OpenLesson Teams is required; pause integration |
| `404 workspace_not_found` | Re-bootstrap workspace; check `workspace_id` in state |
| `404 block_not_found` | Re-run `GET /blocks` and refresh step mapping |
| `429 rate_limit_exceeded` | Back off 60s; retry |
| Empty evidence on report | Upload at least one `type: "tool"` trace in scope (matching `block_id` or workspace-wide) before calling performance |

---

## Minimal end-to-end examples

### Block-level checkpoint (per-step focus)

```text
1. POST /org/guests → gsk_ key
2. POST /workspaces → workspace_id + blocks
3. GET /blocks → optional map customer.icp.define → block_id
4. [PumaDoc decides: user finished ICP step / ran simulation]
5. POST /workspaces/{id}/evidence → tool trace (block_id set)
6. POST /workspaces/{id}/performance → { "block_id": "..." }  → block report
7. POST /workspaces/{id}/performance → { "prompt": "...", "block_id": "...", "file_ids": [...] }  (optional)
8. PumaDoc updates Knowledge / gates next step per its own rules
```

### Workspace-global checkpoint (journey rollup)

```text
1–3. Bootstrap workspace (same as above)
4. [PumaDoc uploads tool traces over several days — block_id optional or mixed]
5. POST /workspaces/{id}/evidence → cumulative journey tool trace (no block_id)
6. POST /workspaces/{id}/performance → {}  → workspace-wide report
7. POST /workspaces/{id}/performance → { "prompt": "...", "file_ids": [...] }  (no block_id)
8. PumaDoc uses summary for dashboard or mentor review
```

### With optional media

```text
5a. POST /workspaces/{id}/evidence → tool trace (required for scoring)
5b. POST /workspaces/{id}/evidence → screenshot and/or screen recording (optional)
6. POST /workspaces/{id}/performance → report at chosen scope
```

---

## What this skill does not cover

- Live tutoring session control, proofs, blockchain → not in Evidence API v2
- Browser cookie auth → use API keys only
- Separate voice evidence type → use tool JSON reflections and/or `video` with audio

---

## Checklist for implementers

- [ ] Store `workspace_id`, optional step→`block_id` map, and `file_ids` per scope in PumaDoc agent state
- [ ] Define PumaDoc checkpoint policy (per-step, simulation-only, batch, global, on-demand)
- [ ] Serialize open tool-usage JSON (events + `goals_achieved`) when **PumaDoc** chooses — not on a fixed OpenLesson cadence
- [ ] Upload **at least one** `type: "tool"` row in scope before performance at that scope
- [ ] Support **block-level** performance (`block_id` set) and **workspace-global** performance (`block_id` omitted)
- [ ] Treat screenshots, screen recording, and EEG as optional — never block on them
- [ ] Call performance **without** `prompt` for structured report; **with** `prompt` + `file_ids` for Q&A
- [ ] Apply gating / Knowledge updates in PumaDoc — OpenLesson does not enforce step unlock rules
- [ ] Never log or display raw `gsk_` / `sk_` keys in user chat