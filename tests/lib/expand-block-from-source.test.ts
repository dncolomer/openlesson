/**
 * Expand-from-selected-block selection + prompt builders.
 * Drives shipped resolveExpandFromSourceSelection / prompt helpers.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildExpandFromSourceContextPrompt,
  buildExpandFromSourceSlotPrompt,
  canShowExpandBlockDrawer,
  expandCenterFromSourceBlock,
  resolveExpandFromSourceSelection,
  snapshotExpandFromSourceSlots,
  sourceBlockOccupiedKeys,
} from "@/lib/expand-block-from-source";
import { resolveAddExpandSelection } from "@/lib/add-block-range-density";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.EXPAND_FROM_SOURCE_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-172de092c1c8/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

const sourceBlock = {
  id: "src-block",
  position_x: 5,
  position_y: 5,
  span_w: 1,
  span_h: 1,
};

describe("expand center + occupancy from source", () => {
  it("uses anchor; multi-cell footprint keys excluded", () => {
    expect(expandCenterFromSourceBlock(sourceBlock)).toEqual({
      row: 5,
      col: 5,
    });
    expect(sourceBlockOccupiedKeys(sourceBlock)).toEqual(["5:5"]);

    const multi = {
      id: "m",
      position_x: 2,
      position_y: 3,
      span_w: 2,
      span_h: 2,
    };
    expect(expandCenterFromSourceBlock(multi)).toEqual({ row: 3, col: 2 });
    const keys = sourceBlockOccupiedKeys(multi);
    expect(keys).toContain("3:2");
    expect(keys).toContain("3:3");
    expect(keys).toContain("4:2");
    expect(keys).toContain("4:3");
    expect(keys).toHaveLength(4);
  });
});

describe("resolveExpandFromSourceSelection", () => {
  it("placeable empties only; density matches range-density pipeline; excludes occupied/unusable", () => {
    const occupied = new Set(["5:5", "5:6"]);
    const unusable = new Set(["4:5"]);
    const seed = 42;
    const range = 1;
    const density = 100;

    const result = resolveExpandFromSourceSelection({
      sourceBlock,
      range,
      density,
      seed,
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });

    expect(result.center).toEqual({ row: 5, col: 5 });
    // Source + neighbor occupied + unusable never selected
    const keys = result.selected.map((c) => `${c.row}:${c.col}`);
    expect(keys).not.toContain("5:5");
    expect(keys).not.toContain("5:6");
    expect(keys).not.toContain("4:5");
    for (const c of result.selected) {
      expect(occupied.has(`${c.row}:${c.col}`)).toBe(false);
      expect(unusable.has(`${c.row}:${c.col}`)).toBe(false);
    }
    expect(result.frozenSlots).toEqual(result.selected);
    expect(result.frozenSlots.some((c) => c.row === 5 && c.col === 5)).toBe(
      false,
    );

    // Parity with empty-cell pipeline candidates (minus center if it were placeable)
    const emptyPipe = resolveAddExpandSelection({
      center: { row: 5, col: 5 },
      range,
      density,
      seed,
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });
    const emptyKeys = new Set(
      emptyPipe.selected
        .filter((c) => !(c.row === 5 && c.col === 5))
        .map((c) => `${c.row}:${c.col}`),
    );
    const fromSourceKeys = new Set(result.selected.map((c) => `${c.row}:${c.col}`));
    expect(fromSourceKeys).toEqual(emptyKeys);

    // Density sampling: lower density ⊆ full candidates
    const sparse = resolveExpandFromSourceSelection({
      sourceBlock,
      range: 2,
      density: 20,
      seed: 7,
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });
    const full = resolveExpandFromSourceSelection({
      sourceBlock,
      range: 2,
      density: 100,
      seed: 7,
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });
    expect(sparse.selected.length).toBeLessThanOrEqual(full.selected.length);
    expect(sparse.candidates.length).toBe(full.candidates.length);
    for (const c of sparse.selected) {
      expect(
        full.candidates.some((x) => x.row === c.row && x.col === c.col),
      ).toBe(true);
    }

    const frozen = snapshotExpandFromSourceSlots(sparse.selected);
    expect(frozen).toEqual(sparse.selected);

    writeEvidence(
      "expand-block-from-source.log",
      [
        "center=" + JSON.stringify(result.center),
        "candidates=" + result.candidates.length,
        "selected=" + JSON.stringify(result.selected),
        "frozen=" + JSON.stringify(result.frozenSlots),
        "sparse_n=" + sparse.selected.length,
        "full_n=" + full.selected.length,
        "prompt=" +
          buildExpandFromSourceContextPrompt({
            title: "Quadratic formula",
            description: "ax^2+bx+c=0",
            planning_prompt: "Derive then practice",
          }),
        "slot_prompt=" +
          buildExpandFromSourceSlotPrompt({
            source: { title: "Quadratic formula" },
            slot: { row: 6, col: 5 },
            slotIndex: 0,
            totalSlots: 3,
          }),
      ].join("\n"),
    );
  });

  it("prompt includes source identity; drawer gating requires canEdit + sole", () => {
    const ctx = buildExpandFromSourceContextPrompt({
      id: "b1",
      title: "Limits",
      description: "Approach values",
      planning_prompt: "epsilon-delta intro",
    });
    expect(ctx).toMatch(/Limits/);
    expect(ctx).toMatch(/Approach values/);
    expect(ctx).toMatch(/epsilon-delta intro/);
    expect(ctx).toMatch(/main context/i);

    const slot = buildExpandFromSourceSlotPrompt({
      source: { title: "Limits" },
      slot: { row: 1, col: 2 },
      slotIndex: 1,
      totalSlots: 4,
    });
    expect(slot).toMatch(/1:2|row 1, col 2/);
    expect(slot).toMatch(/2 of 4/);

    expect(
      canShowExpandBlockDrawer({ canEdit: true, soleFilledSelected: true }),
    ).toBe(true);
    expect(
      canShowExpandBlockDrawer({ canEdit: false, soleFilledSelected: true }),
    ).toBe(false);
    expect(
      canShowExpandBlockDrawer({ canEdit: true, soleFilledSelected: false }),
    ).toBe(false);
  });

  it("optional modifier guidance is included only when non-empty", () => {
    const source = {
      title: "Quadratic formula",
      description: "ax^2+bx+c=0",
      planning_prompt: "Derive then practice",
    };
    const modifier =
      "Emphasize real-world applications and keep examples beginner-friendly";

    const withGuidance = buildExpandFromSourceContextPrompt(source, modifier);
    expect(withGuidance).toContain("Quadratic formula");
    expect(withGuidance).toContain(modifier);
    expect(withGuidance).toMatch(/Creator guidance for the expansion/i);

    const slotWith = buildExpandFromSourceSlotPrompt({
      source,
      slot: { row: 6, col: 5 },
      slotIndex: 0,
      totalSlots: 3,
      userGuidance: modifier,
    });
    expect(slotWith).toContain(modifier);
    expect(slotWith).toContain("Quadratic formula");
    expect(slotWith).toMatch(/row 6, col 5/);

    // Empty / omitted / whitespace: source-only behavior (no guidance line)
    const emptyCtx = buildExpandFromSourceContextPrompt(source, "");
    const omittedCtx = buildExpandFromSourceContextPrompt(source);
    const wsCtx = buildExpandFromSourceContextPrompt(source, "   \n\t  ");
    for (const p of [emptyCtx, omittedCtx, wsCtx]) {
      expect(p).toContain("Quadratic formula");
      expect(p).toContain("ax^2+bx+c=0");
      expect(p).not.toMatch(/Creator guidance for the expansion/i);
    }
    const slotEmpty = buildExpandFromSourceSlotPrompt({
      source,
      slot: { row: 6, col: 5 },
      slotIndex: 0,
      totalSlots: 1,
      userGuidance: "",
    });
    expect(slotEmpty).toContain("Quadratic formula");
    expect(slotEmpty).not.toMatch(/Creator guidance for the expansion/i);

    writeEvidence(
      "expand-modifier-prompt-tests.log",
      [
        "with_guidance_contains_modifier=" + withGuidance.includes(modifier),
        "slot_with_contains_modifier=" + slotWith.includes(modifier),
        "empty_omits_guidance_line=" +
          !emptyCtx.includes("Creator guidance for the expansion"),
        "omitted_omits_guidance_line=" +
          !omittedCtx.includes("Creator guidance for the expansion"),
        "ws_omits_guidance_line=" +
          !wsCtx.includes("Creator guidance for the expansion"),
        "with_guidance_snip=" + withGuidance.slice(0, 280),
        "slot_with_snip=" + slotWith.slice(0, 280),
      ].join("\n"),
    );
  });
});

describe("structural expand-from-source module", () => {
  it("module exports selection + prompt helpers", () => {
    const src = read("lib/expand-block-from-source.ts");
    expect(src).toContain("resolveExpandFromSourceSelection");
    expect(src).toContain("buildExpandFromSourceContextPrompt");
    expect(src).toContain("buildExpandFromSourceSlotPrompt");
    expect(src).toContain("resolveAddExpandSelection");
  });
});
