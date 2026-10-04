/**
 * TAP Learning canvas session: chapter count, presets without a map type, the
 * available-chapter cap, and one session-wide insight goal.
 * Pure — no React. Crafting is never blocked by the goal.
 */
import { clampIleMinInsightsPerChapter } from "@/lib/ile-turn-insights";

export const ILE_SESSION_CHAPTER_COUNT_MIN = 1;
export const ILE_SESSION_CHAPTER_COUNT_MAX = 5;
export const ILE_SESSION_CHAPTER_COUNT_DEFAULT = 1;

export const ILE_SESSION_INSIGHT_GOAL_MIN = 1;
export const ILE_SESSION_INSIGHT_GOAL_MAX = 5;
export const ILE_SESSION_INSIGHT_GOAL_DEFAULT = 1;

/** Legacy map bands (6–22) are not a chapter count. */
export function clampIleSessionChapterCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return ILE_SESSION_CHAPTER_COUNT_DEFAULT;
  if (n <= ILE_SESSION_CHAPTER_COUNT_MIN) return ILE_SESSION_CHAPTER_COUNT_MIN;
  if (n >= ILE_SESSION_CHAPTER_COUNT_MAX) return ILE_SESSION_CHAPTER_COUNT_MAX;
  return n;
}

/** One session-wide accepted-insight goal, on the same 1–5 scale. */
export function clampIleSessionInsightGoal(value: unknown): number {
  return clampIleMinInsightsPerChapter(value);
}

/**
 * Chapters the session makes available, in saved order.
 * Never longer than the clamped count, so map-sized lists stay capped.
 */
export function capIleSessionChapters<T>(
  chapters: readonly T[] | null | undefined,
  count: unknown,
): T[] {
  const limit = clampIleSessionChapterCount(count);
  return (chapters ?? []).slice(0, limit);
}

export type IleBlockSessionChapter = {
  id: string;
  prompt: string;
};

/**
 * The one live chapter: the plan's current step, so the card, the open work
 * id, and the seeded prompt stay on the scene that step already has.
 * A blank id is skipped. With no index, the first saved step is that chapter.
 */
export function ileBlockSessionChapter<
  T extends { id?: string | null; description?: string | null },
>(
  steps: readonly T[] | null | undefined,
  currentStepIndex?: number | null,
): IleBlockSessionChapter | null {
  const list = steps ?? [];
  if (list.length === 0) return null;
  const raw = Number(currentStepIndex);
  const start = Number.isFinite(raw)
    ? Math.min(Math.max(0, Math.floor(raw)), list.length - 1)
    : 0;
  for (let index = start; index < list.length; index += 1) {
    const id = String(list[index]?.id ?? "").trim();
    if (!id) continue;
    return { id, prompt: String(list[index]?.description ?? "").trim() };
  }
  for (let index = 0; index < start; index += 1) {
    const id = String(list[index]?.id ?? "").trim();
    if (!id) continue;
    return { id, prompt: String(list[index]?.description ?? "").trim() };
  }
  return null;
}

/** One open-work id: the current step from `ileBlockSessionChapter`. */
export function ileBlockSessionOpenWorkIds<
  T extends { id?: string | null; description?: string | null },
>(
  steps: readonly T[] | null | undefined,
  currentStepIndex?: number | null,
): string[] {
  const chapter = ileBlockSessionChapter(steps, currentStepIndex);
  return chapter ? [chapter.id] : [];
}

export type IleBlockSessionFrame = {
  index: number;
  id: string;
  prompt: string;
};

/**
 * The one live chapter for this render. Comes from the plan's current step,
 * so the first paint already has that id. A missing plan, empty steps, or a
 * pre-plan `step-N` id returns null. Callers must not seed until this exists.
 */
export function ileBlockSessionFrame(
  plan:
    | {
        steps?: readonly { id?: string | null; description?: string | null }[] | null;
        currentStepIndex?: number | null;
      }
    | null
    | undefined,
): IleBlockSessionFrame | null {
  const steps = plan?.steps;
  if (!plan || !steps || steps.length === 0) return null;
  const chapter = ileBlockSessionChapter(steps, plan.currentStepIndex);
  if (!chapter || /^step-\d+$/.test(chapter.id)) return null;
  const index = steps.findIndex((step) => String(step?.id ?? "").trim() === chapter.id);
  if (index < 0) return null;
  return { index, id: chapter.id, prompt: chapter.prompt };
}

/**
 * The insight goal is a target. It does not block crafting or continued work,
 * and it does not mark chapters done.
 */
export function ileInsightGoalBlocksWork(
  _acceptedCount?: unknown,
  _goal?: unknown,
): boolean {
  return false;
}

export function ileChaptersMarkedDoneForInsightGoal(): readonly string[] {
  return [];
}

export type IleCanvasSessionConfig = {
  chapterCount: number;
  insightGoal: number;
};

export function ileCanvasSessionConfigKey(sessionId: string): string {
  return `ile-canvas-session:${String(sessionId || "").trim()}`;
}

export function readIleCanvasSessionConfig(
  sessionId: string,
  storage?: Pick<Storage, "getItem"> | null,
): IleCanvasSessionConfig | null {
  const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(ileCanvasSessionConfigKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { chapterCount?: unknown; insightGoal?: unknown };
    return {
      chapterCount: clampIleSessionChapterCount(parsed.chapterCount),
      insightGoal: clampIleSessionInsightGoal(parsed.insightGoal),
    };
  } catch {
    return null;
  }
}

export function writeIleCanvasSessionConfig(
  sessionId: string,
  config: { chapterCount?: unknown; insightGoal?: unknown },
  storage?: Pick<Storage, "setItem"> | null,
): IleCanvasSessionConfig {
  const next: IleCanvasSessionConfig = {
    chapterCount: clampIleSessionChapterCount(config.chapterCount),
    insightGoal: clampIleSessionInsightGoal(config.insightGoal),
  };
  const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  store?.setItem(ileCanvasSessionConfigKey(sessionId), JSON.stringify(next));
  return next;
}
