/**
 * Canvas-first ILE session: chapter count, presets, cap, and the
 * session-wide insight goal. Imports the shipped helpers.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_PREGAME_DIFFICULTY_PRESETS,
  ILE_PREGAME_PRESETS,
  applyIlePregameDifficultyPreset,
  applyIlePregamePreset,
  clampIlePregameKnobs,
} from "@/lib/ile-pregame-settings";
import {
  capIleSessionChapters,
  clampIleSessionChapterCount,
  clampIleSessionInsightGoal,
  ileChaptersMarkedDoneForInsightGoal,
  ileInsightGoalBlocksWork,
} from "@/lib/ile-canvas-session";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a4905160ec41/implementer";

describe("ILE canvas session chapter count and insight goal", () => {
  it("clamps a manual count and every preset to 1–5 and does not select a map type", () => {
    const manual = [
      clampIleSessionChapterCount(1),
      clampIleSessionChapterCount(3),
      clampIleSessionChapterCount(0),
      clampIleSessionChapterCount(9),
      clampIleSessionChapterCount("22"),
      clampIlePregameKnobs({ chapterCount: 4 }).chapterCount,
    ];
    expect(manual).toEqual([1, 3, 1, 5, 5, 4]);

    const presetRows = ILE_PREGAME_PRESETS.map((preset) => {
      const knobs = applyIlePregamePreset(preset.id);
      return {
        id: preset.id,
        chapterCount: knobs.chapterCount,
        hasMapType: Object.prototype.hasOwnProperty.call(knobs, "mapType"),
      };
    });
    expect(presetRows.map((row) => row.hasMapType)).toEqual([false, false, false]);
    for (const row of presetRows) {
      expect(row.chapterCount).toBeGreaterThanOrEqual(1);
      expect(row.chapterCount).toBeLessThanOrEqual(5);
    }
    expect(presetRows.map((row) => row.chapterCount)).toEqual([1, 3, 5]);

    const longer = Array.from({ length: 18 }, (_, index) => `chapter-${index + 1}`);
    const capped = capIleSessionChapters(longer, presetRows[1]?.chapterCount);
    expect(capped).toEqual(["chapter-1", "chapter-2", "chapter-3"]);
    expect(capIleSessionChapters(longer, 22)).toHaveLength(5);
    expect(capIleSessionChapters(longer, 6)).toHaveLength(5);

    const goals = ILE_PREGAME_DIFFICULTY_PRESETS.map((preset) => {
      const difficulty = applyIlePregameDifficultyPreset(preset.id);
      return clampIleSessionInsightGoal(difficulty.minInsightsPerChapter);
    });
    expect(goals).toEqual([1, 1, 2]);
    expect(clampIleSessionInsightGoal(0)).toBe(1);
    expect(clampIleSessionInsightGoal(4)).toBe(4);
    expect(clampIleSessionInsightGoal(80)).toBe(5);
    expect(ileInsightGoalBlocksWork(0, 5)).toBe(false);
    expect(ileInsightGoalBlocksWork(1, 5)).toBe(false);
    expect(ileChaptersMarkedDoneForInsightGoal()).toEqual([]);

    const observed = [
      `manual ${manual.join(",")}`,
      ...presetRows.map((row) => `${row.id} chapters=${row.chapterCount} mapType=${row.hasMapType}`),
      `capped3 ${capped.join(",")}`,
      `cap22 ${capIleSessionChapters(longer, 22).length}`,
      `goals ${goals.join(",")}`,
      `blocksWork ${ileInsightGoalBlocksWork(0, goals[2])}`,
      `markedDone ${ileChaptersMarkedDoneForInsightGoal().length}`,
    ].join("\n");
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, "ile-canvas-session-settings.txt"), `${observed}\n`);
    expect(readFileSync(join(SCRATCH, "ile-canvas-session-settings.txt"), "utf8")).toContain(
      "skirmish chapters=1 mapType=false",
    );
  });
});
