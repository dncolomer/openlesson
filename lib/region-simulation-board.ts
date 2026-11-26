/**
 * Headless Work canvas for knowledge-region simulation.
 * Local mutations only — never getChat() / callXai.
 */

import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  appendIleWorkCanvasFocusNote,
  breakdownIleWorkCanvasSelection,
} from "@/lib/learn-work-canvas-commands";
import { placeTurn } from "@/lib/learn-work-canvas-place";
import {
  classifyIleWorkCanvasSceneDiff,
  ILE_WORK_CANVAS_RETIRED_COMMAND_POW_IDS,
  ILE_WORK_CANVAS_POW_TOOL_NAME,
  type IleWorkCanvasPowEvent,
} from "@/lib/learn-work-canvas-pow";
import {
  emptyIleWorkCanvasScene,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasScene,
  type IleWorkCanvasSkeleton,
} from "@/lib/learn-work-canvas-scene";
import {
  BOARD_CLOCK_START_MS,
  nextBoardClockMs,
  type BoardClockGapKind,
} from "@/lib/region-simulation-clock";
import { REGION_SIMULATION_SOURCE } from "@/lib/region-simulation";
import { SESSION_POLICY_INFER_INTERVAL_MS } from "@/lib/session-policy-infer";

export type RegionSimFlowKind = "verify" | "learn";

export type BoardOp =
  | { type: "draw"; text: string; x?: number; y?: number }
  | { type: "select"; ids: string[] }
  | { type: "erase"; ids: string[] }
  | { type: "move"; id: string; x: number; y: number }
  | { type: "breakdown" }
  | { type: "focus_note"; text: string }
  | { type: "next_note"; text: string; hiddenStateId: string | null }
  | { type: "replace"; ids: string[]; text?: string; skeletons?: IleWorkCanvasSkeleton[] }
  | { type: "append"; text?: string; skeletons?: IleWorkCanvasSkeleton[] }
  | { type: "commit" };

const RETIRED = new Set<string>(ILE_WORK_CANVAS_RETIRED_COMMAND_POW_IDS);

function liveIds(scene: IleWorkCanvasScene): string[] {
  return scene.elements.filter((el) => !el.isDeleted && el.id).map((el) => el.id);
}

function liveTexts(scene: IleWorkCanvasScene): string[] {
  const out: string[] = [];
  for (const el of scene.elements) {
    if (el.isDeleted) continue;
    const text = String(el.originalText || el.text || "").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

function powFromEvent(event: IleWorkCanvasPowEvent, timestampMs: number): FlowPowRow | null {
  if (RETIRED.has(event.toolAction)) return null;
  return {
    type: "tool",
    tool_name: event.toolName || ILE_WORK_CANVAS_POW_TOOL_NAME,
    tool_action: event.toolAction,
    timestamp_ms: timestampMs,
    metadata: {
      ...event.metadata,
      origin: REGION_SIMULATION_SOURCE,
      simulated: true,
      via: "board-runtime",
    },
  };
}

export type BoardRuntime = {
  scene: IleWorkCanvasScene;
  clockMs: number;
  seed: string;
  flowKind: RegionSimFlowKind;
  seq: number;
  lastInferClockMs: number;
  pow: FlowPowRow[];
  burstBias: number;
};

export function createBoardRuntime(input: {
  seed: string;
  flowKind?: RegionSimFlowKind;
  problem?: string;
  burstBias?: number;
}): BoardRuntime {
  const runtime: BoardRuntime = {
    scene: emptyIleWorkCanvasScene(),
    clockMs: BOARD_CLOCK_START_MS,
    seed: input.seed,
    flowKind: input.flowKind || "verify",
    seq: 0,
    lastInferClockMs: BOARD_CLOCK_START_MS,
    pow: [],
    burstBias: input.burstBias ?? 1,
  };
  const problem = String(input.problem || "").trim();
  if (problem) applyBoardOp(runtime, { type: "draw", text: problem, x: 80, y: 80 });
  return runtime;
}

function bumpClock(runtime: BoardRuntime, kind: BoardClockGapKind, wallMs?: number): number {
  runtime.seq += 1;
  runtime.clockMs = nextBoardClockMs({
    clockMs: runtime.clockMs,
    kind,
    seed: runtime.seed,
    seq: runtime.seq,
    wallMs,
    burstBias: runtime.burstBias,
  });
  return runtime.clockMs;
}

function recordDiff(runtime: BoardRuntime, before: IleWorkCanvasScene): void {
  const events = classifyIleWorkCanvasSceneDiff(before, runtime.scene);
  for (const event of events) {
    const row = powFromEvent(event, runtime.clockMs);
    if (row) runtime.pow.push(row);
  }
}

function selectedElements(scene: IleWorkCanvasScene) {
  const ids = new Set(Object.keys(scene.appState.selectedElementIds || {}).filter(Boolean));
  return scene.elements.filter((el) => ids.has(el.id) && !el.isDeleted);
}

export function applyBoardOp(runtime: BoardRuntime, op: BoardOp): { ok: boolean; reason?: string } {
  if (op.type === "commit") {
    bumpClock(runtime, "commit");
    return { ok: true };
  }
  if ((op.type === "focus_note" || op.type === "next_note") && runtime.flowKind !== "learn") {
    return { ok: false, reason: "learn_only" };
  }
  const before = serializeIleWorkCanvasScene(runtime.scene);
  const rewrite = op.type === "breakdown" || op.type === "replace" || op.type === "append";
  bumpClock(runtime, rewrite ? "rewrite" : "burst");

  if (op.type === "draw") {
    runtime.scene = placeTurn(runtime.scene, {
      text: op.text,
      origin: op.x != null && op.y != null ? { x: op.x, y: op.y } : undefined,
    });
  } else if (op.type === "select") {
    const selected: Record<string, true> = {};
    for (const id of op.ids) if (id) selected[id] = true;
    runtime.scene = {
      ...serializeIleWorkCanvasScene(runtime.scene),
      appState: { ...runtime.scene.appState, selectedElementIds: selected },
    };
  } else if (op.type === "erase") {
    const drop = new Set(op.ids);
    const current = serializeIleWorkCanvasScene(runtime.scene);
    runtime.scene = {
      ...current,
      elements: current.elements.map((el) => (drop.has(el.id) ? { ...el, isDeleted: true } : el)),
    };
  } else if (op.type === "move") {
    const current = serializeIleWorkCanvasScene(runtime.scene);
    runtime.scene = {
      ...current,
      elements: current.elements.map((el) =>
        el.id === op.id ? { ...el, x: op.x, y: op.y } : el,
      ),
    };
  } else if (op.type === "breakdown") {
    const result = breakdownIleWorkCanvasSelection(runtime.scene, selectedElements(runtime.scene));
    runtime.scene = result.scene;
    if (!result.split) return { ok: false, reason: "breakdown_noop" };
  } else if (op.type === "focus_note") {
    runtime.scene = appendIleWorkCanvasFocusNote(runtime.scene, op.text, "focus").scene;
  } else if (op.type === "next_note") {
    runtime.scene = appendIleWorkCanvasFocusNote(
      runtime.scene,
      op.text,
      "next",
      op.hiddenStateId,
    ).scene;
  } else if (op.type === "replace") {
    if (!op.text && !(op.skeletons && op.skeletons.length)) {
      return { ok: false, reason: "rewrite_args" };
    }
    runtime.scene = placeTurn(
      runtime.scene,
      { text: op.text || "", elements: op.skeletons },
      { replaceIds: op.ids },
    );
  } else if (op.type === "append") {
    if (!op.text && !(op.skeletons && op.skeletons.length)) {
      return { ok: false, reason: "rewrite_args" };
    }
    runtime.scene = placeTurn(runtime.scene, {
      text: op.text || "",
      elements: op.skeletons,
    });
  }
  recordDiff(runtime, before);
  return { ok: true };
}

export function advanceOpenRouterClock(runtime: BoardRuntime, wallMs: number): number {
  return bumpClock(runtime, "openrouter", wallMs);
}

export function maybeDwellInfer(runtime: BoardRuntime): boolean {
  if (runtime.clockMs - runtime.lastInferClockMs < SESSION_POLICY_INFER_INTERVAL_MS) return false;
  bumpClock(runtime, "dwell");
  runtime.lastInferClockMs = runtime.clockMs;
  runtime.pow.push({
    type: "tool",
    tool_name: "unsys",
    tool_action: "dwell",
    timestamp_ms: runtime.clockMs,
    metadata: { origin: REGION_SIMULATION_SOURCE, simulated: true, dwell: true },
  });
  return true;
}

export function markOccupancyInfer(runtime: BoardRuntime): void {
  runtime.lastInferClockMs = runtime.clockMs;
}

export function boardNoteTexts(runtime: BoardRuntime): string[] {
  return liveTexts(runtime.scene);
}

export function boardLiveIds(runtime: BoardRuntime): string[] {
  return liveIds(runtime.scene);
}

export function compactScreenPow(runtime: BoardRuntime): FlowPowRow {
  const signature = boardNoteTexts(runtime).join("\n").slice(0, 400);
  return {
    type: "screen",
    tool_name: "canvas",
    tool_action: "scene",
    timestamp_ms: runtime.clockMs,
    payload: signature,
    metadata: { origin: REGION_SIMULATION_SOURCE, simulated: true, signature },
  };
}
