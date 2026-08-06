import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  creatorEffectIconKeys,
  creatorEffectsEqual,
  defaultBlockCreatorEffects,
  dynamicBlocksUnlockedAfterDone,
  generatorCellKey,
  generatorTargetCellsAfterDone,
  generatorTargetHighlightCells,
  hasAnyCreatorEffect,
  isDynamicEffectEnabled,
  isDynamicEffectLocked,
  isGeneratorEffectBusy,
  isGeneratorEffectEnabled,
  learnerDynamicMapLabel,
  normalizeBlockCreatorEffects,
  parseBlockCreatorEffects,
  parseGeneratorTargetCells,
  serializeBlockCreatorEffects,
  toggleDynamicUnlockAfterId,
  toggleGeneratorTargetCell,
  validateBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import {
  composeDynamicGenerationUserPrompt,
  formatGeneratorGeometryNote,
  normalizeEffectGenerationResult,
} from "@/lib/block-effect-generation";
import { isLearnerMapBlockLocked } from "@/lib/learner-local-dag";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-block-effects/implementer";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("block-creator-effects pure helpers", () => {
  it("defaults all effects off", () => {
    const d = defaultBlockCreatorEffects();
    expect(d.dynamic.enabled).toBe(false);
    expect(d.dynamic.unlockAfterBlockIds).toEqual([]);
    expect(d.generator.enabled).toBe(false);
    expect(hasAnyCreatorEffect(null)).toBe(false);
  });

  it("parses dynamic unlock-after ids and generator cells; ignores legacy promptable", () => {
    const n = parseBlockCreatorEffects(
      {
        dynamic: {
          enabled: true,
          unlock_after_block_ids: ["a", "self", "b", "a"],
        },
        promptable: { enabled: true, framing: "ignored" },
        generator: {
          enabled: true,
          target_cells: [{ row: 1, col: 2 }],
        },
      },
      { selfBlockId: "self" },
    );
    expect(n.dynamic.unlockAfterBlockIds).toEqual(["a", "b"]);
    expect(n.generator.targetCells).toEqual([{ row: 1, col: 2 }]);
    expect(creatorEffectIconKeys(n)).toEqual(["dynamic", "generator"]);
    expect((n as { promptable?: unknown }).promptable).toBeUndefined();
  });

  it("serialize round-trips without promptable", () => {
    const raw = {
      dynamic: { enabled: true, unlockAfterBlockIds: ["x", "y"] },
      generator: {
        enabled: true,
        targetCells: [{ row: 3, col: 4 }],
      },
    };
    const ser = serializeBlockCreatorEffects(
      normalizeBlockCreatorEffects(raw),
    );
    expect(ser).toEqual({
      dynamic: {
        enabled: true,
        unlock_after_block_ids: ["x", "y"],
      },
      generator: {
        enabled: true,
        target_cells: [{ row: 3, col: 4 }],
      },
    });
    expect((ser as { promptable?: unknown }).promptable).toBeUndefined();
  });

  it("validate dynamic requires unlock deps; no DAG required", () => {
    const blocks = [
      { id: "a", position_x: 0, position_y: 0 },
      { id: "b", position_x: 1, position_y: 0 },
    ];
    const noDeps = validateBlockCreatorEffects({
      blockId: "a",
      effects: {
        ...defaultBlockCreatorEffects(),
        dynamic: { enabled: true, unlockAfterBlockIds: [] },
      },
      blocks,
    });
    expect(noDeps.ok).toBe(false);

    const ok = validateBlockCreatorEffects({
      blockId: "a",
      effects: {
        ...defaultBlockCreatorEffects(),
        dynamic: { enabled: true, unlockAfterBlockIds: ["b"] },
      },
      blocks,
    });
    expect(ok.ok).toBe(true);
  });

  it("isDynamicEffectLocked / unlock transition", () => {
    const effects = parseBlockCreatorEffects({
      dynamic: {
        enabled: true,
        unlock_after_block_ids: ["a", "b"],
      },
    });
    const blocks = [
      { id: "dyn", status: "available", creator_effects: effects },
      { id: "a", status: "completed" },
      { id: "b", status: "available" },
    ];
    expect(
      isDynamicEffectLocked({
        effects,
        selfBlockId: "dyn",
        blocks,
      }),
    ).toBe(true);

    expect(
      dynamicBlocksUnlockedAfterDone({
        completedBlockId: "b",
        blocks,
      }),
    ).toEqual(["dyn"]);
  });

  it("learner map lock uses dynamic unlock-after", () => {
    const blocks = [
      {
        id: "dyn",
        status: "available",
        creator_effects: {
          dynamic: { enabled: true, unlock_after_block_ids: ["a"] },
        },
      },
      { id: "a", status: "available" },
    ];
    expect(isLearnerMapBlockLocked(blocks[0]!, blocks)).toBe(true);
    const done = [blocks[0]!, { id: "a", status: "completed" }];
    expect(isLearnerMapBlockLocked(blocks[0]!, done)).toBe(false);
  });

  it("generator busy + cells helpers", () => {
    const effects = parseBlockCreatorEffects({
      dynamic: { enabled: true, unlock_after_block_ids: ["a"] },
      generator: {
        enabled: true,
        target_cells: [{ row: 2, col: 3 }],
      },
    });
    expect(learnerDynamicMapLabel({ effects, title: "Algebra" })).toBe("?");
    expect(isGeneratorEffectBusy(effects)).toBe(true);
    expect(generatorTargetHighlightCells(effects)).toEqual([
      { row: 2, col: 3 },
    ]);
    expect(toggleDynamicUnlockAfterId(["a"], "b", "self")).toEqual(["a", "b"]);
    expect(generatorCellKey({ row: 1, col: 2 })).toBe("1:2");
    expect(parseGeneratorTargetCells([{ r: 1, c: 2 }])).toEqual([
      { row: 1, col: 2 },
    ]);
    expect(
      creatorEffectsEqual(
        defaultBlockCreatorEffects(),
        parseBlockCreatorEffects(null),
      ),
    ).toBe(true);
    expect(isDynamicEffectEnabled(null)).toBe(false);
    expect(isGeneratorEffectEnabled(null)).toBe(false);
    expect(
      generatorTargetCellsAfterDone({
        completedBlockId: "g",
        blocks: [
          {
            id: "g",
            position_x: 0,
            position_y: 0,
            creator_effects: {
              generator: {
                enabled: true,
                target_cells: [{ row: 1, col: 0 }],
              },
            },
          },
        ],
      }),
    ).toEqual([{ row: 1, col: 0 }]);
    expect(toggleGeneratorTargetCell([], { row: 1, col: 2 })).toEqual([
      { row: 1, col: 2 },
    ]);
  });
});

describe("block-effect-generation prompts", () => {
  it("builds dynamic prompts with grounding", () => {
    const dyn = composeDynamicGenerationUserPrompt({
      workspaceTitle: "Calc",
      workspaceGoal: "Master limits",
      blockSeedTitle: "Next step",
      completedBlocks: [{ id: "1", title: "Derivatives", description: "d/dx" }],
    });
    expect(dyn).toContain("Dynamic block");
    expect(dyn).toContain("Derivatives");
  });

  it("geometry note and result normalize", () => {
    expect(
      formatGeneratorGeometryNote({
        generator: { position_x: 0, position_y: 0 },
        target: { position_x: 2, position_y: -1 },
      }),
    ).toMatch(/above/);
    expect(
      normalizeEffectGenerationResult(
        { title: "  T  ", description: " D " },
        { title: "fallback" },
      ),
    ).toEqual({ title: "T", description: "D" });
  });
});

describe("creator effects wired into workspace UI + API", () => {
  it("no Promptable drawer/UI; Dynamic + Generator remain", () => {
    const panels = read("components/WorkspaceBlockEffectsPanels.tsx");
    expect(panels).toContain("data-dynamic-unlock-picker");
    expect(panels).toContain("data-generator-save-targets");
    expect(panels).not.toContain("WorkspaceBlockPromptableEffectPanel");
    expect(panels).not.toContain("data-promptable-framing");

    const detail = read("components/WorkspaceBlockDetailPane.tsx");
    expect(detail).not.toContain("effect_promptable");
    expect(detail).not.toContain("Promptable");
    expect(detail).toContain("effect_dynamic");
    expect(detail).toContain("effect_generator");

    // Empty-cell Add is create-only; Dynamic/Generator live on detail pane
    const addPane = read("components/WorkspaceAddBlockPane.tsx");
    expect(addPane).not.toContain("effect_promptable");
    expect(addPane).not.toContain("WorkspaceBlockPromptableEffectPanel");
    expect(addPane).not.toContain('drawerId="effect_dynamic"');
    expect(addPane).not.toContain('drawerId="effect_generator"');
    expect(addPane).not.toContain("WorkspaceBlockDynamicEffectPanel");
    expect(addPane).not.toContain("WorkspaceBlockGeneratorEffectPanel");

    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    expect(learner).not.toContain("promptable");
    expect(learner).not.toContain("needsPromptable");
    expect(learner).toContain("data-learner-dynamic-unlock");

    const genRoute = read("app/api/workspace/block-effect-generate/route.ts");
    expect(genRoute).not.toContain("promptable");
    expect(genRoute).toContain("dynamic");
    expect(genRoute).toContain("generator_cell");
    // Learners can spawn generator targets after Mark Done (admin write after auth)
    expect(genRoute).toContain("createAdminClient");

    const grid = read("components/BlockSkillGrid.tsx");
    expect(grid).not.toContain('data-creator-effect-icon="promptable"');
  });
});

try {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "block-creator-effects.ok"), "1");
} catch {
  /* optional */
}
