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
 * Index varies angle: core mechanism → failure mode → concrete application.
 * Never meta ("how would you approach learning") or stage directions.
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

  if (substance && !looksLikeTopicOverview(substance)) {
    if (i === 0) {
      return `What is the core mechanism in “${subject}” — specifically: ${clip(substance, 140)} — and how would you explain it precisely?`;
    }
    if (i === 1) {
      return `Given “${clip(substance, 120)}”, what would break or go wrong if someone applied “${subject}” incorrectly?`;
    }
    return goal
      ? `Walk through one concrete example of “${subject}” that advances “${clip(goal, 80)}”. What evidence shows you got it right?`
      : `Walk through one concrete example of “${subject}” using: ${clip(substance, 120)}. What would you check to know you are correct?`;
  }

  // Thin / guest-like context: still subject-matter, never meta-learning fluff.
  if (i === 0) {
    return goal
      ? `What is the central claim of “${subject}” that matters for “${clip(goal, 90)}”, and how would you state it precisely?`
      : `What is the central claim of “${subject}” that someone studying this subject must not get wrong?`;
  }
  if (i === 1) {
    return planning
      ? `How does “${subject}” show up when ${clip(planning, 100)}? Name the mechanism, not a study strategy.`
      : `Give one concrete example of “${subject}” in practice, and what misapplication would look like.`;
  }
  return goal
    ? `How does mastering “${subject}” move you toward “${clip(goal, 90)}”? Point at a specific decision or result.`
    : `Where does “${subject}” connect to a real problem or decision, and what would you check first?`;
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
    "CRITICAL for exercises:",
    "- Each exercise MUST be a fixed, fully-specified problem with concrete numbers/data/constraints inside the text.",
    "- The learner must NOT invent, choose, or design their own problem — never say \"state the problem you chose\", \"solve a non-trivial problem in <topic>\", or \"stay within this scope\" + invent.",
    "- Prefer equations, data tables, parameters, or explicit scenarios the learner solves step-by-step.",
    "",
    "OUTPUT: JSON only with:",
    '{ "topics": string[], "questions": string[3], "exercises": string[3], "probes": [{ "question": string, "kind": "question"|"exercise", "difficulty": "warmup"|"core"|"stretch", "contextSources": string[] }] }',
    "Exactly 3 questions and 3 exercises (probes preferred: 3 question + 3 exercise).",
    "Never use say/talk/think out loud stage directions. Never meta-learning icebreakers.",
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

/** True if text is a banned meta-learning / icebreaker pattern. */
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
    // Invent-your-own exercise templates (meta drill framing)
    /state the problem you chose\b/i.test(t) ||
    /solve a non-trivial problem in\b/i.test(t) ||
    /solve a non-trivial problem involving\b/i.test(t) ||
    /design a mini-problem that requires\b/i.test(t) ||
    /stay within this scope:\b/i.test(t)
  );
}
