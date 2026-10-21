import type { ChapterPlanStatus } from "@/components/session-view/types";

export type IleWelcomeChapterMode = "checking" | "failed" | "continue" | "new";

export type IleWelcomeChapterExtras = {
  /** Navigated from Previous Sessions (same session id). */
  resume?: boolean;
  /** Hydrated stored steps — mini map of what exists. */
  stepCount?: number;
};

/** Continue = stored plan / resume; new = no chapters yet. */
export function ileWelcomeChapterMode(
  status: ChapterPlanStatus,
  extras: IleWelcomeChapterExtras = {},
): IleWelcomeChapterMode {
  if (extras.resume || (extras.stepCount ?? 0) > 0 || status === "exists") {
    return "continue";
  }
  if (status === "unknown") return "checking";
  if (status === "failed") return "failed";
  return "new";
}

export function ileWelcomeShowsSizePicker(
  status: ChapterPlanStatus,
  extras: IleWelcomeChapterExtras = {},
): boolean {
  return ileWelcomeChapterMode(status, extras) === "new";
}

/** Continue never regenerates; new sessions have nothing to replace. */
export function ileWelcomeShowsRegenerate(
  status: ChapterPlanStatus,
  extras: IleWelcomeChapterExtras = {},
): boolean {
  void status;
  void extras;
  return false;
}

export function ileWelcomeShowsContinuePreview(
  status: ChapterPlanStatus,
  extras: IleWelcomeChapterExtras = {},
): boolean {
  return ileWelcomeChapterMode(status, extras) === "continue";
}
