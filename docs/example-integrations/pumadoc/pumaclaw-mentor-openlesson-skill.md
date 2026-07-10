---
name: pumaclaw-mentor-openlesson
description: PumaClaw Agent Mentor mode — read learner workspace progress and deliver openLesson-grounded advice to optimize customer-development learning efficiency.
---

# PumaClaw Mentor — OpenLesson Integration

**API reference:** `/skill.md` · **Transport:** openLesson MCP (or REST Bearer — same tools)

**When:** PumaClaw Agent runs in **Mentor mode** — session start, mentor check-in, or when the learner asks how to learn faster.

**Goal:** Holistic, evidence-backed advice on optimizing learning — not step gating. Uses the same learner workspace the Customer Agent populated.

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
| 1 | `get_learning_progress` | Always first — blocks, evidence counts, `conversion_goal`, `recommended_next_actions` |
| 2 | `analyze_performance` (report) | If `evidence_artifacts >= 1` — workspace-global (omit `block_id`) for overview |
| 3 | `analyze_performance` (chat) | Always — mentor coaching prompt (below) |

**Report** (optional orientation):

```json
{ "workspace_id": "<uuid>" }
```

**Chat** (primary mentor output):

```json
{
  "workspace_id": "<uuid>",
  "prompt": "You are a learning mentor. Given all evidence (tool traces, chat, TAP if any), give 3–5 concrete ways this learner can improve customer-development learning efficiency: what to practice, what evidence to collect, and what to stop doing. Be specific to their gaps. No scores unless helpful.",
  "file_ids": []
}
```

Reuse `file_ids` from the report call on follow-up mentor questions.

If **no evidence yet**, say so honestly and recommend the learner complete Customer Agent steps first; optionally `generate_evidence_schema` to preview what signal to collect.

---

## Present advice in Mentor chat

Synthesize `response` (chat mode) and/or `report.gap_analysis`, `marker_scores`, `recommended_next_actions`. Keep tone mentor — not examiner.

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

If the mentor session itself produces new signal (e.g. learner articulates a plan in mentor chat), call `upload_evidence` with `tool_name: "pumaclaw"` and chat events — keeps the workspace current for the next review.

---

## Optional tools

| Tool | Use |
|------|-----|
| `list_blocks` | Name competencies when advising |
| `get_tap_results` | Incorporate completed think-aloud gaps |
| `generate_evidence_schema` | When evidence is thin — show what to capture next |

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
- [ ] Workspace-global `analyze_performance` when evidence exists
- [ ] Chat-mode performance with mentor efficiency prompt
- [ ] Deliver concise optimization advice — no API exposure to learner