/**
 * Canvas-faithful exploration actor: board ops then occupancy, never session_policy clicks.
 */

import { completeFlowEmbedding, type FlowKind } from "@/lib/flow-embedding";
import {
  applyBoardOp,
  boardNoteTexts,
  compactScreenPow,
  createBoardRuntime,
  markOccupancyInfer,
  maybeDwellInfer,
  type BoardOp,
  type RegionSimFlowKind,
} from "@/lib/region-simulation-board";
import { inferOccupancyHid } from "@/lib/region-simulation-occupancy";
import {
  EXPLORATION_STRATEGIES,
  explorationStrategyById,
  regionSimulationPow,
  seededSimulationTree,
  type ExplorationStrategy,
  type RegionSimulationSamplePlan,
  type RegionSimulationWalk,
} from "@/lib/region-simulation";
import { sessionHarnessExploreLine } from "@/lib/session-harness";
import {
  sessionBranchById,
  sessionBranchInferCandidates,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

function firstTokens(value: string, count: number): string {
  return value.split(/\s+/).filter(Boolean).slice(0, count).join(" ");
}

function hidText(model: SessionBranchModel, hid: string | null, fallback: string): string {
  const branch = sessionBranchById(model, hid || model.rootId);
  return String(branch?.question || branch?.title || fallback).trim() || fallback;
}

function cheapChildTitle(model: SessionBranchModel, hid: string | null): string {
  const parent = sessionBranchById(model, hid || model.rootId);
  if (!parent?.edges.length) return parent?.title || model.chapterTitle;
  const ranked = [...parent.edges].sort((a, b) => a.price - b.price || a.toId.localeCompare(b.toId));
  const child = sessionBranchById(model, ranked[0]?.toId || "");
  return child?.title || parent.title;
}

function unusedTitle(model: SessionBranchModel, visited: ReadonlySet<string>): string {
  const next = model.branches.find((branch) => !visited.has(branch.id) && branch.id !== model.rootId);
  return next?.title || model.chapterTitle;
}

export function pickExplorationOp(input: {
  strategy: ExplorationStrategy;
  step: number;
  hid: string | null;
  model: SessionBranchModel;
  liveIds: string[];
  flowKind: RegionSimFlowKind;
  visited: ReadonlySet<string>;
  problem: string;
}): BoardOp | "commit" {
  const prefer = input.strategy.params.prefer;
  const hidQuestion = hidText(input.model, input.hid, input.problem);
  if (prefer === "cheap") {
    if (input.step === 0) return { type: "draw", text: firstTokens(hidQuestion, 12) };
    return "commit";
  }
  if (prefer === "novel") {
    if (input.step >= 2) return "commit";
    const slot = input.step;
    return {
      type: "draw",
      text: unusedTitle(input.model, input.visited),
      x: 80 + 40 * (slot % 6),
      y: 80 + 40 * Math.floor(slot / 6),
    };
  }
  if (prefer === "lineage") {
    if (input.flowKind === "learn") {
      if (input.step === 0) return { type: "focus_note", text: hidQuestion };
      if (input.step === 1) {
        const next = sessionHarnessExploreLine({ model: input.model });
        return {
          type: "next_note",
          text: next.text,
          hiddenStateId: next.toId,
        };
      }
      return "commit";
    }
    if (input.step >= 2) return "commit";
    return {
      type: "draw",
      text: sessionHarnessExploreLine({ model: input.model }).text,
    };
  }
  const exploring =
    prefer === "costly" ||
    (prefer === "balanced" && input.step < input.strategy.params.commitAfter);
  if (prefer === "balanced" && !exploring) {
    if (input.step === input.strategy.params.commitAfter) {
      return { type: "draw", text: cheapChildTitle(input.model, input.hid) };
    }
    return "commit";
  }
  const phase = input.step % 3;
  if (phase === 0) return { type: "draw", text: hidQuestion };
  if (phase === 1) return { type: "select", ids: input.liveIds.slice(-2) };
  return { type: "breakdown" };
}

export function runCanvasFaithfulExplorationSample(
  plan: RegionSimulationSamplePlan,
  flowKind: FlowKind = "verify",
  catalog: readonly ExplorationStrategy[] = EXPLORATION_STRATEGIES,
  referenceModel?: SessionBranchModel | null,
): RegionSimulationWalk {
  const strategy =
    catalog.find((row) => row.id === plan.strategyId) ?? explorationStrategyById(plan.strategyId);
  if (!strategy) throw new Error(`Unknown exploration strategy: ${plan.strategyId}`);
  const model = referenceModel
    ? { ...referenceModel, focusId: referenceModel.rootId }
    : seededSimulationTree({
        problem: plan.problem,
        seed: plan.seed,
        strategyId: strategy.id,
      });
  const boardKind: RegionSimFlowKind = flowKind;
  const burstBias = strategy.params.prefer === "cheap" ? 0.7 : strategy.params.prefer === "costly" ? 1.2 : 1;
  const runtime = createBoardRuntime({
    seed: plan.seed,
    flowKind: boardKind,
    problem: plan.problem,
    burstBias,
  });
  const visited = new Set<string>([model.rootId]);
  const sequence: string[] = [];
  let hid: string | null = model.rootId;
  let lastHid: string | null = null;
  let committed = 0;
  const maxSteps = Math.max(1, strategy.params.maxSteps);

  const infer = (step: number) => {
    maybeDwellInfer(runtime);
    const next = inferOccupancyHid({
      model,
      hid,
      strategy,
      visited,
      noteTexts: boardNoteTexts(runtime),
      seed: plan.seed,
      step,
    });
    markOccupancyInfer(runtime);
    if (next) {
      hid = next;
      model.focusId = next;
      visited.add(next);
    }
    return next;
  };

  for (let step = 0; step < maxSteps; step += 1) {
    const liveIds = runtime.scene.elements.filter((el) => !el.isDeleted).map((el) => el.id);
    const op = pickExplorationOp({
      strategy,
      step,
      hid,
      model,
      liveIds,
      flowKind: boardKind,
      visited,
      problem: plan.problem,
    });
    if (op === "commit") {
      const next = infer(step);
      if (next && next !== model.rootId) sequence.push(next);
      break;
    }
    const applied = applyBoardOp(runtime, op);
    if (!applied.ok && op.type === "breakdown") {
      applyBoardOp(runtime, { type: "draw", text: hidText(model, hid, plan.problem) });
    }
    const next = infer(step);
    if (next && lastHid === next) committed += 1;
    else committed = 1;
    lastHid = next;
    if (next && next !== model.rootId && !sequence.includes(next)) {
      sequence.push(next);
    }
    if (committed > strategy.params.commitAfter && lastHid === next && next) {
      applyBoardOp(runtime, { type: "commit" });
      break;
    }
  }

  const walkSequence = sequence;
  const pow = [
    ...regionSimulationPow({
      strategy,
      problem: plan.problem,
      flowId: plan.flowId,
      seed: plan.seed,
      sequence: walkSequence,
    }),
    ...runtime.pow,
    compactScreenPow(runtime),
  ];
  const embedding = completeFlowEmbedding({
    flowKind,
    model,
    sequence: walkSequence,
    pow,
    audioEnforced: false,
  });
  return { model, sequence: walkSequence, pow, embedding };
}
