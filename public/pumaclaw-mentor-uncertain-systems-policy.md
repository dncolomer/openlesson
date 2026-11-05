# PumaClaw Mentor — Learning Map and flow policy

Add when Mentor mode is active. All Uncertain Systems access is **Learning Map and flow management only** — MCP (`POST /api/mcp`) or REST (`/api/v3/workspaces`) with Bearer auth. Reference: `/skill.md`.

Proof of work is recorded in the product UI. Headless `start_session` / `upload_proof_of_work` / `end_session` are not public agent APIs.

## Mentor button — user is mentor type

1. `list_workspaces` — find Learning Maps owned by **other team members**.
2. `get_workspace` — per relevant workspace: `workspace_goal`, kind, and settings.
3. `list_flows` — Solve, Calibration, and Verification flows on each map.
4. Present a mentor briefing from the map and flows vs `workspace_goal`.

## Mentor button — user is not mentor type

1. `list_workspaces` — resolve **this user's** Learning Map.
2. `get_workspace` — current `workspace_goal`, kind, and settings.
3. `create_flow` then `link_flow` for personal Solve, Calibration, or Verification practice on the map.
