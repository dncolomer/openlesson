/**
 * AI-use board harness: one OpenRouter round per call, checkpoint in/out.
 * Never sleeps. Clock advances by actual round latency.
 */

import type { FlowPowRow } from "@/lib/flow-embedding";
import type { OpenRouterChatResult, OpenRouterMessage, OpenRouterTool } from "@/lib/ai/openrouter";
import { openRouterChatCompletions, openRouterUserHash } from "@/lib/ai/openrouter";
import type { IleWorkCanvasScene, IleWorkCanvasSkeleton } from "@/lib/learn-work-canvas-scene";
import { serializeIleWorkCanvasScene } from "@/lib/learn-work-canvas-scene";
import {
  applyBoardOp,
  advanceOpenRouterClock,
  boardNoteTexts,
  compactScreenPow,
  createBoardRuntime,
  markOccupancyInfer,
  maybeDwellInfer,
  type BoardOp,
  type BoardRuntime,
  type RegionSimFlowKind,
} from "@/lib/region-simulation-board";
import { inferOccupancyHid } from "@/lib/region-simulation-occupancy";
import {
  aiUseCatalogById,
  type AiUseCatalogRow,
} from "@/lib/region-simulation-ai-use-catalog";
import { EXPLORATION_STRATEGIES } from "@/lib/region-simulation";
import { type SessionBranchModel } from "@/lib/session-branch-model";

export const AI_USE_MAX_TOOL_ROUNDS = 24;
export const AI_USE_MAX_BOARD_STEPS = 16;
export const AI_USE_SAMPLE_WALL_BUDGET_MS = 8 * 60 * 1000;

const BALANCED = EXPLORATION_STRATEGIES.find((row) => row.id === "balanced")!;

export const AI_USE_BOARD_TOOLS: readonly OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "board_draw",
      description: "Draw text on the Work canvas.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "board_select",
      description: "Select canvas element ids.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "string" } } },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "board_erase",
      description: "Erase canvas element ids.",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "string" } } },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "board_command",
      description:
        "Run a local canvas command. Rewrite commands require text or elements. focus/next only on Learn.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          elements: { type: "array" },
          hiddenStateId: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "board_look",
      description: "Look at the current board summary.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "board_done",
      description: "Finish this sample.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export type AiUseCheckpoint = {
  plan_cursor: number;
  sample_index: number;
  catalogId: string;
  run_id: string;
  scene: IleWorkCanvasScene;
  clockMs: number;
  hid: string | null;
  focusId: string | null;
  visited: string[];
  messages: OpenRouterMessage[];
  pow: FlowPowRow[];
  costUsd: number;
  toolRound: number;
  wallStartedAt: number;
  sequence: string[];
  emptyToolRounds: number;
  done?: boolean;
  failed?: string | null;
};

export type AiUseHarnessRoundResult = {
  checkpoint: AiUseCheckpoint;
  done: boolean;
  failed: string | null;
  costUsd: number;
  wallMs: number;
};

function jsonArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function restoreRuntime(checkpoint: AiUseCheckpoint, seed: string, flowKind: RegionSimFlowKind): BoardRuntime {
  const runtime = createBoardRuntime({ seed, flowKind });
  runtime.scene = serializeIleWorkCanvasScene(checkpoint.scene);
  runtime.clockMs = checkpoint.clockMs;
  runtime.pow = [...checkpoint.pow];
  runtime.lastInferClockMs = checkpoint.clockMs;
  return runtime;
}

function commandToOp(
  args: Record<string, unknown>,
  flowKind: RegionSimFlowKind,
): BoardOp | { error: string } {
  const id = String(args.id || "").trim();
  const text = String(args.text || "").trim();
  const skeletons = Array.isArray(args.elements) ? (args.elements as IleWorkCanvasSkeleton[]) : undefined;
  if (id === "breakdown") return { type: "breakdown" };
  if (id === "focus" || id === "focus_note") {
    if (flowKind !== "learn") return { error: "learn_only" };
    if (!text) return { error: "text_required" };
    return { type: "focus_note", text };
  }
  if (id === "next" || id === "next_note") {
    if (flowKind !== "learn") return { error: "learn_only" };
    if (!text) return { error: "text_required" };
    return {
      type: "next_note",
      text,
      hiddenStateId: String(args.hiddenStateId || "").trim() || null,
    };
  }
  if (id === "simplify" || id === "refactor" || id === "replace") {
    if (!text && !skeletons?.length) return { error: "text_or_elements_required" };
    return { type: "replace", ids: [], text: text || undefined, skeletons };
  }
  if (id === "concepts" || id === "draw" || id === "append") {
    if (!text && !skeletons?.length) return { error: "text_or_elements_required" };
    return { type: "append", text: text || undefined, skeletons };
  }
  return { error: `unknown_command:${id || "missing"}` };
}

function inferOnRuntime(input: {
  runtime: BoardRuntime;
  model: SessionBranchModel;
  hid: string | null;
  visited: Set<string>;
  seed: string;
  step: number;
  flowKind: string;
}): string | null {
  maybeDwellInfer(input.runtime);
  const next = inferOccupancyHid({
    model: input.model,
    hid: input.hid,
    strategy: BALANCED,
    visited: input.visited,
    noteTexts: boardNoteTexts(input.runtime),
    seed: input.seed,
    step: input.step,
  });
  markOccupancyInfer(input.runtime);
  if (next) {
    input.model.focusId = next;
    input.visited.add(next);
  }
  return next;
}

export function createAiUseCheckpoint(input: {
  catalog: AiUseCatalogRow;
  runId: string;
  problem: string;
  seed: string;
  flowKind: RegionSimFlowKind;
  ownerUserId: string;
  planCursor: number;
  sampleIndex: number;
  model: SessionBranchModel;
}): AiUseCheckpoint {
  const runtime = createBoardRuntime({
    seed: input.seed,
    flowKind: input.flowKind,
    problem: input.problem,
  });
  const system = [
    "You are solving a problem on a Work canvas the way a careful student would.",
    "Use tools to draw, select, break down, and rewrite. Do not click hidden states.",
    "Call board_done when you have an answer on the board.",
    `Problem: ${input.problem}`,
  ].join(" ");
  return {
    plan_cursor: input.planCursor,
    sample_index: input.sampleIndex,
    catalogId: input.catalog.id,
    run_id: input.runId,
    scene: serializeIleWorkCanvasScene(runtime.scene),
    clockMs: runtime.clockMs,
    hid: input.model.rootId,
    focusId: input.model.rootId,
    visited: [input.model.rootId],
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Start working on the board." },
    ],
    pow: runtime.pow,
    costUsd: 0,
    toolRound: 0,
    wallStartedAt: Date.now(),
    sequence: [],
    emptyToolRounds: 0,
  };
}

export async function runAiUseHarnessRound(input: {
  checkpoint: AiUseCheckpoint;
  catalog?: AiUseCatalogRow | null;
  seed: string;
  flowKind: RegionSimFlowKind;
  model: SessionBranchModel;
  ownerUserId: string;
  apiKey?: string | null;
  complete?: (req: Parameters<typeof openRouterChatCompletions>[0]) => Promise<OpenRouterChatResult>;
}): Promise<AiUseHarnessRoundResult> {
  const catalog = input.catalog || aiUseCatalogById(input.checkpoint.catalogId);
  if (!catalog) {
    return {
      checkpoint: { ...input.checkpoint, failed: "unknown_catalog" },
      done: false,
      failed: "unknown_catalog",
      costUsd: input.checkpoint.costUsd,
      wallMs: 0,
    };
  }
  if (input.checkpoint.done) {
    return {
      checkpoint: input.checkpoint,
      done: true,
      failed: null,
      costUsd: input.checkpoint.costUsd,
      wallMs: 0,
    };
  }
  if (Date.now() - input.checkpoint.wallStartedAt > AI_USE_SAMPLE_WALL_BUDGET_MS) {
    const failed = "sample_wall_budget";
    return {
      checkpoint: { ...input.checkpoint, failed, done: true },
      done: true,
      failed,
      costUsd: input.checkpoint.costUsd,
      wallMs: 0,
    };
  }
  if (input.checkpoint.toolRound >= AI_USE_MAX_TOOL_ROUNDS) {
    const checkpoint = { ...input.checkpoint, done: true };
    return { checkpoint, done: true, failed: null, costUsd: checkpoint.costUsd, wallMs: 0 };
  }

  const runtime = restoreRuntime(input.checkpoint, input.seed, input.flowKind);
  const visited = new Set(input.checkpoint.visited);
  input.model.focusId = input.checkpoint.focusId || input.model.rootId;
  let hid = input.checkpoint.hid;
  const sequence = [...input.checkpoint.sequence];
  const complete = input.complete || openRouterChatCompletions;
  const thinking =
    catalog.thinking.kind === "none"
      ? undefined
      : catalog.thinking.kind === "effort"
        ? { exclude: true, effort: catalog.thinking.effort }
        : { exclude: true, max_tokens: catalog.thinking.maxTokens };

  const result = await complete({
    model: catalog.slug,
    messages: input.checkpoint.messages,
    tools: AI_USE_BOARD_TOOLS,
    tool_choice: "required",
    max_tokens: 4096,
    user: openRouterUserHash(input.ownerUserId),
    dataCollection: catalog.dataCollection,
    reasoning: thinking,
    apiKey: input.apiKey || undefined,
  });
  advanceOpenRouterClock(runtime, result.wallMs);

  const messages: OpenRouterMessage[] = [...input.checkpoint.messages, result.message];
  let emptyToolRounds = input.checkpoint.emptyToolRounds;
  let mutatingOps = 0;
  let done = false;

  if (!result.toolCalls.length) {
    emptyToolRounds += 1;
    messages.push({
      role: "user",
      content: "Use a board tool. Tools are required.",
    });
    if (emptyToolRounds >= 2) {
      const failed = "no_tool_calls";
      const checkpoint: AiUseCheckpoint = {
        ...input.checkpoint,
        messages,
        clockMs: runtime.clockMs,
        pow: runtime.pow,
        costUsd: input.checkpoint.costUsd + result.costUsd,
        toolRound: input.checkpoint.toolRound + 1,
        emptyToolRounds,
        failed,
        done: true,
      };
      return {
        checkpoint,
        done: true,
        failed,
        costUsd: checkpoint.costUsd,
        wallMs: result.wallMs,
      };
    }
  } else {
    emptyToolRounds = 0;
    for (const call of result.toolCalls) {
      const args = jsonArgs(call.function.arguments);
      let toolContent = "";
      if (call.function.name === "board_done") {
        const next = inferOnRuntime({
          runtime,
          model: input.model,
          hid,
          visited,
          seed: input.seed,
          step: mutatingOps,
          flowKind: input.flowKind,
        });
        if (next && next !== input.model.rootId && !sequence.includes(next)) {
          sequence.push(next);
        }
        applyBoardOp(runtime, { type: "commit" });
        done = true;
        toolContent = JSON.stringify({ ok: true, done: true });
      } else if (call.function.name === "board_look") {
        toolContent = JSON.stringify({
          texts: boardNoteTexts(runtime),
          clockMs: runtime.clockMs,
        });
      } else {
        let op: BoardOp | { error: string } | null = null;
        if (call.function.name === "board_draw") {
          op = { type: "draw", text: String(args.text || ""), x: Number(args.x) || undefined, y: Number(args.y) || undefined };
        } else if (call.function.name === "board_select") {
          op = { type: "select", ids: Array.isArray(args.ids) ? args.ids.map(String) : [] };
        } else if (call.function.name === "board_erase") {
          op = { type: "erase", ids: Array.isArray(args.ids) ? args.ids.map(String) : [] };
        } else if (call.function.name === "board_command") {
          op = commandToOp(args, input.flowKind);
        } else {
          op = { error: `unknown_tool:${call.function.name}` };
        }
        if (op && "error" in op) {
          toolContent = JSON.stringify({ ok: false, error: op.error });
        } else if (op) {
          const applied = applyBoardOp(runtime, op);
          toolContent = JSON.stringify({ ok: applied.ok, reason: applied.reason || null });
          if (applied.ok && op.type !== "commit") {
            mutatingOps += 1;
            const next = inferOnRuntime({
              runtime,
              model: input.model,
              hid,
              visited,
              seed: input.seed,
              step: mutatingOps,
              flowKind: input.flowKind,
            });
            hid = next;
            if (next && next !== input.model.rootId && !sequence.includes(next)) {
              sequence.push(next);
            }
          }
        }
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: toolContent || "{}",
      });
      if (done) break;
    }
  }

  const boardOps = runtime.pow.filter((row) => row.tool_name === "canvas").length;
  if (boardOps >= AI_USE_MAX_BOARD_STEPS) done = true;

  const checkpoint: AiUseCheckpoint = {
    ...input.checkpoint,
    scene: serializeIleWorkCanvasScene(runtime.scene),
    clockMs: runtime.clockMs,
    hid,
    focusId: input.model.focusId,
    visited: [...visited],
    messages,
    pow: [...runtime.pow, compactScreenPow(runtime)],
    costUsd: input.checkpoint.costUsd + result.costUsd,
    toolRound: input.checkpoint.toolRound + 1,
    emptyToolRounds,
    sequence,
    done,
    failed: null,
  };
  return {
    checkpoint,
    done,
    failed: null,
    costUsd: checkpoint.costUsd,
    wallMs: result.wallMs,
  };
}
