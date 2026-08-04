/**
 * Shared pure builders for dialogue questions + solo exercises.
 * Used by live Explore/Drill paths (fallbacks) and Simulation drawer/tab
 * so author previews match what learners actually get.
 *
 * Rules (product UX):
 * - Ground every item in workspace goal / subject / block materials when present.
 * - Thin/guest context still yields subject-matter items — never meta-learning fluff.
 * - No "out loud" / think-aloud stage directions.
 * - Exercises reuse the same quality helpers as TAPBench / TAP exercise / ILE Project.
 */

import {
  buildDomainExerciseAuthorSystemPrompt,
  buildTapbenchExerciseFallback,
  ensureExercisePrefix,
  looksLikeTopicOverview,
  type TapbenchExerciseContext,
} from "@/lib/pow-api/tapbench-exercise-quality";
import {
  assemblePromptWorkspaceContext,
  type PromptWorkspaceContextInput,
} from "@/lib/prompt-workspace-context";
import {
  buildTapOpeningQuestionTask,
  buildTapPracticeOpeningQuestionTask,
} from "@/lib/prompt-kernel/surfaces/tap";

export type PracticeItemContext = {
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  chapterDescription?: string | null;
  planningPrompt?: string | null;
  localNotes?: string | null;
  files?: Array<{ name: string; excerpt?: string | null }> | null;
};

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function clean(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

/** Subject label preferred order: block → chapter → workspace title/topic. */
export function practiceSubjectLabel(ctx: PracticeItemContext): string {
  return (
    clean(ctx.blockTitle) ||
    clean(ctx.chapterDescription)?.slice(0, 60) ||
    clean(ctx.workspaceTitle) ||
    clean(ctx.rootTopic) ||
    "this topic"
  );
}

/** Best domain substance string for grounding (goal + description + notes). */
export function practiceDomainSubstance(ctx: PracticeItemContext): string {
  const parts = [
    clean(ctx.blockDescription),
    clean(ctx.chapterDescription),
    clean(ctx.localNotes),
    clean(ctx.workspaceGoal),
    clean(ctx.workspaceDescription),
    clean(ctx.planningPrompt),
    clean(ctx.notes),
  ].filter(Boolean);
  return parts[0] || "";
}

/**
 * Pure dialogue question (Explore / conversational TAP style).
 * Index varies angle: work a concrete instance → catch a misuse → verify correctness.
 * Never meta-learning fluff, never syllabus restatement, never
 * "core mechanism… explain it precisely" wrappers around a blurb.
 */
export function buildGroundedDialogueQuestion(
  ctx: PracticeItemContext,
  index = 0,
): string {
  const subject = practiceSubjectLabel(ctx);
  const substance = practiceDomainSubstance(ctx);
  const goal = clean(ctx.workspaceGoal);
  const planning = clean(ctx.planningPrompt);
  const i = ((index % 3) + 3) % 3;

  // Workable domain substance (not a topic-catalog blurb).
  const work =
    substance && !looksLikeTopicOverview(substance)
      ? clip(substance, 110)
      : "";

  if (work) {
    if (i === 0) {
      return goal
        ? `Using “${subject}” on this setup — ${work} — produce one concrete intermediate result that advances “${clip(goal, 70)}”. What is that result?`
        : `Using “${subject}” on this setup — ${work} — pick concrete numbers or a named instance and give the first checkable intermediate result.`;
    }
    if (i === 1) {
      return `Someone applies “${subject}” to: ${work}. Name one concrete mistake that yields a wrong answer, and the first signal that would catch it.`;
    }
    return goal
      ? `Finish one worked instance of “${subject}” for “${clip(goal, 70)}” using: ${work}. What evidence shows the answer is correct?`
      : `Finish one worked instance of “${subject}” using: ${work}. What would you check immediately to know you are correct?`;
  }

  // Thin / guest-like context: still a checkable domain act, never meta fluff.
  if (i === 0) {
    return goal
      ? `Give one concrete numerical or situational example of “${subject}” that matters for “${clip(goal, 80)}”, and state the key intermediate result.`
      : `Give one concrete example of “${subject}” with specific numbers or a named situation — what is the key intermediate result?`;
  }
  if (i === 1) {
    return planning
      ? `When ${clip(planning, 90)}, apply “${subject}” once. What goes wrong first if a key assumption is inverted?`
      : `What breaks if you apply “${subject}” with the wrong assumption? Name the failure and the first check that would catch it.`;
  }
  return goal
    ? `Name one calculation or decision in “${subject}” that moves you toward “${clip(goal, 80)}”, and the evidence that shows you got it right.`
    : `Where would you use “${subject}” on a real problem today, and what is the first checkable output you would produce?`;
}

/**
 * Pure solo exercise (Drill / TAP exercise / ILE Project style).
 * Always returns a fixed, checkable problem — never "invent your own problem".
 * Index varies the concrete instance (seeded numbers / alternate templates).
 */
export function buildGroundedExerciseItem(
  ctx: PracticeItemContext,
  index = 0,
): string {
  const subject = practiceSubjectLabel(ctx);
  const substance = practiceDomainSubstance(ctx);
  const goal = clean(ctx.workspaceGoal);
  const i = ((index % 3) + 3) % 3;

  const base: TapbenchExerciseContext = {
    blockTitle: clean(ctx.blockTitle) || subject,
    blockDescription: substance || clean(ctx.blockDescription) || null,
    workspaceTitle: clean(ctx.workspaceTitle) || clean(ctx.rootTopic) || null,
    workspaceGoal: goal || null,
    rootTopic: clean(ctx.rootTopic) || null,
  };

  // Shared concrete-domain builder (seeded by index for variation).
  return buildTapbenchExerciseFallback(base, i);
}

/** Convert practice context into assemblePromptWorkspaceContext input. */
export function practiceContextToPromptInput(
  ctx: PracticeItemContext,
  extra?: Partial<PromptWorkspaceContextInput>,
): PromptWorkspaceContextInput {
  return {
    workspaceTitle: ctx.workspaceTitle,
    rootTopic: ctx.rootTopic,
    workspaceGoal: ctx.workspaceGoal,
    workspaceDescription: ctx.workspaceDescription,
    notes: ctx.notes,
    blockTitle: ctx.blockTitle,
    blockDescription: ctx.blockDescription,
    chapterDescription: ctx.chapterDescription,
    files: ctx.files,
    blockLocalContext: ctx.localNotes
      ? { notes: ctx.localNotes }
      : extra?.blockLocalContext,
    ...extra,
  };
}

/**
 * System prompt for Simulation LLM regenerate — reuses live domain-exercise +
 * TAP opening rules (not a separate ad-hoc author philosophy).
 */
export function buildSimulationSamplesSystemPrompt(): string {
  const exerciseRules = buildDomainExerciseAuthorSystemPrompt("tap_exercise");
  const dialogueRules = buildTapOpeningQuestionTask();
  const practiceRules = buildTapPracticeOpeningQuestionTask();
  return [
    "You generate sample practice items that preview what learners see in Explore (dialogue) and Drill (solo exercise).",
    "These must match live session quality — same grounding rules as TAP openings and domain exercises.",
    "",
    "DIALOGUE QUESTIONS (Explore / conversational) — follow these rules:",
    dialogueRules,
    "",
    "Warmup-friendly variants may use practice simplicity:",
    practiceRules,
    "",
    "SOLO EXERCISES (Drill) — follow these rules:",
    exerciseRules,
    "",
    "CRITICAL for dialogue questions:",
    "- Each question must demand a concrete intermediate result, worked instance, failure mode with a catch signal, or checkable output — NOT a syllabus restatement.",
    '- FORBIDDEN dialogue wrappers: "What is the core mechanism in…", "how would you explain it precisely", "central claim … must not get wrong", "Explore how X intersects with Y…", "in your own words what is…", pure "what is X?" overview questions.',
    "- Do NOT paste the block description after \"specifically:\" and ask for a definition of the blurb.",
    "",
    "CRITICAL for exercises:",
    "- Each exercise MUST be a fixed, fully-specified problem with concrete numbers/data/constraints inside the text.",
    "- The learner must NOT invent, choose, or design their own problem — never say \"state the problem you chose\", \"solve a non-trivial problem in <topic>\", or \"stay within this scope\" + invent.",
    "- Prefer equations, data tables, parameters, or explicit scenarios the learner solves step-by-step.",
    "",
    "OUTPUT: JSON only with:",
    '{ "topics": string[], "questions": string[3], "exercises": string[3], "probes": [{ "question": string, "kind": "question"|"exercise", "difficulty": "warmup"|"core"|"stretch", "contextSources": string[] }] }',
    "Exactly 3 questions and 3 exercises (probes preferred: 3 question + 3 exercise).",
    "Never use say/talk/think out loud stage directions. Never meta-learning icebreakers or generic meta domain questions.",
    "Every item must be grounded in the workspace goal and block subject matter provided.",
  ].join("\n");
}

/**
 * User prompt for Simulation LLM regenerate — shared workspace context assembly.
 * Supports block scope (focused block) and entire-workspace scope (goal + map).
 */
export function buildSimulationSamplesUserPrompt(
  ctx: PracticeItemContext & {
    blocks?: PromptWorkspaceContextInput["blocks"];
    focusedBlockId?: string | null;
    unusableCells?: PromptWorkspaceContextInput["unusableCells"];
    locale?: string | null;
    /**
     * "block" (default when focusedBlockId set) or "workspace" for entire-map
     * samples with no single focused block.
     */
    sampleScope?: "block" | "workspace" | null;
  },
): string {
  const isWorkspaceScope =
    ctx.sampleScope === "workspace" ||
    (!ctx.focusedBlockId && ctx.sampleScope !== "block");

  const assembled = assemblePromptWorkspaceContext(
    practiceContextToPromptInput(ctx, {
      blocks: ctx.blocks,
      focusedBlockId: isWorkspaceScope ? null : ctx.focusedBlockId,
      unusableCells: ctx.unusableCells,
      blockLocalContext:
        !isWorkspaceScope && ctx.localNotes
          ? { notes: ctx.localNotes }
          : undefined,
    }),
  );
  const languageNote =
    ctx.locale && ctx.locale !== "en"
      ? `Respond in ${ctx.locale}. Topics and items must be in that language.`
      : "";

  const scopeLead = isWorkspaceScope
    ? [
        "Generate sample practice items for the ENTIRE WORKSPACE (what might appear in Explore dialogue or Drill solo exercise across this course).",
        "Ground items in the workspace goal, title, notes, and map inventory/topology. Do not lock every item to a single block; sample across the map when inventory is present.",
        "Avoid generic fluff. Prefer concrete domain problems over syllabus restatements.",
      ]
    : [
        "Generate sample practice items for this block (what might appear in Explore dialogue or Drill solo exercise).",
        "Prioritize workspace goal, focused block text, local materials, map inventory/topology when present.",
        "Avoid generic fluff. Prefer concrete domain problems over syllabus restatements.",
      ];

  return [
    ...scopeLead,
    "",
    assembled.contextBlock,
    ctx.planningPrompt
      ? `Planning / session customization: ${clean(ctx.planningPrompt)}`
      : "",
    languageNote,
    "",
    "Return JSON only. Exactly 3 dialogue questions + 3 solo exercises (via questions/exercises and/or probes).",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * True if text is a banned meta-learning / icebreaker / generic meta-domain
 * pattern (syllabus restatement wrappers, "explain it precisely", invent-your-own).
 * Used for live fallbacks, Simulation sanitize, and structural guards.
 */
export function isMetaLearningFluff(text: string | null | undefined): boolean {
  const t = clean(text);
  if (!t) return false;
  return (
    /what do you already know\b/i.test(t) ||
    /how would you approach (learning|studying|this topic)\b/i.test(t) ||
    /what assumptions do you have\b/i.test(t) ||
    /what does .+ mean to you\b/i.test(t) ||
    /how do you feel about\b/i.test(t) ||
    /reflect on your learning\b/i.test(t) ||
    /what is your study strategy\b/i.test(t) ||
    // Generic meta domain wrappers (not a checkable task)
    /what is the core mechanism in\b/i.test(t) ||
    /how would you explain it precisely\b/i.test(t) ||
    /how would you explain the mechanism\b/i.test(t) ||
    /how would you state it precisely\b/i.test(t) ||
    /what is the central claim of\b/i.test(t) ||
    /must not get wrong\b/i.test(t) ||
    /in your own words,?\s*what is\b/i.test(t) ||
    /demonstrate your understanding of\b/i.test(t) ||
    /\bspecifically:\s*explore how\b/i.test(t) ||
    /^explore how\b/i.test(t) ||
    /\b— specifically:\s*.{20,}\s*— and how would you explain\b/i.test(t) ||
    // Invent-your-own exercise templates (meta drill framing)
    /state the problem you chose\b/i.test(t) ||
    /solve a non-trivial problem in\b/i.test(t) ||
    /solve a non-trivial problem involving\b/i.test(t) ||
    /design a mini-problem that requires\b/i.test(t) ||
    /stay within this scope:\b/i.test(t)
  );
}
