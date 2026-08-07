/**
 * LWM Snapshot interpretability — plain-language field inventory + report →
 * client-facing explanation (no re-scoring).
 *
 * Shared by UI, docs, and tests so non-technical readers can answer
 * “what does 28 mean?” and “why is GHC different?” from existing report fields.
 */

import type { GhcConfidence } from "@/lib/prompt-kernel/scores";
import { SCORE_FIELD_DESCRIPTIONS } from "@/lib/prompt-kernel/scores";
import type {
  PerformanceMarkerScore,
  VerticalScoreReport,
} from "@/lib/pow-api/performance-report";

/** Client-facing names (never product jargon alone). */
export const LWM_CLIENT_LABELS = {
  primary_score: "Skill / readiness",
  primary_score_short: "Skill",
  ghc_score: "Authenticity of work",
  ghc_score_short: "Authenticity",
  ghc_confidence: "Authenticity confidence",
  workspace_goal: "What success looks like",
  summary: "In plain words",
  strengths: "What they did well",
  growth_areas: "Where they can grow",
  gaps: "Gaps to close",
  next_steps: "Suggested next steps",
  markers: "Skill breakdown",
  suggestions: "Tips",
  confidence: "How clear the evidence is",
  temporal_summary: "Timing patterns",
} as const;

/**
 * Inventory of main LWM Snapshot response fields with plain-language meaning.
 * Driven by {@link SCORE_FIELD_DESCRIPTIONS} + report contract — not a freehand list.
 */
export interface LwmSnapshotFieldInventoryItem {
  /** Wire / API field name */
  field: string;
  /** Short name for UI */
  client_label: string;
  /** One–two sentences for non-technical readers */
  plain_language: string;
  /** Role relative to the dual-score story */
  role: "primary" | "secondary" | "context" | "breakdown" | "narrative" | "side";
}

export function listLwmSnapshotResponseFields(): LwmSnapshotFieldInventoryItem[] {
  return [
    {
      field: "score",
      client_label: LWM_CLIENT_LABELS.primary_score,
      plain_language:
        "Primary 0–100 score: how well this person has demonstrated skill and explored the workspace so far. " +
        "Low (e.g. ~20–35) often means thin or narrow evidence — not a personal judgment. " +
        "Also returned as lwm_snapshot_score (same number).",
      role: "primary",
    },
    {
      field: "lwm_snapshot_score",
      client_label: LWM_CLIENT_LABELS.primary_score,
      plain_language: SCORE_FIELD_DESCRIPTIONS.lwm_snapshot_score,
      role: "primary",
    },
    {
      field: "workspace_goal",
      client_label: LWM_CLIENT_LABELS.workspace_goal,
      plain_language: SCORE_FIELD_DESCRIPTIONS.workspace_goal,
      role: "context",
    },
    {
      field: "ghc_score",
      client_label: LWM_CLIENT_LABELS.ghc_score,
      plain_language:
        "Secondary 0–100 score: how genuine / human the work process looks (System 1 vs System 2 thoughts, natural pacing). " +
        "It is NOT the same as skill. Short agent dumps can still look “structured” and score mid-high authenticity " +
        "while skill stays low — that split is expected. " +
        SCORE_FIELD_DESCRIPTIONS.ghc_score,
      role: "secondary",
    },
    {
      field: "ghc_confidence",
      client_label: LWM_CLIENT_LABELS.ghc_confidence,
      plain_language: SCORE_FIELD_DESCRIPTIONS.ghc_confidence,
      role: "secondary",
    },
    {
      field: "marker_scores",
      client_label: LWM_CLIENT_LABELS.markers,
      plain_language:
        "Spider/radar breakdown: a few competency axes (each with label, 0–100 score, and short rationale). " +
        "Use these to explain *where* the primary score is strong or weak.",
      role: "breakdown",
    },
    {
      field: "summary",
      client_label: LWM_CLIENT_LABELS.summary,
      plain_language: "Short narrative of the overall snapshot for humans (not a separate score).",
      role: "narrative",
    },
    {
      field: "strengths",
      client_label: LWM_CLIENT_LABELS.strengths,
      plain_language: "Bullet list of demonstrated strengths from the evidence.",
      role: "narrative",
    },
    {
      field: "growth_areas",
      client_label: LWM_CLIENT_LABELS.growth_areas,
      plain_language: "Bullet list of areas that still need practice or clearer proof.",
      role: "narrative",
    },
    {
      field: "gap_analysis",
      client_label: LWM_CLIENT_LABELS.gaps,
      plain_language:
        "Structured gaps (title, severity, suggested repair) plus next_steps.directions and next_steps.events " +
        "for product-friendly follow-ups — not platform busywork.",
      role: "narrative",
    },
    {
      field: "suggestions",
      client_label: LWM_CLIENT_LABELS.suggestions,
      plain_language: "Actionable tips aligned with the gaps and goal.",
      role: "narrative",
    },
    {
      field: "confidence",
      client_label: LWM_CLIENT_LABELS.confidence,
      plain_language:
        "How solid the evidence base is overall: emerging | developing | clear | well-connected " +
        "(about the snapshot reading, not the person).",
      role: "context",
    },
    {
      field: "temporal_summary",
      client_label: LWM_CLIENT_LABELS.temporal_summary,
      plain_language: SCORE_FIELD_DESCRIPTIONS.temporal_summary,
      role: "context",
    },
    {
      field: "learning_world_model",
      client_label: "Learning state (side payload)",
      plain_language:
        "Optional durable world-model after the snapshot (exploration, profile, scores snapshot). " +
        "Not required to explain the two big numbers.",
      role: "side",
    },
    {
      field: "knowledge_config",
      client_label: "Knowledge embedding (side payload)",
      plain_language:
        "Optional knowledge-config vector after the snapshot for map/region geometry — not a skill letter grade.",
      role: "side",
    },
  ];
}

/** Required inventory fields for acceptance / tests. */
export const LWM_SNAPSHOT_REQUIRED_INVENTORY_FIELDS = [
  "score",
  "lwm_snapshot_score",
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
  "temporal_summary",
] as const;

export interface LwmExplainedMarker {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

export interface LwmExplainedGap {
  title: string;
  severity?: string;
  suggested_repair?: string;
}

export interface LwmSnapshotExplanation {
  /** Primary skill score 0–100 */
  primary_score: number | null;
  primary_label: string;
  primary_meaning: string;
  /** GHC authenticity 0–100 */
  ghc_score: number | null;
  ghc_label: string;
  ghc_confidence: GhcConfidence | string | null;
  ghc_meaning: string;
  /** Why primary and GHC can diverge (always filled for client education). */
  dual_score_note: string;
  workspace_goal: string | null;
  summary: string | null;
  strengths: string[];
  growth_areas: string[];
  markers: LwmExplainedMarker[];
  gaps: LwmExplainedGap[];
  next_step_directions: string[];
  next_step_events: string[];
  suggestions: string[];
  evidence_confidence: string | null;
  temporal_summary: string | null;
  /** Heuristic band for primary score (for UI chips). */
  primary_band: "low" | "moderate" | "strong" | "unknown";
}

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function primaryBand(score: number | null): LwmSnapshotExplanation["primary_band"] {
  if (score == null) return "unknown";
  if (score < 40) return "low";
  if (score < 70) return "moderate";
  return "strong";
}

function primaryMeaning(score: number | null): string {
  if (score == null) {
    return "No skill score yet — generate a snapshot after there is proof of work.";
  }
  if (score < 40) {
    return (
      `${score}/100 skill & readiness: early or thin evidence of mastery. ` +
      `Common with a short practice session or few work samples — more depth and variety will usually raise this.`
    );
  }
  if (score < 70) {
    return (
      `${score}/100 skill & readiness: partial demonstration of the workspace goal. ` +
      `Some strengths show; key pathways or depth still missing.`
    );
  }
  return (
    `${score}/100 skill & readiness: solid demonstration against the workspace goal from the evidence on file.`
  );
}

function ghcMeaning(score: number | null, confidence: unknown): string {
  const conf =
    typeof confidence === "string" && confidence.trim() ? confidence.trim() : "unknown";
  if (score == null) {
    return "No authenticity reading yet.";
  }
  if (score >= 70) {
    return (
      `${score}/100 authenticity of work (confidence: ${conf}): the process looks relatively genuine ` +
      `(e.g. mixed spontaneous vs deliberate thoughts). This does not mean high skill — only that the work pattern looks human-like.`
    );
  }
  if (score >= 40) {
    return (
      `${score}/100 authenticity of work (confidence: ${conf}): mixed signals of natural vs mechanical process. ` +
      `Still separate from skill / readiness.`
    );
  }
  return (
    `${score}/100 authenticity of work (confidence: ${conf}): process looks thin, mechanical, or tool-only. ` +
    `Low authenticity often co-occurs with low confidence when there is little think-aloud structure.`
  );
}

const DUAL_SCORE_NOTE =
  "Two different questions: Skill / readiness = “how much did they show they can do the work?” " +
  "Authenticity (GHC) = “does the way they worked look like real thinking, not a dump?” " +
  "A short session can score low skill and still mid/high authenticity if traces look structured.";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function markersFrom(report: Partial<VerticalScoreReport> | null | undefined): LwmExplainedMarker[] {
  const raw = report?.marker_scores;
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map((m: PerformanceMarkerScore | Record<string, unknown>, i) => {
      const id = typeof m.id === "string" && m.id.trim() ? m.id : `marker_${i}`;
      const label =
        typeof m.label === "string" && m.label.trim() ? m.label.trim() : id;
      const score = clampScore(m.score) ?? 0;
      const rationale =
        typeof m.rationale === "string" && m.rationale.trim()
          ? m.rationale.trim()
          : "No rationale provided.";
      return { id, label, score, rationale };
    });
}

function gapsFrom(report: Partial<VerticalScoreReport> | null | undefined): LwmExplainedGap[] {
  const gaps = report?.gap_analysis?.gaps;
  if (!Array.isArray(gaps)) return [];
  return gaps.slice(0, 8).map((g) => ({
    title: typeof g?.title === "string" ? g.title : "Gap",
    severity: typeof g?.severity === "string" ? g.severity : undefined,
    suggested_repair:
      typeof g?.suggested_repair === "string" ? g.suggested_repair : undefined,
  }));
}

/**
 * Map a VerticalScoreReport (or report-shaped JSON) to a client-facing explanation.
 * Pure: no I/O, no re-scoring — only presents existing fields.
 */
export function explainLwmSnapshotReport(
  report: Partial<VerticalScoreReport> | null | undefined,
): LwmSnapshotExplanation {
  const primary =
    clampScore(report?.score) ??
    clampScore(report?.lwm_snapshot_score) ??
    clampScore(report?.verification_score);
  const ghc = clampScore(report?.ghc_score);
  const ghcConf =
    typeof report?.ghc_confidence === "string" ? report.ghc_confidence : null;
  const next = report?.gap_analysis?.next_steps;

  return {
    primary_score: primary,
    primary_label: LWM_CLIENT_LABELS.primary_score,
    primary_meaning: primaryMeaning(primary),
    ghc_score: ghc,
    ghc_label: LWM_CLIENT_LABELS.ghc_score,
    ghc_confidence: ghcConf,
    ghc_meaning: ghcMeaning(ghc, ghcConf),
    dual_score_note: DUAL_SCORE_NOTE,
    workspace_goal:
      typeof report?.workspace_goal === "string" && report.workspace_goal.trim()
        ? report.workspace_goal.trim()
        : null,
    summary:
      typeof report?.summary === "string" && report.summary.trim()
        ? report.summary.trim()
        : null,
    strengths: asStringArray(report?.strengths).slice(0, 8),
    growth_areas: asStringArray(report?.growth_areas).slice(0, 8),
    markers: markersFrom(report),
    gaps: gapsFrom(report),
    next_step_directions: asStringArray(next?.directions).slice(0, 6),
    next_step_events: asStringArray(next?.events).slice(0, 6),
    suggestions: asStringArray(report?.suggestions).slice(0, 6),
    evidence_confidence:
      typeof report?.confidence === "string" ? report.confidence : null,
    temporal_summary:
      typeof report?.temporal_summary === "string" && report.temporal_summary.trim()
        ? report.temporal_summary.trim()
        : null,
    primary_band: primaryBand(primary),
  };
}

/** Band chip label for UI. */
export function lwmPrimaryBandLabel(
  band: LwmSnapshotExplanation["primary_band"],
): string {
  switch (band) {
    case "low":
      return "Early evidence";
    case "moderate":
      return "Building";
    case "strong":
      return "Solid";
    default:
      return "No score yet";
  }
}
