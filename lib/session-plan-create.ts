/**
 * Pure helpers for ILE session plan creation: prompt assembly and step
 * normalization (including spatial grid coordinates).
 */

import {
  formatInitialChaptersForPrompt,
  parseInitialChaptersLevel,
  SPATIAL_MAP_LAYOUT_RULES,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import { applyIleChapterModeInstructions } from "@/lib/ile-chapter-depth";
import type { IleSessionMode } from "@/lib/ile-mode";
import type { RequestType, SessionPlanStep } from "@/lib/domain/types";

const VALID_STEP_TYPES = new Set<RequestType>([
  "question",
  "task",
  "suggestion",
  "checkpoint",
  "feedback",
]);

/** Reasonable grid extent so a bad LLM value cannot explode layout. */
const POSITION_CLAMP = 24;

export interface SessionPlanCreatePromptVars {
  problem: string;
  objectives?: string[];
  calibration?: string;
  /** Preferred field name. */
  initialChapters?: InitialChaptersLevel | string | null;
  /** @deprecated alias for initialChapters */
  mapSize?: InitialChaptersLevel | string | null;
  /** Dialog (learning) vs Project (solo exercise) grain. */
  sessionMode?: IleSessionMode | string | null;
}

export interface RawSessionPlanStep {
  id?: string;
  type?: string;
  description?: string;
  order?: number;
  status?: SessionPlanStep["status"];
  position_x?: unknown;
  position_y?: unknown;
}

export interface NormalizedCreatePlan {
  goal: string;
  strategy: string;
  description?: string;
  steps: SessionPlanStep[];
}

function formatObjectives(objectives?: string[]): string {
  if (!objectives?.length) return "No specific objectives defined";
  return objectives.map((o, i) => `${i + 1}. ${o}`).join("\n");
}

/**
 * Fill the session_plan_create template with problem context, initial-chapters
 * band, spatial instructions, and Dialog vs Project chapter grain.
 * Does not call the model.
 */
export function composeSessionPlanCreatePrompt(
  template: string,
  vars: SessionPlanCreatePromptVars,
): string {
  const level = vars.initialChapters ?? vars.mapSize;
  const mapInfo = formatInitialChaptersForPrompt(level);

  const filled = template
    .replace("{problem}", vars.problem || "Untitled topic")
    .replace("{objectives}", formatObjectives(vars.objectives))
    .replace("{calibration}", vars.calibration || "No prior learning data available")
    // Preferred placeholders
    .replaceAll("{initial_chapters_level}", mapInfo.level)
    .replaceAll("{initial_chapters_audience}", mapInfo.band.audience)
    .replaceAll("{initial_chapters_instruction}", mapInfo.countInstruction)
    // Legacy map-size placeholders (still filled if present in overrides)
    .replaceAll("{map_size_level}", mapInfo.level)
    .replaceAll("{map_size_audience}", mapInfo.band.audience)
    .replaceAll("{map_size_instruction}", mapInfo.countInstruction)
    .replaceAll("{target_step_count}", String(mapInfo.band.target))
    .replaceAll("{min_steps}", String(mapInfo.band.min))
    .replaceAll("{max_steps}", String(mapInfo.band.max))
    .replaceAll("{spatial_map_layout_rules}", SPATIAL_MAP_LAYOUT_RULES);

  return applyIleChapterModeInstructions(filled, vars.sessionMode);
}

function parseGridCoord(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (Math.abs(value) > POSITION_CLAMP) return undefined;
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || Math.abs(n) > POSITION_CLAMP) return undefined;
    return n;
  }
  return undefined;
}

/**
 * Normalize LLM (or fixture) steps: keep non-empty descriptions, renumber
 * order, and retain unique integer grid cells (including negatives). Duplicate
 * or invalid coordinates are dropped so radial backfill can place those steps
 * later — intentional unique coords are never wiped.
 *
 * Prefer start at (0,0): first valid step without coords may receive origin
 * if free; if a step already claims (0,0) it is kept as foundation geometry.
 */
export function normalizeSessionPlanCreateSteps(
  rawSteps: RawSessionPlanStep[] | undefined | null,
  options?: { idSeed?: number },
): SessionPlanStep[] {
  const seed = options?.idSeed ?? Date.now();
  const occupied = new Set<string>();

  const mapped = (rawSteps || []).map((step, idx) => {
    const typeRaw = (step.type || "question") as RequestType;
    const type = VALID_STEP_TYPES.has(typeRaw) ? typeRaw : "question";
    const description = typeof step.description === "string" ? step.description : "";

    let position_x = parseGridCoord(step.position_x);
    let position_y = parseGridCoord(step.position_y);

    if (position_x != null && position_y != null) {
      const key = `${position_x}:${position_y}`;
      if (occupied.has(key)) {
        position_x = undefined;
        position_y = undefined;
      } else {
        occupied.add(key);
      }
    } else {
      position_x = undefined;
      position_y = undefined;
    }

    const result: SessionPlanStep = {
      id: step.id || `step_${idx + 1}_${seed}`,
      type,
      description,
      order: typeof step.order === "number" && Number.isFinite(step.order) ? step.order : idx + 1,
      status: step.status || "pending",
    };

    if (position_x != null && position_y != null) {
      result.position_x = position_x;
      result.position_y = position_y;
    }

    return result;
  });

  const valid = mapped.filter((s) => s.description.trim().length > 0);
  const renumbered = valid.map((s, idx) => ({ ...s, order: idx + 1 }));

  if (renumbered.length === 0) return renumbered;

  const hasOrigin = renumbered.some((s) => s.position_x === 0 && s.position_y === 0);
  if (!hasOrigin) {
    const first = renumbered[0];
    if (first.position_x == null || first.position_y == null) {
      renumbered[0] = { ...first, position_x: 0, position_y: 0 };
    }
  }

  return renumbered;
}

export type PersistablePlanStep = {
  id?: string;
  description: string;
  type: RequestType | string;
  order?: number;
  position_x?: number;
  position_y?: number;
  status?: SessionPlanStep["status"];
};

/**
 * Build the plan shape that gets persisted after create. First step is
 * in_progress; all provided positions on valid steps are kept.
 */
export function toPersistedCreatePlanSteps(
  steps: PersistablePlanStep[],
  options?: { idSeed?: number },
): SessionPlanStep[] {
  const seed = options?.idSeed ?? Date.now();
  return steps.map((step, idx) => {
    const typeRaw = (step.type || "question") as RequestType;
    const type = VALID_STEP_TYPES.has(typeRaw) ? typeRaw : "question";
    const persisted: SessionPlanStep = {
      id: step.id || `step_${idx + 1}_${seed}`,
      description: step.description,
      status: idx === 0 ? "in_progress" : "pending",
      type,
      order: step.order ?? idx + 1,
    };
    if (step.position_x != null && step.position_y != null) {
      persisted.position_x = step.position_x;
      persisted.position_y = step.position_y;
    }
    return persisted;
  });
}

export function resolveInitialChaptersForCreate(value: unknown): InitialChaptersLevel {
  return parseInitialChaptersLevel(value);
}

/** @deprecated Prefer resolveInitialChaptersForCreate */
export function resolveMapSizeForCreate(value: unknown): InitialChaptersLevel {
  return parseInitialChaptersLevel(value);
}
