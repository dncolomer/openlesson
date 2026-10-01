/**
 * ILE altitude groups come from the stored chapter DAG, not from step order.
 * Adjacent squares at one elevation share one outline. Manual empty-cell add is off.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import {
  ILE_ALTITUDE_TILE_CLASS,
  ileAltitudeGroups,
  ileAltitudeMapFrame,
  ileAltitudePaint,
  type IleAltitudeChapter,
} from "@/lib/ile-altitude-map";
import {
  blockCircularMenuActions,
  blockCircularMenuOpensOnEmpty,
  ileVoicePadSpec,
} from "@/lib/block-circular-menu";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";
import { SKILL_GRID_GAP, SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import type { SessionPlanStep } from "@/lib/domain/types";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function chapter(
  partial: Partial<IleAltitudeChapter> & Pick<IleAltitudeChapter, "id">,
): IleAltitudeChapter {
  return { row: 0, col: 0, ...partial };
}

function step(
  partial: Partial<SessionPlanStep> & Pick<SessionPlanStep, "id" | "order" | "description">,
): SessionPlanStep {
  return { status: "pending", type: "task", ...partial };
}

describe("ile altitude groups", () => {
  it("keeps chapters with no DAG on one elevation and merges only edge-adjacent squares", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "a", row: 0, col: 0 }),
      chapter({ id: "b", row: 0, col: 1 }),
      chapter({ id: "c", row: 1, col: 2 }),
    ]);
    expect(groups.map((group) => group.altitude)).toEqual([0, 0]);
    const merged = groups.find((group) => group.chapterIds.includes("a"));
    const alone = groups.find((group) => group.chapterIds.includes("c"));
    expect(merged?.chapterIds.sort()).toEqual(["a", "b"]);
    expect(merged?.cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    expect(merged?.loops).toHaveLength(1);
    expect(alone?.chapterIds).toEqual(["c"]);
    expect(alone?.loops).toHaveLength(1);

    const pad = SKILL_GRID_GAP / 2;
    expect(merged?.loops[0]?.minX).toBeCloseTo(0 * SKILL_GRID_PITCH - pad);
    expect(merged?.loops[0]?.maxX).toBeCloseTo(2 * SKILL_GRID_PITCH - pad);
    expect(merged?.loops[0]?.d.startsWith("M ")).toBe(true);
    expect(merged?.loops[0]?.d.endsWith("Z")).toBe(true);

    const frame = ileAltitudeMapFrame(groups);
    expect(frame.minX).toBeLessThanOrEqual(0);
    expect(frame.width).toBeGreaterThan(SKILL_GRID_PITCH);
  });

  it("drops elevation along lock-until and leads-to, and ignores step order", () => {
    const fromEdges = ileAltitudeGroups([
      chapter({ id: "high", row: 0, col: 0, nextIds: ["mid"] }),
      chapter({ id: "mid", row: 1, col: 0, lockUntilIds: ["high"], nextIds: ["low"] }),
      chapter({ id: "low", row: 2, col: 0, lockUntilIds: ["mid"] }),
    ]);
    const altitude = Object.fromEntries(fromEdges.map((group) => [group.chapterIds[0], group.altitude]));
    expect(altitude.high).toBeGreaterThan(altitude.mid);
    expect(altitude.mid).toBeGreaterThan(altitude.low);
    expect(fromEdges).toHaveLength(3);

    const highPaint = ileAltitudePaint(altitude.high, altitude.high);
    const lowPaint = ileAltitudePaint(altitude.low, altitude.high);
    expect(highPaint.shadowDy).toBeGreaterThan(lowPaint.shadowDy);
    expect(highPaint.shadowBlur).toBeGreaterThan(lowPaint.shadowBlur);
    expect(highPaint.shadowOpacity).toBeGreaterThan(lowPaint.shadowOpacity);
    expect(highPaint.strokeWidth).toBe(1);
    expect(lowPaint.strokeWidth).toBe(highPaint.strokeWidth);
    expect(parseFloat(highPaint.stroke.split(",")[3] ?? "1")).toBeLessThan(0.7);

    const orderedOnly = ileAltitudeGroups([
      chapter({ id: "first", row: 0, col: 0 }),
      chapter({ id: "second", row: 0, col: 1 }),
    ]);
    expect(new Set(orderedOnly.map((group) => group.altitude))).toEqual(new Set([0]));

    const nodes = sessionStepsToSkillGridNodes([
      step({
        id: "s1",
        order: 0,
        description: "Summit",
        position_x: 0,
        position_y: 0,
        next_step_ids: ["s2"],
      }),
      step({
        id: "s2",
        order: 1,
        description: "Valley",
        position_x: 0,
        position_y: 1,
        lock_until_step_ids: ["s1"],
      }),
      step({
        id: "s3",
        order: 2,
        description: "Beside the summit",
        position_x: 1,
        position_y: 0,
      }),
    ]);
    expect(nodes.find((node) => node.id === "s1")?.next_block_ids).toEqual(["s2"]);
    expect(nodes.find((node) => node.id === "s2")?.lock_until_block_ids).toEqual(["s1"]);
    expect(nodes.find((node) => node.id === "s3")?.lock_until_block_ids).toEqual([]);
    expect(nodes.find((node) => node.id === "s3")?.next_block_ids).toEqual([]);
    const mapped = ileAltitudeGroups(
      nodes.map((node) => ({
        id: node.id,
        row: node.position_y,
        col: node.position_x,
        lockUntilIds: node.lock_until_block_ids,
        nextIds: node.next_block_ids,
      })),
    );
    const byId = new Map(mapped.flatMap((group) => group.chapterIds.map((id) => [id, group.altitude])));
    expect(byId.get("s1")).toBeGreaterThan(byId.get("s2") ?? 0);
    expect(byId.get("s3")).toBe(byId.get("s1"));
    const summit = mapped.find((group) => group.chapterIds.includes("s1"));
    expect(summit?.chapterIds.sort()).toEqual(["s1", "s3"]);
  });

  it("does not loop on a cycle and skips chapters with no square", () => {
    const groups = ileAltitudeGroups([
      chapter({ id: "a", row: 0, col: 0, nextIds: ["b"] }),
      chapter({ id: "b", row: 1, col: 0, nextIds: ["a"] }),
      chapter({ id: "missing", row: null, col: null, nextIds: ["a"] }),
    ]);
    expect(groups.flatMap((group) => group.chapterIds).sort()).toEqual(["a", "b"]);
    expect(groups.every((group) => Number.isFinite(group.altitude))).toBe(true);
  });

  it("draws the chapter map as contours and does not offer an empty-cell add", () => {
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(world).toContain("data-ile-altitude-map");
    expect(world).toContain("data-ile-altitude-shadow");
    expect(world).toContain("ILE_ALTITUDE_TILE_CLASS");
    expect(world).toContain('suggestMode === "chapter"');
    expect(ILE_ALTITUDE_TILE_CLASS).toContain("bg-transparent");
    expect(ILE_ALTITUDE_TILE_CLASS).not.toMatch(/rounded-(sm|md|lg|xl)/);
    expect(
      resolveEmptyCellMarker({
        surface: "chapter",
        canEdit: true,
        learnerMode: false,
      }),
    ).toBe("none");
    expect(world).toContain('surface: suggestMode === "chapter" ? "chapter" : "block"');
    expect(world).toContain('isUnusable && suggestMode !== "chapter"');
    expect(world).toContain("data-map-cell-unusable-mark");
    expect(blockCircularMenuOpensOnEmpty("ile")).toBe(false);
    expect(blockCircularMenuActions("ile", { empty: true })).toEqual([]);
    expect(ileVoicePadSpec({ selection: "empty" }).actions).toEqual([]);
    expect(blockCircularMenuActions("ile").map((action) => action.id)).toEqual(["work", "edit"]);
    const chapter = read("components/ChapterMapPanel.tsx");
    expect(chapter).toContain('suggestMode="chapter"');
    expect(read("lib/ile-tim-chapter-complete.ts")).toContain("chapter_map_expand");
  });
});
