/**
 * Author limits on which practice launches a block allows:
 * Explore/Drill × Dialog/Solo, plus allowed Drill (TAP) durations.
 * Pure helpers — unit-tested without React/DB.
 *
 * Serialization keeps legacy snake_case keys (allow_open_ended / allow_timed)
 * for DB compatibility: open_ended → dialog, timed → solo.
 */

import { DURATIONS } from "@/lib/tap-score-client-helpers";
import type { LearningStyle, PracticeModality, SessionHorizon } from "@/lib/product-intent";
import {
  resolveLaunchFromStyleAndModality,
  type ProductLaunchTarget,
} from "@/lib/product-intent";

/** Canonical duration palette for Drill/TAP practice (same as launch card). */
export const BLOCK_PRACTICE_DURATION_OPTIONS: readonly number[] = DURATIONS;

export type BlockPracticeOptions = {
  allowExplore: boolean;
  allowDrill: boolean;
  /** Dialog modality (LLM-powered conversation). */
  allowDialog: boolean;
  /** Solo Exercise modality. */
  allowSolo: boolean;
  /**
   * @deprecated Prefer allowDialog. Mirrored for older readers.
   * open_ended historically meant ILE path; now maps to dialog.
   */
  allowOpenEnded: boolean;
  /**
   * @deprecated Prefer allowSolo. Mirrored for older readers.
   * timed historically meant TAP path; now maps to solo.
   */
  allowTimed: boolean;
  /**
   * Allowed Drill (TAP) lengths in minutes (subset of BLOCK_PRACTICE_DURATION_OPTIONS).
   * Empty when drill is off; when drill is on, at least one duration after normalize.
   */
  allowedDurationsMinutes: number[];
};

export type BlockPracticeOptionsInput = Partial<{
  allowExplore: unknown;
  allowDrill: unknown;
  allowDialog: unknown;
  allowSolo: unknown;
  allowOpenEnded: unknown;
  allowTimed: unknown;
  allowedDurationsMinutes: unknown;
  /** snake_case aliases from DB/JSON */
  allow_explore: unknown;
  allow_drill: unknown;
  allow_dialog: unknown;
  allow_solo: unknown;
  allow_open_ended: unknown;
  allow_timed: unknown;
  allowed_durations_minutes: unknown;
}> | null;

/** Full open product surface (both styles, both modalities, all durations). */
export function defaultBlockPracticeOptions(): BlockPracticeOptions {
  return {
    allowExplore: true,
    allowDrill: true,
    allowDialog: true,
    allowSolo: true,
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
 * Ensures at least one style and one modality; drill always has ≥1 duration when on.
 * Legacy allow_open_ended → allowDialog; allow_timed → allowSolo.
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

  // Prefer explicit dialog/solo; fall back to open_ended/timed legacy keys.
  const dialogRaw = raw.allowDialog ?? raw.allow_dialog;
  const soloRaw = raw.allowSolo ?? raw.allow_solo;
  const openRaw = raw.allowOpenEnded ?? raw.allow_open_ended;
  const timedRaw = raw.allowTimed ?? raw.allow_timed;

  let allowDialog =
    dialogRaw !== undefined
      ? asBool(dialogRaw, def.allowDialog)
      : asBool(openRaw, def.allowDialog);
  let allowSolo =
    soloRaw !== undefined
      ? asBool(soloRaw, def.allowSolo)
      : asBool(timedRaw, def.allowSolo);

  // At least one style
  if (!allowExplore && !allowDrill) {
    allowExplore = true;
    allowDrill = true;
  }
  // At least one modality
  if (!allowDialog && !allowSolo) {
    allowDialog = true;
    allowSolo = true;
  }

  let durations = parseDurationList(
    raw.allowedDurationsMinutes ?? raw.allowed_durations_minutes,
  );
  // Durations apply to Drill (TAP) launches
  if (allowDrill) {
    if (durations.length === 0) {
      durations = [...BLOCK_PRACTICE_DURATION_OPTIONS];
    }
  } else {
    durations = [];
  }

  return {
    allowExplore,
    allowDrill,
    allowDialog,
    allowSolo,
    allowOpenEnded: allowDialog,
    allowTimed: allowSolo,
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

/** Force Explore (ILE) on, keeping other author limits. */
export function withExplorePracticeEnabled(
  opts: BlockPracticeOptions | null | undefined,
): BlockPracticeOptions {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  if (n.allowExplore) return n;
  return { ...n, allowExplore: true };
}

/**
 * Practice options on purchased AYCL clones: catalog may have turned Explore
 * off, but both play-only and Play+Build clones always offer it.
 */
export function parseAyclClonePracticeOptions(raw: unknown): BlockPracticeOptions {
  return withExplorePracticeEnabled(parseBlockPracticeOptions(raw));
}

/** Parse practice options, forcing Explore when this is an AYCL clone. */
export function parseWorkspacePracticeOptions(
  raw: unknown,
  opts?: { ayclClone?: boolean },
): BlockPracticeOptions {
  return opts?.ayclClone
    ? parseAyclClonePracticeOptions(raw)
    : parseBlockPracticeOptions(raw);
}

/** Wire shape for DB / API (snake_case). Writes both new + legacy keys. */
export function serializeBlockPracticeOptions(
  opts: BlockPracticeOptions,
): Record<string, unknown> {
  const n = normalizeBlockPracticeOptions(opts);
  return {
    allow_explore: n.allowExplore,
    allow_drill: n.allowDrill,
    allow_dialog: n.allowDialog,
    allow_solo: n.allowSolo,
    // Legacy mirrors
    allow_open_ended: n.allowDialog,
    allow_timed: n.allowSolo,
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

/** Whether Dialog or Solo modality is offered. */
export function blockAllowsPracticeModality(
  opts: BlockPracticeOptions | null | undefined,
  modality: PracticeModality,
): boolean {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  return modality === "solo" ? n.allowSolo : n.allowDialog;
}

/**
 * @deprecated Prefer blockAllowsPracticeModality.
 * open_ended → dialog; timed → solo.
 */
export function blockAllowsPracticeHorizon(
  opts: BlockPracticeOptions | null | undefined,
  horizon: SessionHorizon,
): boolean {
  return blockAllowsPracticeModality(
    opts,
    horizon === "timed" ? "solo" : "dialog",
  );
}

/** Allowed Drill (TAP) durations (empty if drill disabled). */
export function blockAllowedDurations(
  opts: BlockPracticeOptions | null | undefined,
): number[] {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  if (!n.allowDrill) return [];
  return n.allowedDurationsMinutes.length
    ? n.allowedDurationsMinutes
    : [...BLOCK_PRACTICE_DURATION_OPTIONS];
}

/**
 * Whether a launch target (style × solo flag) is allowed by author limits.
 * soloEnabled true → solo modality; false → dialog.
 */
export function blockAllowsLaunchTarget(
  opts: BlockPracticeOptions | null | undefined,
  style: LearningStyle,
  soloEnabled: boolean,
): boolean {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  if (!blockAllowsPracticeStyle(n, style)) return false;
  if (soloEnabled) return n.allowSolo;
  return n.allowDialog;
}

/**
 * Default style/modality for the launch card given limits.
 */
export function resolveDefaultPracticeLaunchUi(
  opts: BlockPracticeOptions | null | undefined,
): { style: LearningStyle; solo: boolean; timebox: boolean; durationMinutes: number } {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  const style: LearningStyle = n.allowExplore
    ? "explore"
    : n.allowDrill
      ? "drill"
      : "explore";
  // Prefer dialog when available; else solo.
  const solo = n.allowDialog ? false : Boolean(n.allowSolo);
  const durations = blockAllowedDurations(n);
  const durationMinutes =
    durations.includes(15) ? 15 : durations[0] ?? 15;
  return {
    style,
    solo,
    /** @deprecated alias of solo for older UI that still reads timebox */
    timebox: solo,
    durationMinutes,
  };
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
    if (n.allowDialog) {
      out.push(resolveLaunchFromStyleAndModality(style, false).id);
    }
    if (n.allowSolo) {
      out.push(resolveLaunchFromStyleAndModality(style, true).id);
    }
  }
  return out;
}

/**
 * Compact icon keys for map badges (stable for tests/data attrs).
 * - explore / drill: style allowed
 * - dialog / solo: modality allowed
 * - open / timed: legacy aliases of dialog / solo
 */
export function practiceOptionsIconKeys(
  opts: BlockPracticeOptions | null | undefined,
): Array<"explore" | "drill" | "dialog" | "solo" | "open" | "timed"> {
  const n = normalizeBlockPracticeOptions(opts ?? null);
  const keys: Array<"explore" | "drill" | "dialog" | "solo" | "open" | "timed"> = [];
  if (n.allowExplore) keys.push("explore");
  if (n.allowDrill) keys.push("drill");
  if (n.allowDialog) {
    keys.push("dialog");
    keys.push("open");
  }
  if (n.allowSolo) {
    keys.push("solo");
    keys.push("timed");
  }
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
  if (n.allowDialog !== d.allowDialog) return true;
  if (n.allowSolo !== d.allowSolo) return true;
  if (n.allowDrill) {
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
