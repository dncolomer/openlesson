import { describe, expect, it } from "vitest";
import {
  blockFootprintCellCount,
  composeGenerateShapeBlockSystemMessage,
  composeGenerateShapeBlockUserPrompt,
  composeMergeBlockSystemMessage,
  composeMergeBlockUserPrompt,
  composeSplitBlockSystemMessage,
  composeSplitBlockUserPrompt,
  composeSuggestShapeBlockTitlesSystemMessage,
  composeSuggestShapeBlockTitlesUserPrompt,
  describeBlockBreadthRelativeToSingle,
  formatSourceBlockSizeLine,
} from "@/lib/block-footprint-prompt";

describe("block-footprint-prompt (ILE/TAP size relative to singles)", () => {
  it("counts cells relative to a 1×1 single block", () => {
    expect(blockFootprintCellCount(1, 1)).toBe(1);
    expect(blockFootprintCellCount(2, 2)).toBe(4);
    expect(blockFootprintCellCount(3, 1)).toBe(3);
  });

  it("describes baseline vs multi-cell ILE/TAP breadth", () => {
    const single = describeBlockBreadthRelativeToSingle(1, 1);
    expect(single).toMatch(/1×1/);
    expect(single).toMatch(/baseline/i);
    expect(single).toMatch(/ILE\/TAP/);

    const multi = describeBlockBreadthRelativeToSingle(2, 3);
    expect(multi).toMatch(/2×3/);
    expect(multi).toMatch(/6 single-block/);
    expect(multi).toMatch(/~6×/);
    expect(multi).toMatch(/broader/i);
  });

  it("merge prompt states result size vs sources and single-block units", () => {
    const prompt = composeMergeBlockUserPrompt({
      context: "Workspace: Demo\nGoal: Ship",
      sourceBlocks: [
        { title: "A", span_w: 1, span_h: 1, description: "Narrow A" },
        { title: "B", span_w: 2, span_h: 1 },
      ],
      resultSpanW: 2,
      resultSpanH: 2,
      userGuidance: "Unify fundamentals",
    });
    expect(prompt).toContain("Workspace: Demo");
    expect(prompt).toContain(formatSourceBlockSizeLine({ title: "A", span_w: 1, span_h: 1 }));
    expect(prompt).toMatch(/2×2.*4 single-block/i);
    expect(prompt).toMatch(/~4× a baseline 1×1/i);
    expect(prompt).toMatch(/Unify fundamentals/);
    expect(prompt).toMatch(/ILE\/TAP/);
    expect(composeMergeBlockSystemMessage()).toMatch(/broader than 1×1/i);
  });

  it("generate-in-shape prompt encodes footprint breadth vs single cells", () => {
    const prompt = composeGenerateShapeBlockUserPrompt({
      context: "Workspace: X",
      spanW: 2,
      spanH: 2,
      anchorRow: 0,
      anchorCol: 1,
      neighborSummary: '"Intro" at (0,0)',
      userRequest: "Cover auth flows",
    });
    expect(prompt).toContain("anchor (0,1)");
    expect(prompt).toMatch(/2×2.*4 single-block/i);
    expect(prompt).toMatch(/~4× broader/);
    expect(prompt).toContain("Cover auth flows");
    expect(prompt).toMatch(/Size ontology/i);
    expect(composeGenerateShapeBlockSystemMessage()).toMatch(/breadth/i);
  });

  it("shape title suggestions encode footprint breadth (not single-cell drills)", () => {
    const prompt = composeSuggestShapeBlockTitlesUserPrompt({
      workspaceTitle: "Auth mastery",
      workspaceDescription: "Ship secure sessions",
      existingBlocksSummary: '- "Password basics" at (0,0)',
      entityLabel: "learning block",
      spanW: 2,
      spanH: 3,
      anchorRow: 1,
      anchorCol: 2,
      cellCount: 6,
      neighborSummary: '"Password basics" weight 1.0',
    });
    expect(prompt).toContain("Auth mastery");
    expect(prompt).toMatch(/anchor \(1,2\)/);
    expect(prompt).toMatch(/2×3/);
    expect(prompt).toMatch(/6 single-block/);
    expect(prompt).toMatch(/~6×/);
    expect(prompt).toMatch(/exactly 3/);
    expect(prompt).toMatch(/broader/i);
    expect(prompt).toContain("Password basics");
    expect(composeSuggestShapeBlockTitlesSystemMessage("learning block")).toMatch(
      /multi-cell|breadth/i,
    );
  });

  it("split prompt asks for 1×1 parts narrower than the multi-cell source", () => {
    const prompt = composeSplitBlockUserPrompt({
      context: "Workspace: Y",
      sourceTitle: "Broad Auth",
      sourceDescription: "Everything auth",
      sourceSpanW: 2,
      sourceSpanH: 2,
      parts: [
        { index: 0, position_x: 0, position_y: 0 },
        { index: 1, position_x: 1, position_y: 0 },
        { index: 2, position_x: 0, position_y: 1 },
        { index: 3, position_x: 1, position_y: 1 },
      ],
    });
    expect(prompt).toContain("Broad Auth");
    expect(prompt).toMatch(/2×2.*4 single-block/i);
    expect(prompt).toMatch(/1\/4/);
    expect(prompt).toMatch(/index 0.*1×1/);
    expect(prompt).toMatch(/index 3/);
    expect(prompt).toMatch(/parts/i);
    expect(composeSplitBlockSystemMessage()).toMatch(/1×1 ILE\/TAP/i);
  });
});
