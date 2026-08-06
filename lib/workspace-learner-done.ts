/**
 * Learner Done flow: PoW recommendation, mark-done regardless, progress steps
 * for snapshot/LWM update + DAG unlock. Pure orchestration helpers.
 */

import {
  isBlockCompletedStatus,
  isBlockLockedUntilCompleted,
  type MapGroundBlockRef,
} from "@/lib/map-ground-rules";

export type LearnerDoneRecommendation = "ok" | "not_ok" | "unknown";

export type LearnerPowRecentItem = {
  type: string;
  tool_name?: string | null;
  created_at?: string | null;
  quality?: string | null;
  block_id?: string | null;
};

export type LearnerPowSummary = {
  /** Count of proof-of-work records for this user/workspace (or block). */
  powCount: number;
  /** Optional quality/score signal 0–100 when available. */
  latestScore?: number | null;
  /** Human-readable notes from system check. */
  notes?: string | null;
  /** Post-filter type breakdown for Progress summary. */
  byType?: Array<{ type: string; count: number }>;
  /** Recent artifacts (already subject/block filtered by API when requested). */
  recent?: LearnerPowRecentItem[];
  /** Echo: block id filter when Progress is block-scoped. */
  blockId?: string | null;
  subjectKey?: string | null;
};

/**
 * Sum `by_type[].count` — these are **post subject/quality filter** counts
 * from aggregateProofOfWorkStats (unlike practice_artifacts/total_artifacts which
 * are sample-wide quality tallies before subject filter).
 */
export function sumPowByTypeCounts(byType: unknown): number | null {
  if (!Array.isArray(byType) || byType.length === 0) return null;
  let sum = 0;
  let any = false;
  for (const entry of byType) {
    if (!entry || typeof entry !== "object") continue;
    const c = Number((entry as { count?: unknown }).count);
    if (!Number.isFinite(c) || c < 0) continue;
    sum += Math.floor(c);
    any = true;
  }
  return any ? sum : null;
}

/**
 * Parse GET /api/workspace/proof-of-work-stats JSON into LearnerPowSummary.
 *
 * Shipped shape: `{ stats: WorkspaceProofOfWorkStats }` where:
 * - `practice_artifacts` / `scored_artifacts` / `total_artifacts` = **unfiltered sample**
 *   quality breakdown (ignore for user-scoped reco when subjectKey=me).
 * - `by_type[].count` = counts **after** quality + subject filters (use this).
 * - `filters.subject_key` / `filters.quality` echo the request.
 *
 * For learner Done we want **all existing PoW of the user** → host should call
 * with subjectKey=me & quality=all, then powCount = sum(by_type).
 */
export function parseLearnerPowSummaryFromApi(data: unknown): LearnerPowSummary {
  if (!data || typeof data !== "object") {
    return { powCount: 0, notes: "Empty PoW response" };
  }
  const root = data as Record<string, unknown>;
  const stats =
    root.stats && typeof root.stats === "object"
      ? (root.stats as Record<string, unknown>)
      : root;

  const filters =
    stats.filters && typeof stats.filters === "object"
      ? (stats.filters as Record<string, unknown>)
      : {};
  const subjectKey = String(
    filters.subject_key ?? filters.subjectKey ?? "all",
  ).trim() || "all";
  const qualityFilter = String(
    filters.quality ?? "all",
  ).trim() || "all";

  // Post-filter artifact count (subject + quality aware).
  const filteredCount = sumPowByTypeCounts(stats.by_type);

  // Sample-wide quality tallies — workspace sample, NOT user-scoped.
  const sampleTotal = Number(stats.total_artifacts ?? stats.totalArtifacts ?? NaN);
  const samplePractice = Number(
    stats.practice_artifacts ?? stats.practiceArtifacts ?? NaN,
  );
  const sampleScored = Number(
    stats.scored_artifacts ?? stats.scoredArtifacts ?? NaN,
  );

  let powCount: number;
  if (filteredCount !== null) {
    // Always prefer by_type when present (empty array → 0 after subject filter).
    powCount = filteredCount;
  } else if (subjectKey === "me" || (subjectKey !== "all" && subjectKey.length > 0)) {
    // Scoped request without by_type: do NOT fall back to workspace totals.
    powCount = 0;
  } else if (Number.isFinite(sampleTotal) && sampleTotal >= 0) {
    powCount = Math.floor(sampleTotal);
  } else {
    powCount = 0;
  }

  const scoreRaw = Number(
    stats.latestScore ?? stats.score ?? stats.lwm_score ?? stats.avg_score ?? NaN,
  );

  const blockIdRaw = filters.block_id ?? filters.blockId;
  const blockId =
    typeof blockIdRaw === "string" && blockIdRaw.trim()
      ? blockIdRaw.trim()
      : null;

  const byType: Array<{ type: string; count: number }> = [];
  if (Array.isArray(stats.by_type)) {
    for (const entry of stats.by_type) {
      if (!entry || typeof entry !== "object") continue;
      const type = String((entry as { type?: unknown }).type || "other");
      const count = Number((entry as { count?: unknown }).count);
      if (!Number.isFinite(count) || count <= 0) continue;
      byType.push({ type, count: Math.floor(count) });
    }
  }

  const recent: LearnerPowRecentItem[] = [];
  if (Array.isArray(stats.recent)) {
    for (const row of stats.recent) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      recent.push({
        type: String(r.type || "unknown"),
        tool_name: r.tool_name != null ? String(r.tool_name) : null,
        created_at: r.created_at != null ? String(r.created_at) : null,
        quality: r.quality != null ? String(r.quality) : null,
        block_id: r.block_id != null ? String(r.block_id) : null,
      });
    }
  }

  const notesParts = [
    `subject=${subjectKey}`,
    blockId ? `block=${blockId.slice(0, 8)}` : null,
    `quality=${qualityFilter}`,
    filteredCount !== null ? `artifacts=${filteredCount}` : null,
    Number.isFinite(samplePractice) ? `sample_practice=${Math.floor(samplePractice)}` : null,
    Number.isFinite(sampleScored) ? `sample_scored=${Math.floor(sampleScored)}` : null,
  ].filter(Boolean);

  return {
    powCount,
    latestScore: Number.isFinite(scoreRaw) ? scoreRaw : null,
    notes: notesParts.join(" · "),
    byType,
    recent,
    blockId,
    subjectKey,
  };
}

/**
 * Recommend whether the system believes the learner has enough PoW to mark Done.
 * User may still Mark as Done regardless.
 */
export function recommendLearnerDone(
  summary: LearnerPowSummary | null | undefined,
): {
  recommendation: LearnerDoneRecommendation;
  rationale: string;
} {
  if (!summary) {
    return {
      recommendation: "unknown",
      rationale: "No proof-of-work summary yet — explore or drill first if you can.",
    };
  }
  const count = Math.max(0, Math.floor(Number(summary.powCount) || 0));
  const score =
    summary.latestScore == null || !Number.isFinite(Number(summary.latestScore))
      ? null
      : Math.max(0, Math.min(100, Number(summary.latestScore)));

  if (count <= 0) {
    return {
      recommendation: "not_ok",
      rationale:
        "No proof-of-work found for this block yet. You can still use Mark Done anyway — Generator and unlocks still run.",
    };
  }
  if (score != null && score < 40) {
    return {
      recommendation: "not_ok",
      rationale: `Latest practice signal is low (${Math.round(score)}). More Explore/Drill may help — or mark Done anyway.`,
    };
  }
  if (count >= 1 && (score == null || score >= 40)) {
    return {
      recommendation: "ok",
      rationale:
        score != null
          ? `Found ${count} PoW item(s); latest signal ${Math.round(score)}. Ready to mark Done.`
          : `Found ${count} PoW item(s). System recommendation: OK to mark Done.`,
    };
  }
  return {
    recommendation: "unknown",
    rationale: summary.notes || "Insufficient signal for a firm recommendation.",
  };
}

/** Async Done pipeline stages (progress bar). */
export type LearnerDoneProgressPhase =
  | "idle"
  | "checking_pow"
  | "awaiting_user"
  | "marking_done"
  | "snapshot_lwm"
  | "applying_unlocks"
  | "complete"
  | "error";

export type LearnerDoneProgress = {
  phase: LearnerDoneProgressPhase;
  /** 0–100 UI progress. */
  percent: number;
  message: string;
  recommendation?: LearnerDoneRecommendation;
  rationale?: string;
  error?: string | null;
};

export function initialLearnerDoneProgress(): LearnerDoneProgress {
  return { phase: "idle", percent: 0, message: "" };
}

export function learnerDoneProgressForPhase(
  phase: LearnerDoneProgressPhase,
  extra?: Partial<LearnerDoneProgress>,
): LearnerDoneProgress {
  const map: Record<LearnerDoneProgressPhase, { percent: number; message: string }> = {
    idle: { percent: 0, message: "" },
    checking_pow: { percent: 15, message: "Checking your proof of work…" },
    awaiting_user: { percent: 35, message: "Review recommendation" },
    marking_done: { percent: 55, message: "Marking block done…" },
    snapshot_lwm: { percent: 75, message: "Updating learning world model…" },
    applying_unlocks: { percent: 90, message: "Applying unlock rules…" },
    complete: { percent: 100, message: "Done" },
    error: { percent: 100, message: "Something went wrong" },
  };
  const base = map[phase];
  return {
    phase,
    percent: base.percent,
    message: base.message,
    error: null,
    ...extra,
  };
}

/**
 * After marking a block completed, recompute which blocks unlock
 * (lock_until prereqs all completed).
 */
export function blocksUnlockedAfterDone(input: {
  completedBlockId: string;
  blocks: readonly MapGroundBlockRef[];
}): {
  nextBlocks: MapGroundBlockRef[];
  unlockedIds: string[];
} {
  const completedId = String(input.completedBlockId || "").trim();
  const beforeById = new Map(
    input.blocks.map((b) => [String(b.id), b] as const),
  );
  const nextBlocks = input.blocks.map((b) => {
    if (String(b.id) === completedId) {
      return { ...b, status: "completed" };
    }
    return { ...b };
  });
  const afterById = new Map(
    nextBlocks.map((b) => [String(b.id), b] as const),
  );
  const unlockedIds: string[] = [];
  for (const b of nextBlocks) {
    if (String(b.id) === completedId) continue;
    const wasLocked = isBlockLockedUntilCompleted(b, beforeById);
    const nowLocked = isBlockLockedUntilCompleted(b, afterById);
    if (wasLocked && !nowLocked) {
      unlockedIds.push(String(b.id));
    }
  }
  return { nextBlocks, unlockedIds };
}

/** Status to persist when learner marks Done (no In Progress in this flow). */
export function learnerDoneStatusValue(): "completed" {
  return "completed";
}

export function isLearnerDoneStatus(status: string | null | undefined): boolean {
  return isBlockCompletedStatus(status);
}
