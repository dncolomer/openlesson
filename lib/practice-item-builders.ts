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

export type PracticeExternalLink = {
  title?: string | null;
  url?: string | null;
  description?: string | null;
};

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
  /** Workspace + block-local files (names and optional excerpts). */
  files?: Array<{ name: string; excerpt?: string | null }> | null;
  /**
   * External resource / link attachments (title, URL, description).
   * Used when block or workspace materials include linked sources.
   */
  externalLinks?: PracticeExternalLink[] | null;
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

/**
 * True when attached files/links carry concrete body (excerpt or link description),
 * not only bare filenames. Used to prefer materials over map-card descriptions.
 */
export function practiceMaterialsAreRich(ctx: PracticeItemContext): boolean {
  for (const f of ctx.files || []) {
    if (clean(f?.excerpt).length >= 8) return true;
    // Bare name still counts as a link/material attachment for grounding labels
    if (clean(f?.name).length >= 3) return true;
  }
  for (const link of ctx.externalLinks || []) {
    if (clean(link?.description).length >= 8) return true;
    if (clean(link?.title).length >= 2) return true;
    if (clean(link?.url).length >= 8) return true;
  }
  return false;
}

/**
 * Material snippets from files + external links (names, excerpts, titles, URLs).
 * Short attachment labels come first so they survive prompt clipping; excerpts follow.
 */
export function practiceMaterialSubstance(ctx: PracticeItemContext): string {
  const labels: string[] = [];
  const bodies: string[] = [];
  for (const f of ctx.files || []) {
    const name = clean(f?.name);
    const excerpt = clean(f?.excerpt);
    if (name) labels.push(name);
    if (excerpt) {
      bodies.push(clip(`${name ? `${name}: ` : ""}${excerpt}`, 180));
    } else if (name) {
      bodies.push(`material “${name}”`);
    }
  }
  for (const link of ctx.externalLinks || []) {
    const title = clean(link?.title);
    const desc = clean(link?.description);
    const url = clean(link?.url);
    if (title) labels.push(title);
    else if (url) labels.push(clip(url, 40));
    if (desc) {
      bodies.push(clip(`${title || url || "link"}: ${desc}`, 160));
    } else if (title && url) {
      bodies.push(`source “${title}” (${clip(url, 60)})`);
    } else if (title) {
      bodies.push(`source “${title}”`);
    } else if (url) {
      bodies.push(`source ${clip(url, 80)}`);
    }
  }
  // Dedupe labels while preserving order
  const seen = new Set<string>();
  const uniqueLabels: string[] = [];
  for (const l of labels) {
    const k = l.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueLabels.push(l);
  }
  const head = uniqueLabels.length
    ? `attachments: ${uniqueLabels.slice(0, 6).join(", ")}`
    : "";
  return [head, ...bodies].filter(Boolean).join(" · ");
}

/**
 * Best domain substance string for grounding.
 * - Attached materials/links win when present (simulation quality).
 * - Otherwise preserve TAP opening order: description → local notes → goal
 *   so Simulation matches live `buildTapOpeningQuestionFallback` when no files/links.
 */
export function practiceDomainSubstance(ctx: PracticeItemContext): string {
  const materials = practiceMaterialSubstance(ctx);
  const localNotes = clean(ctx.localNotes);
  const desc = clean(ctx.blockDescription);
  const chapter = clean(ctx.chapterDescription);
  const goal = clean(ctx.workspaceGoal);
  const wsDesc = clean(ctx.workspaceDescription);
  const planning = clean(ctx.planningPrompt);
  const notes = clean(ctx.notes);

  // 1) Rich materials (excerpts / link bodies / attachment names) first
  if (materials && practiceMaterialsAreRich(ctx)) return materials;
  // 2) Non-overview description / chapter (TAP opening parity — before localNotes)
  if (desc && !looksLikeTopicOverview(desc)) return desc;
  if (chapter && !looksLikeTopicOverview(chapter)) return chapter;
  // 3) Local notes (block-level author substance)
  if (localNotes.length >= 8) return localNotes;
  // 4) Materials even if only filenames (still better than nothing)
  if (materials) return materials;
  // 5) Workspace goal / notes / planning
  if (goal) return goal;
  if (notes) return notes;
  if (planning) return planning;
  if (wsDesc) return wsDesc;
  if (desc) return desc;
  if (chapter) return chapter;
  return "";
}

/** All non-empty substance layers joined (for tests / rich fixtures). */
export function practiceAllSubstanceLayers(ctx: PracticeItemContext): string {
  const materials = practiceMaterialSubstance(ctx);
  return [
    clean(ctx.blockDescription),
    clean(ctx.localNotes),
    materials,
    clean(ctx.workspaceGoal),
    clean(ctx.workspaceDescription),
    clean(ctx.planningPrompt),
    clean(ctx.notes),
    clean(ctx.workspaceTitle),
    clean(ctx.rootTopic),
  ]
    .filter(Boolean)
    .join(" · ");
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
  const materials = practiceMaterialSubstance(ctx);
  const goal = clean(ctx.workspaceGoal);
  const notes = clean(ctx.notes);
  const planning = clean(ctx.planningPrompt);
  const i = ((index % 3) + 3) % 3;

  // Materials when rich; otherwise substance (description before localNotes for TAP parity).
  // Do NOT insert bare localNotes ahead of a workable description.
  const workRaw =
    materials && practiceMaterialsAreRich(ctx)
      ? materials
      : substance && !looksLikeTopicOverview(substance)
        ? substance
        : materials || substance;
  const work = workRaw ? clip(workRaw, 140) : "";

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
  // Prefer goal/notes over pure title-only icebreakers when available.
  if (i === 0) {
    if (goal) {
      return `Give one concrete numerical or situational example of “${subject}” that matters for “${clip(goal, 80)}”, and state the key intermediate result.`;
    }
    if (notes) {
      return `From the workspace notes (“${clip(notes, 80)}”), give one concrete instance of “${subject}” and the first checkable intermediate result.`;
    }
    return `Give one concrete example of “${subject}” with specific numbers or a named situation — what is the key intermediate result?`;
  }
  if (i === 1) {
    return planning
      ? `When ${clip(planning, 90)}, apply “${subject}” once. What goes wrong first if a key assumption is inverted?`
      : goal
        ? `While advancing “${clip(goal, 70)}”, what breaks if you apply “${subject}” with the wrong assumption? Name the failure and the first catch signal.`
        : `What breaks if you apply “${subject}” with the wrong assumption? Name the failure and the first check that would catch it.`;
  }
  return goal
    ? `Name one calculation or decision in “${subject}” that moves you toward “${clip(goal, 80)}”, and the evidence that shows you got it right.`
    : notes
      ? `Using workspace notes (“${clip(notes, 70)}”), where would you use “${subject}” and what is the first checkable output?`
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
  const materials = practiceMaterialSubstance(ctx);
  const substance = practiceDomainSubstance(ctx);
  const goal = clean(ctx.workspaceGoal);
  const localNotes = clean(ctx.localNotes);
  const i = ((index % 3) + 3) % 3;

  // Materials first when present; otherwise substance (description-first TAP order).
  const domainBlurb =
    (
      materials && practiceMaterialsAreRich(ctx)
        ? [materials, substance, clean(ctx.blockDescription), localNotes]
        : [substance, clean(ctx.blockDescription), localNotes, materials]
    )
      .filter(Boolean)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .join(" — ") || null;

  const base: TapbenchExerciseContext = {
    blockTitle: clean(ctx.blockTitle) || subject,
    blockDescription: domainBlurb,
    workspaceTitle: clean(ctx.workspaceTitle) || clean(ctx.rootTopic) || null,
    workspaceGoal: goal || clean(ctx.notes) || null,
    rootTopic: clean(ctx.rootTopic) || null,
  };

  // Shared concrete-domain builder (seeded by index for variation).
  // When materials exist, prefix so the exercise text always cites attachments.
  const core = buildTapbenchExerciseFallback(base, i);
  if (materials && practiceMaterialsAreRich(ctx)) {
    const cite = clip(materials, 100);
    // Avoid double-prefix if the concrete builder already embedded the material text
    if (core.toLowerCase().includes(cite.slice(0, 24).toLowerCase())) {
      return core;
    }
    return `Using attached materials (${cite}): ${core}`;
  }
  return core;
}

/** Convert practice context into assemblePromptWorkspaceContext input. */
export function practiceContextToPromptInput(
  ctx: PracticeItemContext,
  extra?: Partial<PromptWorkspaceContextInput>,
): PromptWorkspaceContextInput {
  const base: PromptWorkspaceContextInput = {
    workspaceTitle: ctx.workspaceTitle,
    rootTopic: ctx.rootTopic,
    workspaceGoal: ctx.workspaceGoal,
    workspaceDescription: ctx.workspaceDescription,
    notes: ctx.notes,
    blockTitle: ctx.blockTitle,
    blockDescription: ctx.blockDescription,
    chapterDescription: ctx.chapterDescription,
    files: ctx.files,
    externalResources: ctx.externalLinks,
    blockLocalContext: ctx.localNotes
      ? { notes: ctx.localNotes }
      : undefined,
  };
  if (!extra) return base;
  return {
    ...base,
    ...extra,
    // Prefer richer merge: extra wins when set; keep files/links from ctx if extra omits
    files: extra.files ?? ctx.files,
    externalResources: extra.externalResources ?? ctx.externalLinks,
    blockLocalContext:
      extra.blockLocalContext ??
      (ctx.localNotes ? { notes: ctx.localNotes } : undefined),
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
    blockLocalContext?: PromptWorkspaceContextInput["blockLocalContext"];
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

  // Prefer full local_context when inventory carries it for the focused block.
  let blockLocalContext = ctx.blockLocalContext;
  if (!blockLocalContext && !isWorkspaceScope && ctx.focusedBlockId) {
    const focused = (ctx.blocks || []).find((b) => b.id === ctx.focusedBlockId);
    if (focused?.local_context) blockLocalContext = focused.local_context;
  }
  if (!blockLocalContext && !isWorkspaceScope && ctx.localNotes) {
    blockLocalContext = { notes: ctx.localNotes };
  }

  const assembled = assemblePromptWorkspaceContext(
    practiceContextToPromptInput(ctx, {
      blocks: ctx.blocks,
      focusedBlockId: isWorkspaceScope ? null : ctx.focusedBlockId,
      unusableCells: ctx.unusableCells,
      blockLocalContext: isWorkspaceScope ? undefined : blockLocalContext,
      files: ctx.files,
      externalResources: ctx.externalLinks,
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
