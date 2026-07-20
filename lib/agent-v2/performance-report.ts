import { parseJsonLoose } from "@/lib/xai-client";
import { composePrompt } from "@/lib/prompt-kernel/compose";
import {
  SCORE_FIELD_DESCRIPTIONS,
  SCORE_VERTICALS,
  VERTICAL_MCP_TOOL,
  VERTICAL_REST_PATH,
  VERTICAL_SCORE_FIELD,
  VERTICAL_SCORE_INSTRUCTIONS,
  type GhcConfidence,
  type ScoreVertical,
} from "@/lib/prompt-kernel/scores";
import { buildScoreContextSurface } from "@/lib/prompt-kernel/surfaces/score-context";
import {
  WORLD_MODEL_DELTA_INSTRUCTIONS,
  type LearningWorldModelDelta,
} from "@/lib/prompt-kernel/world-model";
import { evalScoreEndpointPattern } from "@/lib/api/agent-api-paths";

export type { GhcConfidence, ScoreVertical };
export {
  SCORE_VERTICALS,
  VERTICAL_MCP_TOOL,
  VERTICAL_REST_PATH,
  VERTICAL_SCORE_FIELD,
};

export interface PerformanceMarkerScore {
  id: string;
  label: string;
  score: number;
  rationale: string;
  block_id?: string | null;
}

/** Shared guardrails for score-card remediation — import into other agent prompts. */
export const PERFORMANCE_REMEDIATION_GUARDRAILS = `Remediation output rules (gap_analysis.gaps[].suggested_repair, gap_analysis.next_steps, suggestions, and any growth_areas that recommend action):
- NEVER mention Uncertain Systems platform mechanics: Think Aloud Protocol (TAP), TAP sessions or links, ILE, Integrated Learning Environment, workspace blocks, completing or finishing blocks, block completion, or returning to Uncertain Systems.
- Write remediation in product- and workflow-specific language — the same vocabulary as real tool events and domain tasks (e.g. "connect Slack", "route_energy_grid", "document tradeoff before config change").
- gap_analysis.next_steps.events must be granular, observable product/tool actions or event verbs — not platform tasks.
- gap_analysis.next_steps.directions must be intermediate competency goals in domain language — not "complete block X" or "run a TAP".
- TAP, ILE, blocks, and session artifacts may inform scoring as INPUT proof of work — but must never appear as OUTPUT recommendations.`;

const PLATFORM_REMEDIATION_PATTERN =
  /\b(tap|think\s+aloud(?:\s+protocol)?|ile|integrated\s+learning\s+environment|openlesson|uncertain\s+systems)\b|(?:complete|finish)\s+(?:the\s+)?(?:[\w-]+\s+)*(?:workspace\s+)?blocks?\b|block\s+completion|issue\s+(?:a\s+)?tap|run\s+(?:a\s+)?tap|schedule\s+(?:a\s+)?tap/i;

export function isPlatformRemediationSuggestion(text: string): boolean {
  return PLATFORM_REMEDIATION_PATTERN.test(text.trim());
}

export function sanitizeRemediationStrings(items: string[]): string[] {
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0 && !isPlatformRemediationSuggestion(item));
}

export interface PerformanceGapItem {
  title: string;
  proof_of_work: string;
  severity: "low" | "medium" | "high";
  suggested_repair: string;
}

export interface PerformanceNextSteps {
  /** High-level direction and intermediate goals toward readiness or the workspace goal. */
  directions: string[];
  /** Granular, observable actions or events to complete next. */
  events: string[];
}

export interface PerformanceGapAnalysis {
  summary: string;
  gaps: PerformanceGapItem[];
  next_steps: PerformanceNextSteps;
}

/**
 * One vertical score report: a single primary 0–100 score plus spider breakdown,
 * analysis (summary/strengths/growth/gaps), and next actions (gap_analysis.next_steps).
 */
export interface VerticalScoreReport {
  vertical: ScoreVertical;
  /** Primary 0–100 score for this vertical only. */
  score: number;
  /**
   * Named primary field matching the vertical (verification_score | augmentation_score | optimization_score).
   * Always equals `score` for the active vertical.
   */
  verification_score?: number;
  augmentation_score?: number;
  optimization_score?: number;
  /** Inferred or owner-set workspace goal. */
  workspace_goal: string;
  /** Genuine Human Cognition — secondary signal, not a fourth primary vertical. */
  ghc_score: number;
  ghc_confidence: GhcConfidence;
  temporal_summary?: string;
  world_model_delta?: LearningWorldModelDelta;
  /** Spider/radar competency breakdown. */
  marker_scores: PerformanceMarkerScore[];
  /** Narrative analysis of the score. */
  summary: string;
  strengths: string[];
  growth_areas: string[];
  gap_analysis: PerformanceGapAnalysis;
  suggestions: string[];
  confidence: "emerging" | "developing" | "clear" | "well-connected";
}

/** @deprecated Prefer VerticalScoreReport — kept as alias for gradual call-site renames */
export type PerformanceReport = VerticalScoreReport;

export interface VerticalScoreReportContract {
  endpoint_pattern: string;
  mcp_tool: string;
  vertical: ScoreVertical;
  primary_score_field: string;
  response_mode: "score";
  required_fields: string[];
  primary_score: {
    type: "integer";
    range: "0-100";
    description: string;
  };
  workspace_goal: {
    type: "string";
    description: string;
  };
  ghc_score: {
    type: "integer";
    range: "0-100";
    description: string;
  };
  ghc_confidence: {
    type: "string";
    description: string;
  };
  marker_scores: {
    description: string;
    min_markers: number;
    max_markers: number;
    visualization: "spider_radar";
    item_fields: Array<"id" | "label" | "score" | "rationale" | "block_id">;
  };
  gap_analysis: {
    required: boolean;
    gaps_required: boolean;
    item_fields: Array<"title" | "proof_of_work" | "severity" | "suggested_repair">;
    next_steps_required: boolean;
    next_steps_fields: Array<"directions" | "events">;
  };
  example_report: VerticalScoreReport;
}

/** @deprecated Use VerticalScoreReportContract */
export type PerformanceReportContract = VerticalScoreReportContract;

export const PERFORMANCE_MARKER_SCORE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    score: { type: "number" },
    rationale: { type: "string" },
    block_id: { type: "string" },
  },
  required: ["id", "label", "score", "rationale"],
  additionalProperties: false,
} as const;

export const PERFORMANCE_NEXT_STEPS_SCHEMA = {
  type: "object",
  properties: {
    directions: {
      type: "array",
      items: { type: "string" },
      description:
        "High-level domain goals toward readiness/workspace goal — product/workflow language only; never TAP, blocks, or Uncertain Systems platform tasks",
    },
    events: {
      type: "array",
      items: { type: "string" },
      description:
        "Granular observable product/tool actions or event verbs — never TAP sessions, block completion, or ILE",
    },
  },
  required: ["directions", "events"],
  additionalProperties: false,
} as const;

export const PERFORMANCE_GAP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    proof_of_work: { type: "string" },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    suggested_repair: {
      type: "string",
      description:
        "Product- or workflow-specific repair action — never TAP, block completion, ILE, or Uncertain Systems platform mechanics",
    },
  },
  required: ["title", "proof_of_work", "severity", "suggested_repair"],
  additionalProperties: false,
} as const;

function primaryScoreDescription(vertical: ScoreVertical): string {
  switch (vertical) {
    case "verification":
      return SCORE_FIELD_DESCRIPTIONS.verification_score;
    case "augmentation":
      return SCORE_FIELD_DESCRIPTIONS.augmentation_score;
    case "optimization":
      return SCORE_FIELD_DESCRIPTIONS.optimization_score;
  }
}

export function buildVerticalScoreReportSchema(vertical: ScoreVertical) {
  const primaryField = VERTICAL_SCORE_FIELD[vertical];
  return {
    name: `workspace_${vertical}_score_report`,
    schema: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: primaryScoreDescription(vertical),
        },
        workspace_goal: {
          type: "string",
          description: SCORE_FIELD_DESCRIPTIONS.workspace_goal,
        },
        ghc_score: {
          type: "number",
          description: SCORE_FIELD_DESCRIPTIONS.ghc_score,
        },
        ghc_confidence: {
          type: "string",
          enum: ["none", "low", "medium", "high"],
          description: SCORE_FIELD_DESCRIPTIONS.ghc_confidence,
        },
        temporal_summary: {
          type: "string",
          description: SCORE_FIELD_DESCRIPTIONS.temporal_summary,
        },
        world_model_delta: {
          type: "object",
          description: "Partial learning world model update from this evaluation",
          additionalProperties: true,
        },
        marker_scores: {
          type: "array",
          description: "Spider/radar competency axes for visualization",
          items: PERFORMANCE_MARKER_SCORE_SCHEMA,
        },
        summary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        growth_areas: { type: "array", items: { type: "string" } },
        gap_analysis: {
          type: "object",
          properties: {
            summary: { type: "string" },
            gaps: {
              type: "array",
              items: PERFORMANCE_GAP_ITEM_SCHEMA,
            },
            next_steps: PERFORMANCE_NEXT_STEPS_SCHEMA,
          },
          required: ["summary", "gaps", "next_steps"],
          additionalProperties: false,
        },
        suggestions: { type: "array", items: { type: "string" } },
        confidence: {
          type: "string",
          enum: ["emerging", "developing", "clear", "well-connected"],
        },
      },
      required: [
        "score",
        "workspace_goal",
        "ghc_score",
        "ghc_confidence",
        "marker_scores",
        "summary",
        "strengths",
        "growth_areas",
        "gap_analysis",
        "suggestions",
        "confidence",
      ],
      additionalProperties: false,
    },
    primary_field: primaryField,
    vertical,
  } as const;
}

/** Schema used for verification (default); generators pick per-vertical via buildVerticalScoreReportSchema. */
export const PERFORMANCE_REPORT_SCHEMA = buildVerticalScoreReportSchema("verification");

function exampleReportForVertical(vertical: ScoreVertical): VerticalScoreReport {
  const score =
    vertical === "verification" ? 72 : vertical === "augmentation" ? 64 : 58;
  const base: VerticalScoreReport = {
    vertical,
    score,
    workspace_goal: "Trial-to-paid subscription activation",
    ghc_score: 45,
    ghc_confidence: "low",
    temporal_summary:
      "Tool events clustered with short gaps; little reflective dwell between decisions.",
    world_model_delta: {
      evidence_appetite: {
        want_more: ["decision_rationale", "reflection_checkpoint"],
        saturated: ["tool_crud_events"],
      },
      scores_snapshot: {
        verification_score: vertical === "verification" ? score : null,
        augmentation_score: vertical === "augmentation" ? score : null,
        optimization_score: vertical === "optimization" ? score : null,
        ghc_score: 45,
      },
    },
    marker_scores: [
      {
        id: "workflow_execution",
        label: "Workflow Execution",
        score: 78,
        rationale: "Completed core setup steps with consistent tool traces.",
      },
      {
        id: "decision_quality",
        label: "Decision Quality",
        score: 65,
        rationale: "Choices were reasonable but lacked quantified tradeoff analysis.",
      },
      {
        id: "artifact_quality",
        label: "Artifact Quality",
        score: 70,
        rationale: "Deliverables were usable but missing edge-case coverage.",
      },
      {
        id: "reflection_depth",
        label: "Reflection Depth",
        score: 58,
        rationale: "Learner reflections were brief and did not cite counterfactuals.",
      },
    ],
    summary:
      vertical === "verification"
        ? "Learner demonstrates partial knowledge coverage with solid execution but shallow reflection."
        : vertical === "augmentation"
          ? "Practice readiness is developing; targeted drills on tradeoffs would close the largest gaps."
          : "Progress toward the workspace goal is partial — activation milestones remain incomplete.",
    strengths: ["Completed primary workflow without blocking errors"],
    growth_areas: ["Quantify tradeoffs before committing to configuration choices"],
    gap_analysis: {
      summary: "Reflection and risk quantification lag behind execution skill.",
      gaps: [
        {
          title: "Missing quantified tradeoff analysis",
          proof_of_work: "Tool traces show configuration changes without ROI or risk notes.",
          severity: "medium",
          suggested_repair:
            "Add a short decision log with expected impact before each major change.",
        },
      ],
      next_steps: {
        directions: [
          "Build a repeatable decision log habit before changing production configuration",
        ],
        events: [
          "Re-run the workflow with explicit before/after metrics",
          "Upload screenshots at each configuration checkpoint",
          "Document expected impact before the next configuration change",
        ],
      },
    },
    suggestions: ["Collect screenshots at each decision checkpoint"],
    confidence: "developing",
  };
  return applyNamedScoreField(base);
}

export const EXAMPLE_PERFORMANCE_REPORT = exampleReportForVertical("verification");
export const EXAMPLE_VERIFICATION_SCORE_REPORT = EXAMPLE_PERFORMANCE_REPORT;
export const EXAMPLE_AUGMENTATION_SCORE_REPORT = exampleReportForVertical("augmentation");
export const EXAMPLE_OPTIMIZATION_SCORE_REPORT = exampleReportForVertical("optimization");

export function applyNamedScoreField(report: VerticalScoreReport): VerticalScoreReport {
  const field = VERTICAL_SCORE_FIELD[report.vertical];
  return {
    ...report,
    verification_score: undefined,
    augmentation_score: undefined,
    optimization_score: undefined,
    [field]: report.score,
  };
}

export function primaryScoreOf(report: VerticalScoreReport): number {
  return clampPerformanceScore(report.score);
}

export function buildVerticalScoreReportContract(
  vertical: ScoreVertical,
  baseUrl?: string
): VerticalScoreReportContract {
  const path = VERTICAL_REST_PATH[vertical];
  const endpoint = evalScoreEndpointPattern(path, baseUrl);
  const primaryField = VERTICAL_SCORE_FIELD[vertical];

  return {
    endpoint_pattern: endpoint,
    mcp_tool: VERTICAL_MCP_TOOL[vertical],
    vertical,
    primary_score_field: primaryField,
    response_mode: "score",
    required_fields: [
      "score",
      primaryField,
      "vertical",
      "workspace_goal",
      "ghc_score",
      "ghc_confidence",
      "marker_scores",
      "summary",
      "strengths",
      "growth_areas",
      "gap_analysis",
      "gap_analysis.gaps",
      "gap_analysis.next_steps",
      "gap_analysis.next_steps.directions",
      "gap_analysis.next_steps.events",
      "suggestions",
      "confidence",
    ],
    primary_score: {
      type: "integer",
      range: "0-100",
      description: primaryScoreDescription(vertical),
    },
    workspace_goal: {
      type: "string",
      description: SCORE_FIELD_DESCRIPTIONS.workspace_goal,
    },
    ghc_score: {
      type: "integer",
      range: "0-100",
      description: SCORE_FIELD_DESCRIPTIONS.ghc_score,
    },
    ghc_confidence: {
      type: "string",
      description: SCORE_FIELD_DESCRIPTIONS.ghc_confidence,
    },
    marker_scores: {
      description:
        "4-8 competency axes for spider/radar charts. Derive ids and labels from workspace blocks and the eval definition.",
      min_markers: 4,
      max_markers: 8,
      visualization: "spider_radar",
      item_fields: ["id", "label", "score", "rationale", "block_id"],
    },
    gap_analysis: {
      required: true,
      gaps_required: true,
      item_fields: ["title", "proof_of_work", "severity", "suggested_repair"],
      next_steps_required: true,
      next_steps_fields: ["directions", "events"],
    },
    example_report: exampleReportForVertical(vertical),
  };
}

/** Build contracts for all three vertical score endpoints. */
export function buildAllVerticalScoreContracts(baseUrl?: string): VerticalScoreReportContract[] {
  return SCORE_VERTICALS.map((v) => buildVerticalScoreReportContract(v, baseUrl));
}

/** @deprecated Prefer buildVerticalScoreReportContract / buildAllVerticalScoreContracts */
export function buildPerformanceReportContract(baseUrl?: string): VerticalScoreReportContract {
  return buildVerticalScoreReportContract("verification", baseUrl);
}

export function emptyVerticalScoreReport(
  vertical: ScoreVertical = "verification",
  message?: string
): VerticalScoreReport {
  const summary =
    message ||
    "No performance proof of work is available yet. Collect product tool events, workspace proof of work uploads, or linked session reports before generating a gap analysis.";

  return applyNamedScoreField({
    vertical,
    score: 0,
    workspace_goal: "Workspace goal not yet inferable — collect more workspace proof of work.",
    ghc_score: 0,
    ghc_confidence: "none",
    temporal_summary: "No temporal proof-of-work series available yet.",
    marker_scores: [],
    summary,
    strengths: [],
    growth_areas: ["Collect baseline performance proof of work before assessing readiness."],
    gap_analysis: {
      summary: "Insufficient data to identify specific learning gaps.",
      gaps: [],
      next_steps: {
        directions: [
          "Establish baseline competency proof of work across priority workflow milestones",
        ],
        events: [
          "Upload tool usage traces for the primary workflow",
          "Capture screenshots at each major configuration checkpoint",
        ],
      },
    },
    suggestions: [
      "Upload the next observable product action as a tool proof-of-work event",
    ],
    confidence: "emerging",
  });
}

/** @deprecated Prefer emptyVerticalScoreReport(vertical) */
export function emptyPerformanceReport(message?: string): VerticalScoreReport {
  return emptyVerticalScoreReport("verification", message);
}

export function buildPerformanceStyleSection(stylePrompt?: string | null): string {
  if (!stylePrompt?.trim()) return "";
  return `\n\nOutput style (apply to every narrative string in the JSON — summary, strengths, growth_areas, gap titles/proof-of-work/suggested_repair, next_steps, suggestions, marker rationales, and workspace_goal when phrased as coaching):\n${stylePrompt.trim()}`;
}

export function buildVerticalScoreInstructions(
  vertical: ScoreVertical,
  blockId?: string | null,
  workspaceGoal?: string | null,
  stylePrompt?: string | null
): string {
  const scope = blockId ? "a single workspace block" : "the full workspace";
  const goalLine = workspaceGoal?.trim()
    ? `\nAuthoritative workspace goal (use exactly for workspace_goal; score ${VERTICAL_SCORE_FIELD[vertical]} against this):\n"${workspaceGoal.trim()}"\n`
    : "";

  const verticalLabel =
    vertical === "verification"
      ? "learning verification"
      : vertical === "augmentation"
        ? "learning augmentation (practice readiness)"
        : "learning optimization (progress toward workspace goal)";

  const task = `You produce a structured **${verticalLabel}** score report for ${scope} in Uncertain Systems.
This call scores ONLY the ${vertical} vertical. Return one primary score field ("score") plus spider breakdown, analysis, and next actions.
${goalLine}

Use the attached workspace performance JSON and artifact files **as PoW context catalogs and file refs** — score only from the proof-of-work they reference (see SCORE GENERATION CONTEXT). Return only JSON matching the schema.

${VERTICAL_SCORE_INSTRUCTIONS[vertical]}

Additional required outputs:
6. marker_scores — 4-8 competency axes for spider/radar visualization. Each item needs:
   - id: snake_case competency key aligned to workspace blocks or eval definition
   - label: human-readable axis name
   - score: 0-100 for that competency
   - rationale: one sentence grounded in specific PoW evidence (cite artifact/trace/event, not marketing)
   - block_id (optional): tie axis to a workspace block when scoped
7. gap_analysis.gaps — concrete deficiencies only (title, proof_of_work, severity low|medium|high, suggested_repair). proof_of_work must reference observed PoW or explicit absence. List every meaningful gap found; use an empty array only when proof of work is truly insufficient to name gaps. Do not duplicate next steps as gaps.
8. gap_analysis.next_steps — always include, separate from gaps:
   - directions: 2-5 high-level outcomes or intermediate goals in domain/product language
   - events: 3-8 granular, observable product/tool actions or event verbs from the learner's real workflow
9. suggestions — short product/workflow follow-ups; same remediation rules as gaps and next_steps.
10. ${WORLD_MODEL_DELTA_INSTRUCTIONS}

${PERFORMANCE_REMEDIATION_GUARDRAILS}

Be honest when proof of work is thin. Severity should reflect business risk, not politeness. Lower the primary score and marker scores when proof of work is sparse.${buildPerformanceStyleSection(stylePrompt)}`;

  // ontology → score-context surface (PoW-only + verification submit/stash) → task
  return composePrompt({
    ontology: "full",
    surface: buildScoreContextSurface(vertical),
    task,
  });
}

/** @deprecated Prefer buildVerticalScoreInstructions */
export function buildPerformanceReportInstructions(
  blockId?: string | null,
  workspaceGoal?: string | null,
  stylePrompt?: string | null
): string {
  return buildVerticalScoreInstructions("verification", blockId, workspaceGoal, stylePrompt);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function normalizePerformanceGapAnalysis(
  gapAnalysis: Partial<PerformanceGapAnalysis> | null | undefined
): PerformanceGapAnalysis {
  const gaps = Array.isArray(gapAnalysis?.gaps)
    ? gapAnalysis.gaps
        .filter(
          (gap): gap is PerformanceGapItem =>
            Boolean(gap) &&
            typeof gap.title === "string" &&
            typeof gap.proof_of_work === "string" &&
            typeof gap.suggested_repair === "string"
        )
        .map((gap) => ({
          ...gap,
          suggested_repair: isPlatformRemediationSuggestion(gap.suggested_repair)
            ? "Repeat the workflow with explicit checkpoints and document decisions in product terms."
            : gap.suggested_repair,
        }))
    : [];

  const summary =
    typeof gapAnalysis?.summary === "string" && gapAnalysis.summary.trim()
      ? gapAnalysis.summary.trim()
      : gaps.length > 0
        ? "Learning gaps were identified from the available proof of work."
        : "No specific learning gaps were identified from the available proof of work.";

  const rawNextSteps = gapAnalysis?.next_steps;
  const next_steps: PerformanceNextSteps =
    rawNextSteps && typeof rawNextSteps === "object"
      ? {
          directions: sanitizeRemediationStrings(normalizeStringList(rawNextSteps.directions)),
          events: sanitizeRemediationStrings(normalizeStringList(rawNextSteps.events)),
        }
      : { directions: [], events: [] };

  return {
    summary,
    gaps,
    next_steps,
  };
}

const VALID_GHC_CONFIDENCE = new Set<GhcConfidence>(["none", "low", "medium", "high"]);

function normalizeGhcConfidence(value: unknown): GhcConfidence {
  if (typeof value === "string" && VALID_GHC_CONFIDENCE.has(value as GhcConfidence)) {
    return value as GhcConfidence;
  }
  return "none";
}

export function normalizeVerticalScoreReport(
  report: VerticalScoreReport | (Partial<VerticalScoreReport> & { score?: number }),
  vertical: ScoreVertical = "verification"
): VerticalScoreReport {
  const gap_analysis = normalizePerformanceGapAnalysis(report.gap_analysis);
  const resolvedVertical =
    report.vertical && SCORE_VERTICALS.includes(report.vertical as ScoreVertical)
      ? (report.vertical as ScoreVertical)
      : vertical;

  // Accept named primary fields from model output if score is missing
  const namedField = VERTICAL_SCORE_FIELD[resolvedVertical];
  const namedValue = (report as Record<string, unknown>)[namedField];
  const score = clampPerformanceScore(
    typeof report.score === "number"
      ? report.score
      : typeof namedValue === "number"
        ? namedValue
        : 0
  );
  const ghc_score = clampPerformanceScore(report.ghc_score);
  const ghc_confidence = normalizeGhcConfidence(report.ghc_confidence);
  const temporal_summary =
    typeof report.temporal_summary === "string" && report.temporal_summary.trim()
      ? report.temporal_summary.trim()
      : undefined;
  const world_model_delta =
    report.world_model_delta && typeof report.world_model_delta === "object"
      ? report.world_model_delta
      : undefined;
  const workspace_goal =
    typeof report.workspace_goal === "string" ? report.workspace_goal.trim() : "";

  return applyNamedScoreField({
    vertical: resolvedVertical,
    score,
    workspace_goal,
    ghc_score,
    ghc_confidence,
    ...(temporal_summary ? { temporal_summary } : {}),
    ...(world_model_delta ? { world_model_delta } : {}),
    marker_scores: Array.isArray(report.marker_scores)
      ? normalizeMarkerScores(report.marker_scores)
      : [],
    summary: typeof report.summary === "string" ? report.summary : "",
    strengths: normalizeStringList(report.strengths),
    growth_areas: sanitizeRemediationStrings(report.growth_areas ?? []),
    suggestions: sanitizeRemediationStrings(report.suggestions ?? []),
    gap_analysis,
    confidence: VALID_CONFIDENCE_LEVELS.has(report.confidence as VerticalScoreReport["confidence"])
      ? (report.confidence as VerticalScoreReport["confidence"])
      : "developing",
  });
}

/** @deprecated Prefer normalizeVerticalScoreReport */
export function normalizePerformanceReport(
  report: VerticalScoreReport
): VerticalScoreReport {
  return normalizeVerticalScoreReport(report, report.vertical ?? "verification");
}

const VALID_CONFIDENCE_LEVELS = new Set<VerticalScoreReport["confidence"]>([
  "emerging",
  "developing",
  "clear",
  "well-connected",
]);

function clampPerformanceScore(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(100, Math.max(0, value)));
}

function normalizeMarkerScores(value: unknown): PerformanceMarkerScore[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : `marker_${index + 1}`,
      label:
        typeof item.label === "string" && item.label.trim()
          ? item.label.trim()
          : `Competency ${index + 1}`,
      score: clampPerformanceScore(item.score),
      rationale:
        typeof item.rationale === "string" && item.rationale.trim()
          ? item.rationale.trim()
          : "Evidence from attached proof of work.",
      ...(typeof item.block_id === "string" ? { block_id: item.block_id } : {}),
    }))
    .filter((item) => item.label.length > 0);
}

function parseRecoverableReportObject(text: string): Record<string, unknown> | null {
  const direct = parseJsonLoose<Record<string, unknown>>(text);
  if (direct.ok) return direct.data;

  const start = text.indexOf("{");
  if (start === -1) return null;

  let fragment = text.slice(start).trim();
  const openBraces = (fragment.match(/\{/g) || []).length;
  const closeBraces = (fragment.match(/\}/g) || []).length;
  const openBrackets = (fragment.match(/\[/g) || []).length;
  const closeBrackets = (fragment.match(/\]/g) || []).length;
  fragment += "]".repeat(Math.max(0, openBrackets - closeBrackets));
  fragment += "}".repeat(Math.max(0, openBraces - closeBraces));

  const repaired = parseJsonLoose<Record<string, unknown>>(fragment);
  return repaired.ok ? repaired.data : null;
}

/**
 * Best-effort recovery when xAI returns text that fails strict JSON-schema parsing
 * (truncation, trailing commas, markdown wrappers). Returns null when core fields
 * cannot be recovered.
 */
export function recoverVerticalScoreReportFromModelText(
  text: string,
  vertical: ScoreVertical = "verification"
): VerticalScoreReport | null {
  const raw = parseRecoverableReportObject(text);
  if (!raw) return null;
  const marker_scores = normalizeMarkerScores(raw.marker_scores);
  if (marker_scores.length === 0) return null;

  const namedField = VERTICAL_SCORE_FIELD[vertical];
  const score = clampPerformanceScore(
    typeof raw.score === "number"
      ? raw.score
      : typeof raw[namedField] === "number"
        ? raw[namedField]
        : typeof raw.overall_score === "number"
          ? raw.overall_score
          : typeof raw.conversion_score === "number" && vertical === "optimization"
            ? raw.conversion_score
            : 0
  );

  const workspace_goal =
    typeof raw.workspace_goal === "string"
      ? raw.workspace_goal.trim()
      : typeof raw.conversion_goal === "string"
        ? raw.conversion_goal.trim()
        : "";

  const report: VerticalScoreReport = {
    vertical,
    score,
    workspace_goal,
    ghc_score: clampPerformanceScore(raw.ghc_score, 0),
    ghc_confidence: normalizeGhcConfidence(raw.ghc_confidence),
    ...(typeof raw.temporal_summary === "string" && raw.temporal_summary.trim()
      ? { temporal_summary: raw.temporal_summary.trim() }
      : {}),
    ...(raw.world_model_delta && typeof raw.world_model_delta === "object"
      ? { world_model_delta: raw.world_model_delta as LearningWorldModelDelta }
      : {}),
    marker_scores,
    summary:
      typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary.trim()
        : "Score report synthesized from workspace proof of work.",
    strengths: normalizeStringList(raw.strengths),
    growth_areas: normalizeStringList(raw.growth_areas),
    gap_analysis: normalizePerformanceGapAnalysis(
      raw.gap_analysis as Partial<PerformanceGapAnalysis> | null | undefined
    ),
    suggestions: normalizeStringList(raw.suggestions),
    confidence: VALID_CONFIDENCE_LEVELS.has(raw.confidence as VerticalScoreReport["confidence"])
      ? (raw.confidence as VerticalScoreReport["confidence"])
      : "developing",
  };

  return normalizeVerticalScoreReport(report, vertical);
}

/** @deprecated Prefer recoverVerticalScoreReportFromModelText */
export function recoverPerformanceReportFromModelText(
  text: string
): VerticalScoreReport | null {
  return recoverVerticalScoreReportFromModelText(text, "verification");
}

/** TAP post-session auto-results always use verification only. */
export const TAP_AUTO_SCORE_VERTICAL: ScoreVertical = "verification";
