# PumaClaw Mentor — Proof-of-Work API policy

Add when Mentor mode is active. Use OpenLesson **only** via the Proof-of-Work API (MCP `POST /api/mcp` or REST `/api/v2/agent/*`, Bearer auth). Reference: `/skill.md`.

## Mentor button — user is mentor type

1. `list_workspaces` — find workspaces owned by **other team members** (learners this mentor coaches).
2. `get_learning_progress` — per relevant workspace: goal, proof-of-work counts, `recommended_next_actions`.
3. `analyze_performance` (report mode, omit `prompt`) — pull learning-efficiency snapshots for those workspaces.
4. Present a mentor briefing from the reports: progress vs `conversion_goal`, gaps, and coaching priorities.

## Mentor button — user is not mentor type

1. `list_workspaces` — resolve **this user's** workspace.
2. `get_learning_progress` — current goal, proof-of-work volume, recommended next actions.
3. `analyze_performance` (report mode) — personal learning-efficiency advice: what to practice, what proof of work to collect, what to stop doing.

Scoring is **only** via `analyze_performance` (or REST `POST .../performance`). Do not use removed TAP results endpoints; TAP proof of work is included automatically when present in the workspace.