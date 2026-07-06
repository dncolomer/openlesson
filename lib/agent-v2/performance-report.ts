export interface PerformanceMarkerScore {
  id: string;
  label: string;
  score: number;
  rationale: string;
  block_id?: string | null;
}

/** Shared guardrails for score-card remediation — import into other agent prompts. */
export const PERFORMANCE_REMEDIATION_GUARDRAILS = `Remediation output rules (gap_analysis.gaps[].suggested_repair, gap_analysis.next_steps, suggestions, and any growth_areas that recommend action):
- NEVER mention OpenLesson platform mechanics: Think Aloud Protocol (TAP), TAP sessions or links, ILE, Integrated Learning Environment, workspace blocks, completing or finishing blocks, block completion, or returning to OpenLesson.
- Write remediation in product- and workflow-specific language — the same vocabulary as real tool events and domain tasks (e.g. "connect Slack", "route_energy_grid", "document tradeoff before config change").
- gap_analysis.next_steps.events must be granular, observable product/tool actions or event verbs — not platform tasks.
- gap_analysis.next_steps.directions must be intermediate competency goals in domain language — not "complete block X" or "run a TAP".
- TAP, ILE, blocks, and session artifacts may inform scoring as INPUT evidence — but must never appear as OUTPUT recommendations.`;

const PLATFORM_REMEDIATION_PATTERN =
  /\b(tap|think\s+aloud(?:\s+protocol)?|ile|integrated\s+learning\s+environment|openlesson)\b|(?:complete|finish)\s+(?:the\s+)?(?:workspace\s+)?blocks?\b|block\s+completion|issue\s+(?:a\s+)?tap|run\s+(?:a\s+)?tap|schedule\s+(?:a\s+)?tap/i;

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
  evidence: string;
  severity: "low" | "medium" | "high";
  suggested_repair: string;
}

export interface PerformanceNextSteps {
  /** High-level direction and intermediate goals toward readiness or conversion. */
  directions: string[];
  /** Granular, observable actions or events to complete next. */
  events: string[];
}

export interface PerformanceGapAnalysis {
  summary: string;
  gaps: PerformanceGapItem[];
  next_steps: PerformanceNextSteps;
  /** @deprecated Normalized into next_steps.events when present. */
  next_practice?: string[];
}

export interface PerformanceReport {
  overall_score: number;
  /** Estimated likelihood (0–100) of achieving the workspace conversion goal from all evidence. */
  conversion_score: number;
  /** What "conversion" means for this workspace — inferred from context when not explicit. */
  conversion_goal: string;
  marker_scores: PerformanceMarkerScore[];
  summary: string;
  strengths: string[];
  growth_areas: string[];
  gap_analysis: PerformanceGapAnalysis;
  suggestions: string[];
  confidence: "emerging" | "developing" | "clear" | "well-connected";
}

export interface PerformanceReportContract {
  endpoint_pattern: string;
  response_mode: "report";
  required_fields: string[];
  overall_score: {
    type: "integer";
    range: "0-100";
    description: string;
  };
  conversion_score: {
    type: "integer";
    range: "0-100";
    description: string;
  };
  conversion_goal: {
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
    item_fields: Array<"title" | "evidence" | "severity" | "suggested_repair">;
    next_steps_required: boolean;
    next_steps_fields: Array<"directions" | "events">;
  };
  example_report: PerformanceReport;
}

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
        "High-level domain goals toward readiness/conversion — product/workflow language only; never TAP, blocks, or OpenLesson platform tasks",
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
    evidence: { type: "string" },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    suggested_repair: {
      type: "string",
      description:
        "Product- or workflow-specific repair action — never TAP, block completion, ILE, or OpenLesson platform mechanics",
    },
  },
  required: ["title", "evidence", "severity", "suggested_repair"],
  additionalProperties: false,
} as const;

export const PERFORMANCE_REPORT_SCHEMA = {
  name: "workspace_performance_report",
  schema: {
    type: "object",
    properties: {
      overall_score: {
        type: "number",
        description: "0-100 learning verification score synthesized from evidence",
      },
      conversion_score: {
        type: "number",
        description:
          "0-100 estimated likelihood of achieving the workspace conversion goal based on all evidence",
      },
      conversion_goal: {
        type: "string",
        description:
          "What conversion means in this workspace (e.g. trial activation, certification sign-off); infer from context when not explicit",
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
          next_practice: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "gaps", "next_steps"],
        additionalProperties: false,
      },
      suggestions: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["emerging", "developing", "clear", "well-connected"] },
    },
    required: [
      "overall_score",
      "conversion_score",
      "conversion_goal",
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
};

export const EXAMPLE_PERFORMANCE_REPORT: PerformanceReport = {
  overall_score: 72,
  conversion_score: 58,
  conversion_goal: "Trial-to-paid subscription activation",
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
  summary: "Learner demonstrates partial readiness with solid execution but shallow reflection.",
  strengths: ["Completed primary workflow without blocking errors"],
  growth_areas: ["Quantify tradeoffs before committing to configuration choices"],
  gap_analysis: {
    summary: "Reflection and risk quantification lag behind execution skill.",
    gaps: [
      {
        title: "Missing quantified tradeoff analysis",
        evidence: "Tool traces show configuration changes without ROI or risk notes.",
        severity: "medium",
        suggested_repair: "Add a short decision log with expected impact before each major change.",
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

export function buildPerformanceReportContract(baseUrl?: string): PerformanceReportContract {
  const endpoint = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/api/v2/agent/workspaces/{workspace_id}/performance`
    : "POST /api/v2/agent/workspaces/{workspace_id}/performance";

  return {
    endpoint_pattern: endpoint,
    response_mode: "report",
    required_fields: [
      "overall_score",
      "conversion_score",
      "conversion_goal",
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
    overall_score: {
      type: "integer",
      range: "0-100",
      description:
        "Learning verification score synthesized from workspace evidence, session artifacts, and competency signals.",
    },
    conversion_score: {
      type: "integer",
      range: "0-100",
      description:
        "Estimated likelihood the learner achieves the workspace conversion goal, inferred from all evidence — distinct from learning verification.",
    },
    conversion_goal: {
      type: "string",
      description:
        "Plain-language definition of what conversion means for this workspace (infer from title, notes, blocks, and evidence when not explicit).",
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
      item_fields: ["title", "evidence", "severity", "suggested_repair"],
      next_steps_required: true,
      next_steps_fields: ["directions", "events"],
    },
    example_report: EXAMPLE_PERFORMANCE_REPORT,
  };
}

export function emptyPerformanceReport(message?: string): PerformanceReport {
  const summary =
    message ||
    "No performance evidence is available yet. Collect product tool events, workspace evidence uploads, or linked session reports before generating a gap analysis.";

  return {
    overall_score: 0,
    conversion_score: 0,
    conversion_goal: "Goal conversion not yet inferable — collect more workspace evidence.",
    marker_scores: [],
    summary,
    strengths: [],
    growth_areas: ["Collect baseline performance evidence before assessing readiness."],
    gap_analysis: {
      summary: "Insufficient data to identify specific learning gaps.",
      gaps: [],
      next_steps: {
        directions: [
          "Establish baseline competency evidence across priority workflow milestones",
        ],
        events: [
          "Upload tool usage traces for the primary workflow",
          "Capture screenshots at each major configuration checkpoint",
        ],
      },
    },
    suggestions: [
      "Upload the next observable product action as a tool evidence event",
    ],
    confidence: "emerging",
  };
}

export function buildPerformanceStyleSection(stylePrompt?: string | null): string {
  if (!stylePrompt?.trim()) return "";
  return `\n\nOutput style (apply to every narrative string in the JSON — summary, strengths, growth_areas, gap titles/evidence/suggested_repair, next_steps, suggestions, marker rationales, and conversion_goal when phrased as coaching):\n${stylePrompt.trim()}`;
}

export function buildPerformanceReportInstructions(
  blockId?: string | null,
  workspaceConversionGoal?: string | null,
  stylePrompt?: string | null
): string {
  const scope = blockId ? "a single workspace block" : "the full workspace";
  const goalLine = workspaceConversionGoal?.trim()
    ? `\nAuthoritative workspace conversion goal (use exactly for conversion_goal; score conversion_score against this):\n"${workspaceConversionGoal.trim()}"\n`
    : "";

  return `You produce structured learning and gap analysis for ${scope} in OpenLesson.
${goalLine}

Use the attached workspace performance JSON and artifact files. Return only JSON matching the schema.

Required scoring outputs:
1. overall_score — integer 0-100 **learning verification** score synthesized from all evidence (not an average of markers; use judgment). Measures demonstrated competency and readiness to perform — not business conversion directly.
2. conversion_score — integer 0-100 **conversion likelihood** estimating how likely the learner is to achieve the workspace's outcome/conversion goal based on all evidence (tool traces, TAP, artifacts, milestones, drop-offs, re-engagement). This is separate from overall_score: strong learning can coexist with low conversion odds if evidence shows abandonment, missing activation steps, or blockers.
3. conversion_goal — one concise phrase defining what "conversion" means for this workspace. When an authoritative workspace conversion goal is provided above, echo it exactly. Otherwise infer from workspace title, description, notes, blocks, eval definition, and evidence.
4. marker_scores — 4-8 competency axes for spider/radar visualization. Each item needs:
   - id: snake_case competency key aligned to workspace blocks or eval definition
   - label: human-readable axis name
   - score: 0-100 for that competency
   - rationale: one sentence grounded in specific evidence
   - block_id (optional): tie axis to a workspace block when scoped
5. gap_analysis.gaps — concrete deficiencies only (title, evidence, severity low|medium|high, suggested_repair). List every meaningful gap found; use an empty array only when evidence is truly insufficient to name gaps. Do not duplicate next steps as gaps.
6. gap_analysis.next_steps — always include, separate from gaps:
   - directions: 2-5 high-level outcomes or intermediate goals toward readiness/conversion (domain/product language)
   - events: 3-8 granular, observable product/tool actions or event verbs from the learner's real workflow
7. suggestions — short product/workflow follow-ups; same remediation rules as gaps and next_steps.

${PERFORMANCE_REMEDIATION_GUARDRAILS}

Evidence inputs to weigh when scoring (not remediation outputs):
- Tool usage, screenshots, video, and EEG evidence
- Session reports and competency descriptions from the eval definition
- Think Aloud Protocol (TAP) and ILE traces when present — use for scoring only
- Uploaded workspace files

Be honest when evidence is thin. Severity should reflect business risk, not politeness. Lower overall_score and marker scores when evidence is sparse.${buildPerformanceStyleSection(stylePrompt)}`;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function normalizePerformanceGapAnalysis(
  gapAnalysis: Partial<PerformanceGapAnalysis> | null | undefined,
): PerformanceGapAnalysis {
  const gaps = Array.isArray(gapAnalysis?.gaps)
    ? gapAnalysis.gaps
        .filter(
          (gap): gap is PerformanceGapItem =>
            Boolean(gap) &&
            typeof gap.title === "string" &&
            typeof gap.evidence === "string" &&
            typeof gap.suggested_repair === "string",
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
        ? "Learning gaps were identified from the available evidence."
        : "No specific learning gaps were identified from the available evidence.";

  const rawNextSteps = gapAnalysis?.next_steps;
  let next_steps: PerformanceNextSteps;
  if (rawNextSteps && typeof rawNextSteps === "object") {
    next_steps = {
      directions: sanitizeRemediationStrings(normalizeStringList(rawNextSteps.directions)),
      events: sanitizeRemediationStrings(normalizeStringList(rawNextSteps.events)),
    };
  } else {
    next_steps = {
      directions: [],
      events: sanitizeRemediationStrings(normalizeStringList(gapAnalysis?.next_practice)),
    };
  }

  const legacyPractice =
    next_steps.directions.length > 0 || next_steps.events.length > 0
      ? [...next_steps.directions, ...next_steps.events]
      : sanitizeRemediationStrings(normalizeStringList(gapAnalysis?.next_practice));

  return {
    summary,
    gaps,
    next_steps,
    ...(legacyPractice.length > 0 ? { next_practice: legacyPractice } : {}),
  };
}

export function normalizePerformanceReport(report: PerformanceReport): PerformanceReport {
  const gap_analysis = normalizePerformanceGapAnalysis(report.gap_analysis);
  return {
    ...report,
    growth_areas: sanitizeRemediationStrings(report.growth_areas ?? []),
    suggestions: sanitizeRemediationStrings(report.suggestions ?? []),
    gap_analysis,
  };
}