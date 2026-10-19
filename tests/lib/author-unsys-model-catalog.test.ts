/**
 * Author inspect/seed for a single unsys graph (shipped units).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addAuthorUnsysBranch,
  authorUnsysSeedForPersist,
  authorUnsysWorkingModel,
  exampleAuthorUnsysModel,
  inspectAuthorUnsysFocus,
  normalizeAuthorUnsysModelSeed,
  resolveStudentUnsysPrepare,
  setAuthorUnsysEdgePrice,
  studentSessionModelFromAuthorSeed,
} from "@/lib/author-unsys-model";
import { sessionBranchById } from "@/lib/session-branch-model";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("author unsys catalog seeds", () => {
  it("inspects priced edges and student prepare uses the seed", () => {
    const model = exampleAuthorUnsysModel("Just war");
    expect(inspectAuthorUnsysFocus(model, "root")?.hiddenState.edges.length).toBeGreaterThan(0);
    expect(
      inspectAuthorUnsysFocus(model, "root")?.hiddenState.edges.map((row) => row.toId),
    ).toContain("r1");

    let edited = setAuthorUnsysEdgePrice(model, "root", "r1", 3);
    edited = addAuthorUnsysBranch(edited, "r1", {
      title: "Author avenue on region 1",
    });
    expect(
      sessionBranchById(edited, "root")?.edges.find((row) => row.toId === "r1")?.price,
    ).toBe(3);
    expect(sessionBranchById(edited, "r1-x3")?.title).toBe("Author avenue on region 1");

    const seed = authorUnsysSeedForPersist(edited);
    expect(studentSessionModelFromAuthorSeed(seed)?.rootId).toBe(model.rootId);
    expect(
      sessionBranchById(studentSessionModelFromAuthorSeed(seed)!, "root")?.edges.find(
        (row) => row.toId === "r1",
      )?.price,
    ).toBe(3);

    const fromLegacy = normalizeAuthorUnsysModelSeed({
      models: { 4: edited, 8: exampleAuthorUnsysModel("Other") },
    });
    expect(fromLegacy?.model.rootId).toBe(edited.rootId);

    const student = resolveStudentUnsysPrepare({
      seed,
      generated: model,
    });
    expect(student.source).toBe("seed");
    expect(sessionBranchById(student.model!, "r1-x3")?.title).toBe(
      "Author avenue on region 1",
    );

    const none = resolveStudentUnsysPrepare({
      seed: null,
      generated: model,
    });
    expect(none.source).toBe("generated");

    const working = authorUnsysWorkingModel(seed, "Just war");
    expect(sessionBranchById(working, "r1-x3")?.title).toBe("Author avenue on region 1");

    writeEvidence(
      "author-model-catalog.log",
      [
        `edges=${inspectAuthorUnsysFocus(model, "root")?.hiddenState.edges.length}`,
        `seed=${student.source}`,
        `edgePrice=${sessionBranchById(student.model!, "root")?.edges.find((row) => row.toId === "r1")?.price}`,
        `added=${sessionBranchById(student.model!, "r1-x3")?.title}`,
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-model-catalog.log"))).toBe(true);
  });
});
