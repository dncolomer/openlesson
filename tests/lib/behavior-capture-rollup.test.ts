import { describe, expect, it } from "vitest";
import { BEHAVIOR_TOOL_NAME } from "@/lib/behavior-capture";
import {
  BEHAVIOR_ROLLUP_ACTION,
  BEHAVIOR_ROLLUP_SCHEMA,
  buildBehaviorSessionRollup,
} from "@/lib/behavior-capture-rollup";

describe("behavior session rollup", () => {
  it("indexes stream file ids without score fields", () => {
    const item = buildBehaviorSessionRollup({
      sessionId: "s1",
      identity: "ada",
      kind: "solve",
      t0: 1,
      t1: 9,
      hiddenStateWalk: ["h1", "h2"],
      streams: [{ stream: "pointer", xai_file_id: "file-1", sample_count: 12 }],
      counts: { pointer: 12, speech: 3 },
    });
    expect(item.toolName).toBe(BEHAVIOR_TOOL_NAME);
    expect(item.toolAction).toBe(BEHAVIOR_ROLLUP_ACTION);
    const body = JSON.parse(item.payload) as Record<string, unknown>;
    expect(body.schema).toBe(BEHAVIOR_ROLLUP_SCHEMA);
    expect(body.streams).toEqual([{ stream: "pointer", xai_file_id: "file-1", sample_count: 12 }]);
    expect(body).not.toHaveProperty("behavioralConvergence");
    expect(body).not.toHaveProperty("run_cost");
    expect(body).not.toHaveProperty("identity_delta");
    expect(item.payload).not.toContain("run_cost");
  });
});
