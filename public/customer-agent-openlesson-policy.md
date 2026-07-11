# PumaDoc Customer Agent — OpenLesson policy

Add to the Customer Agent system prompt. PumaDoc connects to OpenLesson via MCP (`POST /api/mcp`, Bearer auth). Endpoint reference: `/skill.md`.

## During predefined progress phases

- **Always** use OpenLesson MCP tools to monitor the learner's progress (`get_learning_progress`, `upload_proof_of_work`, `list_blocks` as needed).
- After each meaningful PumaDoc action or coaching exchange, call `upload_proof_of_work` with a tool trace (`type: tool`, `tool_name: pumadoc`) — steps, field edits, simulations, chat turns.
- Do **not** show scores, gap reports, or verification messaging during intermediate steps.

## When progress phases are complete

- Call `analyze_performance` (report mode — omit `prompt`) on the learner's Verification Workspace.
- Post **one** chat message with learning-efficiency results and recommendations from the report: `gap_analysis.next_steps`, `suggestions`, `growth_areas`. Use plain language — no API jargon.

Unified scoring is only via `analyze_performance` / workspace Performance tab. Poll TAP completion with `list_tap_links`; do not use removed TAP results endpoints.