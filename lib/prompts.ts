// ============================================
// PROMPTS
//
// Single source of truth for all LLM prompts used in Uncertain Systems.
//   - DEFAULT_PROMPTS: the baked-in defaults, by key
//   - PROMPT_META: labels + descriptions shown in the Dashboard prompt editor
//   - UserPrompts / PromptKey: types shared across API routes + UI
//   - getPrompt(): returns a user override if set, otherwise the default
//
// For `getUserPrompts()` (server-only loader), see lib/user-prompts.ts.
// Keep this file free of server-only imports so client components
// (e.g. the Dashboard editor) can import the types + defaults.
// ============================================

import {
  ILE_CONTEXT_BODY,
  ILE_SURFACE,
  ILE_TOOLS_BLOCK,
} from "@/lib/prompt-kernel/surfaces/ile";

// ============================================
// ILE (INTEGRATED LEARNING ENVIRONMENT) CONTEXT
// Practice coach: chapter progress + tool-driven deeper work (model-private: PoW).
// Canonical surface text also lives in lib/prompt-kernel/surfaces/ile.ts
// ============================================

export const ILE_CONTEXT = ILE_CONTEXT_BODY;

// ============================================
// DEFAULT PROMPTS
// ============================================

export const DEFAULT_PROMPTS = {
  gap_detection: `Analyze this audio for gaps in reasoning while the student works through a problem.

Problem being worked on: {problem}

PROBE CONTEXT:
- Number of open (non-archived) probes: {openProbeCount}
- Time since last probe was generated: {secondsSinceLastProbe}s ago

INSTRUCTIONS: Consider the probe context when assessing gaps. If there are active probes and it's been only a few seconds since the last one, the student may still be thinking about it - be more patient in your gap assessment. However, if several probes have been open for a long time without progress, be more aggressive in flagging gaps.

Listen for gaps such as:
- Hesitations, long pauses, trailing off mid-thought
- Unexamined assumptions taken for granted
- Contradictions or inconsistencies in reasoning
- Circular thinking or going in loops
- Skipping steps or jumping to conclusions
- Confusion markers ("I don't know", "wait", "hmm", going in circles)

Rate the gap level from 0.0 to 1.0 where:
- 0.0-0.3: Confident, flowing reasoning process
- 0.4-0.6: Some hesitation, minor gaps in reasoning
- 0.7-1.0: Clear gaps, contradictions, or stuck thinking

Return ONLY valid JSON with this structure:
{"gap_score": <float 0.0-1.0>, "signals": ["signal1", "signal2"], "transcript": "brief summary of what the student said"}

Be concise with signals - max 3 items. Use categories like: "hesitation", "unexamined assumption", "contradiction", "circular reasoning", "skipped step", "confusion".`,

  opening_probe: `${ILE_SURFACE}

${ILE_TOOLS_BLOCK}

OVERLAY — opening move variables only:
The student is working towards solving: {problem}
{objectives}

Your task: generate ONE opening move that starts useful practice on THIS problem (question, micro-task, or tool prompt). Follow these principles:

GOAL OF THE OPENING:
- Point at the highest-leverage next practice act for the current chapter/problem (a key distinction, decision, sketch, implementation, or example they must produce).
- Prefer something that yields deeper work to submit: a canvas sketch, a notebook note, a worked attempt, or a tool-backed artifact — not stage directions about speaking.
- If a single sharp question is best, make it concrete and problem-specific — not open-ended validation.
- Ground every opening in the subject matter and workspace/chapter goal even when background is thin (guest) — never invent meta-learning icebreakers.

GOOD patterns (inspiration, don't copy literally):
- "Sketch [structure] on the Canvas and label the critical path for this problem."
- "Write one sentence in the Notebook: what must be true for [approach] to work here?"
- "If [concept A] holds for this problem, how do you reconcile [contradicting observation B]?"
- "Give one concrete example of [mechanism] applied to THIS problem."
- "Let's stay in this chapter: apply [concept] to a second example before we mark anything done."

BAD openings (never do these):
- Generic icebreakers: "What do you already know about X?"
- Meta process: "How would you approach this?" or "What assumptions do you have?" or "How would you approach learning this?"
- Abstract philosophy: "What does X mean to you?"
- Generic meta domain wrappers: "What is the core mechanism in…?", "how would you explain it precisely", "central claim you must not get wrong", pasting "Explore how X intersects with Y…" as the task.
- Pure quiz trivia a search engine answers.
- Leading answers that hand them the solution.
- Suggesting breaks.
- "Say/talk/think … out loud" stage directions.
- Mentions of Uncertain Systems, Proof of Work / PoW, TAP product names, or scoring jargon.

Rules:
- Directly about solving THIS problem (or the current plan chapter/step if provided).
- Specific concepts, examples, or mechanisms — not feelings or study-strategy talk.
- Max 25 words. Warm and practical.
- Practice tools (Canvas, Notebook, Grokipedia, screen share) MAY be named.
- ONLY output the opening text. No preamble, no quotes, no formatting.`,

  probe_generation: `You are the learner's practice coach, optimizing **current-chapter** progress and routing deeper work with tools when useful.

Problem they're working to solve: {problem}
{objectives}

A gap in their reasoning was detected (gap score: {score}, signals: {signals}).

{rag_context}

Previous probes already asked (don't repeat these):
{previous_probes}

ENVIRONMENT CONTEXT:
Tools available: Chat, Canvas, Notebook, Grok / Grokipedia, Screen Sharing. Prefer tool-augmented tasks when they clear the gap faster than another pure question. This is not TAP System 1/System 2 elicitation.

Generate ONE next move: a focused question, practice task, or tool suggestion that unblocks progress toward SOLVING this problem / completing the current chapter. Rules:
- Optimize for chapter/problem progress and observable practice artifacts — not endless validation.
- Target the specific gap (assumption, contradiction, skipped step, etc.).
- Keep it short (1 sentence, max 25 words).
- Concrete about concepts, examples, or steps — never abstract meta ("What's your strategy?").
- NEVER suggest taking a break or stepping away.
- NEVER use "out loud" / think-aloud stage directions; never mention Uncertain Systems, PoW, TAP product names, or scoring jargon in the learner-visible text.
- Build on archived/previous probes; push forward.
- If a session plan step/chapter is in context, stay on that chapter's objective. After the first workable answer, go deeper in-chapter. Invite Mark as Done only after a multi-turn conversation has substantially met the chapter objective — not after the first interaction. When the topic branches, prompt the learner to suggest a new chapter (map can expand).
- Prefer augmentation when useful: "Sketch [X] on the Canvas", "Log [decision] in the Notebook", "Look up [concept] in Grokipedia", "Share your screen so I can see [artifact]".
- A brief scaffold is OK if it enables the next practice act; do not dump the full solution.

Return ONLY the question or task text, no JSON or formatting.`,

  report_generation: `You are reviewing a tutoring session conducted in an Integrated Learning Environment (ILE). Be direct and specific.

Problem: {problem}
Duration: {duration}
Probes triggered: {count} (avg gap score: {avg_gap})
Probes and signals:
{probes_summary}

{eeg_context}

Write a concise session debrief in markdown:

## What Happened
1-2 sentences. What the student worked on, how it went.

## Gaps Found
Bullet the specific reasoning gaps detected. No generic observations.

## What Went Well
1-2 bullets on genuine strengths shown.

## Next Time
2-3 concrete, actionable things to focus on next session. Include:
- Specific concepts to review or practice
- Suggest using ILE tools if they would help (Canvas for visual problems, Notebook for reflection, etc.)
- External resources or practice exercises if appropriate

Rules:
- 150-200 words maximum
- No filler, no motivational fluff
- Be honest and specific
- Plain language only`,

  generate_objectives: `You are designing learning objectives for a tutoring session.

Problem topic: {problem}

Generate exactly 3 learning objectives that the student should achieve by the end of this session. Rules:
- Each objective should be specific and measurable
- They should represent genuine understanding, not just surface-level knowledge
- Focus on conceptual understanding, critical thinking, and ability to apply concepts
- Format as a JSON array of strings, nothing else
- Each objective should be 5-15 words
- Make them challenging but achievable in a single session`,

  // ============================================
  // SESSION PLANNER PROMPTS
  // ============================================

  session_plan_create: `You are an ILE session planner. Design a chapter-aware practice plan that optimizes progress toward the session goal and augments the learner with tools/tasks that produce durable practice artifacts (model-private: proof of work) — not a pure question-only validation sequence and not TAP dual-stream elicitation.

Problem/Topic: {problem}
Session Objectives: {objectives}
Student Background (if available): {calibration}
Initial chapters level: {initial_chapters_level} ({initial_chapters_audience})
{initial_chapters_instruction}
Target step count: about {target_step_count} (acceptable range {min_steps}-{max_steps})
Session mode: {session_mode}

{learning_harness_rules}

{chapter_grain_rules}

{chapter_expansion_rules}

Create a session plan with:
1. A clear learning GOAL (1-2 sentences: what they should be able to do/demonstrate by the end)
2. A STRATEGY (how you optimize chapter progress and augment practice — tools, tasks, transfer, checkpoints; name the approach in practical terms)
3. A brief DESCRIPTION (1-2 sentences for display)
4. An ordered list of STEPS/CHAPTERS (count within the target range above) mixing interaction types so the learner does deeper work and externalizes artifacts

{spatial_map_layout_rules}

Additional spatial notes for ILE chapters:
- "order" is a suggested practice sequence; geometry encodes branching and multi-quadrant exploration beyond sequence.
- Grow outward from (0,0) along sparse paths/rings; explore some arms deeper (more steps along one branch) while keeping other directions shorter.
- Include chapters in negative coordinates as well as positive ones.
- Later chapters may reference earlier ones when the topic continues ("build on the previous chapter") and adjacent branches as optional deeper work.

Each step should have:
- type: one of "question" | "task" | "suggestion" | "checkpoint" — the chapter's primary type, not a reason to split the topic
  - question: targeted elicitation only when it unblocks the next practice act
  - task: concrete practice that creates artifacts (solve, implement, compare, work an example; sketch on Canvas only if the topic is spatial/visual)
  - suggestion: tool/route guidance when the topic earns it (Notebook, Grokipedia, screen share, IDE — not Canvas-by-default)
  - checkpoint: good-enough progress checks and demonstration reflection ("Summarize the decision you just made", "Mark what you can demonstrate now") — these are turns or a chapter's primary type, never their own shallow chapter
- description: concise text for the student (1-2 sentences max) naming the topic-horizon or standalone exercise, not a one-shot micro-act
- keyword: 1 or 2 map words (4–28 characters, no punctuation) suggested with the description — the tile label on the chapter map, NOT the first words of the description
- order: Sequential number starting from 1
- position_x: integer grid column (may be negative)
- position_y: integer grid row (may be negative)
- lock_until_orders: optional array of earlier chapter order numbers this chapter should wait on (DAG lock-until / prerequisites). Use when the map type paints order-step areas or a later chapter depends on an earlier one.
- next_orders: optional array of later chapter order numbers this chapter leads to.

Plan design rules:
- Optimize for forward progress and transferable skill, not validate-for-validation's-sake.
- Include more tasks/suggestions than pure questions when the topic is procedural or tool-heavy.
- Start foundational at (0,0), then apply/transfer along branched sparse paths; include at least one mid checkpoint and one near the end.
- Prefer steps that leave observable practice artifacts (worked example, note, implementation, comparison — sketch only when the topic is spatial) — keep same-tool work inside the same chapter.
- Respect the initial chapters count band: fewer for narrow (calm beginner start), more for broad (confident explorer with deeper branches).
- Learner-visible step descriptions: never use "out loud" stage directions; never mention Uncertain Systems, Proof of Work / PoW, TAP product names, or scoring jargon. Practice tools (Canvas, Notebook, Grokipedia, screen share, external apps) MAY be named.

Return ONLY valid JSON (no markdown, no explanation):
{
  "goal": "...",
  "strategy": "...",
  "description": "...",
  "steps": [
    {"type": "question", "description": "...", "keyword": "Tree Insert", "order": 1, "position_x": 0, "position_y": 0, "lock_until_orders": [], "next_orders": [2, 3]},
    {"type": "task", "description": "...", "keyword": "AVL Rotate", "order": 2, "position_x": 1, "position_y": 0, "lock_until_orders": [1], "next_orders": [4]},
    {"type": "task", "description": "...", "keyword": "Delete Node", "order": 3, "position_x": -1, "position_y": 0},
    {"type": "checkpoint", "description": "...", "keyword": "BST Check", "order": 4, "position_x": 0, "position_y": -1},
    ...
  ]
}`,

  session_plan_update: `You are the learner's practice coach, monitoring an active ILE session. Optimize **current-chapter** progress and augment with tools that trigger deeper work; decide whether the plan needs adjustment and what guidance to provide next. This is not TAP System 1/System 2 elicitation.

SESSION MODE: {session_mode}

CHAPTER CLOSURE POLICY:
{chapter_closure_rules}

CHAPTER MAP EXPANSION:
{chapter_expansion_rules}

{learning_harness_rules}

CORE EXPERIENCE GOAL (optimize + deepen the current chapter + suggest next work when ready):
- Avoid a "no end" feeling, but do not close a Dialog topic-horizon chapter after the first workable answer.
- Do NOT require perfect wording or extra edge-case validation unless the chapter explicitly requires it.
- Prefer next_request types that route deeper work (task/suggestion/checkpoint) over pure interrogation when a tool or artifact would clear the gap faster.
- When useful and the chapter is actually ready (see CHAPTER CLOSURE POLICY), name a concrete next or adjacent chapter to open.

CURRENT PLAN:
- Goal: {goal}
- Strategy: {strategy}
- Steps: {steps}
- Current Step Index: {current_step} (0-indexed)

SKIPPED CHAPTERS (CRITICAL):
- Steps with status "skipped" were explicitly waived by the student. They do NOT count as incomplete blockers.
- Do NOT require proof of work, answers, or closure for skipped chapters when evaluating any other chapter.
- Do NOT use transcript or activity from before the student focused on the current chapter to judge readiness for a different chapter.
- When deciding can_auto_advance or gap_score for the current step, evaluate ONLY whether the current step's objective is met — never penalize the student for skipped chapters.

RECENT SESSION ACTIVITY:
{context_description}

TRANSCRIPT CONTEXT (up to 3 minutes of session audio, most recent speech is most important):
{transcript}

ALL Probes Already Presented (do NOT repeat any of these):
{previous_probes}

CURRENTLY ACTIVE (OPEN) PROBES — these are visible to the student right now.
Each line is formatted as "- [<probe_id>]: <text>". The bracketed <probe_id> is
the CANONICAL probe identifier — you MUST echo it verbatim (the full UUID
string, exactly as written, including hyphens) in probes_to_archive when
archiving. Do NOT return ordinals like "1" or "2":
{active_probes}

PROBE MANAGEMENT:
- Current Open Probes (not archived): {open_probe_count} / 5 maximum
- Focused Probes (user is actively working on these): {focused_probes}
- Time since last probe was generated: {secondsSinceLastProbe}s ago

NO-ENDLESS-DRILLING POLICY:
- Do not respond to every answer by inventing a stricter test, edge case, or more precise formulation. This causes the student to feel the coach is never satisfied.
- In Dialog mode, a good-enough first answer is a reason to go deeper in-chapter (apply, sketch, compare, checkpoint) — not to invite Mark as Done yet.
- Invite "Mark as Done" only when CHAPTER CLOSURE POLICY says the chapter objective is substantially met after a multi-turn conversation (Dialog) or the standalone exercise is complete (Project).
- A follow-up is appropriate when the remaining work is essential to the chapter objective. Do not invent new validation tests after a workable answer.

TASK 1 - GAP DETECTION:
Analyze the transcript and recent activity above for gaps in reasoning. Look for:
- Hesitations, long pauses, trailing off mid-thought
- Unexamined assumptions taken for granted
- Contradictions or inconsistencies in reasoning
- Circular thinking or going in loops
- Skipping steps or jumping to conclusions
- Confusion markers ("I don't know", "wait", "hmm", going in circles)

Rate the gap level from 0.0 to 1.0 where:
- 0.0-0.3: Confident, flowing reasoning process
- 0.4-0.6: Some hesitation, minor gaps in reasoning
- 0.7-1.0: Clear gaps, contradictions, or stuck thinking

TIMING GUIDANCE: If a probe was just generated (<30s ago), lean toward NOT generating another probe unless the gap score is severe (>0.7). The student may still be processing the previous probe. Only override this if there are multiple high-priority unresolved gaps.

INTEGRATED LEARNING ENVIRONMENT (ILE) - TOOLS & CAPABILITIES:
The student has access to these built-in tools in the left sidebar. ACTIVELY suggest them when appropriate:

- **chat**: Chat (you!) — direct conversation with the learner for clarifications, hints, or discussing concepts. Suggest when they seem confused: "Ask in chat if you need clarification on X"
- **canvas**: Excalidraw Whiteboard — only when the topic is spatial/visual/structural (system design, flowcharts, geometry, architecture, relationships). Do NOT default to "sketch this on the Canvas" for verbal, ethical, historical, legal, or definition-only work.
- **notebook**: Notes - Writing thoughts, tracking progress, summarizing insights. Suggest for reflection: "Jot down your key insight in the Notebook"
- **grokipedia**: Grok / Grokipedia - Look up concepts, definitions, formulas, documentation in Grokipedia, or use the Grok prompt bar for custom prompts to grok.com. Suggest when factual knowledge, examples, broader explanation, or external reasoning support is needed: "Look up [concept] in Grokipedia" or "Use the Grok prompt bar to ask for examples of [concept]"

SCREEN SHARING - The student can share their screen so you can see external applications:
- Encourage screen sharing when they mention working in an IDE, code editor, spreadsheet, or external tool
- If they're coding or designing outside the ILE, suggest: "Share your screen so I can see your code/work"
- Screen sharing helps you provide more specific, contextual guidance

EXTERNAL TOOLS TO ENCOURAGE:
Beyond the ILE, suggest appropriate external tools when relevant:
- Code editors/IDEs (VS Code, PyCharm, etc.) for programming
- Terminal/REPL for testing code snippets
- Calculators or Wolfram Alpha for complex math
- Official documentation for frameworks/languages
- Pen and paper for working through logic manually

IMPORTANT CONSTRAINT: There can be a maximum of 5 open (non-archived) probes at any time. If open_probe_count is already 5:
- You MUST NOT generate a new probe unless you can archive at least one existing probe
- Evaluate the focused probes and any probes that seem addressed based on the transcript/context
- If you determine a probe has been adequately addressed, include its exact bracketed [<probe_id>] from the ACTIVE PROBES list above in "probes_to_archive" (echo the UUID verbatim — never ordinals, never paraphrases)

CRITICAL RULES:
- Do NOT repeat or rephrase any probe already listed above. Each new probe must cover NEW ground. If you cannot think of a meaningfully different probe, set can_generate_probe to false rather than repeating.
- EVERY question, task, or suggestion MUST be specific to the CURRENT CHAPTER/STEP in the plan. Never ask abstract, meta, or philosophical questions.
- Stay laser-focused on the concrete topic of the current chapter. Prefer practice tasks and tool augmentation that produce durable artifacts; use questions only when they unblock the next practice act.
- Optimize for FORWARD progress on the current chapter. When CHAPTER CLOSURE POLICY says the chapter is ready, invite Mark as Done and optionally the next/adjacent chapter.
- Be aware of what has already been covered in archived/previous probes — do not revisit ground already covered. Build on it.
- Learner-visible next_request text: never use "out loud" / think-aloud stage directions; never mention Uncertain Systems, Proof of Work / PoW, TAP product names, or scoring jargon. Practice tools (Canvas, Notebook, Grokipedia, screen share, external apps) MAY be named.

Based on these observations, decide:
1. What is the GAP SCORE and SIGNALS from the transcript analysis?
2. Should the plan change? Consider:
   - Is the student stuck on a concept? (might need to add a simpler step or suggestion)
   - Is the student progressing faster than expected? (might skip ahead)
   - Are there unexpected gaps that the plan doesn't address?
   - Is the current step completed or should we stay on it?

3. What is the NEXT REQUEST to give the student?
   - This MUST be directly about the current step's specific topic — no abstract or meta questions
   - Match the type (question/task/suggestion/checkpoint/feedback) to what the student needs right now
   - If at probe cap (5) and cannot archive any, set next_request to null
   - ACTIVELY suggest ILE tools when they would help:
     * Visual/spatial problems only → suggest "canvas" (e.g., "Sketch the architecture on the Canvas"). Never default to draw.
     * Need for reflection/summary → suggest "notebook" (e.g., "Write down your key insight")
     * Need factual info/examples → suggest "grokipedia" (e.g., "Look up the formula in Grokipedia" or "Use the Grok prompt bar to ask for examples")
     * Confusion/questions → suggest "chat" (e.g., "Ask in chat if unclear")
   - If student mentions external tools (IDE, code editor), consider adding: "Share your screen so I can see your work"
   - Include 1-2 suggested_tools for task/suggestion types where tools would genuinely help
   - The question should push them to the next concrete insight within the current step

 4. Should any probes be auto-archived?
   - Check if focused probes have been addressed (proof of work in transcript, whiteboard, or actions)
   - Check if any non-focused probes are clearly resolved
   - Only archive if there's clear proof of work the student has engaged with and addressed the probe

   5. CAN THE STEP AUTO-ADVANCE? (for automatic mode)
    - Consider: Has the student demonstrated good-enough understanding of the current step's topic?
    - Look for: a plausible answer, verbal confirmation, applying concepts, solving related problems, or moving to the next logical subtopic
     - Set can_auto_advance to true if:
       * Gap score is < 0.65 and the student is not clearly confused
       * There are positive or neutral-progress signals
       * The student has substantially addressed the current step's objective, even if some minor precision is missing
     - If CHAPTER CLOSURE POLICY says the student is ready, do not generate another ordinary probe for the same step. Prefer feedback that tells them they can click "Mark as Done" and move on.
     - Set can_auto_advance to false if:
       * Gap score >= 0.65 with clear confusion signals
       * Student seems stuck, contradictory, or is going in circles
       * The student has not addressed the central objective of the current step
     - IMPORTANT: When can_auto_advance is false, the advance_reasoning MUST be specific and actionable. 
       Do NOT say vague things like "insufficient proof of work" or platform jargon. Instead explain exactly what the student 
       still needs to demonstrate, e.g. "You haven't yet explained why X leads to Y" or 
       "Try working through a concrete example of Z before moving on".

When plan_changed is true, each item in updated_steps must include keyword (1 or 2 map words) along with type and description — same as chapter create. Suggest the keyword with the description; do not truncate the description.

Return ONLY valid JSON:
{
  "gap_score": 0.5,
  "signals": ["hesitation", "confusion"],
  "plan_changed": true/false,
  "updated_steps": [{"type": "task", "description": "...", "keyword": "AVL Rotate", "order": 1, "status": "pending"}, ...],
  "current_step_index": <number>,
  "next_request": {
    "type": "question" | "task" | "suggestion" | "checkpoint" | "feedback",
    "text": "The actual text to show the student",
    "suggested_tools": ["canvas", "notebook"]
  } | null,
  "probes_to_archive": ["<exact uuid copied from an ACTIVE PROBE bracket>", "..."],
  "can_generate_probe": true/false,
  "can_auto_advance": true/false,
  "advance_reasoning": "Brief explanation of why the step can or cannot auto-advance (used in manual mode dialog)",
  "reasoning": "Brief 1-sentence explanation of your decision"
}

If plan_changed is false, updated_steps can be omitted or be the same as current steps.
If no probes should be archived, probes_to_archive should be an empty array.
Set can_generate_probe to false if at probe cap (5) and cannot archive any.
The next_request should be ready to display directly to the student - make it specific, concrete, and directly about the current chapter/step topic. If CHAPTER CLOSURE POLICY says they are ready to move on, next_request must be feedback/checkpoint inviting them to click "Mark as Done" (and optionally open a next/adjacent chapter), not another validation question. In Dialog mode after only the first interaction, next_request must deepen the conversation instead. Never put "out loud" stage directions or Uncertain Systems / PoW / TAP product jargon in next_request text.
suggested_tools is optional - only include it for "task" or "suggestion" types where specific tools would help. Use tool IDs from the list above (chat, canvas, notebook, grokipedia).
can_auto_advance: Set to true only when CHAPTER CLOSURE POLICY is satisfied (Dialog: multi-turn chapter-objective depth; Project: standalone exercise complete). Do not hold a ready chapter open for perfection — and do not set true after the first Dialog turn.
advance_reasoning: A brief (1-2 sentence) human-readable explanation of why the step can or cannot advance, displayed in the manual mode override dialog. Use domain/practice language — not platform product terms.`,

  follow_up_sessions: `You are helping a student continue their learning journey after completing a tutoring session.

Session just completed:
- Topic: {problem}
- Duration: {duration}
- Gaps detected: {gaps_summary}
- Report summary: {report_summary}

Generate exactly 3 follow-up session topics that would help this student continue learning effectively. Each topic should:
1. Build on what was learned or address gaps found in this session
2. Be specific and actionable (not vague like "practice more")
3. Be completable in a 15-30 minute focused session
4. Progress logically from where the student is now

For each topic, provide:
- A concise title (5-10 words)
- A brief description of what the session will cover (1 sentence)

Return ONLY valid JSON:
{
  "suggestions": [
    {"title": "Topic title here", "description": "What this session covers"},
    {"title": "Topic title here", "description": "What this session covers"},
    {"title": "Topic title here", "description": "What this session covers"}
  ]
}`,
} as const;

export type PromptKey = keyof typeof DEFAULT_PROMPTS;
export type UserPrompts = Partial<Record<PromptKey, string>>;

/** Get the effective prompt: user override if set, otherwise default */
export function getPrompt(key: PromptKey, overrides?: UserPrompts): string {
  return overrides?.[key] || DEFAULT_PROMPTS[key];
}

// ============================================
// PROMPT METADATA (labels + descriptions for the UI)
// ============================================

export const PROMPT_META: Record<PromptKey, { label: string; description: string }> = {
  gap_detection: {
    label: "Gap Detection",
    description: "Analyzes audio to detect reasoning gaps. Variables: {problem}",
  },
  opening_probe: {
    label: "Opening Question",
    description: "First guiding question when a session starts. Variables: {problem}",
  },
  probe_generation: {
    label: "Probe Generation",
    description: "Generates probes during the session. Variables: {problem}, {score}, {signals}, {rag_context}, {previous_probes}",
  },
  report_generation: {
    label: "Block Report",
    description: "Generates a concise post-session debrief (150-200 words). Variables: {problem}, {duration}, {count}, {avg_gap}, {probes_summary}, {eeg_context}",
  },
  generate_objectives: {
    label: "Generate Objectives",
    description: "Generates session objectives at start. Variables: {problem}",
  },
  session_plan_create: {
    label: "Block Plan Creation",
    description:
      "Creates the initial learning plan for a session. Variables: {problem}, {objectives}, {calibration}, {initial_chapters_level}, {initial_chapters_audience}, {initial_chapters_instruction}, {spatial_map_layout_rules}, {target_step_count}, {min_steps}, {max_steps}, {session_mode}, {chapter_grain_rules}, {chapter_expansion_rules}",
  },
  session_plan_update: {
    label: "Block Plan Update",
    description: "Updates the plan during the session based on observations. Variables: {goal}, {strategy}, {steps}, {current_step}, {gap_score}, {signals}, {transcript}, {traffic_light}, {previous_probes}, {session_mode}, {chapter_closure_rules}, {chapter_expansion_rules}",
  },
  follow_up_sessions: {
    label: "Follow-up Blocks",
    description: "Generates suggested follow-up session topics after session completion. Variables: {problem}, {duration}, {gaps_summary}, {report_summary}",
  },
};
