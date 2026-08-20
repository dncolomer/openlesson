import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assembleSuggestDagXaiMessages,
  normalizeSuggestDagBlockIds,
  normalizeSuggestDagResponse,
} from "@/lib/suggest-dag";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/tmp/suggest-dag-test";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const blocks = [
  { id: "a", title: "Intro" },
  { id: "b", title: "Practice" },
  { id: "c", title: "Proofs" },
];

describe("normalizeSuggestDagResponse", () => {
  it("keeps valid leads-to edges and drops junk", () => {
    const draft = normalizeSuggestDagResponse(
      {
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "b" },
          { from: "a", to: "a" },
          { from: "missing", to: "b" },
          { from: "Practice", to: "Proofs" },
          { from_id: "c", to_id: "zzz" },
        ],
      },
      ["a", "b", "c"],
      blocks,
    );
    expect(draft.blockIds).toEqual(["a", "b", "c"]);
    expect(draft.edges).toEqual([
      { from: "a", to: "b", kind: "next" },
      { from: "b", to: "c", kind: "next" },
    ]);
  });

  it("reads nested draft.edges and pair lists", () => {
    const nested = normalizeSuggestDagResponse(
      { draft: { edges: [{ source: "a", target: "c" }] } },
      ["a", "c"],
    );
    expect(nested.edges).toEqual([{ from: "a", to: "c", kind: "next" }]);

    const pairs = normalizeSuggestDagResponse({ next: [["a", "b"]] }, ["a", "b"]);
    expect(pairs.edges).toEqual([{ from: "a", to: "b", kind: "next" }]);

    expect(normalizeSuggestDagResponse(null, ["a", "b"]).edges).toEqual([]);
    expect(normalizeSuggestDagBlockIds(["a", "", "a", "b"]).length).toBe(2);
  });

  it("assembles xAI messages from map blocks", () => {
    const msgs = assembleSuggestDagXaiMessages({
      workspaceTitle: "Algebra",
      workspaceGoal: "Master proofs",
      blocks: [
        {
          id: "a",
          title: "Intro",
          description: "Start here",
          position_x: 1,
          position_y: 2,
          is_start: true,
        },
        { id: "b", title: "Practice" },
      ],
      currentEdges: [{ from: "a", to: "b" }],
    });
    expect(msgs.system).toMatch(/leads-to/i);
    expect(msgs.system).toMatch(/JSON/);
    expect(msgs.user).toContain("Algebra");
    expect(msgs.user).toContain("Master proofs");
    expect(msgs.user).toContain("id=a");
    expect(msgs.user).toContain("starter=true");
    expect(msgs.user).toContain("a -> b");
  });
});

describe("suggest DAG UI + API structural", () => {
  it("drawer button updates canvas draft; route uses xAI; Apply stays separate", () => {
    const pane = read("components/WorkspaceCombineBlocksPane.tsx");
    const route = read("app/api/workspace/suggest-dag/route.ts");
    const helper = read("lib/suggest-dag.ts");

    expect(pane).toContain("data-dag-suggest");
    expect(pane).toContain("Suggest DAG");
    expect(pane).toContain("/api/workspace/suggest-dag");
    expect(pane).toContain("normalizeSuggestDagResponse");
    expect(pane).toContain("setDagDraft");
    expect(pane).toContain("data-dag-apply");
    expect(pane).toContain("Apply");

    expect(route).toContain("guardWorkspaceRoute");
    expect(route).toContain("callXaiJSON");
    expect(route).toContain("DEFAULT_MODEL");
    expect(route).toContain("assembleSuggestDagXaiMessages");
    expect(route).toContain("normalizeSuggestDagResponse");
    expect(route).not.toContain("openai");

    expect(helper).toContain("export function normalizeSuggestDagResponse");
    expect(helper).toContain("export function assembleSuggestDagXaiMessages");

    writeLog(
      "suggest-dag.log",
      [
        "button=data-dag-suggest",
        "apply_still=data-dag-apply",
        "route=callXaiJSON",
      ].join("\n") + "\n",
    );
  });
});
