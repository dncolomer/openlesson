import {
  buildSkillGridLayout,
  isCellOccupied,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import { getSkillGridPositions } from "@/lib/skill-grid-positions";
import type { SessionPlan, SessionPlanStep } from "@/lib/storage";
import {
  CHAPTER_DONE_MAP_ICON,
  blockMapGlyphDbFields,
  randFromSeed,
  resolveBlockMapGlyph,
} from "@/lib/block-map-glyph";
import {
  ILE_CHAPTER_SOURCE_TIM,
  displayChapterMapIcon,
  isTimUnopenedChapter,
} from "@/lib/ile-tim-chapter-complete";
import { isChapterSlotBlocked, relocateChapterStepsOffBlocked } from "@/lib/ile-chapter-blocked";

export function isChapterSlotAvailable(plan: SessionPlan, row: number, col: number) {
  if (isChapterSlotBlocked(plan, row, col)) return false;
  const nodes = sessionStepsToSkillGridNodes(plan.steps);
  const { occupancy } = buildSkillGridLayout(nodes);
  if (isCellOccupied(occupancy, row, col)) return false;
  return !plan.steps.some((step) => step.position_x === col && step.position_y === row);
}

function mapStepStatus(status: SessionPlanStep["status"]): string {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
      return "in_progress";
    case "skipped":
      return "locked";
    default:
      return "available";
  }
}

/** Map session plan steps to the same node shape used by the workspace block grid.
 * ILE chapters are independent tiles — do not synthesize a linear DAG from `order`.
 */
export function sessionStepsToSkillGridNodes(steps: SessionPlanStep[]): SkillGridNode[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  return sorted.map((step, index) => {
    const glyph = resolveBlockMapGlyph({
      map_keyword: step.map_keyword,
      map_icon: step.map_icon,
      title: step.description,
    });
    return {
      id: step.id,
      title: step.description,
      status: mapStepStatus(step.status),
      is_start: index === 0,
      next_block_ids: [],
      lock_until_block_ids: [],
      position_x: step.position_x,
      position_y: step.position_y,
      map_keyword: glyph.keyword,
      map_icon:
        step.status === "completed"
          ? CHAPTER_DONE_MAP_ICON
          : isTimUnopenedChapter(step)
            ? displayChapterMapIcon(step)
            : glyph.icon,
    };
  });
}

/** Persist payload `updateSessionPlan` writes for ILE chapter add/load/edit. */
export function buildSessionPlanStepsUpdate(plan: SessionPlan): {
  steps: SessionPlanStep[];
  currentStepIndex: number;
} {
  return {
    steps: plan.steps,
    currentStepIndex: plan.currentStepIndex,
  };
}

/** Append a newly created ILE chapter at a grid slot (no DAG wiring). */
export function appendIleChapterStep(
  plan: SessionPlan,
  input: {
    id: string;
    description: string;
    position: { row: number; col: number };
    keyword?: string | null;
    map_keyword?: string | null;
    source?: SessionPlanStep["source"];
    sourceStepId?: string | null;
    timUnopened?: boolean;
    map_icon?: string | null;
  },
): SessionPlan {
  const description = String(input.description || "").trim();
  const glyph = blockMapGlyphDbFields(
    {
      keyword: input.keyword ?? input.map_keyword,
      title: description,
    },
    description,
    randFromSeed(input.id),
  );
  const timSourced = input.source === ILE_CHAPTER_SOURCE_TIM;
  const newStep: SessionPlanStep = {
    id: input.id,
    description,
    status: "pending",
    type: "task",
    order: plan.steps.length,
    position_x: input.position.col,
    position_y: input.position.row,
    map_keyword: glyph.map_keyword,
    map_icon: timSourced
      ? displayChapterMapIcon({
          id: input.id,
          description,
          map_icon: input.map_icon ?? glyph.map_icon,
          source: ILE_CHAPTER_SOURCE_TIM,
          tim_unopened: input.timUnopened !== false,
        })
      : input.map_icon ?? glyph.map_icon,
    source: input.source ?? "learner",
    source_step_id: input.sourceStepId ?? null,
    tim_unopened: timSourced ? input.timUnopened !== false : false,
  };
  return {
    ...plan,
    steps: [...plan.steps, newStep],
  };
}

/** Assign radial grid coordinates to steps that do not have saved positions yet. */
export function ensureChapterGridPositions(plan: SessionPlan): { plan: SessionPlan; changed: boolean } {
  const needsPlacement = plan.steps.some(
    (step) => step.position_x == null || step.position_y == null,
  );
  if (!needsPlacement) return { plan, changed: false };

  const skillNodes = sessionStepsToSkillGridNodes(plan.steps);
  const positions = getSkillGridPositions(skillNodes);
  let changed = false;

  const steps = plan.steps.map((step) => {
    if (step.position_x != null && step.position_y != null) return step;
    const position = positions.get(step.id);
    if (!position) return step;
    changed = true;
    return {
      ...step,
      position_x: position.position_x,
      position_y: position.position_y,
    };
  });

  const relocated = relocateChapterStepsOffBlocked(steps, plan.unusable_cells || []);
  const relocatedChanged = relocated.some((step, index) => {
    const prev = steps[index];
    return step.position_x !== prev.position_x || step.position_y !== prev.position_y;
  });
  return {
    plan: changed || relocatedChanged ? { ...plan, steps: relocated } : plan,
    changed: changed || relocatedChanged,
  };
}