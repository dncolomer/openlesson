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

export type SimulationAudience = "author" | "learner";

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

/**
 * Derive a full simulation snapshot from block fields (no LLM).
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

  const intent = description
    ? clip(`Practice demonstrating: ${description}`, 160)
    : `Practice the core ideas of “${title}” out loud until the gaps show.`;

  const outcome = description
    ? clip(
        `After this block you can explain and apply: ${description.replace(/[.!?]+$/, "")}.`,
        180,
      )
    : `After this block you can teach “${title}” to a peer with an example.`;

  const probes: SimulationProbe[] = samples.questions.map((question, i) => {
    const difficulty = difficultyForIndex(i);
    return {
      id: `probe-${i}`,
      question,
      coachCue: coachCueForQuestion(question, title),
      difficulty,
      kind: difficulty === "stretch" ? "exercise" : "question",
    };
  });
  // Ensure at least one exercise-style prompt when we only have questions.
  if (probes.length > 0 && !probes.some((p) => p.kind === "exercise") && title) {
    probes.push({
      id: `probe-ex-${probes.length}`,
      question: `Complete a short exercise on “${title}”: outline the steps or solution out loud.`,
      coachCue: "Success: ordered steps and a check that the answer fits the problem.",
      difficulty: "stretch",
      kind: "exercise",
    });
  }

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
      met: probes.length > 0,
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

  let probes: SimulationProbe[] = [];
  if (Array.isArray(rec.probes)) {
    const parsed: SimulationProbe[] = [];
    rec.probes.forEach((p, i) => {
      if (!p || typeof p !== "object") return;
      const pr = p as Record<string, unknown>;
      const question = clean(pr.question || pr.prompt || pr.text);
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
      parsed.push({
        id: `probe-${i}`,
        question,
        coachCue:
          clean(pr.coachCue || pr.coach_cue || pr.success || pr.cue) ||
          coachCueForQuestion(question, clean(fallback?.title) || "this block"),
        difficulty,
        kind,
      });
    });
    probes = parsed.slice(0, 8);
  }

  if (probes.length === 0 && samples.questions.length > 0) {
    const title = clean(fallback?.title) || "this block";
    probes = samples.questions.map((question, i) => {
      const difficulty = difficultyForIndex(i);
      return {
        id: `probe-${i}`,
        question,
        coachCue: coachCueForQuestion(question, title),
        difficulty,
        kind: difficulty === "stretch" ? ("exercise" as const) : ("question" as const),
      };
    });
  }

  // Optional dedicated exercise list from the model
  if (Array.isArray(rec.exercises)) {
    const title = clean(fallback?.title) || "this block";
    const fromEx: SimulationProbe[] = [];
    rec.exercises.forEach((ex, i) => {
      const question =
        typeof ex === "string"
          ? clean(ex)
          : ex && typeof ex === "object"
            ? clean(
                (ex as Record<string, unknown>).question ||
                  (ex as Record<string, unknown>).text,
              )
            : "";
      if (question.length < 8) return;
      fromEx.push({
        id: `ex-${i}`,
        question,
        coachCue: coachCueForQuestion(question, title),
        difficulty: "stretch",
        kind: "exercise",
      });
    });
    // Prefer explicit exercises over stretch-tagged probes when provided
    if (fromEx.length) {
      const qs = probes.filter((p) => p.kind !== "exercise");
      probes = [...qs, ...fromEx].slice(0, 10);
    }
  }

  const topics =
    samples.topics.length > 0
      ? samples.topics
      : Array.isArray(rec.topics)
        ? samples.topics
        : base.topics;

  return {
    intent: intent || base.intent,
    outcome: outcome || base.outcome,
    topics: topics.length ? topics : base.topics,
    probes: probes.length ? probes : base.probes,
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
