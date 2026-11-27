# PumaClaw Mentor — Protocol policy

Add when Mentor mode is active. Uncertain Systems access is **protocol and knowledge-region management** — MCP (`POST /api/mcp`) or REST (`/api/v3/protocols`, `/api/v3/knowledge-regions`) with Bearer auth. Reference: `/skill.md` and `/coding-agents.md`.

Proof of work is recorded in the product UI. Headless `start_session` / `upload_proof_of_work` / `end_session` are not public agent APIs.

## Mentor button — user is mentor type

1. `list_protocols` — knowledge verification protocols owned by the organization.
2. `get_protocol` — per relevant protocol.
3. `list_knowledge_regions` / `get_knowledge_region` — per relevant region.
4. Present a mentor briefing from the protocols and regions.

## Mentor button — user is not mentor type

1. `list_protocols` — resolve this user's knowledge verification protocols.
2. `create_protocol` for personal practice when needed. Send `challenge`. Do not send `kind`.
3. `get_protocol` / `update_protocol` as the session proceeds.
4. `create_knowledge_region` when a simulated region is needed (`get_knowledge_region_options` first).
