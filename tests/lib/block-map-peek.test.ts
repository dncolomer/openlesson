import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { resolveMapBlockPeek } from "@/lib/block-map-peek";
import {
  blockCircularMenuDoubleClickIsNoop,
  blockCircularMenuOpensOnSelect,
} from "@/lib/block-circular-menu";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const nodes = [
  {
    id: "a",
    title: "Fourier analysis",
    description: "Decompose signals into frequencies.",
  },
  { id: "b", title: "  ", description: null },
];

describe("resolveMapBlockPeek", () => {
  it("returns full title + description for a known block", () => {
    expect(resolveMapBlockPeek(nodes, "a")).toEqual({
      id: "a",
      title: "Fourier analysis",
      description: "Decompose signals into frequencies.",
    });
  });

  it("falls back untitled and empty description; ignores missing ids", () => {
    expect(resolveMapBlockPeek(nodes, "b")).toEqual({
      id: "b",
      title: "Untitled",
      description: "",
    });
    expect(resolveMapBlockPeek(nodes, null)).toBeNull();
    expect(resolveMapBlockPeek(nodes, "missing")).toBeNull();
  });
});

describe("map double-click peek overlay", () => {
  it("creator and ILE occupied-block double-click peek; Workspace learner stays a no-op", () => {
    const grid = readMapGridSurface();
    const authoring = read("components/block-skill-grid/use-map-authoring.ts");
    const host = read("components/BlockSkillGrid.tsx");
    const menu = read("lib/block-circular-menu.ts");
    expect(authoring).toContain("onPeekBlock");
    expect(authoring).toContain("handleBlockDoubleClick");
    expect(authoring).toMatch(/onPeekBlock\?\.\(blockId\)/);
    expect(host).toContain("blockCircularMenuDoubleClickIsNoop");
    expect(host).toContain("blockCircularMenuOpensOnSelect");
    expect(host).toContain("handleBlockDoubleClickGuarded");
    expect(host).toContain("blockCircularMenuOpensOnSelect(circularMenuSurface, { exploreOpen: mapExploreOpen })");
    expect(host).toMatch(/if \(blockCircularMenuDoubleClickIsNoop\(circularMenuSurface\)\) return/);
    expect(blockCircularMenuOpensOnSelect("ile")).toBe(true);
    expect(blockCircularMenuDoubleClickIsNoop("ile")).toBe(false);
    expect(blockCircularMenuDoubleClickIsNoop("workspace-learner")).toBe(true);
    expect(menu).toContain("blockCircularMenuOpensOnSelect");
    expect(grid).toContain("data-map-block-peek");
    expect(grid).toContain("data-map-block-peek-title");
    expect(grid).toContain("data-map-block-peek-description");
    expect(grid).toContain("MapBlockPeekModal");
    expect(grid).toContain("resolveMapBlockPeek");
    expect(grid).toContain("aria-modal");
    expect(grid).toContain("onPeekBlock: setPeekBlockId");
  });
});
