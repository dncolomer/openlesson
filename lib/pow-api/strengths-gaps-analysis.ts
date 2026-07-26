/**
 * Pure Strengths & Gaps browse / link / analysis helpers.
 * Driven by PerformanceReport shapes (strengths + gap_analysis) used by Ranking.
 */

import {
  normalizePerformanceGapAnalysis,
  normalizePerformanceReport,
  type PerformanceGapItem,
  type PerformanceNextSteps,
  type PerformanceReport,
} from "@/lib/pow-api/performance-report";

export type LinkedPowActionKind =
  | "proof_of_work_evidence"
  | "next_step_event"
  | "next_step_direction"
  | "suggested_repair";

export type LinkedPowAction = {
  id: string;
  kind: LinkedPowActionKind;
  /** Short heading for the linked action. */
  label: string;
  /** Full text (PoW quote, event verb, repair guidance). */
  detail: string;
};

export type BrowsableGap = {
  id: string;
  title: string;
  severity: PerformanceGapItem["severity"];
  proofOfWork: string;
  suggestedRepair: string;
  linkedActions: LinkedPowAction[];
  subjectKey: string;
  subjectLabel: string;
};

export type BrowsableStrength = {
  id: string;
  text: string;
  subjectKey: string;
  subjectLabel: string;
};

export type StrengthsGapsSeverityCounts = {
  low: number;
  medium: number;
  high: number;
};

export type SharedGapTitle = {
  title: string;
  /** @deprecated Prefer subjectCount — occurrence count kept for older callers. */
  count: number;
  /** Distinct subjects that share this gap theme. */
  subjectCount: number;
};

/** Normalized theme overlap across subjects (gaps or strengths). */
export type CohortThemeOverlap = {
  /** Normalized key (trim + lowercase + collapse whitespace). */
  themeKey: string;
  /** Display label (preserves first-seen casing). */
  label: string;
  /** Distinct subjects that exhibit this theme. */
  subjectCount: number;
  /** Total item occurrences (a subject may contribute once per theme). */
  occurrenceCount: number;
  subjectKeys: string[];
  subjectLabels: string[];
  /** Gap themes only: severity mix across matching gap rows. */
  severity?: StrengthsGapsSeverityCounts;
};

export type StrengthsGapsAnalysisSummary = {
  subjectCount: number;
  subjectsWithReports: number;
  strengthCount: number;
  gapCount: number;
  severity: StrengthsGapsSeverityCounts;
  /** Gaps whose proof_of_work text is non-empty. */
  gapsWithPowEvidence: number;
  /** Gaps with at least one linked PoW action (evidence, event, direction, or repair). */
  gapsWithLinkedActions: number;
  /** gapsWithLinkedActions / gapCount, or 0 when no gaps. */
  powLinkageRate: number;
  /**
   * Gap title frequency rollup (compat). `count` mirrors occurrenceCount;
   * `subjectCount` is distinct subjects.
   */
  topSharedGapTitles: SharedGapTitle[];
  /**
   * Gap themes ordered by distinct subject count (then occurrences).
   * Includes single-subject themes; UI filters to subjectCount ≥ 2 for “shared”.
   */
  gapThemeOverlaps: CohortThemeOverlap[];
  /** Strength themes ordered the same way. */
  strengthThemeOverlaps: CohortThemeOverlap[];
  /** Themes with subjectCount ≥ 2 only. */
  sharedGapThemes: CohortThemeOverlap[];
  sharedStrengthThemes: CohortThemeOverlap[];
};

export type StrengthsGapsBrowseModel = {
  strengths: BrowsableStrength[];
  gaps: BrowsableGap[];
  analysis: StrengthsGapsAnalysisSummary;
};

export type StrengthsGapsSubjectReportInput = {
  subjectKey: string;
  subjectLabel?: string | null;
  report?: unknown | null;
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "this",
  "that",
  "it",
  "as",
  "at",
  "by",
  "from",
  "into",
  "not",
  "no",
  "do",
  "does",
  "did",
]);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9_+.-]+/g)) {
    const t = raw.trim();
    if (t.length < 3 || STOP.has(t)) continue;
    out.add(t);
  }
  return out;
}

function overlapScore(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let n = 0;
  for (const t of ta) if (tb.has(t)) n += 1;
  return n;
}

function normalizeSeverity(value: unknown): PerformanceGapItem["severity"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

/**
 * Derive linked PoW actions for a single gap from its own proof_of_work /
 * suggested_repair plus report-level next_steps events/directions.
 */
export function linkGapToPowActions(
  gap: Pick<PerformanceGapItem, "title" | "proof_of_work" | "suggested_repair" | "severity">,
  nextSteps?: PerformanceNextSteps | null,
  options?: { gapIndex?: number; subjectKey?: string },
): LinkedPowAction[] {
  const gapIndex = options?.gapIndex ?? 0;
  const subjectKey = options?.subjectKey ?? "subject";
  const prefix = `${subjectKey}:gap-${gapIndex}`;
  const actions: LinkedPowAction[] = [];

  const pow = typeof gap.proof_of_work === "string" ? gap.proof_of_work.trim() : "";
  if (pow) {
    actions.push({
      id: `${prefix}:pow`,
      kind: "proof_of_work_evidence",
      label: "PoW evidence",
      detail: pow,
    });
  }

  const repair =
    typeof gap.suggested_repair === "string" ? gap.suggested_repair.trim() : "";
  if (repair) {
    actions.push({
      id: `${prefix}:repair`,
      kind: "suggested_repair",
      label: "Suggested repair",
      detail: repair,
    });
  }

  const events = Array.isArray(nextSteps?.events) ? nextSteps!.events : [];
  const directions = Array.isArray(nextSteps?.directions) ? nextSteps!.directions : [];
  const gapBlob = `${gap.title || ""} ${pow}`;

  // Prefer events that share vocabulary with the gap; if none match and the
  // event list is short, still attach all so every gap can show next actions.
  const scoredEvents = events
    .map((event, i) => ({
      event: typeof event === "string" ? event.trim() : "",
      i,
      score: overlapScore(gapBlob, typeof event === "string" ? event : ""),
    }))
    .filter((row) => row.event.length > 0);

  const matchedEvents = scoredEvents.filter((row) => row.score > 0);
  const eventsToLink =
    matchedEvents.length > 0
      ? matchedEvents
      : scoredEvents.length > 0 && scoredEvents.length <= 5
        ? scoredEvents
        : scoredEvents.slice(0, 2);

  for (const row of eventsToLink) {
    actions.push({
      id: `${prefix}:event-${row.i}`,
      kind: "next_step_event",
      label: "Next-step PoW action",
      detail: row.event,
    });
  }

  const scoredDirs = directions
    .map((direction, i) => ({
      direction: typeof direction === "string" ? direction.trim() : "",
      i,
      score: overlapScore(gapBlob, typeof direction === "string" ? direction : ""),
    }))
    .filter((row) => row.direction.length > 0 && row.score > 0);

  for (const row of scoredDirs.slice(0, 3)) {
    actions.push({
      id: `${prefix}:dir-${row.i}`,
      kind: "next_step_direction",
      label: "Related direction",
      detail: row.direction,
    });
  }

  return actions;
}

/** Normalize free-text themes for cross-subject exact/normalized matching. */
export function normalizeThemeKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

type ThemeBucket = {
  themeKey: string;
  label: string;
  subjects: Map<string, string>;
  occurrenceCount: number;
  severity: StrengthsGapsSeverityCounts;
};

function emptySeverity(): StrengthsGapsSeverityCounts {
  return { low: 0, medium: 0, high: 0 };
}

function sortOverlaps(a: CohortThemeOverlap, b: CohortThemeOverlap): number {
  return (
    b.subjectCount - a.subjectCount ||
    b.occurrenceCount - a.occurrenceCount ||
    a.label.localeCompare(b.label)
  );
}

/**
 * Group items by normalized theme text and count **distinct subjects**.
 * Same subject listing the same theme twice only counts once toward subjectCount.
 */
export function computeThemeOverlaps(
  items: Array<{
    text: string;
    subjectKey: string;
    subjectLabel: string;
    severity?: PerformanceGapItem["severity"];
  }>,
  options?: { includeSeverity?: boolean },
): CohortThemeOverlap[] {
  const buckets = new Map<string, ThemeBucket>();

  for (const item of items) {
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;
    const themeKey = normalizeThemeKey(text);
    if (!themeKey) continue;
    const subjectKey =
      typeof item.subjectKey === "string" && item.subjectKey.trim()
        ? item.subjectKey.trim()
        : "unknown";
    const subjectLabel =
      typeof item.subjectLabel === "string" && item.subjectLabel.trim()
        ? item.subjectLabel.trim()
        : subjectKey;

    let bucket = buckets.get(themeKey);
    if (!bucket) {
      bucket = {
        themeKey,
        label: text,
        subjects: new Map(),
        occurrenceCount: 0,
        severity: emptySeverity(),
      };
      buckets.set(themeKey, bucket);
    }
    bucket.occurrenceCount += 1;
    if (!bucket.subjects.has(subjectKey)) {
      bucket.subjects.set(subjectKey, subjectLabel);
    }
    if (options?.includeSeverity && item.severity) {
      const sev = normalizeSeverity(item.severity);
      bucket.severity[sev] += 1;
    }
  }

  const out: CohortThemeOverlap[] = [];
  for (const bucket of buckets.values()) {
    const subjectKeys = [...bucket.subjects.keys()].sort();
    const subjectLabels = subjectKeys.map((k) => bucket.subjects.get(k) || k);
    out.push({
      themeKey: bucket.themeKey,
      label: bucket.label,
      subjectCount: bucket.subjects.size,
      occurrenceCount: bucket.occurrenceCount,
      subjectKeys,
      subjectLabels,
      ...(options?.includeSeverity ? { severity: { ...bucket.severity } } : {}),
    });
  }
  return out.sort(sortOverlaps);
}

export function computeStrengthsGapsAnalysis(
  strengths: BrowsableStrength[],
  gaps: BrowsableGap[],
  options?: { subjectCount?: number; subjectsWithReports?: number },
): StrengthsGapsAnalysisSummary {
  const severity: StrengthsGapsSeverityCounts = emptySeverity();
  let gapsWithPowEvidence = 0;
  let gapsWithLinkedActions = 0;

  for (const gap of gaps) {
    severity[gap.severity] = (severity[gap.severity] ?? 0) + 1;
    if (gap.proofOfWork.trim()) gapsWithPowEvidence += 1;
    if (gap.linkedActions.length > 0) gapsWithLinkedActions += 1;
  }

  const gapThemeOverlaps = computeThemeOverlaps(
    gaps.map((g) => ({
      text: g.title,
      subjectKey: g.subjectKey,
      subjectLabel: g.subjectLabel,
      severity: g.severity,
    })),
    { includeSeverity: true },
  );

  const strengthThemeOverlaps = computeThemeOverlaps(
    strengths.map((s) => ({
      text: s.text,
      subjectKey: s.subjectKey,
      subjectLabel: s.subjectLabel,
    })),
  );

  const sharedGapThemes = gapThemeOverlaps.filter((t) => t.subjectCount >= 2);
  const sharedStrengthThemes = strengthThemeOverlaps.filter((t) => t.subjectCount >= 2);

  const topSharedGapTitles: SharedGapTitle[] = gapThemeOverlaps.slice(0, 8).map((t) => ({
    title: t.label,
    count: t.occurrenceCount,
    subjectCount: t.subjectCount,
  }));

  const gapCount = gaps.length;
  return {
    subjectCount: options?.subjectCount ?? 0,
    subjectsWithReports: options?.subjectsWithReports ?? 0,
    strengthCount: strengths.length,
    gapCount,
    severity,
    gapsWithPowEvidence,
    gapsWithLinkedActions,
    powLinkageRate: gapCount > 0 ? gapsWithLinkedActions / gapCount : 0,
    topSharedGapTitles,
    gapThemeOverlaps,
    strengthThemeOverlaps,
    sharedGapThemes,
    sharedStrengthThemes,
  };
}

/** One bar in the cohort coverage chart (shared themes only). */
export type CohortCoverageChartRow = {
  kind: "gap" | "strength";
  themeKey: string;
  label: string;
  subjectCount: number;
  /** subjectCount / subjectsWithReports, clamped 0–1 (0 if no reports). */
  coverage: number;
  /** 0–100 integer for display. */
  coveragePct: number;
};

/**
 * Build horizontal-bar chart rows for shared gap + strength themes.
 * Sorted by subject coverage desc; useful for spotting dominant cohort patterns.
 */
export function buildCohortCoverageChart(
  analysis: Pick<
    StrengthsGapsAnalysisSummary,
    "subjectsWithReports" | "sharedGapThemes" | "sharedStrengthThemes"
  >,
  options?: { maxRows?: number },
): CohortCoverageChartRow[] {
  const maxRows = Math.max(1, options?.maxRows ?? 10);
  const denom = Math.max(0, analysis.subjectsWithReports || 0);

  const fromThemes = (
    themes: CohortThemeOverlap[],
    kind: "gap" | "strength",
  ): CohortCoverageChartRow[] =>
    themes.map((t) => {
      const coverage = denom > 0 ? Math.min(1, Math.max(0, t.subjectCount / denom)) : 0;
      return {
        kind,
        themeKey: t.themeKey,
        label: t.label,
        subjectCount: t.subjectCount,
        coverage,
        coveragePct: Math.round(coverage * 100),
      };
    });

  return [...fromThemes(analysis.sharedGapThemes, "gap"), ...fromThemes(analysis.sharedStrengthThemes, "strength")]
    .sort(
      (a, b) =>
        b.subjectCount - a.subjectCount ||
        b.coverage - a.coverage ||
        a.label.localeCompare(b.label),
    )
    .slice(0, maxRows);
}

/** Severity stack fractions for a gap theme (sums to 1 when any severities present). */
export function severityStackFractions(
  severity: StrengthsGapsSeverityCounts | undefined | null,
): { low: number; medium: number; high: number; total: number } {
  const low = severity?.low ?? 0;
  const medium = severity?.medium ?? 0;
  const high = severity?.high ?? 0;
  const total = low + medium + high;
  if (total <= 0) return { low: 0, medium: 0, high: 0, total: 0 };
  return {
    low: low / total,
    medium: medium / total,
    high: high / total,
    total,
  };
}

function parseReport(raw: unknown): PerformanceReport | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return normalizePerformanceReport(raw as PerformanceReport);
  } catch {
    return null;
  }
}

/**
 * Build a browsable strengths/gaps model from one or more subject reports
 * (latest-per-subject snapshots as used by Ranking).
 */
export function buildStrengthsGapsBrowseModel(
  inputs: StrengthsGapsSubjectReportInput[] | null | undefined,
): StrengthsGapsBrowseModel {
  const strengths: BrowsableStrength[] = [];
  const gaps: BrowsableGap[] = [];
  let subjectsWithReports = 0;
  const list = Array.isArray(inputs) ? inputs : [];

  for (const input of list) {
    const subjectKey =
      typeof input.subjectKey === "string" && input.subjectKey.trim()
        ? input.subjectKey.trim()
        : "unknown";
    const subjectLabel =
      typeof input.subjectLabel === "string" && input.subjectLabel.trim()
        ? input.subjectLabel.trim()
        : subjectKey;

    const report = parseReport(input.report);
    if (!report) continue;
    subjectsWithReports += 1;

    const strengthList = Array.isArray(report.strengths) ? report.strengths : [];
    strengthList.forEach((text, i) => {
      const t = typeof text === "string" ? text.trim() : "";
      if (!t) return;
      strengths.push({
        id: `${subjectKey}:strength-${i}`,
        text: t,
        subjectKey,
        subjectLabel,
      });
    });

    const gapAnalysis = normalizePerformanceGapAnalysis(report.gap_analysis);
    gapAnalysis.gaps.forEach((gap, i) => {
      const title = typeof gap.title === "string" ? gap.title.trim() : "";
      if (!title) return;
      const proofOfWork =
        typeof gap.proof_of_work === "string" ? gap.proof_of_work.trim() : "";
      const suggestedRepair =
        typeof gap.suggested_repair === "string" ? gap.suggested_repair.trim() : "";
      const linkedActions = linkGapToPowActions(
        {
          title,
          proof_of_work: proofOfWork,
          suggested_repair: suggestedRepair,
          severity: normalizeSeverity(gap.severity),
        },
        gapAnalysis.next_steps,
        { gapIndex: i, subjectKey },
      );
      gaps.push({
        id: `${subjectKey}:gap-${i}`,
        title,
        severity: normalizeSeverity(gap.severity),
        proofOfWork,
        suggestedRepair,
        linkedActions,
        subjectKey,
        subjectLabel,
      });
    });
  }

  const analysis = computeStrengthsGapsAnalysis(strengths, gaps, {
    subjectCount: list.length,
    subjectsWithReports,
  });

  return { strengths, gaps, analysis };
}
