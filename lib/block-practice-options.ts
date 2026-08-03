/**
 * Author limits on which practice launches a block allows:
 * Explore/Drill × Open-ended/Timed, plus allowed timed durations.
 * Pure helpers — unit-tested without React/DB.
 */

import { DURATIONS } from "@/lib/tap-score-client-helpers";
import type { LearningStyle, SessionHorizon } from "@/lib/product-intent";
import {
  resolveLaunchFromStyleAndTimebox,
  type ProductLaunchTarget,
} from "@/lib/product-intent";

/** Canonical duration palette for timed practice (same as launch card). */
export const BLOCK_PRACTICE_DURATION_OPTIONS: readonly number[] = DURATIONS;

export type BlockPracticeOptions = {
  allowExplore: boolean;
  allowDrill: boolean;
  allowOpenEnded: boolean;
  allowTimed: boolean;
  /**
   * Allowed timed lengths in minutes (subset of BLOCK_PRACTICE_DURATION_OPTIONS).
   * Empty when timed is off; when timed is on, at least one duration after normalize.
   */
  allowedDurationsMinutes: number[];
};

export type BlockPracticeOptionsInput = Partial<{
  allowExplore: unknown;
  allowDrill: unknown;
  allowOpenEnded: unknown;
  allowTimed: unknown;
  allowedDurationsMinutes: unknown;
  /** snake_case aliases from DB/JSON */
  allow_explore: unknown;
  allow_drill: unknown;
  allow_open_ended: unknown;
  allow_timed: unknown;
  allowed_durations_minutes: unknown;
}> | null;

/** Full open product surface (both styles, both horizons, all durations). */
export function defaultBlockPracticeOptions(): BlockPracticeOptions {
  return {
    allowExplore: true,
    allowDrill: true,
    allowOpenEnded: true,
    allowTimed: true,
    allowedDurationsMinutes: [...BLOCK_PRACTICE_DURATION_OPTIONS],
  };
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function parseDurationList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(BLOCK_PRACTICE_DURATION_OPTIONS);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isFinite(n)) continue;
    const mins = Math.round(n);
    if (!allowed.has(mins as (typeof BLOCK_PRACTICE_DURATION_OPTIONS)[number])) continue;
    if (seen.has(mins)) continue;
    seen.add(mins);
    out.push(mins);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Normalize author/DB payload into a valid practice options object.
 * Ensures at least one style and one horizon; timed always has ≥1 duration when on.
 */
export function normalizeBlockPracticeOptions(
  raw?: BlockPracticeOptionsInput,
): BlockPracticeOptions {
  const def = defaultBlockPracticeOptions();
  if (raw == null || typeof raw !== "object") return def;

  let allowExplore = asBool(
    raw.allowExplore ?? raw.allow_explore,
    def.allowExplore,
  );
  let allowDrill = asBool(raw.allowDrill ?? raw.allow_drill, def.allowDrill);
  let allowOpenEnded = asBool(
    raw.allowOpenEnded ?? raw.allow_open_ended,
    def.allowOpenEnded,
  );
  let allowTimed = asBool(raw.allowTimed ?? raw.allow_timed, def.allowTimed);

  // At least one style
  if (!allowExplore && !allowDrill) {
    allowExplore = true;
    allowDrill = true;
  }
  // At least one horizon
  if (!allowOpenEnded && !allowTimed) {
    allowOpenEnded = true;
    allowTimed = true;
  }

  let durations = parseDurationList(
    raw.allowedDurationsMinutes ?? raw.allowed_durations_minutes,
  );
  if (allowTimed) {
    if (durations.length === 0) {
      durations = [...BLOCK_PRACTICE_DURATION_OPTIONS];
    }
  } else {
    durations = [];
  }

  return {
    allowExplore,
    allowDrill,
    allowOpenEnded,
    allowTimed,
    allowedDurationsMinutes: durations,
  };
}

/** Parse unknown DB/JSON value (null/undefined → defaults). */
export function parseBlockPracticeOptions(raw: unknown): BlockPracticeOptions {
  if (raw == null) return defaultBlockPracticeOptions();
  if (typeof raw === "string") {
    try {
      return normalizeBlockPracticeOptions(JSON.parse(raw) as BlockPracticeOptionsInput);
    } catch {
      return defaultBlockPracticeOptions();
    }
  }
  if (typeof raw === "object") {
    return normalizeBlockPracticeOptions(raw as BlockPracticeOptionsInput);
  }
  return defaultBlockPracticeOptions();
}

/** Wire shape for DB / API (snake_case). */
export function serializeBlockPracticeOptions(
  opts: BlockPracticeOptions,
): Record<string, unknown> {
  const n = normalizeBlockPracticeOptions(opts);
  return {
    allow_explore: n.allowExplore,
    allow_drill: n.allowDrill,
    allow_open_ended: n.allowOpenEnded,
    allow_timed: n.allowTimed,
    allowed_durations_minutes: n.allowedDurationsMinutes,
  };
}

/** Whether a learning style is offered. */
export function blockAllowsPracticeStyle(
  opts: BlockPracticeOptions | null | undefined,
  style: LearningStyle,
): boolean {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  return style === "drill" ? n.allowDrill : n.allowExplore;
}

/** Whether open-ended or timed horizon is offered. */
export function blockAllowsPracticeHorizon(
  opts: BlockPracticeOptions | null | undefined,
  horizon: SessionHorizon,
): boolean {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  return horizon === "timed" ? n.allowTimed : n.allowOpenEnded;
}

/** Allowed timed durations (empty if timed disabled). */
export function blockAllowedDurations(
  opts: BlockPracticeOptions | null | undefined,
): number[] {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  if (!n.allowTimed) return [];
  return n.allowedDurationsMinutes.length
    ? n.allowedDurationsMinutes
    : [...BLOCK_PRACTICE_DURATION_OPTIONS];
}

/**
 * Whether a launch target (style × timebox) is allowed by author limits.
 */
export function blockAllowsLaunchTarget(
  opts: BlockPracticeOptions | null | undefined,
  style: LearningStyle,
  timeboxEnabled: boolean,
): boolean {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  if (!blockAllowsPracticeStyle(n, style)) return false;
  if (timeboxEnabled) return n.allowTimed;
  return n.allowOpenEnded;
}

/**
 * Default style/timebox for the launch card given limits.
 */
export function resolveDefaultPracticeLaunchUi(
  opts: BlockPracticeOptions | null | undefined,
): { style: LearningStyle; timebox: boolean; durationMinutes: number } {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  const style: LearningStyle = n.allowExplore
    ? "explore"
    : n.allowDrill
      ? "drill"
      : "explore";
  // Prefer open-ended when available; else timed.
  const timebox = n.allowOpenEnded ? false : Boolean(n.allowTimed);
  const durations = blockAllowedDurations(n);
  const durationMinutes =
    durations.includes(15) ? 15 : durations[0] ?? 15;
  return { style, timebox, durationMinutes };
}

/** Clamp chosen duration into allowed set. */
export function clampPracticeDuration(
  opts: BlockPracticeOptions | null | undefined,
  minutes: number,
): number {
  const allowed = blockAllowedDurations(opts);
  if (allowed.length === 0) return Math.round(Number(minutes) || 15);
  const m = Math.round(Number(minutes) || 0);
  if (allowed.includes(m)) return m;
  return allowed[0]!;
}

/**
 * Enabled product launch combos (up to 4) for map chrome / badges.
 */
export function enabledPracticeLaunchCombos(
  opts: BlockPracticeOptions | null | undefined,
): ProductLaunchTarget["id"][] {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  const out: ProductLaunchTarget["id"][] = [];
  for (const style of ["explore", "drill"] as const) {
    if (!blockAllowsPracticeStyle(n, style)) continue;
    if (n.allowOpenEnded) {
      out.push(resolveLaunchFromStyleAndTimebox(style, false).id);
    }
    if (n.allowTimed) {
      out.push(resolveLaunchFromStyleAndTimebox(style, true).id);
    }
  }
  return out;
}

/**
 * Compact icon keys for map badges (stable for tests/data attrs).
 * - explore / drill: style allowed
 * - open / timed: horizon allowed
 */
export function practiceOptionsIconKeys(
  opts: BlockPracticeOptions | null | undefined,
): Array<"explore" | "drill" | "open" | "timed"> {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  const keys: Array<"explore" | "drill" | "open" | "timed"> = [];
  if (n.allowExplore) keys.push("explore");
  if (n.allowDrill) keys.push("drill");
  if (n.allowOpenEnded) keys.push("open");
  if (n.allowTimed) keys.push("timed");
  return keys;
}

/** True when options differ from full default surface (for map badge density). */
export function practiceOptionsIsRestricted(
  opts: BlockPracticeOptions | null | undefined,
): boolean {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  const d = defaultBlockPracticeOptions();
  if (n.allowExplore !== d.allowExplore) return true;
  if (n.allowDrill !== d.allowDrill) return true;
  if (n.allowOpenEnded !== d.allowOpenEnded) return true;
  if (n.allowTimed !== d.allowTimed) return true;
  if (n.allowTimed) {
    if (n.allowedDurationsMinutes.length !== d.allowedDurationsMinutes.length) {
      return true;
    }
    for (let i = 0; i < n.allowedDurationsMinutes.length; i++) {
      if (n.allowedDurationsMinutes[i] !== d.allowedDurationsMinutes[i]) {
        return true;
      }
    }
  }
  return false;
}
