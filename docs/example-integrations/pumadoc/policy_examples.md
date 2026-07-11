# PumaDoc × openLesson — Policy Examples

Lightweight policy additions for existing PumaDoc skills. Full integration guides: `customer-agent-openlesson-skill.md`, `pumaclaw-mentor-openlesson-skill.md`.

---

## Customer Agent — openLesson policy

**Workspace:** On first session, resolve or create one openLesson workspace per learner titled `PumaDoc Customer Agent — {username}`. Store `workspace_id` server-side; reuse it every session.

**Background verification:** Use openLesson MCP in the background for the full journey. After session start, call `get_learning_progress` and `generate_proof_of_work_schema`. After each meaningful PumaDoc action or coaching exchange, call `upload_proof_of_work` (`type: tool`) with a JSON trace of tool events and chat turns (`tool_name: pumadoc`). Do not show scores, gap reports, or verification messaging during intermediate steps.

**Validation only:** When the user completes the validation progress step, call `analyze_performance` (report mode, block-scoped). Post one **Learning check-in** in chat with 3–5 next actions drawn from `gap_analysis.next_steps`, `next_practice`, `suggestions`, and `growth_areas` — framed as how to improve learning efficiency, not API output. Report also returns `overall_score`, `conversion_score`, `conversion_goal`, and `marker_scores`.

**Proof-of-work types:** `tool` (required minimum), `screen`, `video`, `eeg` — max 10 MB each; TAP (`create_tap_link`) is separate but strengthens scoring.

**Rules:** No mid-journey scoring. Brief TIM reflection nudges are OK (every MCP/REST response includes `interruption`). Tool JSON + chat is sufficient; `screen`, `video`, `eeg`, and TAP are optional enrichments.

**One-liner:** Stream PumaDoc + chat proof of work to openLesson in the background; score and surface learning-efficiency next actions only at the validation step.

---

## PumaClaw Mentor — openLesson policy

**When:** PumaClaw runs in Mentor mode — session start, check-in, or when the learner asks how to learn faster.

**Workspace:** Use the same `PumaDoc Customer Agent — {username}` workspace. Create only if missing.

**Flow:** Call `get_learning_progress` first. If proof of work exists, optionally run workspace-global `analyze_performance` (no `block_id`), then `analyze_performance` in chat mode with a mentor prompt for 3–5 concrete ways to improve customer-development learning efficiency. Reuse `file_ids` on follow-ups.

**Output:** Post one **Mentor: learning efficiency** block — where they stand, top optimization actions, one habit to build, one time-sink to avoid. Mentor tone, not examiner. Do not gate progress; advise only.

**If no proof of work:** Say so and point the learner back to Customer Agent steps. Optionally `upload_proof_of_work` from mentor chat (`tool_name: pumaclaw`) when the session itself adds signal.

**One-liner:** Read the learner's openLesson workspace and give proof-of-work-backed advice on how to optimize customer-development learning — no gating.