import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BehaviorChunker } from "@/lib/behavior-capture-chunk";
import {
  BehaviorBoardSampler,
  attachBehaviorBoardSampler,
  behaviorBoardSampler,
  sampleBoardAppState,
  sessionMountsBehaviorPointer,
} from "@/lib/behavior-capture-pointer";
import { classifyIleWorkCanvasSceneDiff } from "@/lib/learn-work-canvas-pow";
import { emptyIleWorkCanvasScene } from "@/lib/learn-work-canvas";

const ROOT = join(__dirname, "../..");

function linesOf(chunker: BehaviorChunker): Record<string, unknown>[] {
  chunker.flush();
  const out: Record<string, unknown>[] = [];
  let next = chunker.takePending();
  while (next) {
    for (const line of next.jsonl.split("\n")) {
      if (line.trim()) out.push(JSON.parse(line) as Record<string, unknown>);
    }
    next = chunker.takePending();
  }
  return out;
}

describe("BehaviorBoardSampler", () => {
  it("records pointer edges and pointer samples without serializing the board", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxOpenBytes: 50_000, maxPending: 8 });
    const sampler = new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() });
    sampler.onPointerUpdate({ pointer: { x: 10.44, y: 20.11 }, button: "down" }, 1);
    sampler.onPointerUpdate({ pointer: { x: 12, y: 22 }, button: "down" }, 40);
    sampler.onPointerUpdate({ pointer: { x: 12, y: 22 }, button: "up" }, 80);
    const rows = linesOf(chunker);
    expect(rows.some((row) => row.stream === "pointer_edge" && row.type === "down")).toBe(true);
    expect(rows.some((row) => row.stream === "pointer_edge" && row.type === "up")).toBe(true);
    expect(rows.some((row) => row.stream === "pointer")).toBe(true);
    expect(rows[0]?.x).toBe(10.4);
  });

  it("skips unchanged hover", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxOpenBytes: 50_000, maxPending: 8 });
    const sampler = new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() });
    sampler.onPointerUpdate({ pointer: { x: 1, y: 1 }, button: "up" }, 0);
    sampler.onPointerUpdate({ pointer: { x: 1, y: 1 }, button: "up" }, 200);
    sampler.onPointerUpdate({ pointer: { x: 1, y: 1 }, button: "up" }, 400);
    const hovers = linesOf(chunker).filter((row) => row.stream === "hover");
    expect(hovers.length).toBe(1);
  });

  it("tags reveal viewport separately from hand pan", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxOpenBytes: 50_000, maxPending: 8 });
    const sampler = new BehaviorBoardSampler(chunker, {
      now: () => 1000,
      schedule: (flush) => flush(),
    });
    sampler.onViewport({ scrollX: 0, scrollY: 0, zoom: 1, via: "hand" }, 1000);
    sampler.markReveal(1000);
    sampler.onViewport({ scrollX: 40, scrollY: 10, zoom: 1 }, 1010);
    const rows = linesOf(chunker).filter((row) => row.stream === "viewport");
    expect(rows[0]?.via).toBe("hand");
    expect(rows[1]?.via).toBe("reveal");
  });

  it("records tool and edit transitions once", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxOpenBytes: 50_000, maxPending: 8 });
    const sampler = new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() });
    sampleBoardAppState(sampler, {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      activeTool: { type: "freedraw" },
      editingTextElement: null,
    }, 1);
    sampleBoardAppState(sampler, {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      activeTool: { type: "freedraw" },
      editingTextElement: { id: "t" },
    }, 2);
    sampleBoardAppState(sampler, {
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      activeTool: { type: "freedraw" },
      editingTextElement: { id: "t" },
    }, 3);
    const rows = linesOf(chunker);
    expect(rows.filter((row) => row.stream === "tool_state")).toHaveLength(1);
    expect(rows.filter((row) => row.stream === "edit_state")).toHaveLength(2);
  });
});

describe("pan/zoom stay out of canvas work PoW", () => {
  it("does not classify a scroll-only scene as a work action", () => {
    const before = emptyIleWorkCanvasScene();
    const after = {
      ...before,
      appState: { ...(before.appState ?? {}), scrollX: 80, scrollY: 40, zoom: { value: 1.4 } },
    };
    expect(classifyIleWorkCanvasSceneDiff(before, after)).toEqual([]);
  });
});

describe("board sampler sources", () => {
  it("does not call Excalidraw serialize on the pointer path", () => {
    const src = readFileSync(join(ROOT, "lib/behavior-capture-pointer.ts"), "utf8");
    expect(src).not.toContain("exportToBlob");
    expect(src).not.toContain("serializeAsJSON");
  });

  it("wires Excalidraw pointer updates into the sampler", () => {
    const canvas = readFileSync(join(ROOT, "components/ExcalidrawCanvas.tsx"), "utf8");
    expect(canvas).toContain("behaviorBoardSampler");
    expect(canvas).toContain("onPointerUpdate");
    expect(canvas).toContain("sampleBoardAppState");
  });
});

describe("sessionMountsBehaviorPointer", () => {
  it("does not mount pointer JSONL on Calibrate", () => {
    expect(sessionMountsBehaviorPointer({ kind: "calibrate" })).toBe(false);
    expect(sessionMountsBehaviorPointer({ kind: "solve" })).toBe(true);
    expect(sessionMountsBehaviorPointer({ metadata: { play_mode: "scout" } })).toBe(false);
  });
});

describe("attachBehaviorBoardSampler", () => {
  it("holds one sampler outside React", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1" });
    const sampler = new BehaviorBoardSampler(chunker);
    attachBehaviorBoardSampler(sampler);
    expect(behaviorBoardSampler()).toBe(sampler);
    attachBehaviorBoardSampler(null);
    expect(behaviorBoardSampler()).toBeNull();
  });
});
