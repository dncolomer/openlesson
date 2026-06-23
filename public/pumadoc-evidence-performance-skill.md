---
name: pumadoc-customer-agent-openlesson-evidence-performance
description: PumaDoc Customer Agent integration skill for OpenLesson workspace creation, per-step evidence upload (tool usage, screenshots, video, EEG), and performance gap analysis via the Agentic API.
---

# PumaDoc Customer Agent — OpenLesson Evidence & Performance

This skill teaches the PumaDoc Customer Agent how to verify customer-development learning by **uploading step evidence** and **requesting performance analysis** through OpenLesson's Agentic API.

**Canonical API reference:** `/skill.md` (`https://openlesson.academy/skill.md`) and `/docs/agentic-v2`. When this document and the live API differ, follow `skill.md`.

**Share URL for this integration:** `/pumadoc-evidence-performance-skill.md`

---

## Purpose

After each Customer Agent step, the user should demonstrate understanding — not only produce a PumaDoc artifact. OpenLesson collects **evidence of how they worked** (tool traces, screenshots, optional video/EEG) and returns a **structured gap report** or answers **follow-up questions** over that evidence.

```text
PumaDoc artifact created → evidence uploaded → performance analyzed → Knowledge updated → next step unlocked
```

GHL Score links are optional and documented in the separate GHL integration skill. This skill covers the **evidence + performance** path only.

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

Default scopes: `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write` (GHL scopes unused in this skill).

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

When the user completes a PumaDoc step, upload evidence against that step's `block_id`.

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

**Create Performance Workspace** from the Customer Agent journey prompt:

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

### 1. After each Customer Agent step — upload evidence

Upload **at least one** evidence artifact per completed step. Prefer a **tool trace** plus a **screenshot** of the PumaDoc artifact.

#### Tool usage trace (`type: "tool"`)

Serialize what the user did in PumaDoc and supporting tools:

```json
{
  "type": "tool",
  "file_name": "pumadoc-step-icp-define.json",
  "mime_type": "application/json",
  "data": "<base64>",
  "block_id": "{block_uuid_for_this_step}",
  "metadata": {
    "pumadoc_step_id": "customer.icp.define",
    "pumadoc_artifact_id": "artifact-123",
    "source": "pumadoc-customer-agent"
  },
  "tool_name": "pumadoc",
  "tool_action": "step_completed",
}
```

Recommended JSON payload inside `data`:

```json
{
  "step_id": "customer.icp.define",
  "step_title": "Define ICP",
  "events": [
    { "ts": 0, "tool": "pumadoc", "action": "open_step", "detail": "..." },
    { "ts": 4200, "tool": "pumadoc", "action": "edit_field", "detail": "..." },
    { "ts": 9800, "tool": "notes", "action": "add_note", "detail": "..." }
  ],
  "artifact_summary": "One-sentence summary of what they produced",
  "learner_reflection": "Optional user reflection from chat"
}
```

#### Screenshot (`type: "screen"`)

Capture the PumaDoc artifact panel or canvas:

```json
{
  "type": "screen",
  "file_name": "icp-canvas.png",
  "mime_type": "image/png",
  "data": "<base64>",
  "block_id": "{block_uuid}",
  "metadata": {
    "pumadoc_step_id": "customer.icp.define",
    "caption": "ICP canvas after step completion"
  }
}
```

#### Optional: video (`type: "video"`) or EEG (`type: "eeg"`)

Use when PumaDoc captures screen recording or Muse EEG during a step. Same `block_id` scoping. Max **10 MB** per file.

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

Call when the step's evidence is uploaded. **Do not send `prompt`.**

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
    "evidence_artifacts": 2,
    "ghl_sessions": 0,
    "linked_sessions": 0,
    "plan_files": 1
  },
  "file_ids": ["file_...", "file_..."]
}
```

**Save `file_ids`** in PumaDoc state for follow-up questions on the same step.

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

If `confidence` is `emerging` or high-severity gaps remain, stay on the step and propose a rework loop (more evidence → re-run performance).

---

## User-facing chat templates

**Before evidence upload:**

```text
Nice work on [step name]. Before we move on, I'm saving a learning snapshot to verify you can explain and apply what you decided — not just that the doc looks finished.
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
| Empty evidence on report | Upload at least tool + screen evidence before calling performance |

---

## Minimal end-to-end example

```text
1. POST /org/guests → gsk_ key for founder@startup.example
2. POST /workspaces → workspace_id + 5 blocks
3. GET /blocks → map customer.icp.define → block_id
4. [User completes ICP step in PumaDoc]
5. POST /workspaces/{id}/evidence → tool trace (block_id set)
6. POST /workspaces/{id}/evidence → screenshot (block_id set)
7. POST /workspaces/{id}/performance → { "block_id": "..." }  → report
8. POST /workspaces/{id}/performance → { "prompt": "...", "block_id": "...", "file_ids": [...] }
9. Update PumaDoc Knowledge; unlock next step
```

---

## What this skill does not cover

- GHL private links and voice sessions → see `pumadoc-customer-agent-openlesson-ghl-integration.md`
- Live tutoring sessions, proofs, blockchain → not in Agentic API v2
- Browser cookie auth → use API keys only

---

## Checklist for implementers

- [ ] Store `workspace_id`, step→`block_id` map, and latest `file_ids` in PumaDoc agent state
- [ ] Upload tool trace + screenshot after every Customer Agent step
- [ ] Call performance **without** `prompt` for structured report
- [ ] Call performance **with** `prompt` + `file_ids` for user questions
- [ ] Gate next step on `confidence` and gap severity
- [ ] Never log or display raw `gsk_` / `sk_` keys in user chat