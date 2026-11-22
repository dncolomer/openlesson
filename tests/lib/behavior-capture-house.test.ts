import { describe, expect, it } from "vitest";
import { BehaviorChunker } from "@/lib/behavior-capture-chunk";
import {
  attachBehaviorBoardSampler,
  BehaviorBoardSampler,
} from "@/lib/behavior-capture-pointer";
import {
  compactLaserPoints,
  laserBehaviorClass,
  recordCommandAttempt,
  recordLaserStroke,
  recordSpeech,
  recordUnsys,
} from "@/lib/behavior-capture-house";
import { speechBehaviorFields } from "@/lib/learn-thought-traces";

function drain(chunker: BehaviorChunker): Record<string, unknown>[] {
  chunker.flush();
  const rows: Record<string, unknown>[] = [];
  let next = chunker.takePending();
  while (next) {
    for (const line of next.jsonl.split("\n")) {
      if (line.trim()) rows.push(JSON.parse(line) as Record<string, unknown>);
    }
    next = chunker.takePending();
  }
  return rows;
}

describe("laser capture", () => {
  it("keeps unknown laser strokes as compact points, not scene elements", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxPending: 4 });
    const sampler = new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() });
    attachBehaviorBoardSampler(sampler);
    const points = Array.from({ length: 80 }, (_, i) => ({ x: i, y: i * 0.5 }));
    recordLaserStroke({ points, kind: "unknown" });
    const rows = drain(chunker);
    const laser = rows.find((row) => row.stream === "laser");
    expect(laser).toBeTruthy();
    expect(laser?.class).toBe("unknown");
    expect((laser?.pts as unknown[]).length).toBeLessThanOrEqual(32);
    expect(laser?.n).toBe(80);
    attachBehaviorBoardSampler(null);
  });

  it("maps question-mark to simplify", () => {
    expect(laserBehaviorClass("question-mark")).toBe("simplify");
    expect(laserBehaviorClass("unknown", "breakdown")).toBe("breakdown");
  });

  it("compacts long trails", () => {
    expect(compactLaserPoints([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
    expect(compactLaserPoints(Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }))).length).toBe(32);
  });
});

describe("speech transcripts", () => {
  it("stores transcript metadata without audio bytes", () => {
    const fields = speechBehaviorFields({
      text: "hello there",
      isFinal: true,
      confidence: 0.8,
      lang: "en-US",
      durationMs: 1200,
    });
    expect(fields.text).toBe("hello there");
    expect(fields.is_final).toBe(true);
    expect(fields.word_count).toBe(2);
    expect(JSON.stringify(fields)).not.toContain("data:audio");
    const chunker = new BehaviorChunker({ sessionId: "s1", maxPending: 4 });
    attachBehaviorBoardSampler(new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() }));
    recordSpeech({ text: "hello there", isFinal: true, confidence: 0.8, lang: "en-US" });
    const row = drain(chunker).find((item) => item.stream === "speech");
    expect(row?.text).toBe("hello there");
    expect(row?.is_final).toBe(true);
    attachBehaviorBoardSampler(null);
  });
});

describe("command attempts and occupancy", () => {
  it("records failed commands with ok false", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxPending: 4 });
    attachBehaviorBoardSampler(new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() }));
    recordCommandAttempt({ command_id: "simplify", path: "tile", ok: false, reason: "needs_selection" });
    const row = drain(chunker).find((item) => item.stream === "command_attempt");
    expect(row?.ok).toBe(false);
    expect(row?.reason).toBe("needs_selection");
    attachBehaviorBoardSampler(null);
  });

  it("records occupancy hid on unsys", () => {
    const chunker = new BehaviorChunker({ sessionId: "s1", maxPending: 4 });
    attachBehaviorBoardSampler(new BehaviorBoardSampler(chunker, { schedule: (flush) => flush() }));
    recordUnsys({ hid: "hidden-1" });
    const row = drain(chunker).find((item) => item.stream === "unsys");
    expect(row?.hid).toBe("hidden-1");
    attachBehaviorBoardSampler(null);
  });
});
