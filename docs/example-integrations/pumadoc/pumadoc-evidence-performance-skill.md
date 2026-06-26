---
name: pumadoc-customer-agent-openlesson-evidence-performance
description: PumaDoc Customer Agent integration skill for OpenLesson workspace creation, open-format tool-usage evidence upload, optional media enrichments, and performance gap analysis via the Agentic API.
---

# PumaDoc Customer Agent — OpenLesson Evidence & Performance

This skill teaches the PumaDoc Customer Agent how to verify customer-development learning by **serializing what the user did**, **uploading evidence** through OpenLesson's Agentic API, and **requesting performance analysis** that returns structured gap reports or follow-up Q&A.

**Canonical API reference:** `/skill.md` (`https://openlesson.academy/skill.md`) and `/docs/agentic-v2`. When this document and the live API differ, follow `skill.md`.

**Share URL for this integration:** `/pumadoc-evidence-performance-skill.md`

---

## Purpose

After each Customer Agent step, the user should demonstrate understanding — not only produce a PumaDoc artifact. OpenLesson scores **genuine cognition** from evidence of how they worked, then returns a **structured gap report** or answers **follow-up questions** grounded in that evidence.

```text
PumaDoc work completed → tool usage serialized → evidence uploaded → performance analyzed → Knowledge updated → next step unlocked
```

**Minimum viable path:** a single `type: "tool"` upload per step is enough for performance scores to compute. Screenshots, screen recording (with voice), and EEG are **optional enrichments** — not prerequisites.

---

## Design principles

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

## PumaDoc ↔ OpenLesson mapping

Map each Customer Agent step to one **workspace block**. Store in PumaDoc session state:

```json
{
  "openlesson": {
    "workspace_id": "uuid",
    "step_blocks": {
      "customer.icp.define": "block-uuid",
      "customer.segment.prioritize": "block-uuid"
    },
    "performance_file_ids": []
  }
}
```

When the user completes a PumaDoc step, upload evidence against that step's `block_id`. OpenLesson aligns block context from the workspace graph; PumaDoc only needs consistent `pumadoc_step_id` in metadata for traceability.

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

**Create Performance Workspace** from the Customer Agent journey prompt (OpenLesson generates blocks; no per-step goal manifest required):

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

Tell the user in chat which OpenLesson block corresponds to the current step (use block `title`, not UUID).

---

### 1. After each Customer Agent step — serialize and upload evidence

#### Required: tool usage trace (`type: "tool"`)

Upload **one tool trace per completed step**. This alone is sufficient before calling performance.

**Envelope** (API request body):

```json
{
  "type": "tool",
  "file_name": "pumadoc-step-icp-define.json",
  "mime_type": "application/json",
  "data": "<base64-encoded JSON below>",
  "block_id": "{block_uuid_for_this_step}",
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

### 2. Request performance analysis

#### Report mode — structured gap analysis

Call when the step's tool evidence is uploaded. **Do not send `prompt`.**

```http
POST /api/v2/agent/workspaces/{workspace_id}/performance
```

```json
{
  "block_id": "{block_uuid_for_this_step}"
}
```

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

**Save `file_ids`** in PumaDoc state for follow-up questions on the same step.

If only tool evidence exists, `evidence_artifacts` may be `1` — that is expected and sufficient.

#### Chat mode — follow-up question

Send a non-empty `prompt`. Reuse `file_ids` from the report response to avoid rebuilding context.

```json
{
  "block_id": "{block_uuid}",
  "prompt": "What is the single biggest gap in how this founder defined their ICP?",
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

### 3. Update PumaDoc Knowledge from results

After `mode: "report"`, the Customer Agent should:

1. Summarize `report.summary` in plain chat language.
2. Add `report.gap_analysis.gaps` as **repair missions** (title + `suggested_repair`).
3. Write `report.strengths` into PumaDoc Knowledge as validated signals.
4. Store `report.gap_analysis.next_practice` as suggested next actions.
5. **Unlock the next Customer Agent step** only when:
   - `confidence` is `developing`, `clear`, or `well-connected`, **or**
   - all `high` severity gaps have an explicit repair mission accepted by the user.

If `confidence` is `emerging` or high-severity gaps remain, stay on the step and propose a rework loop (additional tool trace → re-run performance).

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
| Empty evidence on report | Upload at least one `type: "tool"` trace for the `block_id` before calling performance |

---

## Minimal end-to-end examples

### Tool-only (recommended default)

```text
1. POST /org/guests → gsk_ key for founder@startup.example
2. POST /workspaces → workspace_id + blocks
3. GET /blocks → map customer.icp.define → block_id
4. [User completes ICP step in PumaDoc, runs simulation]
5. POST /workspaces/{id}/evidence → tool trace with events + goals_achieved (block_id set)
6. POST /workspaces/{id}/performance → { "block_id": "..." }  → report
7. POST /workspaces/{id}/performance → { "prompt": "...", "block_id": "...", "file_ids": [...] }  (optional Q&A)
8. Update PumaDoc Knowledge; unlock next step
```

### With optional media

```text
5a. POST /workspaces/{id}/evidence → tool trace (required)
5b. POST /workspaces/{id}/evidence → screenshot and/or screen recording (optional)
6. POST /workspaces/{id}/performance → report (same as above)
```

---

## What this skill does not cover

- Live tutoring session control, proofs, blockchain → not in Agentic API v2
- Browser cookie auth → use API keys only
- Separate voice evidence type → use tool JSON reflections and/or `video` with audio

---

## Checklist for implementers

- [ ] Store `workspace_id`, step→`block_id` map, and latest `file_ids` in PumaDoc agent state
- [ ] Serialize open tool-usage JSON (events + `goals_achieved`) after every Customer Agent step
- [ ] Upload **at least one** `type: "tool"` evidence row per step before performance
- [ ] Treat screenshots, screen recording, and EEG as optional — never block on them
- [ ] Call performance **without** `prompt` for structured report
- [ ] Call performance **with** `prompt` + `file_ids` for user questions
- [ ] Gate next step on `confidence` and gap severity
- [ ] Never log or display raw `gsk_` / `sk_` keys in user chat