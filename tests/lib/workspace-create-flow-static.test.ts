import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { isBlockMapToolEnabled } from "@/lib/block-map-tools";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("workspace create + builder static wiring", () => {


  it("builder tab label is Builder in English messages", () => {
    const en = JSON.parse(read("messages/en.json"));
    expect(en.planView.planBuilder).toBe("Builder");
  });

  it("workspace Knowledge and Dashboard have no Insights diary", () => {
    const dash = read("app/dashboard/page.tsx");
    expect(dash).not.toContain("InsightsDashboardTab");
    expect(dash).not.toContain("DashboardInsightsTab");
    expect(dash).not.toContain("isDashboardInsightsTab");
    expect(fs.existsSync(path.join(ROOT, "components/InsightsDashboardTab.tsx"))).toBe(false);
  });

  it("insights API routes are gone", () => {
    expect(fs.existsSync(path.join(ROOT, "app/api/insights/route.ts"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "app/api/insights"))).toBe(false);
  });


  it("sequential appear animation is wired for AI-added blocks", () => {
    const grid = readMapGridSurface();
    expect(grid).toContain("appearingNodeIds");
    expect(grid).toContain("APPEAR_STAGGER_MS");
    expect(grid).toMatch(/opacity|fade|shadow/);
    // Avoid max-update-depth: stable empty default + content key + no setState(new Set()) every empty run
    expect(grid).toContain("EMPTY_APPEARING_NODE_IDS");
    expect(grid).toContain("appearingKey");
    expect(grid).toContain("onAppearingCompleteRef");
    expect(grid).toMatch(/prev\.size === 0 \? prev : new Set\(\)/);
    expect(grid).not.toMatch(/appearingNodeIds = \[\]/);
    const list = read("components/SessionList.tsx");
    expect(list).toContain("appearingNodeIds");
    expect(list).toContain("setAppearingNodeIds");
  });

  it("multi-select grid ops are exposed (merge, split, move op, generate_shape)", () => {
    const grid = readMapGridSurface();
    expect(grid).toContain("generate_shape");
    expect(grid).toContain("merge");
    expect(grid).toContain("split");
    // Move is a grid op from click-and-drag (not a strip tool)
    expect(grid).toContain('op: "move"');
    expect(grid).toContain("selectedEmptyCells");
    expect(grid).toContain("selectedBlockIds");
    const dispatch = read("lib/workspace-grid-ops/dispatch.ts");
    expect(dispatch).toContain("handle_merge");
    expect(dispatch).toContain("handle_split");
    expect(dispatch).toContain("handle_move");
    expect(dispatch).toContain("handle_generate_shape");
    expect(read("lib/workspace-grid-ops/merge.ts")).toContain("composeMergeBlockUserPrompt");
    expect(read("lib/workspace-grid-ops/split.ts")).toContain("composeSplitBlockUserPrompt");
    expect(read("lib/workspace-grid-ops/generate_shape.ts")).toContain(
      "composeGenerateShapeBlockUserPrompt",
    );
    expect(read("lib/workspace-grid-ops/shared.ts")).toContain("block-footprint-prompt");
  });


});
