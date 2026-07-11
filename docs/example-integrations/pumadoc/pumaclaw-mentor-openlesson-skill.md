---
name: pumaclaw-mentor-openlesson
description: PumaClaw Agent Mentor mode — read learner workspace progress and deliver openLesson-grounded advice to optimize customer-development learning efficiency.
---

# PumaClaw Mentor — OpenLesson Integration

**API reference:** `/skill.md` · **Transport:** openLesson MCP (`POST /api/mcp`) or REST (`/api/v2/agent/*`) — full parity, Bearer auth

**When:** PumaClaw Agent runs in **Mentor mode** — session start, mentor check-in, or when the learner asks how to learn faster.

**Goal:** Holistic, proof-of-work-backed advice on optimizing learning — not step gating. Uses the same learner workspace the Customer Agent populated.

Every MCP tool result and REST success response includes top-level `interruption` (TIM).

**MCP tools:** `list_workspaces`, `get_workspace`, `get_learning_progress`, `create_workspace`, `list_blocks`, `generate_proof_of_work_schema`, `generate_integration_skill`, `upload_proof_of_work`, `analyze_performance`, `list_tap_links`, `create_tap_link`

---

## Proof-of-work signal the mentor can recommend

| `type` | MIME types | Mentor guidance |
|--------|------------|-----------------|
| `tool` | `application/json`, `text/plain`, `text/markdown` | Core — tool events + chat turns (`tool_name: pumadoc` or `pumaclaw`) |
| `screen` | `image/png`, `image/jpeg`, `image/webp` | Optional artifact screenshots |
| `video` | `video/mp4`, `video/webm`, `video/quicktime` | Optional walkthrough with voice |
| `eeg` | `application/json`, `text/plain` | Optional Muse EEG during focused work (`device_name`, `sample_count`, `band_powers`) |

TAP (Think Aloud Protocol) evidence uploads to proof of work on completion. Poll `list_tap_links` for status, then use `analyze_performance` for unified scoring. Tool JSON alone is sufficient for `analyze_performance`.

---

## Workspace (per learner)

| Step | MCP tool | Notes |
|------|----------|-------|
| 1 | `list_workspaces` | Prefer **`PumaDoc Customer Agent — {username}`** (shared with Customer Agent) |
| 2 | `create_workspace` | Only if none exists — mentor may bootstrap an empty learner |

**Bootstrap create** (rare — Customer Agent usually created it):

```json
{
  "initial_prompt": "Customer development learning workspace for {username}. Mentor reviews progress across ICP, validation, and decision quality."
}
```

Store `workspace_id` in mentor session state.

---

## Mentor session flow

| Order | MCP tool | When |
|-------|----------|------|
| 1 | `get_learning_progress` | Always first — blocks, proof-of-work counts, `conversion_goal`, `recommended_next_actions` |
| 2 | `analyze_performance` (report) | If `proof_of_work_artifacts >= 1` — workspace-global (omit `block_id`) for overview |
| 3 | `analyze_performance` (chat) | Always — mentor coaching prompt (below) |

**Report** (optional orientation):

```json
{ "workspace_id": "<uuid>" }
```

**Chat** (primary mentor output):

```json
{
  "workspace_id": "<uuid>",
  "prompt": "You are a learning mentor. Given all proof of work (tool traces, chat, TAP if any), give 3–5 concrete ways this learner can improve customer-development learning efficiency: what to practice, what proof of work to collect, and what to stop doing. Be specific to their gaps. No scores unless helpful.",
  "file_ids": []
}
```

Reuse `file_ids` from the report call on follow-up mentor questions.

If **no proof of work yet**, say so honestly and recommend the learner complete Customer Agent steps first; optionally `generate_proof_of_work_schema` to preview what signal to collect.

---

## Present advice in Mentor chat

Synthesize `response` (chat mode) and/or `report.gap_analysis` (including `next_steps.directions` / `next_steps.events`), `marker_scores`, `conversion_score` vs `conversion_goal`, and `recommended_next_actions`. Keep tone mentor — not examiner.

**Template:**

```text
### Mentor: learning efficiency

{1–2 sentence summary of where they stand vs conversion_goal}

**Optimize your learning:**
1. {action}
2. {action}
3. {action}

**Habit to build:** {recurring practice from next_practice or suggestions}
**Time-sink to avoid:** {common anti-pattern from gaps}

Want a deeper dive on any block? Ask me to focus on a specific step.
```

Do not re-run Customer Agent validation gating. Mentor advises; Customer Agent verifies.

---

## When to upload (Mentor-initiated)

If the mentor session itself produces new signal (e.g. learner articulates a plan in mentor chat), call `upload_proof_of_work` with `tool_name: "pumaclaw"` and chat events — keeps the workspace current for the next review.

---

## Optional tools

| Tool | Use |
|------|-----|
| `list_blocks` | Name competencies when advising |
| `list_tap_links` | Confirm TAP completion before incorporating think-aloud proof of work |
| `generate_proof_of_work_schema` | When proof of work is thin — show what to capture next |

---

## Agent state

```json
{
  "workspace_id": "uuid",
  "username": "jane",
  "mentor_file_ids": [],
  "last_review_at": "ISO-8601"
}
```

---

## Checklist

- [ ] Resolve username workspace (shared with Customer Agent)
- [ ] `get_learning_progress` every mentor session
- [ ] Workspace-global `analyze_performance` when proof of work exists
- [ ] Chat-mode performance with mentor efficiency prompt
- [ ] Deliver concise optimization advice — no API exposure to learner