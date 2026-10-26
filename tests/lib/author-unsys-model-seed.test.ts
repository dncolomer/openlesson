/**
 * Author editor + seed persist + student prepare resolve (shipped units).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addAuthorUnsysBranch,
  authorUnsysSeedForPersist,
  exampleAuthorUnsysModel,
  inspectAuthorUnsysFocus,
  normalizeAuthorUnsysModelSeed,
  resolveStudentUnsysPrepare,
  setAuthorUnsysEdgePrice,
  studentSessionModelFromAuthorSeed,
} from "@/lib/author-unsys-model";
import { sessionBranchById } from "@/lib/session-branch-model";
import { readFileSync } from "node:fs";
import {
  authorSeedBlockIdFromPreparePlan,
  learnSessionFieldInput,
  planSessionBranchPrepare,
  sessionBranchPrepareRequest,
  sessionPrepareBlockId,
} from "@/lib/session-branch-prepare";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("author unsys model seed", () => {
  it("edits prices, adds a branch, and student prepare uses the seed when present", () => {
    const generated = exampleAuthorUnsysModel("Just war");
    const none = resolveStudentUnsysPrepare({ seed: null, generated: null });
    expect(none.source).toBe("none");
    expect(none.model).toBeNull();

    const onTheFly = resolveStudentUnsysPrepare({ seed: undefined, generated });
    expect(onTheFly.source).toBe("generated");
    expect(onTheFly.model?.rootId).toBe(generated.rootId);

    let edited = setAuthorUnsysEdgePrice(generated, "root", "r1", 7);
    edited = addAuthorUnsysBranch(edited, "r1", {
      title: "Author avenue on region 1",
      question: "What would you check on the author avenue?",
      territory: "Author avenue of region 1.",
      observation: "The author avenue is on the board.",
    });

    const added = inspectAuthorUnsysFocus(edited, "r1");
    const authorChildId = added?.childIds.find((id) => id.includes("-x"));
    expect(authorChildId).toBeTruthy();
    expect(sessionBranchById(edited, authorChildId!)?.title).toBe(
      "Author avenue on region 1",
    );
    expect(
      sessionBranchById(edited, "root")?.edges.find((row) => row.toId === "r1")?.price,
    ).toBe(7);

    const seed = authorUnsysSeedForPersist(edited);
    const persisted = normalizeAuthorUnsysModelSeed(seed);
    expect(persisted).toBeTruthy();

    const fromSeed = resolveStudentUnsysPrepare({
      seed: persisted,
      generated,
    });
    expect(fromSeed.source).toBe("seed");
    expect(fromSeed.model?.rootId).toBe(generated.rootId);
    expect(
      sessionBranchById(fromSeed.model!, "root")?.edges.find((row) => row.toId === "r1")
        ?.price,
    ).toBe(7);
    expect(sessionBranchById(fromSeed.model!, authorChildId!)?.title).toBe(
      "Author avenue on region 1",
    );
    expect(studentSessionModelFromAuthorSeed(null)).toBeNull();
    expect(studentSessionModelFromAuthorSeed({ not: "a model" })).toBeNull();

    const metadata = {
      workspace_id: "ws-learn",
      block_id: "block-seed-1",
      learning_model_size: 4,
    };
    expect(sessionPrepareBlockId(metadata)).toBe("block-seed-1");
    const learnInput = learnSessionFieldInput({
      sessionId: "learn-session-1",
      problem: "A cause can fail.",
      ileToken: "ile",
      metadata,
    });
    expect(learnInput?.blockId).toBe("block-seed-1");
    expect(learnInput?.workspaceId).toBe("ws-learn");
    const learnPlan = planSessionBranchPrepare(learnInput);
    expect(learnPlan.kind).toBe("learn");
    expect(authorSeedBlockIdFromPreparePlan(learnPlan)).toBe("block-seed-1");
    const learnRequest = sessionBranchPrepareRequest(learnPlan);
    expect(learnRequest).toMatchObject({
      sessionId: "learn-session-1",
      blockId: "block-seed-1",
      workspaceId: "ws-learn",
    });
    expect(
      resolveStudentUnsysPrepare({
        seed: persisted,
        generated,
      }).source,
    ).toBe("seed");

    const route = readFileSync(
      join(__dirname, "../../app/api/learn/session-branch-model/route.ts"),
      "utf8",
    );
    expect(route).toContain("authorSeedBlockIdFromPreparePlan");
    expect(route).toContain("sessionPrepareBlockId");
    expect(route).toContain("studentSessionModelFromAuthorSeed");
    expect(route).not.toMatch(/studentSessionModelFromAuthorSeed\([\s\S]*catalogSize/);
    expect(route).toContain("answers_model_seed");
    expect(route).toContain("sessionBranchContinuationFromSeed");
    expect(route).toContain("sessionBranchParentsNeedingGrowth");
    expect(route).toContain("openingWorkForSessionField");
    expect(route).not.toContain("continuation: null,\n              done: true");
    const field = readFileSync(
      join(__dirname, "../../components/session-view/use-session-field.ts"),
      "utf8",
    );
    expect(field).toContain("blockId: sessionBlockId");
    expect(field).toContain("metadata: session?.metadata");
    expect(field).toContain("metadata: session.metadata");
    const canvas = readFileSync(
      join(__dirname, "../../components/session-view/session-chapter-canvas.tsx"),
      "utf8",
    );
    expect(canvas).toContain("sessionPrepareBlockId");
    expect(canvas).toContain("blockId:");

    writeEvidence(
      "author-model-seed.log",
      [
        `none=${none.source}`,
        `onTheFly=${onTheFly.source}`,
        `seeded=${fromSeed.source}`,
        `root=${fromSeed.model?.rootId}`,
        `r1Edge=${sessionBranchById(fromSeed.model!, "root")?.edges.find((row) => row.toId === "r1")?.price}`,
        `added=${authorChildId}`,
        `addedTitle=${sessionBranchById(fromSeed.model!, authorChildId!)?.title}`,
        `learnKind=${learnPlan.kind}`,
        `learnBlockId=${learnRequest?.blockId}`,
        `metaBlock=${sessionPrepareBlockId(metadata)}`,
        `routeLearnSeed=${route.includes("authorSeedBlockIdFromPreparePlan")}`,
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-model-seed.log"))).toBe(true);
  });
});
