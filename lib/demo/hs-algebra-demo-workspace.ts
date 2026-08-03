/**
 * Pure helpers + authentic copy for the Highschool Algebra demo workspace.
 * No DB I/O — regions use the shipped synthetic profile → knowledgecfg encoder.
 *
 * Scope (intentionally smaller than Helios SaaS demo):
 *  - 1 workspace about high-school algebra
 *  - exactly 2 synthetic knowledge regions
 *  - ≥3 guest subjects with multi-event PoW (tool + screen)
 */

import {
  createSyntheticKnowledgeRegionFromProfile,
  encodeKnowledgeConfig,
  type CustomVerificationModelSpec,
  type PowFeatureRow,
  type SyntheticRegionProfile,
} from "@/lib/knowledge-config";
import {
  emptyLearningWorldModel,
  mergeLearningWorldModelDelta,
} from "@/lib/prompt-kernel/world-model";

/** Stable marker for idempotent find/replace on staging. */
export const HS_ALGEBRA_DEMO_MARKER = "[DEMO:hs-algebra-v1]";

export const HS_ALGEBRA_DEMO_WORKSPACE = {
  title: "High School Algebra — Competency Practice Map",
  root_topic: "High school algebra foundations and equation solving",
  description:
    "Classroom-style workspace for high school Algebra I/II. Students practice linear " +
    "equations, inequalities, polynomials, and systems with tool and screen proof-of-work. " +
    "Two synthetic knowledge regions mark Foundations (expressions & linear equations) versus " +
    "Advanced Procedures (quadratics, factoring, and systems) so demos show multi-learner " +
    "progress on a real algebra map.",
  conversion_goal:
    "Show multi-student proof-of-work clustered into algebra foundations vs advanced procedures regions.",
  notes:
    `${HS_ALGEBRA_DEMO_MARKER} High school algebra demo — two synthetic regions, multi-guest PoW.`,
  source_type: "topic" as const,
  payment_status: "paid" as const,
  status: "active" as const,
};

export type AlgebraRegionKey = "foundations" | "advanced";

export interface AlgebraRegionDefinition {
  key: AlgebraRegionKey;
  regionName: string;
  description: string;
  profile: SyntheticRegionProfile;
}

export interface AlgebraPowEvent {
  proof_of_work_type: "tool" | "screen" | "video" | "eeg";
  tool_name: string;
  tool_action: string;
  file_name: string;
  mime_type: string;
  metadata: Record<string, unknown>;
  /** Offset from subject session start (ms). */
  offset_ms: number;
}

export interface AlgebraGuestSubject {
  /** Stable key used for idempotent guest email / labels. */
  key: string;
  displayName: string;
  emailLocalPart: string;
  regionHint: AlgebraRegionKey | "mixed";
  verification_score: number;
  strengths: string[];
  friction_patterns: string[];
  preferred_modalities: string[];
  powEvents: AlgebraPowEvent[];
}

export interface AlgebraBlockDefinition {
  key: string;
  title: string;
  description: string;
  is_start?: boolean;
}

export const HS_ALGEBRA_BLOCKS: AlgebraBlockDefinition[] = [
  {
    key: "expressions",
    title: "Algebraic expressions & properties",
    description:
      "Simplify expressions, apply distributive property, and combine like terms.",
    is_start: true,
  },
  {
    key: "linear_equations",
    title: "Linear equations in one variable",
    description:
      "Solve multi-step linear equations and check solutions by substitution.",
  },
  {
    key: "inequalities",
    title: "Inequalities & number lines",
    description:
      "Graph and solve linear inequalities; interpret compound inequality statements.",
  },
  {
    key: "systems",
    title: "Systems of linear equations",
    description:
      "Solve 2×2 systems by substitution, elimination, and graphing.",
  },
  {
    key: "quadratics",
    title: "Quadratics & factoring",
    description:
      "Factor trinomials, complete the square, and apply the quadratic formula.",
  },
];

/** Exactly two synthetic knowledge regions for the algebra demo. */
export const HS_ALGEBRA_REGIONS: AlgebraRegionDefinition[] = [
  {
    key: "foundations",
    regionName: "Algebra Foundations",
    description:
      "Synthetic competency region for students solid on expressions, linear equations, " +
      "and inequality graphing — the Algebra I foundations layer.",
    profile: {
      name: "Algebra Foundations",
      description: "Expressions, like terms, linear equations, and inequalities",
      verification_score: 82,
      augmentation_score: 78,
      optimization_score: 74,
      ghc_score: 68,
      strengths: [
        "combine-like-terms",
        "distribute-and-simplify",
        "solve-linear-equations",
        "graph-inequalities",
        "check-by-substitution",
      ],
      friction_patterns: ["sign-errors", "forgot-to-check"],
      preferred_modalities: ["tool", "screen"],
      pow_types: ["tool", "screen", "tool", "screen"],
      tool_names: [
        "desmos-graphing",
        "equation-step-checker",
        "algebra-tiles",
        "number-line-plotter",
        "expression-simplifier",
      ],
    },
  },
  {
    key: "advanced",
    regionName: "Advanced Algebra Procedures",
    description:
      "Synthetic competency region for students practicing systems, factoring, and " +
      "quadratic solution methods — the Algebra II procedures layer.",
    profile: {
      name: "Advanced Algebra Procedures",
      description: "Systems of equations, factoring, and quadratic formula work",
      verification_score: 88,
      augmentation_score: 84,
      optimization_score: 80,
      ghc_score: 72,
      strengths: [
        "systems-elimination",
        "factor-trinomials",
        "quadratic-formula",
        "complete-the-square",
        "discriminant-analysis",
      ],
      friction_patterns: ["factor-sign-slip", "system-ordering"],
      preferred_modalities: ["tool", "screen", "speech"],
      pow_types: ["tool", "screen", "tool", "speech"],
      tool_names: [
        "system-solver",
        "factoring-lab",
        "quadratic-formula-coach",
        "parabola-grapher",
        "discriminant-checker",
      ],
    },
  },
];

function powBundle(
  tools: Array<{
    type?: AlgebraPowEvent["proof_of_work_type"];
    tool: string;
    action: string;
    file: string;
    mime?: string;
    meta?: Record<string, unknown>;
  }>,
): AlgebraPowEvent[] {
  return tools.map((t, i) => ({
    proof_of_work_type: t.type ?? (i % 3 === 1 ? "screen" : "tool"),
    tool_name: t.tool,
    tool_action: t.action,
    file_name: t.file,
    mime_type: t.mime ?? (t.type === "screen" ? "image/png" : "application/json"),
    metadata: {
      system: 2,
      demo_subject: true,
      ...(t.meta || {}),
    },
    offset_ms: i * 95_000 + (i % 2) * 14_000,
  }));
}

/**
 * Guest learners with student-like names and algebra-authentic tool/screen PoW.
 * At least three subjects, each with ≥2 events and mixed tool/screen styles.
 */
export const HS_ALGEBRA_GUESTS: AlgebraGuestSubject[] = [
  {
    key: "ava_foundations",
    displayName: "Ava Martinez",
    emailLocalPart: "ava.martinez+hs-algebra-demo",
    regionHint: "foundations",
    verification_score: 84,
    strengths: [
      "combine-like-terms",
      "solve-linear-equations",
      "graph-inequalities",
    ],
    friction_patterns: ["sign-errors"],
    preferred_modalities: ["tool", "screen"],
    powEvents: powBundle([
      {
        tool: "expression-simplifier",
        action: "combine-like-terms",
        file: "hw3_simplify_set_a.json",
        meta: { selective_thought: true, system: 2 },
      },
      {
        type: "screen",
        tool: "desmos-graphing",
        action: "plot-linear-inequality",
        file: "inequality_graph_set2.png",
        mime: "image/png",
      },
      {
        tool: "equation-step-checker",
        action: "multi-step-solve",
        file: "linear_eq_worksheet_b.json",
      },
      {
        type: "screen",
        tool: "number-line-plotter",
        action: "compound-inequality",
        file: "numberline_and_or.png",
        mime: "image/png",
        meta: { system: 2, submit: true },
      },
    ]),
  },
  {
    key: "noah_foundations",
    displayName: "Noah Patel",
    emailLocalPart: "noah.patel+hs-algebra-demo",
    regionHint: "foundations",
    verification_score: 78,
    strengths: ["distribute-and-simplify", "check-by-substitution"],
    friction_patterns: ["forgot-to-check", "sign-errors"],
    preferred_modalities: ["tool", "screen"],
    powEvents: powBundle([
      {
        tool: "algebra-tiles",
        action: "model-distributive",
        file: "tiles_distribute_3x.json",
      },
      {
        type: "screen",
        tool: "equation-step-checker",
        action: "solve-and-check",
        file: "check_substitution_screen.png",
        mime: "image/png",
      },
      {
        tool: "expression-simplifier",
        action: "expand-and-combine",
        file: "expand_practice_set.json",
        meta: { system: 2 },
      },
    ]),
  },
  {
    key: "mia_advanced",
    displayName: "Mia Thompson",
    emailLocalPart: "mia.thompson+hs-algebra-demo",
    regionHint: "advanced",
    verification_score: 90,
    strengths: [
      "factor-trinomials",
      "quadratic-formula",
      "systems-elimination",
    ],
    friction_patterns: ["factor-sign-slip"],
    preferred_modalities: ["tool", "screen", "speech"],
    powEvents: powBundle([
      {
        tool: "factoring-lab",
        action: "factor-ax2-bx-c",
        file: "factor_set_c.json",
        meta: { selective_thought: true, system: 2 },
      },
      {
        type: "screen",
        tool: "parabola-grapher",
        action: "vertex-and-roots",
        file: "parabola_roots_hw.png",
        mime: "image/png",
      },
      {
        tool: "quadratic-formula-coach",
        action: "apply-formula",
        file: "qf_practice_round3.json",
      },
      {
        tool: "system-solver",
        action: "elimination-2x2",
        file: "systems_word_problems.json",
        meta: { submit: true, system: 2 },
      },
    ]),
  },
  {
    key: "liam_mixed",
    displayName: "Liam Okonkwo",
    emailLocalPart: "liam.okonkwo+hs-algebra-demo",
    regionHint: "mixed",
    verification_score: 72,
    strengths: ["solve-linear-equations", "systems-elimination"],
    friction_patterns: ["system-ordering", "sign-errors"],
    preferred_modalities: ["tool", "screen"],
    powEvents: powBundle([
      {
        tool: "equation-step-checker",
        action: "two-step-equations",
        file: "review_linear_warmup.json",
      },
      {
        type: "screen",
        tool: "desmos-graphing",
        action: "graph-system",
        file: "intersect_lines_hw.png",
        mime: "image/png",
      },
      {
        tool: "system-solver",
        action: "substitution-attempt",
        file: "system_sub_draft.json",
        meta: { system: 1 },
      },
      {
        type: "screen",
        tool: "factoring-lab",
        action: "guided-factor-intro",
        file: "factor_intro_tiles.png",
        mime: "image/png",
      },
    ]),
  },
];

export const HS_ALGEBRA_GUEST_EMAIL_DOMAIN = "demo.uncertain.systems";

export function hsAlgebraGuestEmail(localPart: string): string {
  return `${localPart}@${HS_ALGEBRA_GUEST_EMAIL_DOMAIN}`;
}

export function algebraRegionByKey(key: AlgebraRegionKey): AlgebraRegionDefinition {
  const found = HS_ALGEBRA_REGIONS.find((r) => r.key === key);
  if (!found) throw new Error(`unknown algebra region key: ${key}`);
  return found;
}

/** Build one synthetic region via the shipped knowledgecfg encoder path. */
export function buildAlgebraRegion(
  region: AlgebraRegionDefinition,
  workspaceId = "hs-algebra-demo",
): CustomVerificationModelSpec {
  const model = createSyntheticKnowledgeRegionFromProfile({
    name: region.regionName,
    profile: region.profile,
    description: region.description,
    workspaceId,
  });
  return {
    ...model,
    subjects: [{ label: "synthetic:grok-4.5" }],
  };
}

/** Exactly the two algebra regions (foundations + advanced). */
export function buildAllAlgebraRegions(
  workspaceId = "hs-algebra-demo",
): CustomVerificationModelSpec[] {
  return HS_ALGEBRA_REGIONS.map((r) => buildAlgebraRegion(r, workspaceId));
}

export interface EncodedAlgebraGuest {
  subject: AlgebraGuestSubject;
  embedding: ReturnType<typeof encodeKnowledgeConfig>;
  vector: number[];
  powRows: PowFeatureRow[];
}

/**
 * Encode a guest from faked PoW (+ light LWM profile) through the real encoder.
 */
export function encodeAlgebraGuest(
  subject: AlgebraGuestSubject,
  options?: {
    workspaceId?: string;
    totalBlocks?: number;
    sessionStartMs?: number;
  },
): EncodedAlgebraGuest {
  const workspaceId = options?.workspaceId ?? "hs-algebra-demo";
  const sessionStartMs = options?.sessionStartMs ?? 1_720_500_000_000;
  const totalBlocks = options?.totalBlocks ?? HS_ALGEBRA_BLOCKS.length;

  const powRows: PowFeatureRow[] = subject.powEvents.map((ev) => ({
    proof_of_work_type: ev.proof_of_work_type,
    timestamp_ms: sessionStartMs + ev.offset_ms,
    tool_name: ev.tool_name,
    tool_action: ev.tool_action,
    metadata: {
      ...ev.metadata,
      demo_marker: HS_ALGEBRA_DEMO_MARKER,
      subject_key: subject.key,
      region_hint: subject.regionHint,
      subject_kind: "guest",
    },
  }));

  const worldModel = mergeLearningWorldModelDelta(emptyLearningWorldModel(workspaceId), {
    scores_snapshot: {
      verification_score: subject.verification_score,
      augmentation_score: Math.max(0, subject.verification_score - 6),
      optimization_score: Math.max(0, subject.verification_score - 10),
      ghc_score: Math.round(subject.verification_score * 0.78),
    },
    learning_profile: {
      strengths: subject.strengths,
      friction_patterns: subject.friction_patterns,
      preferred_modalities: subject.preferred_modalities,
      temporal_patterns: { avg_dwell_ms: 4800, idle_bursts: 2 },
    },
    inferred_goal: {
      text: `High school algebra practice — ${subject.displayName} (${subject.regionHint})`,
      confidence: 0.75,
      source: "evolved",
    },
  });

  const embedding = encodeKnowledgeConfig({
    workspaceId,
    powRows,
    worldModel,
    totalBlocks,
    asOfMs: sessionStartMs + Math.max(...subject.powEvents.map((e) => e.offset_ms), 0),
  });

  return {
    subject,
    embedding,
    vector: embedding.vector,
    powRows,
  };
}

export function encodeAllAlgebraGuests(
  workspaceId = "hs-algebra-demo",
): EncodedAlgebraGuest[] {
  return HS_ALGEBRA_GUESTS.map((s, i) =>
    encodeAlgebraGuest(s, {
      workspaceId,
      sessionStartMs: 1_720_500_000_000 + i * 86_400_000,
    }),
  );
}

/** Catalog shape checks used by unit tests and seed preflight. */
export function assertHsAlgebraCatalogShape(): {
  regionCount: number;
  guestCount: number;
  minPowPerGuest: number;
  regionNames: string[];
  guestNames: string[];
} {
  if (HS_ALGEBRA_REGIONS.length !== 2) {
    throw new Error(`expected exactly 2 algebra regions, got ${HS_ALGEBRA_REGIONS.length}`);
  }
  if (HS_ALGEBRA_GUESTS.length < 3) {
    throw new Error(`expected ≥3 guest subjects, got ${HS_ALGEBRA_GUESTS.length}`);
  }
  const minPow = Math.min(...HS_ALGEBRA_GUESTS.map((g) => g.powEvents.length));
  if (minPow < 2) {
    throw new Error(`expected each guest to have ≥2 PoW events, min=${minPow}`);
  }
  if (!HS_ALGEBRA_DEMO_WORKSPACE.notes.includes(HS_ALGEBRA_DEMO_MARKER)) {
    throw new Error("workspace notes missing demo marker");
  }
  if (!/algebra|high\s*school/i.test(HS_ALGEBRA_DEMO_WORKSPACE.title)) {
    throw new Error("workspace title must be high-school algebra scoped");
  }
  return {
    regionCount: HS_ALGEBRA_REGIONS.length,
    guestCount: HS_ALGEBRA_GUESTS.length,
    minPowPerGuest: minPow,
    regionNames: HS_ALGEBRA_REGIONS.map((r) => r.regionName),
    guestNames: HS_ALGEBRA_GUESTS.map((g) => g.displayName),
  };
}
