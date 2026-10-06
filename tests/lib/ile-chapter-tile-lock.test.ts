/**
 * TAP Learning chapter tiles: DAG-lock badge only; selecting a locked chapter
 * highlights direct blocking prereqs (not the whole neighborhood).
 */
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";
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

describe("TAP Learning chapter tile badges", () => {
  it("does not resolve an identity occupied-tile badge set", () => {
    const badges = read("lib/map-tile-badges.ts");
    expect(badges).not.toContain("resolveMapOccupiedTileBadges");
    expect(resolveEmptyCellMarker({ canEdit: true, learnerMode: false })).toBe("plus");
    expect(
      resolveEmptyCellMarker({ canEdit: true, learnerMode: false, isUnusable: true }),
    ).toBe("none");
    expect(resolveEmptyCellMarker({ canEdit: false, learnerMode: true })).toBe("none");

    expect(chapterHasDagLockChrome(chapters[0]!, chapters)).toBe(false);
    expect(chapterHasDagLockChrome(chapters[1]!, chapters)).toBe(true);
    expect(isChapterMapTileLocked(chapters[0]!, chapters)).toBe(false);
    expect(isChapterMapTileLocked(chapters[1]!, chapters)).toBe(true);

    writeScratch(
      "ile-chapter-tile-badges.txt",
      [
        "occupied_badge_helper=absent",
        `first_has_lock_chrome=${chapterHasDagLockChrome(chapters[0]!, chapters)}`,
        `second_has_lock_chrome=${chapterHasDagLockChrome(chapters[1]!, chapters)}`,
      ].join("\n"),
    );
  });
});

describe("TAP Learning chapter unlock highlight", () => {
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
    const grid = readMapGridSurface();
    expect(existsSync(join(ROOT, "components/ChapterMapPanel.tsx"))).toBe(false);
    const board = read("components/BlockSkillGrid.tsx");
    const mapper = read("lib/chapter-skill-grid.ts");

    expect(board).not.toContain("suggestMode");
    expect(grid).not.toContain("resolveMapOccupiedTileBadges");
    expect(grid).not.toContain("ileChapterUnlockHighlightIds");
    expect(grid).not.toContain("isChapterMapTileLocked");
    expect(grid).not.toContain("chapterHasDagLockChrome");
    expect(grid).not.toContain("data-ile-chapter-unlock-highlight");
    expect(grid).toContain('surface: "block"');
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
    expect(nodes[1]?.lock_until_block_ids).toEqual([]);
    expect(nodes[0]?.next_block_ids).toEqual([]);
    expect(nodes[1]?.next_block_ids).toEqual([]);
    expect(nodes[0]?.is_start).toBe(true);

    writeScratch(
      "ile-chapter-lock-excerpts.txt",
      [
        "ChapterMapPanel absent; BlockSkillGrid has no chapter suggest mode",
        "BlockSkillGrid: no identity occupied-tile badge helper",
        "BlockSkillGrid: no chapter unlock highlight",
        "sessionStepsToSkillGridNodes: no implicit order DAG",
      ].join("\n"),
    );
  });
});
