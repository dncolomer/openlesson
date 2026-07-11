---
name: customer-agent-openlesson
description: PumaDoc Customer Agent — background openLesson verification; stream tool + chat proof of work during steps; surface learning-efficiency next actions only at validation.
---

# Customer Agent — OpenLesson Integration

**API reference:** `/skill.md` · **Transport:** openLesson MCP (or REST Bearer — same tools)

The Customer Agent runs openLesson **in the background**. During normal coaching, serialize PumaDoc actions and chat into evidence. **Do not** show scores or gap reports mid-journey. At the **validation step** (last predefined progress step), post one chat block with the best next actions for learning efficiency.

---

## Workspace (per user)

Resolve once per learner; reuse across sessions.

| Step | MCP tool | Notes |
|------|----------|-------|
| 1 | `list_workspaces` | Find title **`PumaDoc Customer Agent — {username}`** |
| 2 | `create_workspace` | Only if missing — see below |
| 3 | Store `workspace_id` | Server-side agent state (not learner-visible) |

**Create workspace** when no match exists:

```json
{
  "initial_prompt": "Customer development verification for {username}: ICP, segment priority, pain/urgency, alternatives, objections, and validation readiness. Blocks should align with PumaDoc Customer Agent progress steps ending in validation."
}
```

After create: `get_learning_progress` → `list_blocks` → map `pumadoc_step_id` → `block_id` (optional lookup table in agent state).

---

## Session start (once)

| Order | MCP tool | Purpose |
|-------|----------|---------|
| 1 | `get_learning_progress` | `conversion_goal`, proof-of-work counts, `recommended_next_actions` |
| 2 | `generate_proof_of_work_schema` | Proof-of-work contract for uploads |

```json
{
  "workspace_id": "<uuid>",
  "definition": "Verify customer-problem understanding from PumaDoc tool usage and coaching chat",
  "integration_hints": {
    "tool_name": "pumadoc",
    "partner_agent": "Customer Agent",
    "event_verbs": ["open_step", "edit_field", "run_simulation", "chat_turn", "complete_step"],
    "goals": ["step_completed", "simulation_completed", "validation_submitted"]
  }
}
```

Re-call `generate_proof_of_work_schema` after every **5–10** `upload_proof_of_work` calls.

Honor top-level `interruption` (TIM) on any tool result — brief reflection nudges in chat are OK; full scorecards are not.

---

## During progress steps (background)

After each meaningful PumaDoc action **or** coaching exchange, call `upload_proof_of_work`. No learner copy about verification unless TIM requests a short reflection.

| Field | Value |
|-------|-------|
| `type` | `tool` |
| `mime_type` | `application/json` |
| `tool_name` | `pumadoc` |
| `block_id` | Current step's block UUID when mapped |
| `metadata` | `{ "pumadoc_step_id", "username", "source": "customer-agent" }` |

**Payload (`data` base64 JSON)** — include tool events **and** chat thread:

```json
{
  "integration": "customer-agent",
  "username": "jane",
  "pumadoc_step_id": "customer.validation",
  "events": [
    { "ts_ms": 0, "tool": "pumadoc", "action": "open_step", "detail": { "step_id": "customer.icp.define" } },
    { "ts_ms": 8200, "tool": "chat", "action": "user_message", "detail": { "text": "Mid-market CS leaders feel churn most in Q4." } },
    { "ts_ms": 12400, "tool": "chat", "action": "agent_message", "detail": { "text": "What evidence would falsify that segment choice?" } },
    { "ts_ms": 31000, "tool": "pumadoc", "action": "run_simulation", "detail": { "simulation_id": "icp-fit-v1" } }
  ],
  "goals_achieved": ["simulation_completed"],
  "learner_reflection": "Optional — user's stated uncertainty or confidence"
}
```

**Do not** call `analyze_performance` until the validation step completes.

---

## Validation step end (learner-visible)

When the user finishes the **validation** progress step (or journey validation gate):

1. Final `upload_proof_of_work` for that step (`block_id` = validation block).
2. `analyze_performance` — **report mode** (omit `prompt`):

```json
{ "workspace_id": "<uuid>", "block_id": "<validation-block-uuid>" }
```

3. Post **one** chat block. Source (in order): `report.gap_analysis.next_practice`, `report.suggestions`, `report.growth_areas`, `recommended_next_actions` from the tool result. Translate gaps into product language — no API jargon.

**Template:**

```text
### Learning check-in

You're through validation. Based on what you did in PumaDoc and our conversation, here's how to get more from the next round:

1. {next_practice[0] or top suggestion}
2. {next_practice[1]}
3. {next_practice[2]}

**Keep doing:** {top strength from report.strengths}
**Sharpen next:** {top growth_area or gap title}

These steps target learning efficiency — deeper understanding per hour in the workflow, not just finishing artifacts.
```

Optionally unlock the next journey phase per PumaDoc policy. Do not block on optional TAP or media.

---

## Optional enrichments

Screenshots (`screen`), video (`video`), TAP (`create_tap_link` → `get_tap_results`) strengthen signal but are **not required**. Tool JSON + chat is sufficient.

---

## Agent state (server-side)

```json
{
  "workspace_id": "uuid",
  "username": "jane",
  "step_blocks": { "customer.validation": "block-uuid" },
  "evidence_file_ids": [],
  "last_performance_file_ids": []
}
```

---

## Checklist

- [ ] Resolve or create username workspace
- [ ] `get_learning_progress` + `generate_proof_of_work_schema` at session start
- [ ] `upload_proof_of_work` after each meaningful tool action and chat turn
- [ ] No mid-journey scores or gap reports
- [ ] `analyze_performance` (report) only at validation step end
- [ ] Post learning-efficiency next-actions block in Customer Agent chat