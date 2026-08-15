/**
 * ILE chapter tiles: DAG-lock badge only; selecting a locked chapter
 * highlights direct blocking prereqs (not the whole neighborhood).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveMapOccupiedTileBadges } from "@/lib/map-tile-badges";
import {
  chapterHasDagLockChrome,
  ileChapterUnlockHighlightIds,
  isChapterMapTileLocked,
  type LearnerLocalDagBlock,
} from "@/lib/learner-local-dag";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import type { SessionPlanStep } from "@/lib/storage";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-afa3922221b0/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const chapters: LearnerLocalDagBlock[] = [
  {
    id: "ch-a",
    title: "First",
    status: "available",
    next_block_ids: ["ch-b"],
    lock_until_block_ids: [],
  },
  {
    id: "ch-b",
    title: "Second",
    status: "available",
    next_block_ids: ["ch-c"],
    lock_until_block_ids: ["ch-a"],
  },
  {
    id: "ch-c",
    title: "Third",
    status: "available",
    next_block_ids: [],
    lock_until_block_ids: ["ch-b"],
  },
];

describe("ILE chapter tile badges", () => {
  it("chapter tiles drop workspace badges; DAG lock still reports", () => {
    const loaded = resolveMapOccupiedTileBadges({
      surface: "chapter",
      hasDagLock: false,
      isStart: true,
      hasPractice: true,
      hasLocalContext: true,
      hasEffects: true,
      generatorBusy: true,
    });
    expect(loaded.showLock).toBe(false);
    expect(loaded.showStarter).toBe(false);
    expect(loaded.showPractice).toBe(false);
    expect(loaded.showLocalContext).toBe(false);
    expect(loaded.showEffects).toBe(false);
    expect(loaded.showGeneratorBusy).toBe(false);

    const locked = resolveMapOccupiedTileBadges({
      surface: "chapter",
      hasDagLock: true,
      isStart: true,
      hasPractice: true,
      hasLocalContext: true,
      hasEffects: true,
      generatorBusy: true,
    });
    expect(locked.showLock).toBe(true);
    expect(locked.showStarter).toBe(false);
    expect(locked.showPractice).toBe(false);
    expect(locked.showLocalContext).toBe(false);
    expect(locked.showEffects).toBe(false);
    expect(locked.showGeneratorBusy).toBe(false);

    const workspace = resolveMapOccupiedTileBadges({
      surface: "block",
      hasDagLock: true,
      isStart: true,
      hasPractice: true,
      hasLocalContext: true,
      hasEffects: true,
      generatorBusy: true,
    });
    expect(workspace.showLock).toBe(true);
    expect(workspace.showStarter).toBe(true);
    expect(workspace.showPractice).toBe(true);
    expect(workspace.showLocalContext).toBe(true);
    expect(workspace.showEffects).toBe(true);
    expect(workspace.showGeneratorBusy).toBe(true);

    expect(chapterHasDagLockChrome(chapters[0]!, chapters)).toBe(false);
    expect(chapterHasDagLockChrome(chapters[1]!, chapters)).toBe(true);
    expect(isChapterMapTileLocked(chapters[0]!, chapters)).toBe(false);
    expect(isChapterMapTileLocked(chapters[1]!, chapters)).toBe(true);

    writeScratch(
      "ile-chapter-tile-badges.txt",
      [
        `chapter_flags=${JSON.stringify(loaded)}`,
        `chapter_locked=${JSON.stringify(locked)}`,
        `workspace_keeps_suite=${JSON.stringify(workspace)}`,
        `first_has_lock_chrome=${chapterHasDagLockChrome(chapters[0]!, chapters)}`,
        `second_has_lock_chrome=${chapterHasDagLockChrome(chapters[1]!, chapters)}`,
      ].join("\n"),
    );
  });
});

describe("ILE chapter unlock highlight", () => {
  it("selecting a locked chapter highlights only incomplete direct prereqs", () => {
    expect(ileChapterUnlockHighlightIds("ch-b", chapters)).toEqual(["ch-a"]);
    expect(ileChapterUnlockHighlightIds("ch-c", chapters)).toEqual(["ch-b"]);
    expect(ileChapterUnlockHighlightIds("ch-c", chapters)).not.toContain("ch-a");
    expect(ileChapterUnlockHighlightIds("ch-a", chapters)).toEqual([]);

    const aDone = chapters.map((c) =>
      c.id === "ch-a" ? { ...c, status: "completed" } : c,
    );
    expect(isChapterMapTileLocked(aDone[1]!, aDone)).toBe(false);
    expect(ileChapterUnlockHighlightIds("ch-b", aDone)).toEqual([]);
    expect(ileChapterUnlockHighlightIds("ch-c", aDone)).toEqual(["ch-b"]);

    const allDone = chapters.map((c) => ({ ...c, status: "completed" }));
    expect(ileChapterUnlockHighlightIds("ch-c", allDone)).toEqual([]);

    writeScratch(
      "ile-chapter-lock-highlight.txt",
      [
        `select_b=${ileChapterUnlockHighlightIds("ch-b", chapters).join(",")}`,
        `select_c=${ileChapterUnlockHighlightIds("ch-c", chapters).join(",")}`,
        `select_unlocked_a=${ileChapterUnlockHighlightIds("ch-a", chapters).join(",") || "empty"}`,
        `select_b_after_a_done=${ileChapterUnlockHighlightIds("ch-b", aDone).join(",") || "empty"}`,
        `select_c_after_a_done=${ileChapterUnlockHighlightIds("ch-c", aDone).join(",")}`,
      ].join("\n"),
    );
  });
});

describe("chapter map path wiring", () => {
  it("chapter grid omits extra badges and applies unlock-highlight on locked select", () => {
    const grid = read("components/BlockSkillGrid.tsx");
    const chapter = read("components/ChapterMapPanel.tsx");
    const mapper = read("lib/chapter-skill-grid.ts");

    expect(chapter).toContain('suggestMode="chapter"');
    expect(grid).toContain("resolveMapOccupiedTileBadges");
    expect(grid).toContain("ileChapterUnlockHighlightIds");
    expect(grid).toContain("isChapterMapTileLocked");
    expect(grid).toContain("chapterHasDagLockChrome");
    expect(grid).toContain("data-ile-chapter-unlock-highlight");
    expect(grid).toContain('surface: suggestMode === "chapter" ? "chapter" : "block"');
    expect(mapper).toContain("lock_until_block_ids");

    const steps: SessionPlanStep[] = [
      {
        id: "s1",
        order: 0,
        description: "One",
        status: "pending",
        type: "task",
        position_x: 0,
        position_y: 0,
      },
      {
        id: "s2",
        order: 1,
        description: "Two",
        status: "pending",
        type: "task",
        position_x: 1,
        position_y: 0,
      },
    ];
    const nodes = sessionStepsToSkillGridNodes(steps);
    expect(nodes[0]?.lock_until_block_ids).toEqual([]);
    expect(nodes[1]?.lock_until_block_ids).toEqual(["s1"]);
    expect(nodes[0]?.is_start).toBe(true);

    writeScratch(
      "ile-chapter-lock-excerpts.txt",
      [
        "ChapterMapPanel: suggestMode=chapter",
        "BlockSkillGrid: resolveMapOccupiedTileBadges + ileChapterUnlockHighlightIds",
        "BlockSkillGrid: data-ile-chapter-unlock-highlight",
        "sessionStepsToSkillGridNodes: lock_until previous chapter",
      ].join("\n"),
    );
  });
});
