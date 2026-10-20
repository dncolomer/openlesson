/**
 * Author unsys seed studio: sample graph, catalog delete, map-replacing surface.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  expandAuthorUnsysSessionNode,
  generateAuthorUnsysSessionField,
} from "@/lib/author-unsys-generate";
import {
  AUTHOR_UNSYS_GENERATE_PATH,
  authorUnsysDeeperChildCount,
  authorUnsysSeedForPersist,
  exampleAuthorUnsysModel,
  generateAuthorUnsysSample,
  inspectAuthorUnsysFocus,
  removeAuthorUnsysBranch,
  setAuthorUnsysBranchFields,
} from "@/lib/author-unsys-model";
import {
  AUTHOR_UNSYS_ROOT_COLOR,
  authorUnsysGraphEdges,
  authorUnsysRegionColor,
  layoutAuthorUnsysGraph,
  seedAuthorUnsysPositions,
} from "@/lib/author-unsys-layout";
import { SESSION_BRANCH_CHILD_MAX, sessionBranchById } from "@/lib/session-branch-model";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-54e8f9ec94f9/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeEvidence(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("author unsys seed studio", () => {
  it("layouts a 2d tree, generates a local sample, and persists one graph", async () => {
    const four = generateAuthorUnsysSample("Just war");
    expect(four.branches.length).toBeGreaterThan(6);
    expect(
      inspectAuthorUnsysFocus(four, "root")?.hiddenState.edges.map((row) => row.toId),
    ).toEqual(expect.arrayContaining(["r1", "r2", "r3"]));
    expect(four.rootId).toBe(exampleAuthorUnsysModel("Just war").rootId);

    const renamed = setAuthorUnsysBranchFields(four, "r1", { title: "Author region" });
    expect(sessionBranchById(renamed, "r1")?.title).toBe("Author region");

    const layout = layoutAuthorUnsysGraph(four, 800, 600);
    const root = layout.get("root");
    const r1 = layout.get("r1");
    const r2 = layout.get("r2");
    expect(root).toEqual({ x: 400, y: 312 });
    expect(r1).toBeTruthy();
    expect(r2).toBeTruthy();
    expect(Math.hypot(r1!.x - root!.x, r1!.y - root!.y)).toBeGreaterThan(80);
    expect(Math.hypot(r1!.x - r2!.x, r1!.y - r2!.y)).toBeGreaterThan(40);
    expect(authorUnsysRegionColor(four, "root")).toBe(AUTHOR_UNSYS_ROOT_COLOR);
    expect(authorUnsysRegionColor(four, "r1")).not.toBe(authorUnsysRegionColor(four, "r2"));
    expect(authorUnsysGraphEdges(four).some((edge) => edge.from === "root" && edge.to === "r1")).toBe(
      true,
    );
    expect(inspectAuthorUnsysFocus(four, "root")?.hiddenState.edges.length).toBeGreaterThan(0);

    const placed = seedAuthorUnsysPositions(four, 800, 600, { r1: { x: 10, y: 20 } });
    expect(placed.r1).toEqual({ x: 10, y: 20 });
    expect(placed.root).toBeTruthy();

    const trimmed = removeAuthorUnsysBranch(four, "r1");
    expect(sessionBranchById(trimmed, "r1")).toBeNull();
    expect(sessionBranchById(trimmed, "root")).toBeTruthy();
    expect(
      sessionBranchById(trimmed, "root")?.edges.some((edge) => edge.toId === "r1"),
    ).toBe(false);

    expect(authorUnsysDeeperChildCount(0)).toBe(SESSION_BRANCH_CHILD_MAX);
    expect(authorUnsysDeeperChildCount(1)).toBe(SESSION_BRANCH_CHILD_MAX);
    expect(authorUnsysDeeperChildCount(2)).toBe(SESSION_BRANCH_CHILD_MAX);

    const generated = await generateAuthorUnsysSessionField(
      { chapterTitle: "Just war" },
      {
        generateFirstLevel: async () => {
          return { ok: true, model: four };
        },
      },
    );
    expect(generated.ok).toBe(true);

    const expanded = await expandAuthorUnsysSessionNode(
      {
        chapterTitle: "Just war",
        model: four,
        parentId: "r1",
      },
      {
        generateChildren: async () => ({
          ok: true,
          children: [
            {
              title: "Deeper avenue",
              question: "What still has to be true?",
              territory: "Avenue of region 1.",
              observation: "The avenue is open.",
              edgePrice: 5,
            },
          ],
        }),
      },
    );
    expect(expanded.ok).toBe(true);
    if (expanded.ok) {
      expect(expanded.model.branches.some((branch) => branch.title === "Deeper avenue")).toBe(
        true,
      );
    }

    const seed = authorUnsysSeedForPersist(four);
    expect(seed.model.rootId).toBe(four.rootId);

    const studio = read("components/WorkspaceUnsysSeedStudio.tsx");
    const graph = read("components/WorkspaceUnsysSeedGraph.tsx");
    const view = read("components/WorkspaceView.tsx");
    const panel = read("components/WorkspaceBlockUnsysModelPanel.tsx");
    const route = read("app/api/workspace/helios-unsys-seed-generate/route.ts");
    const update = read("lib/workspace-grid-ops/update_block.ts");
    const authoring = read("components/workspace-view/use-workspace-authoring.ts");
    expect(view).toContain("WorkspaceUnsysSeedStudio");
    expect(view).toMatch(/unsysStudioBlock && !shell\.playView/);
    expect(view).toContain("onOpenUnsysStudio");
    expect(panel).toContain("data-author-unsys-open");
    expect(studio).toContain("Back to map");
    expect(studio).toMatch(/onClose\?: \(\) => void/);
    expect(studio).toContain("Generate sample");
    expect(studio).toContain("Regenerate sample");
    expect(studio).toContain("Delete seed");
    expect(studio).toContain("Save seed");
    expect(studio).toContain("AUTHOR_UNSYS_GENERATE_PATH");
    expect(studio).toContain("WorkspaceBlockUnsysHeliosChat");
    expect(studio).not.toContain("generateAuthorUnsysSample");
    expect(studio).not.toContain("data-author-unsys-focus-card");
    expect(studio).toContain("WorkspaceUnsysSeedInspector");
    expect(studio).toContain("data-workspace-helios-mode-toggle");
    expect(studio).toContain('data-helios-map-mode-option="helios"');
    expect(studio).toContain('data-helios-map-mode-option="manual"');
    expect(studio).toContain("resolveWorkspaceHeliosColumnSurface");
    expect(studio).toContain("onGenerateGraph");
    expect(studio).toContain("data-author-unsys-generating");
    expect(studio).toContain("blur-sm");
    expect(studio).toContain("backdrop-blur-sm");
    expect(studio).not.toContain("bg-black/45");
    expect(studio).toContain('normalizeWorkspaceHeliosColumnMode("manual")');
    expect(studio).not.toContain("onSelect={setFocusId}");
    expect(studio).not.toContain("Generating with xAI");
    const inspector = read("components/WorkspaceUnsysSeedInspector.tsx");
    expect(inspector).toContain("data-author-unsys-action-price");
    expect(inspector).toContain("data-author-unsys-branch-title");
    expect(inspector).toContain("data-author-unsys-graph-add");
    expect(inspector).toContain("data-author-unsys-graph-deeper");
    expect(inspector).toContain("data-author-unsys-graph-remove");
    expect(graph).not.toContain("data-author-unsys-action-price");
    expect(graph).not.toContain("data-author-unsys-branch-title");
    expect(graph).not.toContain("data-author-unsys-graph-add");
    expect(graph).not.toContain("data-author-unsys-graph-deeper");
    expect(graph).not.toContain("data-author-unsys-action-spoke");
    expect(graph).toContain("data-author-unsys-action-lead");
    expect(inspector).not.toContain("data-author-unsys-action-lead-select");
    expect(inspector).toContain("data-author-unsys-edge-price");
    expect(studio).not.toContain("data-author-unsys-catalogs");
    expect(graph).toContain("data-author-unsys-graph-infinite");
    expect(graph).toContain("data-author-unsys-graph-grid");
    expect(graph).toContain("data-author-unsys-diamond");
    expect(graph).toContain("graphDiamondEdge");
    expect(graph).not.toContain("rotate-45");
    expect(graph).toContain("seedAuthorUnsysPositions");
    expect(studio).toContain("onGenerateDeeper");
    expect(route).toContain("generateAuthorUnsysSessionField");
    expect(route).toContain("expandAuthorUnsysSessionNode");
    expect(route).toContain("parentId");
    expect(route).toContain("guardWorkspaceRoute");
    expect(AUTHOR_UNSYS_GENERATE_PATH).toBe("/api/workspace/helios-unsys-seed-generate");
    expect(authoring).toContain("answers_model_seed: input.seed");
    expect(authoring).toContain("serializeAuthorUnsysModelSeed(input.seed)");
    expect(authoring).toMatch(/seed: AuthorUnsysModelSeed \| null/);
    expect(update).toContain("answers_model_seed");
    expect(update).toContain("serializeAuthorUnsysModelSeed(seed)");

    writeEvidence(
      "author-unsys-studio.log",
      [
        `sampleBranches=${four.branches.length}`,
        `rootEdges=${inspectAuthorUnsysFocus(four, "root")?.hiddenState.edges.length}`,
        `root=${JSON.stringify(root)}`,
        `r1=${JSON.stringify(r1)}`,
        `viewStudio=${view.includes("WorkspaceUnsysSeedStudio")}`,
      ].join("\n"),
    );
    expect(existsSync(join(SCRATCH, "author-unsys-studio.log"))).toBe(true);
  });
});
