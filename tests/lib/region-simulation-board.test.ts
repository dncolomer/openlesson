import { describe, expect, it } from "vitest";
import { ILE_WORK_CANVAS_RETIRED_COMMAND_POW_IDS } from "@/lib/learn-work-canvas-pow";
import {
  applyBoardOp,
  compactScreenPow,
  createBoardRuntime,
} from "@/lib/region-simulation-board";
import { boardClockGapMs } from "@/lib/region-simulation-clock";
import { SESSION_POLICY_INFER_INTERVAL_MS } from "@/lib/session-policy-infer";

describe("region simulation board runtime", () => {
  it("advances a simulated clock without sleeping and classifies local draws", () => {
    const runtime = createBoardRuntime({
      seed: "seed-a",
      problem: "What is a limit?",
      flowKind: "verify",
    });
    expect(runtime.clockMs).toBeGreaterThan(1);
    const before = runtime.clockMs;
    applyBoardOp(runtime, { type: "draw", text: "epsilon neighborhood" });
    expect(runtime.clockMs).toBeGreaterThan(before);
    expect(runtime.pow.some((row) => row.tool_name === "canvas")).toBe(true);
    expect(
      runtime.pow.some((row) =>
        ILE_WORK_CANVAS_RETIRED_COMMAND_POW_IDS.includes(
          row.tool_action as (typeof ILE_WORK_CANVAS_RETIRED_COMMAND_POW_IDS)[number],
        ),
      ),
    ).toBe(false);
    const screen = compactScreenPow(runtime);
    expect(screen.type).toBe("screen");
    expect(String(screen.payload || "")).toContain("limit");
  });

  it("rejects Focus/Next off Learn and rewrite tools without text", () => {
    const runtime = createBoardRuntime({ seed: "seed-b", flowKind: "verify" });
    expect(applyBoardOp(runtime, { type: "focus_note", text: "here" })).toEqual({
      ok: false,
      reason: "learn_only",
    });
    expect(applyBoardOp(runtime, { type: "replace", ids: ["x"] })).toEqual({
      ok: false,
      reason: "rewrite_args",
    });
    const learn = createBoardRuntime({ seed: "seed-c", flowKind: "learn" });
    expect(applyBoardOp(learn, { type: "focus_note", text: "Focus here" }).ok).toBe(true);
  });

  it("uses typed gaps and a 20s dwell increment", () => {
    expect(boardClockGapMs({ kind: "dwell", seed: "s", seq: 1 })).toBe(
      SESSION_POLICY_INFER_INTERVAL_MS,
    );
    const burst = boardClockGapMs({ kind: "burst", seed: "s", seq: 1 });
    expect(burst).toBeGreaterThanOrEqual(400);
    expect(burst).toBeLessThanOrEqual(1200);
    const llm = boardClockGapMs({ kind: "openrouter", seed: "s", seq: 1, wallMs: 12_000 });
    expect(llm).toBe(12_000);
  });
});
