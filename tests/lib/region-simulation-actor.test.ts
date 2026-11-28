import { describe, expect, it } from "vitest";
import { EXPLORATION_STRATEGIES } from "@/lib/region-simulation";
import { runCanvasFaithfulExplorationSample } from "@/lib/region-simulation-actor";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";

function fixtureModel() {
  const model = normalizeSessionBranchModel(
    {
      premise: "Limits",
      question: "What is a limit?",
      territory: "Limits",
      observation: "The field is open.",
      regions: [
        {
          title: "Delta",
          question: "What is delta?",
          territory: "Cheap child",
          observation: "Delta is nearby.",
          edgePrice: 10,
        },
        {
          title: "Epsilon",
          question: "What is epsilon?",
          territory: "Costly child",
          observation: "Epsilon is far.",
          edgePrice: 90,
        },
        {
          title: "Neighborhood",
          question: "What is unused?",
          territory: "Unused sibling",
          observation: "Off path.",
          edgePrice: 40,
        },
      ],
    },
    "Limits",
  );
  if (!model) throw new Error("fixture refused");
  return model;
}

function plan(strategyId: string) {
  return {
    index: 0,
    strategyId,
    flowId: "flow-a",
    problem: "What is a limit of a sequence?",
    problemIndex: 0,
    seed: `seed-${strategyId}`,
  };
}

describe("canvas-faithful exploration actor", () => {
  it("locks exploit-heavy to a cheap hid with canvas timestamps", async () => {
    const model = fixtureModel();
    const cheap = model.branches.find((row) => row.title === "Delta")!;
    const walk = await runCanvasFaithfulExplorationSample(plan("exploit-heavy"), "verify", EXPLORATION_STRATEGIES, model);
    expect(walk.sequence.length).toBeGreaterThan(0);
    expect(walk.sequence[0]).toBe(cheap.id);
    expect(walk.pow.some((row) => row.tool_name === "canvas" && row.tool_action === "draw_text")).toBe(
      true,
    );
    expect(walk.pow.some((row) => typeof row.timestamp_ms === "number" && (row.timestamp_ms || 0) > 1)).toBe(
      true,
    );
    expect(walk.embedding.raw.projectedPolicy?.sequence).toEqual(walk.sequence);
  });


  it("makes information-seeking visit a costly child", async () => {
    const model = fixtureModel();
    const costly = model.branches.find((row) => row.title === "Epsilon")!;
    const walk = await runCanvasFaithfulExplorationSample(
      plan("information-seeking"),
      "verify",
      EXPLORATION_STRATEGIES,
      model,
    );
    expect(walk.sequence).toContain(costly.id);
  });
});
