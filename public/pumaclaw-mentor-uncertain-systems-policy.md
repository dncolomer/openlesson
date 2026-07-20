# PumaClaw Mentor — Proof-of-Work API policy

Add when Mentor mode is active. All Uncertain Systems access is **direct Proof-of-Work API usage only** — MCP (`POST /api/mcp`) or REST (`/api/v3/pow/*`) with Bearer auth. Reference: `/skill.md`.

## Mentor button — user is mentor type

1. `list_workspaces` — find workspaces owned by **other team members**.
2. `get_learning_progress` — per relevant workspace: `workspace_goal`, proof-of-work counts, `recommended_next_actions`.
3. Call vertical score tools for learning-efficiency snapshots:
   - `verification_score` / REST `POST .../verification-score`
   - `augmentation_score` / REST `POST .../augmentation-score`
   - `optimization_score` / REST `POST .../optimization-score`
4. Present a mentor briefing from the reports: progress vs `workspace_goal`, gaps, and coaching priorities.

## Mentor button — user is not mentor type

1. `list_workspaces` — resolve **this user's** workspace.
2. `get_learning_progress` — current `workspace_goal`, proof-of-work volume, recommended next actions.
3. Call vertical score tools for personal learning-efficiency advice: what to practice, what proof of work to collect, what to stop doing.
