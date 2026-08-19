/**
 * ILE chapter Done chrome + context-full auto-stash + chapter-load timing.
 * Drives the shipped mappers/appliers BlockSkillGrid / SessionHeliosPanel call.
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ileChapterCellChrome,
  MAP_CELL_CHAPTER_DONE_CLASS,
  MAP_CELL_NEUTRAL_CLASS,
  mapCellChromeClasses,
  resolveMapCellStatusIcon,
} from "@/lib/map-cell-chrome";
import {
  applyIleContextFullAutoStash,
  buildIleThoughtMemoryRecord,
} from "@/lib/ile-context-auto-stash";
import { emptyIleProjectDualLists } from "@/lib/ile-mode";
import { THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS } from "@/lib/thought-context-auto-stash";
import { CHAPTER_LOAD_DURATION_MS } from "@/components/session/sessionViewHelpers";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f144411bd284/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ileChapterCellChrome (shipped ILE chapter-map mapper)", () => {
  it("completed chapter is white fill + tick; pending has no tick", () => {
    const done = ileChapterCellChrome({
      status: "completed",
      selected: false,
    });
    const pending = ileChapterCellChrome({
      status: "available",
      selected: false,
    });
    const progress = ileChapterCellChrome({
      status: "in_progress",
      selected: false,
    });
    const focusedDone = ileChapterCellChrome({
      status: "completed",
      selected: false,
      focused: true,
    });

    expect(done.statusIcon).toBe("tick");
    expect(done.className).toBe(MAP_CELL_CHAPTER_DONE_CLASS);
    expect(done.className).toMatch(/bg-white/);
    expect(done.className).toMatch(/border-white/);
    expect(pending.statusIcon).toBeNull();
    expect(progress.statusIcon).toBeNull();
    expect(pending.className).toBe(MAP_CELL_NEUTRAL_CLASS);
    expect(focusedDone.statusIcon).toBe("tick");
    expect(focusedDone.className).toMatch(/ring-white|ring-2/);
    expect(focusedDone.className).toMatch(/bg-white/);

    writeScratch(
      "ile-chapter-done-chrome.txt",
      [
        `completed icon=${done.statusIcon} class=${done.className}`,
        `pending icon=${pending.statusIcon} class=${pending.className}`,
        `in_progress icon=${progress.statusIcon} class=${progress.className}`,
        `focusedDone icon=${focusedDone.statusIcon} class=${focusedDone.className}`,
      ].join("\n"),
    );
  });

  it("workspace completed uses the same white Done chrome as chapters", () => {
    expect(resolveMapCellStatusIcon("completed", true)).toBe("tick");
    expect(mapCellChromeClasses({ status: "completed", selected: false })).toBe(
      MAP_CELL_CHAPTER_DONE_CLASS,
    );
    expect(mapCellChromeClasses({ status: "available", selected: false })).toBe(
      MAP_CELL_NEUTRAL_CLASS,
    );
  });
});

describe("applyIleContextFullAutoStash (shipped ILE apply path)", () => {
  it("Learning Mode persists forming text to thought-memory and clears the bar", () => {
    const forming = "x".repeat(THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS);
    const prior = buildIleThoughtMemoryRecord("earlier note", [], 1);
    const result = applyIleContextFullAutoStash({
      formingText: forming,
      sessionMode: "learning",
      thoughtMemory: prior ? [prior] : [],
      nowMs: 50_000,
    });
    expect(result.didStash).toBe(true);
    expect(result.destination).toBe("thought-memory");
    expect(result.formingText).toBe("");
    expect(result.thought?.text).toBe(forming);
    expect(result.thoughtMemory.map((t) => t.text)).toEqual(
      prior ? [prior.text, forming] : [forming],
    );
    expect(result.projectLists.stash).toHaveLength(0);
  });

  it("Project Mode persists forming text onto the dual-stack stash and clears the bar", () => {
    const forming = "project topic ".repeat(30).slice(0, THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS);
    expect(forming.length).toBe(THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS);
    const result = applyIleContextFullAutoStash({
      formingText: forming,
      sessionMode: "project",
      chapterStatus: "in_progress",
      projectLists: emptyIleProjectDualLists(),
      nowMs: 77_000,
    });
    expect(result.didStash).toBe(true);
    expect(result.destination).toBe("project-dual-stash");
    expect(result.formingText).toBe("");
    expect(result.thought?.text).toBe(forming.trim());
    expect(result.projectLists.stash.map((t) => t.text)).toEqual([forming.trim()]);
    expect(result.thoughtMemory).toEqual([]);

    writeScratch(
      "ile-context-autostash.txt",
      [
        `learningDest=thought-memory`,
        `projectDest=${result.destination}`,
        `projectText=${result.thought?.text}`,
        `cleared=${result.formingText === ""}`,
        `stashCount=${result.projectLists.stash.length}`,
      ].join("\n"),
    );
  });

  it("does not stash when the bar is not full, or when Project chapter is locked", () => {
    const short = applyIleContextFullAutoStash({
      formingText: "too short",
      sessionMode: "learning",
    });
    expect(short.didStash).toBe(false);
    expect(short.formingText).toBe("too short");
    expect(short.thought).toBeNull();

    const locked = applyIleContextFullAutoStash({
      formingText: "y".repeat(THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS),
      sessionMode: "project",
      chapterStatus: "completed",
      projectLists: emptyIleProjectDualLists(),
    });
    expect(locked.didStash).toBe(false);
    expect(locked.projectLists.stash).toHaveLength(0);
  });
});

describe("ILE slowness + wiring (shipped source)", () => {
  it("chapter-load delay is gone or ≤ 200ms; dead Project auto-stash effect is gone; live text is read from a ref", () => {
    expect(CHAPTER_LOAD_DURATION_MS).toBeLessThanOrEqual(200);

    const helpers = read("components/session/sessionViewHelpers.ts");
    expect(helpers).toMatch(/CHAPTER_LOAD_DURATION_MS = 0/);

    const view = readSessionViewSurface();
    expect(view).toContain("CHAPTER_LOAD_DURATION_MS");
    expect(view).toContain("CHAPTER_LOAD_DURATION_MS > 0");
    expect(view).not.toContain("Handled in SessionHeliosPanel via onProjectStash");
    expect(view).toContain("getFormingText");

    const hook = read("lib/useSessionThoughtInterface.ts");
    expect(hook).toContain("crystallizableTextRef");
    expect(hook).toContain("getFormingText");
    expect(hook).toContain("buildIleThoughtMemoryRecord");

    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).toContain("applyIleContextFullAutoStash");
    expect(helios).toContain("getFormingText");
    expect(helios).toContain("ingestStashedThought");

    const grid = readMapGridSurface() + read("components/block-skill-grid/map-tile-badges.tsx");
    expect(grid).toContain("ileChapterCellChrome");
    expect(grid).toContain("data-ile-chapter-done-tick");

    const chapter = read("components/ChapterMapPanel.tsx");
    expect(chapter).toContain('suggestMode="chapter"');
    writeScratch(
      "ile-chapter-done-excerpts.txt",
      [
        "BlockSkillGrid uses ileChapterCellChrome + data-ile-chapter-done-tick",
        "ChapterMapPanel suggestMode=chapter",
        `CHAPTER_LOAD_DURATION_MS=${CHAPTER_LOAD_DURATION_MS}`,
      ].join("\n"),
    );
  });
});
