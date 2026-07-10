# PumaDoc × openLesson — Policy Examples

Lightweight policy additions for existing PumaDoc skills. Full integration guides: `customer-agent-openlesson-skill.md`, `pumaclaw-mentor-openlesson-skill.md`.

---

## Customer Agent — openLesson policy

**Workspace:** On first session, resolve or create one openLesson workspace per learner titled `PumaDoc Customer Agent — {username}`. Store `workspace_id` server-side; reuse it every session.

**Background verification:** Use openLesson MCP in the background for the full journey. After session start, call `get_learning_progress` and `generate_evidence_schema`. After each meaningful PumaDoc action or coaching exchange, call `upload_evidence` (`type: tool`) with a JSON trace of tool events and chat turns (`tool_name: pumadoc`). Do not show scores, gap reports, or verification messaging during intermediate steps.

**Validation only:** When the user completes the validation progress step, call `analyze_performance` (report mode, block-scoped). Post one **Learning check-in** in chat with 3–5 next actions drawn from `next_practice`, `suggestions`, and `growth_areas` — framed as how to improve learning efficiency, not API output.

**Rules:** No mid-journey scoring. Brief TIM reflection nudges are OK. Tool JSON + chat is sufficient; screenshots, video, and TAP are optional.

**One-liner:** Stream PumaDoc + chat evidence to openLesson in the background; score and surface learning-efficiency next actions only at the validation step.

---

## PumaClaw Mentor — openLesson policy

**When:** PumaClaw runs in Mentor mode — session start, check-in, or when the learner asks how to learn faster.

**Workspace:** Use the same `PumaDoc Customer Agent — {username}` workspace. Create only if missing.

**Flow:** Call `get_learning_progress` first. If evidence exists, optionally run workspace-global `analyze_performance` (no `block_id`), then `analyze_performance` in chat mode with a mentor prompt for 3–5 concrete ways to improve customer-development learning efficiency. Reuse `file_ids` on follow-ups.

**Output:** Post one **Mentor: learning efficiency** block — where they stand, top optimization actions, one habit to build, one time-sink to avoid. Mentor tone, not examiner. Do not gate progress; advise only.

**If no evidence:** Say so and point the learner back to Customer Agent steps. Optionally `upload_evidence` from mentor chat (`tool_name: pumaclaw`) when the session itself adds signal.

**One-liner:** Read the learner's openLesson workspace and give evidence-backed advice on how to optimize customer-development learning — no gating.