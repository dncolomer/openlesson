/**
 * Pure helpers for the block-detail Simulation drawer.
 * Seeds interactive UI for authors (what this block is designed to do)
 * and consumers (what to expect / practice probes). LLM regenerate uses
 * the same result shape.
 */

import {
  deriveBlockExampleTopics,
  normalizeContentSamplesPayload,
  type BlockExampleTopicsInput,
  type BlockExampleTopicsResult,
} from "@/lib/block-example-topics";
import {
  buildGroundedDialogueQuestion,
  buildGroundedExerciseItem,
  type PracticeItemContext,
} from "@/lib/practice-item-builders";
import {
  containsOutLoudStageDirection,
  stripOutLoudStageDirections,
} from "@/lib/prompt-workspace-context";

export type SimulationAudience = "author" | "learner";

/** Fixed Simulation quota: 3 dialogue questions + 3 solo exercises. */
export const SIMULATION_QUESTION_COUNT = 3;
export const SIMULATION_EXERCISE_COUNT = 3;

export type SimulationProbe = {
  id: string;
  question: string;
  /** Short coach cue: what a strong answer demonstrates. */
  coachCue: string;
  /**
   * Soft kind: warmup/core → dialogue-style questions; stretch → solo exercises.
   */
  difficulty: "warmup" | "core" | "stretch";
  /** Prefer explicit kind when set (LLM regenerate). */
  kind?: "question" | "exercise";
  /**
   * Compact labels for context pieces that influenced this probe
   * (e.g. "Title", "Description", "Local notes"). Omitted when unknown.
   */
  contextSources?: string[];
};

export type SimulationReadinessItem = {
  id: string;
  label: string;
  /** True when the workspace currently satisfies this check. */
  met: boolean;
  /** Author-facing fix hint when not met. */
  authorHint: string;
  /** Learner-facing framing when not met (soft). */
  learnerHint: string;
};

export type BlockSimulationResult = {
  /** One-line intent: what practice is designed to produce. */
  intent: string;
  /** Short outcome statement for the learner. */
  outcome: string;
  topics: string[];
  probes: SimulationProbe[];
  /** Author checklist + design signals. */
  readiness: SimulationReadinessItem[];
  /** Compact labels for modes this block supports. */
  practiceModes: string[];
};

export type BlockSimulationInput = BlockExampleTopicsInput & {
  hasLocalContext?: boolean;
  hasPlanningPrompt?: boolean;
  status?: string | null;
  isStart?: boolean | null;
  lockUntilTitles?: string[] | null;
  /** Optional file names from local context (for influence chips). */
  localFileNames?: string[] | null;
  /** Optional external source labels (for influence chips). */
  externalLabels?: string[] | null;
  /** Workspace-level grounding (same fields live Explore/Drill use). */
  workspaceGoal?: string | null;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  notes?: string | null;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function difficultyForIndex(i: number): SimulationProbe["difficulty"] {
  if (i === 0) return "warmup";
  if (i >= 4) return "stretch";
  return "core";
}

function coachCueForQuestion(question: string, title: string): string {
  const q = question.toLowerCase();
  if (q.includes("define") || q.includes("what is") || q.includes("core idea")) {
    return `A strong answer names the concept in plain language and ties it to “${title || "this block"}”.`;
  }
  if (q.includes("how would you") || q.includes("explain")) {
    return "Look for a clear structure: claim → reason → one concrete example.";
  }
  if (q.includes("evidence") || q.includes("steps") || q.includes("support")) {
    return "Success: ordered steps or evidence, not only a conclusion.";
  }
  if (q.includes("where") || q.includes("real") || q.includes("project")) {
    return "Success: a specific situation, not a generic “in practice” claim.";
  }
  return "Success: precise language, one example, and no hand-wavy gaps.";
}

/** Normalize a free-form influence label for chips (dedupe-friendly). */
export function normalizeContextInfluenceLabel(raw: unknown): string | null {
  const s = clean(raw);
  if (s.length < 2) return null;
  return clip(s, 40);
}

/**
 * Compact list of context pieces available on the block (for seed influence).
 * Order is stable for UI chips.
 */
export function collectBlockContextInfluenceLabels(
  input: BlockSimulationInput,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (label: string | null) => {
    if (!label) return;
    const k = label.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(label);
  };
  if (clean(input.title)) push("Title");
  if (clean(input.description).length >= 8) push("Description");
  if (clean(input.planningPrompt).length >= 4) push("Planning prompt");
  if (clean(input.localNotes).length >= 4) push("Local notes");
  for (const name of input.localFileNames || []) {
    const n = clean(name);
    if (n) push(clip(n, 28));
  }
  for (const ext of input.externalLabels || []) {
    const n = clean(ext);
    if (n) push(clip(`Ext: ${n}`, 32));
  }
  if (
    input.hasLocalContext &&
    !out.some((l) => /local|file|ext:/i.test(l))
  ) {
    push("Local context");
  }
  return out;
}

function pickInfluence(
  available: readonly string[],
  preferred: readonly string[],
  max = 3,
): string[] | undefined {
  if (!available.length) return undefined;
  const out: string[] = [];
  const availLower = new Map(available.map((a) => [a.toLowerCase(), a]));
  for (const p of preferred) {
    const hit = availLower.get(p.toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
    if (out.length >= max) break;
  }
  // Fill from remaining available if still empty / short
  for (const a of available) {
    if (out.length >= max) break;
    if (!out.includes(a)) out.push(a);
  }
  return out.length ? out : undefined;
}

function parseContextSources(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const label = normalizeContextInfluenceLabel(item);
    if (!label) continue;
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(label);
    if (out.length >= 4) break;
  }
  return out.length ? out : undefined;
}

export function probeKindOf(
  p: Pick<SimulationProbe, "kind" | "difficulty">,
): "question" | "exercise" {
  if (p.kind === "question" || p.kind === "exercise") return p.kind;
  return p.difficulty === "stretch" ? "exercise" : "question";
}

/** Split probes into question vs exercise lists (stable order). */
export function partitionSimulationProbes(probes: readonly SimulationProbe[]): {
  questions: SimulationProbe[];
  exercises: SimulationProbe[];
} {
  const questions: SimulationProbe[] = [];
  const exercises: SimulationProbe[] = [];
  for (const p of probes || []) {
    if (probeKindOf(p) === "exercise") exercises.push(p);
    else questions.push(p);
  }
  return { questions, exercises };
}

/**
 * Pad filler for simulation quota — same pure builders as live Explore/Drill fallbacks.
 * No "out loud" stage directions; subject-matter grounded even when thin.
 */
function synthQuestion(
  title: string,
  i: number,
  description: string,
  extra?: PracticeItemContext,
): string {
  return buildGroundedDialogueQuestion(
    {
      blockTitle: title,
      blockDescription: description,
      workspaceGoal: extra?.workspaceGoal,
      workspaceTitle: extra?.workspaceTitle,
      rootTopic: extra?.rootTopic,
      planningPrompt: extra?.planningPrompt,
      localNotes: extra?.localNotes,
      notes: extra?.notes,
      ...extra,
    },
    i,
  );
}

function synthExercise(
  title: string,
  i: number,
  description: string,
  extra?: PracticeItemContext,
): string {
  return buildGroundedExerciseItem(
    {
      blockTitle: title,
      blockDescription: description,
      workspaceGoal: extra?.workspaceGoal,
      workspaceTitle: extra?.workspaceTitle,
      rootTopic: extra?.rootTopic,
      planningPrompt: extra?.planningPrompt,
      localNotes: extra?.localNotes,
      notes: extra?.notes,
      ...extra,
    },
    i,
  );
}

function sanitizeProbeText(text: string): string {
  const t = clean(text);
  if (!t) return t;
  if (containsOutLoudStageDirection(t)) {
    return stripOutLoudStageDirections(t) || t;
  }
  return t;
}

/**
 * Enforce exactly 3 questions + 3 exercises. Pads with synthetic prompts when short;
 * trims when long. Preserves contextSources when present.
 */
export function enforceSimulationProbeQuota(
  probes: readonly SimulationProbe[],
  input: {
    title?: string | null;
    description?: string | null;
    availableInfluence?: readonly string[] | null;
    /** Optional workspace grounding shared with live Explore/Drill builders. */
    workspaceGoal?: string | null;
    workspaceTitle?: string | null;
    rootTopic?: string | null;
    planningPrompt?: string | null;
    localNotes?: string | null;
    notes?: string | null;
  },
): SimulationProbe[] {
  const title = clean(input.title) || "This block";
  const description = clean(input.description);
  const available = [...(input.availableInfluence || [])];
  const ground: PracticeItemContext = {
    blockTitle: title,
    blockDescription: description,
    workspaceGoal: input.workspaceGoal,
    workspaceTitle: input.workspaceTitle,
    rootTopic: input.rootTopic,
    planningPrompt: input.planningPrompt,
    localNotes: input.localNotes,
    notes: input.notes,
  };
  const { questions: qIn, exercises: eIn } = partitionSimulationProbes(probes);

  const questions: SimulationProbe[] = qIn.slice(0, SIMULATION_QUESTION_COUNT).map((p) => ({
    ...p,
    question: sanitizeProbeText(p.question),
  }));
  while (questions.length < SIMULATION_QUESTION_COUNT) {
    const i = questions.length;
    const question = synthQuestion(title, i, description, ground);
    questions.push({
      id: `q-${i}`,
      question,
      coachCue: coachCueForQuestion(question, title),
      difficulty: i === 0 ? "warmup" : "core",
      kind: "question",
      contextSources: pickInfluence(
        available,
        i === 0
          ? ["Title", "Description"]
          : i === 1
            ? ["Description", "Planning prompt"]
            : ["Title", "Local notes", "Local context"],
      ),
    });
  }

  const exercises: SimulationProbe[] = eIn.slice(0, SIMULATION_EXERCISE_COUNT).map((p) => ({
    ...p,
    question: sanitizeProbeText(p.question),
  }));
  while (exercises.length < SIMULATION_EXERCISE_COUNT) {
    const i = exercises.length;
    const question = synthExercise(title, i, description, ground);
    exercises.push({
      id: `ex-${i}`,
      question,
      coachCue: coachCueForQuestion(question, title),
      difficulty: "stretch",
      kind: "exercise",
      contextSources: pickInfluence(
        available,
        i === 0
          ? ["Description", "Local context", "Local notes"]
          : i === 1
            ? ["Planning prompt", "Local notes"]
            : ["Title", "Description", "Local context"],
      ),
    });
  }

  // Re-id for stable list identity
  return [
    ...questions.map((p, i) => ({
      ...p,
      id: `q-${i}`,
      kind: "question" as const,
      difficulty: (i === 0 ? "warmup" : "core") as SimulationProbe["difficulty"],
    })),
    ...exercises.map((p, i) => ({
      ...p,
      id: `ex-${i}`,
      kind: "exercise" as const,
      difficulty: "stretch" as const,
    })),
  ];
}

/**
 * Derive a full simulation snapshot from block fields (no LLM).
 * Always yields exactly 3 questions + 3 exercises with compact influence labels.
 */
export function deriveBlockSimulation(input: BlockSimulationInput): BlockSimulationResult {
  const title = clean(input.title) || "This block";
  const description = clean(input.description);
  const planning = clean(input.planningPrompt);
  const notes = clean(input.localNotes);
  const samples: BlockExampleTopicsResult = deriveBlockExampleTopics({
    title,
    description,
    planningPrompt: planning,
    localNotes: notes,
  });

  const availableInfluence = collectBlockContextInfluenceLabels(input);

  const goal = clean(input.workspaceGoal);
  const intent = description
    ? clip(`Practice demonstrating: ${description}`, 160)
    : goal
      ? clip(`Practice “${title}” toward: ${goal}`, 160)
      : `Practice the core ideas of “${title}” with concrete examples until gaps show.`;

  const outcome = description
    ? clip(
        `After this block you can explain and apply: ${description.replace(/[.!?]+$/, "")}.`,
        180,
      )
    : `After this block you can teach “${title}” to a peer with an example.`;

  // Seed probes from extracted questions + synthetic exercises, then enforce quota.
  // Sanitize any legacy stage-direction phrasing from extracted seeds.
  const seedProbes: SimulationProbe[] = samples.questions.map((question, i) => {
    const difficulty = difficultyForIndex(i);
    const q = sanitizeProbeText(question);
    return {
      id: `probe-${i}`,
      question: q,
      coachCue: coachCueForQuestion(q, title),
      difficulty,
      kind: "question" as const,
      contextSources: pickInfluence(
        availableInfluence,
        i === 0
          ? ["Title", "Description"]
          : i === 1
            ? ["Description", "Planning prompt", "Local notes"]
            : ["Title", "Local notes", "Local context"],
      ),
    };
  });

  const probes = enforceSimulationProbeQuota(seedProbes, {
    title,
    description,
    availableInfluence,
    workspaceGoal: input.workspaceGoal,
    workspaceTitle: input.workspaceTitle,
    rootTopic: input.rootTopic,
    planningPrompt: planning,
    localNotes: notes,
    notes: input.notes,
  });

  const hasDescription = description.length >= 12;
  const hasLocal = Boolean(input.hasLocalContext || notes);
  const hasPlanning = Boolean(input.hasPlanningPrompt || planning);
  const locked =
    Array.isArray(input.lockUntilTitles) && input.lockUntilTitles.length > 0;

  const readiness: SimulationReadinessItem[] = [
    {
      id: "description",
      label: "Clear learning target",
      met: hasDescription,
      authorHint: "Add a 1–2 sentence description so practice has a target.",
      learnerHint: "The goal for this block is still light — lean on the title.",
    },
    {
      id: "local_context",
      label: "Local materials attached",
      met: hasLocal,
      authorHint: "Attach notes/files so probes use your domain substance.",
      learnerHint: "Prompts may use workspace-wide context only.",
    },
    {
      id: "planning",
      label: "Session customization",
      met: hasPlanning,
      authorHint: "Optional planning prompt steers Explore/Drill launches.",
      learnerHint: "You can still launch; no custom session brief yet.",
    },
    {
      id: "probes",
      label: "Practice probes ready",
      met: probes.length === SIMULATION_QUESTION_COUNT + SIMULATION_EXERCISE_COUNT,
      authorHint: "Regenerate simulation after editing the block.",
      learnerHint: "Probes appear once the block has enough substance.",
    },
    {
      id: "unlock",
      label: locked ? "Prerequisites declared" : "No lock gate",
      met: true,
      authorHint: locked
        ? `Locked until: ${input.lockUntilTitles!.join(", ")}`
        : "Open to learners (no lock-until rules).",
      learnerHint: locked
        ? `Complete first: ${input.lockUntilTitles!.join(", ")}`
        : "Available when you open it.",
    },
  ];

  const practiceModes = ["Explore (dialogue)", "Drill (solo exercise)"];
  if (input.isStart) practiceModes.unshift("Start block");

  return {
    intent,
    outcome,
    topics: samples.topics,
    probes,
    readiness,
    practiceModes,
  };
}

/** Normalize LLM payload into a simulation (falls back to empty probes). */
export function normalizeSimulationPayload(
  raw: unknown,
  fallback?: BlockSimulationInput,
): BlockSimulationResult {
  const base = fallback
    ? deriveBlockSimulation(fallback)
    : {
        intent: "",
        outcome: "",
        topics: [] as string[],
        probes: [] as SimulationProbe[],
        readiness: [] as SimulationReadinessItem[],
        practiceModes: ["Explore (dialogue)", "Drill (solo exercise)"],
      };

  if (!raw || typeof raw !== "object") return base;
  const rec = raw as Record<string, unknown>;

  const samples = normalizeContentSamplesPayload(raw);
  const intent =
    clean(rec.intent || rec.designed_to || rec.summary) || base.intent;
  const outcome = clean(rec.outcome || rec.you_will_be_able_to) || base.outcome;
  const availableInfluence = fallback
    ? collectBlockContextInfluenceLabels(fallback)
    : [];

  let probes: SimulationProbe[] = [];
  if (Array.isArray(rec.probes)) {
    const parsed: SimulationProbe[] = [];
    rec.probes.forEach((p, i) => {
      if (!p || typeof p !== "object") return;
      const pr = p as Record<string, unknown>;
      const question = sanitizeProbeText(clean(pr.question || pr.prompt || pr.text));
      if (question.length < 8) return;
      const diffRaw = clean(pr.difficulty).toLowerCase();
      const difficulty: SimulationProbe["difficulty"] =
        diffRaw === "warmup" || diffRaw === "core" || diffRaw === "stretch"
          ? (diffRaw as SimulationProbe["difficulty"])
          : difficultyForIndex(i);
      const kindRaw = clean(pr.kind || pr.type).toLowerCase();
      const kind: "question" | "exercise" =
        kindRaw === "exercise" || kindRaw === "question"
          ? kindRaw
          : difficulty === "stretch"
            ? "exercise"
            : "question";
      const contextSources =
        parseContextSources(
          pr.contextSources || pr.context_sources || pr.influences || pr.sources,
        ) || undefined;
      parsed.push({
        id: `probe-${i}`,
        question,
        coachCue:
          clean(pr.coachCue || pr.coach_cue || pr.success || pr.cue) ||
          coachCueForQuestion(question, clean(fallback?.title) || "this block"),
        difficulty,
        kind,
        contextSources,
      });
    });
    probes = parsed;
  }

  if (probes.length === 0 && samples.questions.length > 0) {
    const title = clean(fallback?.title) || "this block";
    probes = samples.questions.map((question, i) => {
      const difficulty = difficultyForIndex(i);
      const q = sanitizeProbeText(question);
      return {
        id: `probe-${i}`,
        question: q,
        coachCue: coachCueForQuestion(q, title),
        difficulty,
        kind: "question" as const,
        contextSources: pickInfluence(availableInfluence, ["Title", "Description"]),
      };
    });
  }

  // Optional dedicated exercise list — only fills when we lack exercises.
  // Prefer probe exercises (with contextSources) over string exercises[].
  {
    const existingEx = probes.filter((p) => probeKindOf(p) === "exercise");
    if (
      existingEx.length < SIMULATION_EXERCISE_COUNT &&
      Array.isArray(rec.exercises)
    ) {
      const title = clean(fallback?.title) || "this block";
      const fromEx: SimulationProbe[] = [];
      rec.exercises.forEach((ex, i) => {
        const question = sanitizeProbeText(
          typeof ex === "string"
            ? clean(ex)
            : ex && typeof ex === "object"
              ? clean(
                  (ex as Record<string, unknown>).question ||
                    (ex as Record<string, unknown>).text,
                )
              : "",
        );
        if (question.length < 8) return;
        const contextSources =
          ex && typeof ex === "object"
            ? parseContextSources(
                (ex as Record<string, unknown>).contextSources ||
                  (ex as Record<string, unknown>).context_sources ||
                  (ex as Record<string, unknown>).influences,
              )
            : undefined;
        fromEx.push({
          id: `ex-raw-${i}`,
          question,
          coachCue: coachCueForQuestion(question, title),
          difficulty: "stretch",
          kind: "exercise",
          contextSources,
        });
      });
      if (fromEx.length) {
        const qs = probes.filter((p) => probeKindOf(p) !== "exercise");
        probes = [...qs, ...existingEx, ...fromEx];
      }
    }
  }

  // Optional dedicated questions array — only fills when we lack questions
  // (do not overwrite probes that already carry contextSources).
  {
    const existingQ = probes.filter((p) => probeKindOf(p) === "question");
    if (existingQ.length < SIMULATION_QUESTION_COUNT && Array.isArray(rec.questions)) {
      const title = clean(fallback?.title) || "this block";
      const fromQ: SimulationProbe[] = [];
      rec.questions.forEach((q, i) => {
        const question = sanitizeProbeText(
          typeof q === "string"
            ? clean(q)
            : q && typeof q === "object"
              ? clean(
                  (q as Record<string, unknown>).question ||
                    (q as Record<string, unknown>).text,
                )
              : "",
        );
        if (question.length < 8) return;
        const contextSources =
          q && typeof q === "object"
            ? parseContextSources(
                (q as Record<string, unknown>).contextSources ||
                  (q as Record<string, unknown>).context_sources,
              )
            : undefined;
        fromQ.push({
          id: `q-raw-${i}`,
          question,
          coachCue: coachCueForQuestion(question, title),
          difficulty: difficultyForIndex(i),
          kind: "question",
          contextSources,
        });
      });
      if (fromQ.length) {
        const ex = probes.filter((p) => probeKindOf(p) === "exercise");
        probes = [...existingQ, ...fromQ, ...ex];
      }
    }
  }

  const topics =
    samples.topics.length > 0
      ? samples.topics
      : Array.isArray(rec.topics)
        ? samples.topics
        : base.topics;

  const enforced = enforceSimulationProbeQuota(
    probes.length ? probes : base.probes,
    {
      title: fallback?.title || "This block",
      description: fallback?.description,
      availableInfluence,
      workspaceGoal: fallback?.workspaceGoal,
      workspaceTitle: fallback?.workspaceTitle,
      rootTopic: fallback?.rootTopic,
      planningPrompt: fallback?.planningPrompt,
      localNotes: fallback?.localNotes,
      notes: fallback?.notes,
    },
  );

  return {
    intent: intent || base.intent,
    outcome: outcome || base.outcome,
    topics: topics.length ? topics : base.topics,
    probes: enforced,
    readiness: base.readiness,
    practiceModes: base.practiceModes,
  };
}

export function simulationDifficultyLabel(
  d: SimulationProbe["difficulty"],
): string {
  switch (d) {
    case "warmup":
      return "Warm-up";
    case "stretch":
      return "Stretch";
    default:
      return "Core";
  }
}

/** Count of readiness items that are currently met (for progress chrome). */
export function simulationReadinessScore(
  readiness: readonly SimulationReadinessItem[],
): { met: number; total: number } {
  const total = readiness.length;
  const met = readiness.filter((r) => r.met).length;
  return { met, total };
}
