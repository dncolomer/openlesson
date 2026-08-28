import type { ChapterPlanStatus } from "@/components/session-view/types";

/**
 * Confirm Settings stays inert until the cheap existence check resolves.
 * Objectives generation and full-plan hydrate must not keep it blocked.
 */
export function isIleConfirmSettingsBlocked(
  chapterPlanStatus: ChapterPlanStatus,
  isPreparing: boolean,
): boolean {
  return chapterPlanStatus === "unknown" || isPreparing;
}
