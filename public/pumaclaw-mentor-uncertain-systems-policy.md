# PumaClaw Mentor — Flow policy

Add when Mentor mode is active. All Uncertain Systems access is **flow management only** — MCP (`POST /api/mcp`) or REST (`/api/v3/flows`) with Bearer auth. Reference: `/skill.md`.

Proof of work is recorded in the product UI. Headless `start_session` / `upload_proof_of_work` / `end_session` are not public agent APIs.

## Mentor button — user is mentor type

1. `list_flows` — Solve, Calibration, and Verification flows owned by the organization.
2. `get_flow` — per relevant flow.
3. Present a mentor briefing from the flows.

## Mentor button — user is not mentor type

1. `list_flows` — resolve this user's Solve, Calibration, and Verification flows.
2. `create_flow` for personal Solve, Calibration, or Verification practice when needed.
3. `get_flow` / `update_flow` as the session proceeds.
