/**
 * Pure TAPBench exercise quality helpers (client-safe — no xAI / Node deps).
 */

export interface TapbenchExerciseContext {
  blockTitle?: string | null;
  blockDescription?: string | null;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  rootTopic?: string | null;
  exerciseText?: string | null;
}

/** Who / which product surface the exercise is for. */
export type DomainExerciseSurface = "tapbench" | "tap_exercise" | "ile_project";

function surfaceLabel(surface: DomainExerciseSurface): string {
  switch (surface) {
    case "tap_exercise":
      return "human TAP timed drill";
    case "ile_project":
      return "ILE Project Mode chapter exercise";
    default:
      return "TAPBench agent evaluation";
  }
}

/**
 * Shared domain-exercise author system prompt (live Drill + Simulation samples).
 * Pure string — safe for client and server.
 */
export function buildDomainExerciseAuthorSystemPrompt(
  surface: DomainExerciseSurface = "tapbench",
): string {
  const who =
    surface === "tapbench"
      ? "an AI agent under timed evaluation"
      : surface === "ile_project"
        ? "a human learner working a longer-horizon project chapter"
        : "a human learner in a timed TAP drill (solo exercise, no tutor dialogue)";

  const lengthHint =
    surface === "ile_project"
      ? "Length: roughly 80–280 words (chapter-scale, still finishable in one sitting)."
      : "Length: roughly 60–220 words.";

  return [
    `You are the exercise author for ${surfaceLabel(surface)}.`,
    `Write ONE self-contained exercise for ${who}.`,
    "",
    "Hard requirements:",
    "- Produce a concrete problem with clear success criteria (a correct answer, artifact, or checkable reasoning).",
    "- Prefer a single well-scoped problem, or multi-part A/B with explicit subparts.",
    "- Include any numbers, data, constraints, or definitions needed inside the exercise text.",
    "- Difficulty should match the domain: not trivia definitions, not multi-hour research.",
    "- Ground the exercise in the workspace goal and block/subject materials when provided — never generic meta-learning tasks.",
    "- Do NOT restate the topic list or syllabus blurb as the task.",
    '- Do NOT open with "Using what you know about…", "Complete this task:", or "Demonstrate your understanding…".',
    "- Do NOT ask the learner/agent to think aloud or speak out loud.",
    '- Start the response with "Exercise: " then the problem only (no preamble, no markdown fences).',
    lengthHint,
  ].join("\n");
}

/** @deprecated use buildDomainExerciseAuthorSystemPrompt */
export function buildTapbenchExerciseAuthorSystemPrompt(): string {
  return buildDomainExerciseAuthorSystemPrompt("tapbench");
}

const BANNED_OPENERS = [
  /^using what you know about\b/i,
  /^complete this task:\s*/i,
  /^demonstrate your understanding of\b/i,
  /^teach me\b/i,
  /^work through\s+["“']/i,
];

/**
 * Topic catalogs / syllabus blurbs (not tasks), e.g.
 * "Integers, modular arithmetic, combinatorics, and graph theory."
 */
export function looksLikeTopicOverview(text: string | null | undefined): boolean {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (t.length > 400) return false;
  // Imperative / problem cues → treat as task substance, not overview.
  if (
    /\b(prove|show that|compute|calculate|find|solve|design|implement|derive|construct|determine|evaluate|simplify|expand|factor|integrate|differentiate|write|debug|compare|optimize)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/\?/.test(t)) return false;
  const commaParts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const hasFiniteVerb = /\b(is|are|was|were|has|have|does|do|can|should|must|will|involves|covers|includes)\b/i.test(
      t,
    );
    if (!hasFiniteVerb) return true;
    if (/^[A-Z][^.]{0,200},\s+[^.]+\band\b/i.test(t) && !/\.\s+[A-Z]/.test(t)) {
      return true;
    }
  }
  return false;
}

/** Reject low-quality output that restates scope instead of posing a problem. */
export function isLowQualityTapbenchExercise(
  exercise: string,
  input: Pick<TapbenchExerciseContext, "blockTitle" | "blockDescription" | "workspaceTitle">,
): boolean {
  const t = exercise.replace(/\s+/g, " ").trim();
  if (t.length < 40) return true;
  const body = t.replace(/^exercise\s*:\s*/i, "").trim();
  for (const re of BANNED_OPENERS) {
    if (re.test(body)) return true;
  }
  if (/\bState assumptions, work the solution, and note where you are uncertain\b/i.test(t)) {
    return true;
  }
  const desc = (input.blockDescription || "").replace(/\s+/g, " ").trim();
  if (desc && desc.length >= 20) {
    if (body.toLowerCase().includes(desc.toLowerCase()) && body.length < desc.length + 80) {
      return true;
    }
  }
  if (looksLikeTopicOverview(body)) return true;
  const hasTaskCue =
    /\b(prove|show|compute|calculate|find|solve|design|implement|derive|construct|determine|evaluate|simplify|write|debug|compare|optimize|given|suppose|let |consider|for each|how many|what is|which|explain why|provide|construct|model|non-trivial problem|intermediate steps|box a final)\b/i.test(
      body,
    ) ||
    /\?/.test(body) ||
    /\b(part\s*[a-d]|step\s*\d|\(\s*a\s*\))/i.test(body) ||
    /\d/.test(body);
  if (!hasTaskCue) return true;
  return false;
}

export function ensureExercisePrefix(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  if (/^exercise\s*:/i.test(clean)) {
    return clean.replace(/^(exercise\s*:\s*)+/i, "Exercise: ");
  }
  return `Exercise: ${clean}`;
}

/**
 * Improved pure fallback when LLM is unavailable — still better than pasting a topic list.
 */
export function buildTapbenchExerciseFallback(input: TapbenchExerciseContext): string {
  const title = (input.blockTitle || input.workspaceTitle || "this material").trim();
  const desc = (input.blockDescription || "").replace(/\s+/g, " ").trim();
  const goal = (input.workspaceGoal || "").replace(/\s+/g, " ").trim();

  const explicit = (input.exerciseText || "").replace(/\s+/g, " ").trim();
  if (
    explicit &&
    !isLowQualityTapbenchExercise(explicit, input) &&
    !looksLikeTopicOverview(explicit)
  ) {
    return ensureExercisePrefix(explicit.replace(/^exercise\s*:\s*/i, ""));
  }

  if (
    desc &&
    !looksLikeTopicOverview(desc) &&
    /^(design|implement|debug|compare|explain|derive|prove|build|analyze|write|calculate|model|solve|find|show|compute)\b/i.test(
      desc,
    )
  ) {
    const titled =
      title &&
      title !== "this material" &&
      !new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(desc)
        ? `${desc} (topic: ${title})`
        : desc;
    return ensureExercisePrefix(titled);
  }

  const scope =
    desc && looksLikeTopicOverview(desc)
      ? desc.replace(/\.$/, "")
      : desc || goal || title;

  return ensureExercisePrefix(
    [
      `Solve a non-trivial problem in ${title}.`,
      scope && scope !== title ? `Stay within this scope: ${scope}.` : null,
      `State the problem you chose in one sentence (it must require calculation, proof, construction, or multi-step reasoning — not a definition list).`,
      `Then: (1) list assumptions, (2) work the full solution with intermediate steps, (3) box a final answer or conclusion, (4) note one edge case or failure mode.`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
