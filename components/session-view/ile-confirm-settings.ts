import type { ChapterPlanStatus } from "@/components/session-view/types";

/** Confirm Settings stays inert until the existing-chapters check resolves. */
export function isIleConfirmSettingsBlocked(
  chapterPlanStatus: ChapterPlanStatus,
  planLoading: boolean,
  isPreparing: boolean,
): boolean {
  return chapterPlanStatus === "unknown" || planLoading || isPreparing;
}
