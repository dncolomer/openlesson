export interface PerformanceMarkerScore {
  id: string;
  label: string;
  score: number;
  rationale: string;
  block_id?: string | null;
}

export interface PerformanceGapItem {
  title: string;
  evidence: string;
  severity: "low" | "medium" | "high";
  suggested_repair: string;
}

export interface PerformanceGapAnalysis {
  summary: string;
  gaps: PerformanceGapItem[];
  next_practice: string[];
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

export const PERFORMANCE_GAP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    evidence: { type: "string" },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    suggested_repair: { type: "string" },
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
          next_practice: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "gaps", "next_practice"],
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
    next_practice: ["Re-run the workflow with explicit before/after metrics"],
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
      "suggestions",
      "confidence",
    ],
    overall_score: {
      type: "integer",
      range: "0-100",
      description:
        "Learning verification score synthesized from workspace evidence, TAP (Think Aloud Protocol) results, and block competencies.",
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
    },
    example_report: EXAMPLE_PERFORMANCE_REPORT,
  };
}

export function emptyPerformanceReport(message?: string): PerformanceReport {
  const summary =
    message ||
    "No performance evidence is available yet. Collect TAP (Think Aloud Protocol) sessions, workspace evidence uploads, or linked session reports before generating a gap analysis.";

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
      next_practice: [
        "Upload tool usage or screenshots for key blocks",
        "Issue a Think Aloud Protocol (TAP) session on the highest-risk block",
      ],
    },
    suggestions: ["POST /api/v2/agent/workspaces/{workspace_id}/evidence with type tool, screen, video, or eeg"],
    confidence: "emerging",
  };
}

export function buildPerformanceReportInstructions(
  blockId?: string | null,
  workspaceConversionGoal?: string | null
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
5. gap_analysis.gaps — concrete gaps array (title, evidence, severity low|medium|high, suggested_repair). List every meaningful gap found; use an empty array only when evidence is truly insufficient to name gaps.

Prioritize:
- TAP (Think Aloud Protocol) results and gap_analysis when present (align marker_scores with TAP markers when available)
- ILE (Integrated Learning Environment) practice outcomes when present
- Tool usage, screenshots, video, and EEG evidence
- Session reports and block descriptions
- Uploaded workspace files

Be honest when evidence is thin. Severity should reflect business risk, not politeness. Lower overall_score and marker scores when evidence is sparse.`;
}