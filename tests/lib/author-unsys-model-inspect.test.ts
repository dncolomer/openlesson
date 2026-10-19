/**
 * Author inspect / graph navigation over a real answers-model (shipped units).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  exampleAuthorUnsysModel,
  inspectAuthorUnsysFocus,
  listAuthorUnsysHiddenStates,
  navigateAuthorUnsysGraph,
} from "@/lib/author-unsys-model";
import { sessionBranchById } from "@/lib/session-branch-model";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("author unsys model inspect", () => {
  it("lists hidden states with edge prices and navigates parent/child edges", () => {
    const model = exampleAuthorUnsysModel("Just war");
    expect(model.rootId).toBe("root");
    expect(model.focusId).toBe("root");

    const states = listAuthorUnsysHiddenStates(model);
    expect(states.length).toBe(model.branches.length);
    expect(states.length).toBeGreaterThan(6);
    const rootState = states.find((row) => row.id === "root");
    expect(rootState).toBeTruthy();
    expect(rootState?.edges.map((row) => row.toId)).toEqual(
      expect.arrayContaining(["r1", "r2", "r3"]),
    );
    expect(rootState?.edges.every((row) => Number.isFinite(row.price))).toBe(true);

    const atRoot = inspectAuthorUnsysFocus(model);
    expect(atRoot?.focusId).toBe("root");
    expect(atRoot?.parentId).toBeNull();
    expect(atRoot?.childIds).toContain("r1");
    const rootEdge = atRoot?.hiddenState.edges.find((row) => row.toId === "r1")?.price;
    expect(rootEdge).toBe(16);

    const childId = navigateAuthorUnsysGraph(model, atRoot!.focusId, {
      kind: "child",
      childId: "r1",
    });
    expect(childId).toBe("r1");
    const atChild = inspectAuthorUnsysFocus(model, childId);
    expect(atChild?.focusId).toBe("r1");
    expect(atChild?.parentId).toBe("root");
    expect(atChild?.hiddenState.title).toContain("region 1");
    const childEdge = atChild?.hiddenState.edges.find((row) => row.toId === "r1-a1")?.price;
    expect(childEdge).toBeTruthy();
    expect(childEdge).not.toBe(rootEdge);

    const back = navigateAuthorUnsysGraph(model, atChild!.focusId, { kind: "parent" });
    expect(back).toBe("root");
    expect(inspectAuthorUnsysFocus(model, back)?.focusId).toBe("root");

    const missing = navigateAuthorUnsysGraph(model, "root", {
      kind: "child",
      childId: "not-a-child",
    });
    expect(missing).toBeNull();
    expect(sessionBranchById(model, "r1")?.edges.length).toBeGreaterThan(0);

    writeEvidence(
      "author-model-inspect.log",
      [
        `states=${states.length}`,
        `rootEdge=${rootEdge}`,
        `childEdge=${childEdge}`,
        `childNav=${childId}`,
        `parentNav=${back}`,
        `focusRoot=${atRoot?.focusId}`,
        `focusChild=${atChild?.focusId}`,
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-model-inspect.log"))).toBe(true);
  });
});
