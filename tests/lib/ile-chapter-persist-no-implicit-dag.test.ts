/**
 * ILE chapter add: persist payload includes the new step; grid mapper
 * does not synthesize a linear DAG from step order.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  appendIleChapterStep,
  buildSessionPlanStepsUpdate,
  sessionStepsToSkillGridNodes,
} from "@/lib/chapter-skill-grid";
import type { SessionPlan, SessionPlanStep } from "@/lib/storage";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-6cd3683b162d/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function step(partial: Partial<SessionPlanStep> & Pick<SessionPlanStep, "id" | "order" | "description">): SessionPlanStep {
  return {
    status: "pending",
    type: "task",
    position_x: partial.position_x ?? 0,
    position_y: partial.position_y ?? 0,
    ...partial,
  };
}

function plan(steps: SessionPlanStep[]): SessionPlan {
  return {
    id: "plan-1",
    sessionId: "session-1",
    userId: "user-1",
    goal: "Learn",
    strategy: "",
    steps,
    currentStepIndex: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("appendIleChapterStep + persist payload (shipped)", () => {
  it("puts the new chapter id/description/position in the updateSessionPlan steps payload", () => {
    const existing = step({
      id: "ch-a",
      order: 0,
      description: "First chapter",
      position_x: 0,
      position_y: 0,
    });
    const updated = appendIleChapterStep(plan([existing]), {
      id: "ch-new",
      description: "Adjacent follow-up",
      position: { row: 1, col: 2 },
    });
    const payload = buildSessionPlanStepsUpdate(updated);
    const added = payload.steps.find((item) => item.id === "ch-new");
    expect(payload.steps.map((item) => item.id)).toEqual(["ch-a", "ch-new"]);
    expect(added).toMatchObject({
      id: "ch-new",
      description: "Adjacent follow-up",
      position_x: 2,
      position_y: 1,
      status: "pending",
      order: 1,
    });

    const mutate = read("components/session-view/use-session-mutate.ts");
    expect(mutate).toContain("appendIleChapterStep");
    expect(mutate).toContain("buildSessionPlanStepsUpdate");
    const persistFn = mutate.slice(
      mutate.indexOf("const persistPlanSteps"),
      mutate.indexOf("const handleEnsureChapterPositions"),
    );
    expect(persistFn.indexOf("updateSessionPlan")).toBeGreaterThan(-1);
    expect(persistFn.indexOf("setSessionPlan")).toBeGreaterThan(persistFn.indexOf("updateSessionPlan"));
    expect(persistFn).not.toContain("console.warn");
    expect(mutate).toContain("handleAddChapter");
    expect(mutate).toContain("appendIleChapterStep(currentPlan");

    writeScratch(
      "ile-chapter-persist.txt",
      [
        `ids=${payload.steps.map((item) => item.id).join(",")}`,
        `added=${added?.id}:${added?.description}@${added?.position_x},${added?.position_y}`,
        "persist=updateSessionPlan before setSessionPlan",
      ].join("\n"),
    );
  });
});

describe("sessionStepsToSkillGridNodes (shipped)", () => {
  it("does not chain a newly added last step to the previous via order", () => {
    const existing = step({
      id: "ch-a",
      order: 0,
      description: "First chapter",
      position_x: 0,
      position_y: 0,
    });
    const updated = appendIleChapterStep(plan([existing]), {
      id: "ch-new",
      description: "New ILE chapter",
      position: { row: 0, col: 1 },
    });
    const nodes = sessionStepsToSkillGridNodes(updated.steps);
    const first = nodes.find((node) => node.id === "ch-a");
    const added = nodes.find((node) => node.id === "ch-new");
    expect(added?.next_block_ids).toEqual([]);
    expect(added?.lock_until_block_ids).toEqual([]);
    expect(first?.next_block_ids).toEqual([]);
    expect(first?.lock_until_block_ids).toEqual([]);
    expect(first?.next_block_ids).not.toEqual(["ch-new"]);
    expect(added?.lock_until_block_ids).not.toEqual(["ch-a"]);

    const mapper = read("lib/chapter-skill-grid.ts");
    expect(mapper).not.toContain("sorted[index + 1].id");
    expect(mapper).not.toContain("sorted[index - 1].id");

    const view = readSessionViewSurface();
    expect(view).toContain("handleAddChapter");

    writeScratch(
      "ile-chapter-no-implicit-dag.txt",
      [
        `first.next=${JSON.stringify(first?.next_block_ids)}`,
        `added.lock=${JSON.stringify(added?.lock_until_block_ids)}`,
        "no order-linear next/lock",
      ].join("\n"),
    );
  });
});
