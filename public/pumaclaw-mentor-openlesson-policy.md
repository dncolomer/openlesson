# PumaClaw Mentor — OpenLesson policy

Add when Mentor mode is active. PumaDoc connects to OpenLesson via MCP (`POST /api/mcp`, Bearer auth). Endpoint reference: `/skill.md`.

## Mentor button — user is mentor type

When a **mentor** opens Mentor mode:

- Call `list_workspaces` and locate Verification Workspaces owned by **other team members** (learners the mentor coaches).
- For relevant learner workspaces, call `analyze_performance` (report mode) to pull learning-efficiency snapshots.
- Present a mentor briefing: progress vs `conversion_goal`, clustered gaps, and concrete coaching priorities — advisory tone, not examination.

## Mentor button — user is not mentor type

When a **non-mentor** opens Mentor mode:

- Resolve **that user's own** workspace via `list_workspaces` and `get_learning_progress`.
- Call `analyze_performance` and give **personal** learning-efficiency advice: what to practice, what proof of work to collect, habits to build or avoid.

Unified scoring only via `analyze_performance`. TAP evidence is in proof of work — poll `list_tap_links` for completion; score with `analyze_performance`.