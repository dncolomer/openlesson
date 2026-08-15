/**
 * Workspace + chapter map Done (white + tick) and self-progress (gear + fainter white).
 * Drives the shipped chrome mapper and per-user worked-on persist helper.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAP_CELL_DONE_CLASS,
  MAP_CELL_NEUTRAL_CLASS,
  MAP_CELL_SELF_PROGRESS_CLASS,
  ileChapterCellChrome,
  mapCellChromeClasses,
  mapCellChromeIsNeutral,
  resolveMapCellStatusIcon,
  resolveMapTileChrome,
} from "@/lib/map-cell-chrome";
import {
  LEARNER_MAP_CELL_DONE_CLASS,
  learnerMapCellChromeClasses,
  resolveOccupiedMapTileChrome,
} from "@/lib/workspace-learner-chrome";
import {
  isMapItemWorkedOn,
  loadMapSelfProgressIds,
  mapSelfProgressStorageKey,
  recordMapItemWorkedOn,
  resolveMapSelfProgressScope,
  type MapSelfProgressStorage,
} from "@/lib/map-self-progress";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b487f5346d8e/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function memoryStorage(): MapSelfProgressStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

describe("shipped map-tile chrome mapper", () => {
  it("Done is white + tick; self-progress is fainter white + gear; Done wins", () => {
    const workspaceDone = resolveMapTileChrome({
      status: "completed",
      selected: false,
      surface: "block",
    });
    const chapterDone = ileChapterCellChrome({
      status: "done",
      selected: false,
    });
    const learnerDone = learnerMapCellChromeClasses({
      status: "completed",
      selected: false,
    });
    const occupiedDone = resolveOccupiedMapTileChrome({
      learnerMode: true,
      status: "completed",
      selected: false,
      workedOn: true,
    });
    const selfProgress = resolveMapTileChrome({
      status: "available",
      selected: false,
      workedOn: true,
      surface: "block",
    });
    const chapterProgress = ileChapterCellChrome({
      status: "in_progress",
      selected: false,
      workedOn: true,
    });
    const untouched = resolveMapTileChrome({
      status: "available",
      selected: false,
      surface: "block",
    });
    const selectedDone = resolveMapTileChrome({
      status: "completed",
      selected: true,
      workedOn: true,
      surface: "chapter",
    });

    expect(workspaceDone.statusIcon).toBe("tick");
    expect(workspaceDone.className).toBe(MAP_CELL_DONE_CLASS);
    expect(workspaceDone.className).toMatch(/bg-white/);
    expect(workspaceDone.className).toMatch(/border-white/);
    expect(workspaceDone.className).not.toMatch(/emerald|amber|cyan|green-/i);

    expect(chapterDone.statusIcon).toBe("tick");
    expect(chapterDone.className).toBe(MAP_CELL_DONE_CLASS);

    expect(learnerDone).toBe(LEARNER_MAP_CELL_DONE_CLASS);
    expect(learnerDone).toBe(MAP_CELL_DONE_CLASS);
    expect(learnerDone).not.toMatch(/emerald/);

    expect(occupiedDone.statusIcon).toBe("tick");
    expect(occupiedDone.className).toMatch(/bg-white/);
    expect(occupiedDone.className).not.toMatch(/emerald/);

    expect(selfProgress.statusIcon).toBe("gear");
    expect(selfProgress.className).toBe(MAP_CELL_SELF_PROGRESS_CLASS);
    expect(selfProgress.className).toMatch(/bg-white\/40/);
    expect(selfProgress.className).not.toBe(MAP_CELL_DONE_CLASS);
    expect(selfProgress.className).not.toBe(MAP_CELL_NEUTRAL_CLASS);
    expect(mapCellChromeIsNeutral(selfProgress.className)).toBe(true);

    expect(chapterProgress.statusIcon).toBe("gear");
    expect(chapterProgress.className).toBe(MAP_CELL_SELF_PROGRESS_CLASS);

    expect(untouched.statusIcon).toBeNull();
    expect(untouched.className).toBe(MAP_CELL_NEUTRAL_CLASS);
    expect(resolveMapCellStatusIcon("available", true, "block", false)).toBeNull();

    expect(selectedDone.statusIcon).toBe("tick");
    expect(selectedDone.className).toMatch(/bg-white/);
    expect(selectedDone.className).toMatch(/ring-white/);

    expect(
      mapCellChromeClasses({
        status: "in_progress",
        selected: false,
        workedOn: false,
      }),
    ).toBe(MAP_CELL_NEUTRAL_CLASS);

    writeScratch(
      "map-done-progress-chrome.txt",
      [
        `workspaceDone icon=${workspaceDone.statusIcon} class=${workspaceDone.className}`,
        `chapterDone icon=${chapterDone.statusIcon} class=${chapterDone.className}`,
        `learnerDone class=${learnerDone}`,
        `occupiedDone+workedOn icon=${occupiedDone.statusIcon} class=${occupiedDone.className}`,
        `selfProgress icon=${selfProgress.statusIcon} class=${selfProgress.className}`,
        `chapterProgress icon=${chapterProgress.statusIcon} class=${chapterProgress.className}`,
        `untouched icon=${untouched.statusIcon} class=${untouched.className}`,
        `selectedDone icon=${selectedDone.statusIcon} class=${selectedDone.className}`,
      ].join("\n"),
    );
  });
});

describe("self-progress persist helper", () => {
  it("records this user's first-work; another user stays empty; reload keeps the mark", () => {
    const storage = memoryStorage();
    const userA = resolveMapSelfProgressScope({
      userId: "user-a",
      kind: "workspace",
      scopeId: "ws-1",
    });
    const userB = resolveMapSelfProgressScope({
      userId: "user-b",
      kind: "workspace",
      scopeId: "ws-1",
    });
    const chapterScope = resolveMapSelfProgressScope({
      userId: "user-a",
      kind: "chapter",
      scopeId: "session-1",
    });
    expect(userA).not.toBeNull();
    expect(userB).not.toBeNull();
    expect(chapterScope).not.toBeNull();

    expect(loadMapSelfProgressIds(userA, storage)).toEqual([]);
    const afterFirst = recordMapItemWorkedOn(userA, "block-42", storage);
    expect(afterFirst).toEqual(["block-42"]);
    expect(isMapItemWorkedOn(afterFirst, "block-42")).toBe(true);
    expect(isMapItemWorkedOn(afterFirst, "block-99")).toBe(false);

    const reloaded = loadMapSelfProgressIds(userA, storage);
    expect(reloaded).toEqual(["block-42"]);
    expect(isMapItemWorkedOn(reloaded, "block-42")).toBe(true);

    expect(recordMapItemWorkedOn(userA, "block-42", storage)).toEqual(["block-42"]);
    expect(loadMapSelfProgressIds(userB, storage)).toEqual([]);
    expect(isMapItemWorkedOn(loadMapSelfProgressIds(userB, storage), "block-42")).toBe(
      false,
    );
    expect(loadMapSelfProgressIds(null, storage)).toEqual([]);
    expect(recordMapItemWorkedOn(null, "block-42", storage)).toEqual([]);

    const afterChapter = recordMapItemWorkedOn(chapterScope, "chapter-7", storage);
    expect(afterChapter).toEqual(["chapter-7"]);
    expect(loadMapSelfProgressIds(chapterScope, storage)).toEqual(["chapter-7"]);
    expect(loadMapSelfProgressIds(userA, storage)).toEqual(["block-42"]);

    expect(mapSelfProgressStorageKey(userA!)).toContain("user-a");
    expect(mapSelfProgressStorageKey(userA!)).not.toBe(
      mapSelfProgressStorageKey(userB!),
    );

    writeScratch(
      "map-self-progress.txt",
      [
        `userA=${JSON.stringify(reloaded)}`,
        `userB=${JSON.stringify(loadMapSelfProgressIds(userB, storage))}`,
        `chapter=${JSON.stringify(loadMapSelfProgressIds(chapterScope, storage))}`,
        `userAKey=${mapSelfProgressStorageKey(userA!)}`,
        `userBKey=${mapSelfProgressStorageKey(userB!)}`,
      ].join("\n"),
    );
  });
});

describe("workspace Mark as Done + tile glyphs", () => {
  it("workspace pane marks Done; both maps render tick/gear from the chrome mapper", () => {
    const pane = read("components/WorkspaceLearnerBlockPane.tsx");
    const chapter = read("components/ChapterMapPanel.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    const view = read("components/WorkspaceView.tsx");

    expect(pane).toContain("data-learner-mark-done");
    expect(pane).toContain("Mark as Done");
    expect(pane).toContain("onMarkDone");
    expect(chapter).toContain("onChapterDone");
    expect(chapter).toContain('t("chapterMap.markDone")');
    expect(chapter).toContain("learnerScopeId");

    expect(grid).toContain("ileChapterCellChrome");
    expect(grid).toContain("resolveOccupiedMapTileChrome");
    expect(grid).toContain("recordMapItemWorkedOn");
    expect(grid).toContain("MapCellStatusGlyph");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(badges).toContain("data-ile-chapter-done-tick");
    expect(badges).toContain("data-map-cell-done-tick");
    expect(badges).toContain("data-map-cell-self-progress-gear");
    expect(grid).toContain("workedOn: itemWorkedOn");
    expect(grid).not.toMatch(/from "lucide-react"/);

    expect(view).toContain("recordMapItemWorkedOn");
    expect(view).toContain("onMarkDone");
    expect(view).toContain("WorkspaceLearnerBlockPane");

    writeScratch(
      "map-done-progress-excerpts.txt",
      [
        "WorkspaceLearnerBlockPane: data-learner-mark-done + Mark as Done",
        "ChapterMapPanel: onChapterDone + chapterMap.markDone + learnerScopeId",
        "BlockSkillGrid: ileChapterCellChrome + resolveOccupiedMapTileChrome + tick/gear glyphs",
        "WorkspaceView: recordMapItemWorkedOn on launch + onMarkDone",
      ].join("\n"),
    );
  });
});
