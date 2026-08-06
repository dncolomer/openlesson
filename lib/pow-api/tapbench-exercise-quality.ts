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
    "- The problem must be fully specified: the learner solves YOUR problem — they must NOT invent, choose, or design their own problem.",
    '- FORBIDDEN phrases: "Solve a non-trivial problem in…", "State the problem you chose", "Stay within this scope", "Design a mini-problem", "Apply X to a concrete case" without giving the case.',
    "- Difficulty should match the domain: not trivia definitions, not multi-hour research.",
    "- Ground the exercise in the workspace goal and block/subject materials when provided — never generic meta-learning tasks.",
    "- Do NOT restate the topic list or syllabus blurb as the task.",
    '- Do NOT open with "Using what you know about…", "Complete this task:", or "Demonstrate your understanding…".',
    '- Do NOT write "What is the core mechanism in…", "how would you explain it precisely", or paste an "Explore how…" blurb as the problem.',
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
  // Syllabus / survey blurbs often open with "Explore how…" without posing a problem.
  if (/^explore how\b/i.test(t) && !/\b(prove|compute|calculate|find|solve|given)\b/i.test(t)) {
    return true;
  }
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

/**
 * Meta invent-your-own templates — learner is told to invent a problem instead
 * of receiving a fixed, checkable one. Always reject.
 */
export function isInventYourOwnExerciseMeta(text: string | null | undefined): boolean {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return (
    /\bstate the problem you chose\b/i.test(t) ||
    /\bsolve a non-trivial problem in\b/i.test(t) ||
    /\bsolve a non-trivial problem involving\b/i.test(t) ||
    /\bdesign a mini-problem that requires\b/i.test(t) ||
    /\bthe problem you (chose|pick|invent|create|select)\b/i.test(t) ||
    /\bchoose (your|a) (problem|equation|example)\b/i.test(t) ||
    /\bstay within this scope:\b/i.test(t) ||
    /\bapply .+ to a concrete case\b/i.test(t)
  );
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
  if (isInventYourOwnExerciseMeta(t)) return true;
  const desc = (input.blockDescription || "").replace(/\s+/g, " ").trim();
  if (desc && desc.length >= 20) {
    if (body.toLowerCase().includes(desc.toLowerCase()) && body.length < desc.length + 80) {
      return true;
    }
  }
  if (looksLikeTopicOverview(body)) return true;
  // Require a real task cue — numbers, question, or imperative problem verb.
  // "non-trivial problem" alone is meta, not a task.
  const hasTaskCue =
    /\b(prove|show that|compute|calculate|find|solve for|design|implement|derive|construct|determine|evaluate|simplify|expand|factor|write|debug|compare|optimize|given|suppose|let |consider|for each|how many|what is|which|explain why|provide|model)\b/i.test(
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

/** Deterministic non-crypto seed from title/desc (for stable concrete numbers). */
export function exerciseSeedFromContext(
  input: Pick<TapbenchExerciseContext, "blockTitle" | "blockDescription" | "workspaceTitle">,
  index = 0,
): number {
  const s = `${input.blockTitle || ""}|${input.blockDescription || ""}|${input.workspaceTitle || ""}|${index}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function clipScope(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Parse decimal rate from free text (supports 0.9, 90%, 90 percent). */
function parseRateToken(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/%/g, ""));
  if (!Number.isFinite(n)) return null;
  if (t.includes("%") || n > 1) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

/**
 * Pull diagnostic-test parameters from attached material / description text
 * so pure exercises reuse lab-panel numbers instead of only canned defaults.
 */
export function extractDiagnosticRatesFromText(text: string): {
  sens: number | null;
  spec: number | null;
  prev: number | null;
  population: number | null;
  diseased: number | null;
} {
  const s = String(text || "");
  const sensM =
    s.match(/sensitivity\s*(?:is\s*|=\s*)?(\d+(?:\.\d+)?)\s*%?/i) ||
    s.match(/(\d+(?:\.\d+)?)\s*%?\s*sensitivity/i);
  const specM =
    s.match(/specificity\s*(?:is\s*|=\s*)?(\d+(?:\.\d+)?)\s*%?/i) ||
    s.match(/(\d+(?:\.\d+)?)\s*%?\s*specificity/i);
  const prevM =
    s.match(/prevalence\s*(?:is\s*|=\s*|of\s*)?(\d+(?:\.\d+)?)\s*%?/i) ||
    s.match(/(\d+(?:\.\d+)?)\s*%\s*prevalence/i) ||
    s.match(/has\s+(\d+(?:\.\d+)?)\s*%\s*prevalence/i);
  const popM =
    s.match(/\bN\s*=\s*(\d{2,7})\b/i) ||
    s.match(/\b(\d{3,7})\s+patients?\b/i);
  const disM =
    s.match(/diseased\s*=\s*(\d+)/i) ||
    s.match(/\b(\d+)\s+diseased\b/i);
  return {
    sens: parseRateToken(sensM?.[1]),
    spec: parseRateToken(specM?.[1]),
    prev: parseRateToken(prevM?.[1]),
    population: popM?.[1] ? Number(popM[1]) : null,
    diseased: disM?.[1] ? Number(disM[1]) : null,
  };
}

/**
 * Build a fixed, checkable domain problem from block title/description.
 * Never asks the learner to invent their own problem.
 * When description carries attached material text (file excerpts, link labels,
 * lab numbers), prefer those concrete values over canned templates.
 */
export function buildConcreteDomainExercise(
  input: TapbenchExerciseContext,
  index = 0,
): string {
  const title = (input.blockTitle || input.workspaceTitle || "this topic").trim();
  const desc = (input.blockDescription || "").replace(/\s+/g, " ").trim();
  const goal = (input.workspaceGoal || "").replace(/\s+/g, " ").trim();
  const blob = `${title} ${desc} ${goal} ${input.rootTopic || ""}`.toLowerCase();
  const seed = exerciseSeedFromContext(input, index);
  const pick = <T,>(arr: readonly T[]): T => arr[seed % arr.length]!;

  // --- Quadratic formula / roots / discriminant ---
  if (
    /quadratic|discriminant|standard form|ax\^?2|completing.?the.?square|exact solutions?|radical answers?/i.test(
      blob,
    )
  ) {
    const triples: Array<[number, number, number]> = [
      [1, -5, 6],
      [2, -3, -2],
      [1, 2, -8],
      [3, -5, -2],
      [1, -7, 10],
      [2, 5, -3],
    ];
    const [a, b, c] = pick(triples);
    return [
      `Solve ${a === 1 ? "" : a}x² ${b >= 0 ? "+" : "−"} ${Math.abs(b)}x ${c >= 0 ? "+" : "−"} ${Math.abs(c)} = 0 exactly.`,
      `(a) Identify a, b, and c in standard form.`,
      `(b) Compute the discriminant and state the root type (two real / one real / complex).`,
      `(c) Apply the quadratic formula, simplify any radicals, and box both roots.`,
      `(d) Verify by substituting one root back into the original equation.`,
    ].join(" ");
  }

  // --- Bayes / PPV / diagnostic testing ---
  if (
    /bayes|ppv|npv|predictive value|sensitivity|specificity|prevalence|false positive|base rate/i.test(
      blob,
    )
  ) {
    const extracted = extractDiagnosticRatesFromText(`${desc} ${goal}`);
    const sets = [
      { sens: 0.95, spec: 0.9, prev: 0.02 },
      { sens: 0.99, spec: 0.95, prev: 0.001 },
      { sens: 0.9, spec: 0.85, prev: 0.05 },
      { sens: 0.98, spec: 0.92, prev: 0.01 },
    ];
    const fallback = pick(sets);
    const sens = extracted.sens ?? fallback.sens;
    const spec = extracted.spec ?? fallback.spec;
    let prev = extracted.prev ?? fallback.prev;
    if (
      extracted.prev == null &&
      extracted.population != null &&
      extracted.diseased != null &&
      extracted.population > 0
    ) {
      prev = extracted.diseased / extracted.population;
    }
    const materialHint = /lab-panel|cdc|worksheet|material|source “|:\s/i.test(desc)
      ? ` Use the numbers from the attached materials (${clipScope(desc, 90)}).`
      : "";
    const popLine =
      extracted.population != null
        ? ` Consider a population of N=${extracted.population}${extracted.diseased != null ? ` with ${extracted.diseased} diseased` : ""}.`
        : "";
    return [
      `A diagnostic test has sensitivity ${sens}, specificity ${spec}, and the disease prevalence is ${prev}.${materialHint}${popLine}`,
      `(a) Write Bayes’ rule for P(disease | positive).`,
      `(b) Compute the positive predictive value (PPV) as a decimal to 4 places — show the contingency-table or formula steps.`,
      `(c) Box the PPV.`,
      `(d) State in one sentence how PPV would change if prevalence dropped by 10×.`,
    ].join(" ");
  }

  // --- Modular arithmetic / number theory ---
  if (
    /modular|mod\s*\d|congruence|φ\(|totient|chinese remainder|discrete log|number theory/i.test(
      blob,
    )
  ) {
    const mods = [7, 11, 13, 17];
    const bases = [3, 5, 7, 10];
    const m = pick(mods);
    const base = pick(bases);
    const exp = 5 + (seed % 12);
    return [
      `Compute ${base}^${exp} mod ${m} using successive squaring (or another efficient method).`,
      `(a) Show each intermediate power reduced mod ${m}.`,
      `(b) Box the final residue in {0,…,${m - 1}}.`,
      `(c) Does ${base} have a multiplicative inverse mod ${m}? Justify with gcd, and if so compute it.`,
    ].join(" ");
  }

  // --- Derivatives / calculus ---
  if (/derivative|differentiat|tangent|rate of change|chain rule|product rule/i.test(blob)) {
    const fns = [
      "f(x) = x³ − 4x + 1",
      "f(x) = (2x + 1)e^{x}",
      "f(x) = ln(x² + 1)",
      "f(x) = sin(3x) cos(x)",
    ];
    const f = pick(fns);
    const x0 = [0, 1, 2, -1][seed % 4]!;
    return [
      `Let ${f}.`,
      `(a) Compute f′(x) with intermediate steps (name any rules used).`,
      `(b) Evaluate f′(${x0}) and box the value.`,
      `(c) Write the equation of the tangent line to y = f(x) at x = ${x0}.`,
    ].join(" ");
  }

  // --- Linear algebra / systems ---
  if (/matrix|linear system|eigen|gaussian|row reduc|vector space|linear algebra/i.test(blob)) {
    return [
      `Solve the linear system: 2x + y = ${3 + (seed % 5)},  x − y = ${1 + (seed % 3)}.`,
      `(a) Write the coefficient matrix and augmented matrix.`,
      `(b) Row-reduce (or invert) with intermediate steps and box (x, y).`,
      `(c) Verify by substituting back into both equations.`,
    ].join(" ");
  }

  // --- Probability (generic) ---
  if (/\bprobability\b|random variable|expected value|binomial|variance/i.test(blob)) {
    const n = 8 + (seed % 5);
    const p = [0.25, 0.3, 0.4, 0.5][seed % 4]!;
    return [
      `A trial succeeds with probability p = ${p}. You run n = ${n} independent trials.`,
      `(a) Write the PMF of X = number of successes (Binomial).`,
      `(b) Compute P(X = 2) exactly or to 4 decimal places — show the formula with numbers plugged in.`,
      `(c) Compute E[X] and Var(X); box both.`,
    ].join(" ");
  }

  // --- Desc already is an imperative concrete task ---
  if (
    desc &&
    !looksLikeTopicOverview(desc) &&
    /^(design|implement|debug|compare|explain|derive|prove|build|analyze|write|calculate|model|solve|find|show|compute|given|suppose|let |consider)\b/i.test(
      desc,
    ) &&
    !isInventYourOwnExerciseMeta(desc)
  ) {
    const titled =
      title &&
      title !== "this topic" &&
      !new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(desc)
        ? `${desc} (context: ${title})`
        : desc;
    return titled;
  }

  // --- Skill / process / materials-rich non-STEM fallback ---
  // Genuine domain-check scenarios — never fake A/B/C parameter shells or
  // "Work this fixed problem… do not invent" scaffolding that dominated Scrum-like
  // workspaces when no STEM matcher fired.
  const aim = goal
    ? clipScope(goal, 80)
    : title !== "this topic"
      ? clipScope(title, 80)
      : "the stated learning outcome";
  const topic = title !== "this topic" ? title : "this practice";
  // Soft source cite from description only when it is not an inventory dump
  const sourceBit =
    desc &&
    !/^attachments\s*:/i.test(desc) &&
    !/^sources include\b/i.test(desc) &&
    !/\[external\]/i.test(desc)
      ? clipScope(desc, 100)
      : "";

  const variants = [
    [
      `In “${topic}”, decide whether a delivery satisfies “${aim}”.`,
      `(a) State the single governing definition, rule, or success criterion from this topic (one sentence).`,
      `(b) Apply it to this fixed case: the team finished the main work but skipped the required verification / review step named by the practice standard.`,
      `(c) Box a pass/fail judgment with one concrete reason.`,
      `(d) Name one edge case where the same criterion is ambiguous.`,
    ].join(" "),
    [
      `A practitioner claims mastery of “${topic}” while pursuing “${aim}”.`,
      `(a) Name the correct procedure, role boundary, or artifact this topic requires.`,
      `(b) Identify the concrete mistake in this fixed case: they treat a temporary status update as a completed outcome.`,
      `(c) Box the first observable signal that proves the mistake.`,
      `(d) State one corrective action that restores a valid outcome.`,
    ].join(" "),
    [
      `Finish one worked check of “${topic}” for “${aim}”.`,
      `(a) Name the primary artifact or decision this topic requires.`,
      `(b) For this fixed case — three linked descriptions of the same practice disagree on one key term — resolve which definition controls and why${sourceBit ? ` (consider: ${sourceBit})` : ""}.`,
      `(c) Box the controlling definition or decision in one short phrase.`,
      `(d) Note one situation where a different definition would correctly win instead.`,
    ].join(" "),
  ] as const;

  return variants[seed % variants.length]!;
}

/**
 * Pure fallback when LLM is unavailable — always a concrete, checkable problem.
 * Never asks the learner to invent their own problem statement.
 */
export function buildTapbenchExerciseFallback(
  input: TapbenchExerciseContext,
  index = 0,
): string {
  const explicit = (input.exerciseText || "").replace(/\s+/g, " ").trim();
  if (
    explicit &&
    !isLowQualityTapbenchExercise(explicit, input) &&
    !looksLikeTopicOverview(explicit) &&
    !isInventYourOwnExerciseMeta(explicit)
  ) {
    return ensureExercisePrefix(explicit.replace(/^exercise\s*:\s*/i, ""));
  }

  const concrete = buildConcreteDomainExercise(input, index);
  return ensureExercisePrefix(concrete);
}
