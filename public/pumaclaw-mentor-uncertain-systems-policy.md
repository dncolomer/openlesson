# PumaClaw Mentor — Proof-of-Work API policy

Add when Mentor mode is active. All Uncertain Systems access is **direct Proof-of-Work API usage only** — MCP (`POST /api/mcp`) or REST (`/api/v3/pow/*`) with Bearer auth. Reference: `/skill.md`.

## Mentor button — user is mentor type

1. `list_workspaces` — find workspaces owned by **other team members**.
2. `get_workspace` — per relevant workspace: `workspace_goal`, kind, and settings.
3. Start a headless session (`start_session`) or read `list_flow_embeddings` for completed runs.
4. Present a mentor briefing from the inferred path vs `workspace_goal`.

## Mentor button — user is not mentor type

1. `list_workspaces` — resolve **this user's** workspace.
2. `get_workspace` — current `workspace_goal`, kind, and settings.
3. Run Calibrate / Learn / Verify headless (`start_session` → `upload_proof_of_work` → `end_session`) for personal practice.
