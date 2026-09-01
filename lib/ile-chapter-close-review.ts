/**
 * Mark-as-Done reviews session-global ILE Proof of Work (optionally in batches).
 * Close-override always forces close; later scoring of override is out of scope.
 */
import {
  countIlePowByType,
  ilePowCounterTotal,
  type IlePowCounterArtifact,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";

export const ILE_CHAPTER_CLOSE_BATCH_SIZE = 8;

export type IleChapterCloseReview = {
  canClose: boolean;
  reason: string;
  counters: IlePowTypeCounts;
  chapterId: string;
  batchCount: number;
};

export type IleChapterCloseDecision = {
  close: boolean;
  closeOverride: boolean;
  review: IleChapterCloseReview;
};

/** Resolve which plan step Mark as completed should close (clicked id wins). */
export function resolveIleChapterDoneIndex(
  steps: ReadonlyArray<{ id?: string | null }> | null | undefined,
  activeIndex: number,
  stepId?: string | null,
): number {
  if (!Array.isArray(steps) || steps.length === 0) return -1;
  const wanted = typeof stepId === "string" ? stepId.trim() : "";
  if (wanted) {
    const idx = steps.findIndex((s) => String(s?.id || "").trim() === wanted);
    if (idx >= 0) return idx;
  }
  if (!Number.isFinite(activeIndex)) return -1;
  const idx = Math.floor(activeIndex);
  if (idx < 0 || idx >= steps.length) return -1;
  return idx;
}

function reviewFromArtifacts(
  artifacts: readonly IlePowCounterArtifact[],
  chapter: { id: string; description?: string | null },
  batchCount: number,
): IleChapterCloseReview {
  const counters = countIlePowByType(artifacts);
  const total = ilePowCounterTotal(counters);
  const canClose = total > 0;
  return {
    canClose,
    reason: canClose
      ? "Session proof of work supports closing this chapter."
      : "No session proof of work yet — close is blocked unless overridden.",
    counters,
    chapterId: chapter.id,
    batchCount,
  };
}

export function reviewIleChapterClose(input: {
  artifacts: readonly IlePowCounterArtifact[];
  chapter: { id: string; description?: string | null };
}): IleChapterCloseReview {
  return reviewFromArtifacts(input.artifacts, input.chapter, 1);
}

export function splitIlePowBatches<T>(
  artifacts: readonly T[],
  batchSize = ILE_CHAPTER_CLOSE_BATCH_SIZE,
): T[][] {
  const size = Math.max(1, Math.floor(batchSize));
  if (!artifacts.length) return [[]];
  const batches: T[][] = [];
  for (let i = 0; i < artifacts.length; i += size) {
    batches.push(artifacts.slice(i, i + size) as T[]);
  }
  return batches;
}

/**
 * Same decision as concatenating `batches` then reviewing once.
 * Batch summaries are additive so split vs concat cannot diverge.
 */
export function reviewIleChapterCloseInBatches(input: {
  batches: readonly (readonly IlePowCounterArtifact[])[];
  chapter: { id: string; description?: string | null };
}): IleChapterCloseReview {
  const merged = input.batches.flat();
  const batchCount = Math.max(1, input.batches.length);
  return reviewFromArtifacts(merged, input.chapter, batchCount);
}

export function decideIleChapterClose(input: {
  review: Pick<IleChapterCloseReview, "canClose">;
  closeOverride: boolean;
}): { close: boolean; closeOverride: boolean } {
  if (input.closeOverride) return { close: true, closeOverride: true };
  return { close: input.review.canClose, closeOverride: false };
}

export function planIleChapterClose(input: {
  artifacts: readonly IlePowCounterArtifact[];
  chapter: { id: string; description?: string | null };
  closeOverride?: boolean;
  batches?: readonly (readonly IlePowCounterArtifact[])[];
}): IleChapterCloseDecision {
  const review = input.batches
    ? reviewIleChapterCloseInBatches({ batches: input.batches, chapter: input.chapter })
    : reviewIleChapterClose({ artifacts: input.artifacts, chapter: input.chapter });
  const decided = decideIleChapterClose({
    review,
    closeOverride: Boolean(input.closeOverride),
  });
  return { ...decided, review };
}

export const ILE_CHAPTER_UNDO_DONE_STATUS = "in_progress" as const;

/** Mark a completed chapter un-done so Work can resume it. */
export function applyIleChapterUndoDone<T extends { id: string; status: string }>(
  steps: readonly T[] | null | undefined,
  stepId: string | null | undefined,
): { steps: T[]; changed: boolean } {
  const list = Array.isArray(steps) ? steps : [];
  const id = typeof stepId === "string" ? stepId.trim() : "";
  if (!id) return { steps: [...list], changed: false };
  let changed = false;
  const next = list.map((step) => {
    if (step.id !== id || step.status !== "completed") return step;
    changed = true;
    return { ...step, status: ILE_CHAPTER_UNDO_DONE_STATUS };
  });
  return { steps: next, changed };
}
