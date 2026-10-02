/**
 * ILE canvas session: chapter count, presets without a map type, the
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
