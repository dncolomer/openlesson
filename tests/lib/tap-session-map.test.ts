/**
 * Ephemeral TAP live map: origin-centered fog grid, cluster placement, solo seed/select.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chebyshevDistance, getCellKey } from "@/lib/block-skill-grid";
import { emptyExerciseDualLists, stashExerciseSpeech } from "@/lib/exercise-tap";
import { createMapFogLookup } from "@/lib/map-fog-of-war";
import {
  markTapSoloProblemSubmitted,
  nextTapMapCell,
  seedTapSoloProblems,
  setTapSoloProblemLists,
  tapConvoBlocksFromAssistantTurns,
  TAP_SESSION_MAP_MIN_HALF_SPAN,
  TAP_SESSION_MAP_PAD_PX,
  tapSessionMapCenterOnOrigin,
  tapSessionMapViewport,
} from "@/lib/tap-session-map";
import { SKILL_GRID_CELL_SIZE, SKILL_GRID_GAP } from "@/lib/block-skill-grid";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-7c8727e16da8/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function isAdjacentToSome(
  cell: { row: number; col: number },
  occupied: Array<{ row: number; col: number }>,
): boolean {
  return occupied.some((other) => chebyshevDistance(cell, other) === 1);
}

describe("TAP session map placement", () => {
  it("places origin first, then adjacent cluster cells that are not a stripe", () => {
    const occupied: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < 5; i += 1) {
      occupied.push(nextTapMapCell(occupied));
    }
    expect(occupied[0]).toEqual({ row: 0, col: 0 });
    for (let i = 1; i < occupied.length; i += 1) {
      expect(isAdjacentToSome(occupied[i], occupied.slice(0, i))).toBe(true);
    }
    const rows = new Set(occupied.map((c) => c.row));
    const cols = new Set(occupied.map((c) => c.col));
    expect(rows.size).toBeGreaterThan(1);
    expect(cols.size).toBeGreaterThan(1);

    writeScratch(
      "tap-map-placement.txt",
      [
        occupied.map((c, i) => `${i}=${c.row},${c.col}`).join(" "),
        `uniqueRows=${rows.size}`,
        `uniqueCols=${cols.size}`,
        `first=${occupied[0].row},${occupied[0].col}`,
      ].join("\n"),
    );
  });

  it("builds convo blocks around geometry, stably from the same turns", () => {
    const turns = [
      { id: "a1", content: "What is a heap?" },
      { id: "a2", content: "Walk through insert." },
      { id: "a3", content: "Now delete-min." },
      { id: "a4", content: "What is the complexity?" },
    ];
    const blocks = tapConvoBlocksFromAssistantTurns(turns);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toMatchObject({ id: "a1", row: 0, col: 0, kind: "convo" });
    for (let i = 1; i < blocks.length; i += 1) {
      expect(isAdjacentToSome(blocks[i], blocks.slice(0, i))).toBe(true);
    }
    expect(new Set(blocks.map((b) => b.row)).size).toBeGreaterThan(1);
    expect(tapConvoBlocksFromAssistantTurns(turns)).toEqual(blocks);
  });
});

describe("TAP session map viewport / fog", () => {
  it("renders a 2D origin-centered window and applies fog to empties", () => {
    const one = tapSessionMapViewport([{ row: 0, col: 0 }]);
    const stripe = tapSessionMapViewport([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
    for (const view of [one, stripe]) {
      expect(view.maxRow - view.minRow).toBeGreaterThan(1);
      expect(view.maxCol - view.minCol).toBeGreaterThan(1);
      expect(view.minRow).toBe(-view.maxRow);
      expect(view.minCol).toBe(-view.maxCol);
      expect(view.maxRow).toBeGreaterThanOrEqual(TAP_SESSION_MAP_MIN_HALF_SPAN);
    }

    const fog = createMapFogLookup({ occupiedKeys: [getCellKey(0, 0)] });
    expect(fog(0, 0).opacity).toBe(1);
    expect(fog(0, 0).fullyVisible).toBe(true);
    expect(fog(1, 0).fullyVisible).toBe(true);
    const far = fog(one.maxRow, one.maxCol);
    expect(far.opacity).toBe(0);
    expect(far.fullyVisible).toBe(false);

    writeScratch(
      "tap-map-viewport.txt",
      [
        `one=${one.minRow}:${one.maxRow}x${one.minCol}:${one.maxCol}`,
        `stripe=${stripe.minRow}:${stripe.maxRow}x${stripe.minCol}:${stripe.maxCol}`,
        `originFog=${fog(0, 0).opacity}`,
        `nearFog=${fog(1, 0).fullyVisible}`,
        `farFog=${far.opacity}`,
        `halfSpan=${TAP_SESSION_MAP_MIN_HALF_SPAN}`,
      ].join("\n"),
    );
  });

  it("scrolls so block 0,0 is at the visual center of the map pane", () => {
    const viewport = tapSessionMapViewport([{ row: 0, col: 0 }]);
    const vw = 420;
    const vh = 640;
    const layout = tapSessionMapCenterOnOrigin({
      viewport,
      cellSize: SKILL_GRID_CELL_SIZE,
      gap: SKILL_GRID_GAP,
      padding: TAP_SESSION_MAP_PAD_PX,
      viewportWidth: vw,
      viewportHeight: vh,
    });
    expect(layout.originCenterX - layout.scrollLeft).toBeCloseTo(vw / 2, 5);
    expect(layout.originCenterY - layout.scrollTop).toBeCloseTo(vh / 2, 5);

    const overlayH = 180;
    const withOverlay = tapSessionMapCenterOnOrigin({
      viewport,
      cellSize: SKILL_GRID_CELL_SIZE,
      gap: SKILL_GRID_GAP,
      padding: TAP_SESSION_MAP_PAD_PX,
      viewportWidth: vw,
      viewportHeight: vh,
      insetBottom: overlayH,
    });
    expect(withOverlay.originCenterX - withOverlay.scrollLeft).toBeCloseTo(vw / 2, 5);
    expect(withOverlay.originCenterY - withOverlay.scrollTop).toBeCloseTo((vh - overlayH) / 2, 5);

    const map = read("components/tap-score/tap-session-map.tsx");
    expect(map).toContain("tapSessionMapCenterOnOrigin");
    expect(map).toContain("data-tap-session-map-center-inner");
    expect(map).toContain("insetBottom");
    expect(map).toContain("data-tap-turn-overlay");
    expect(map).toContain("scrollLeft");
    expect(map).toContain("scrollTop");
  });
});

describe("TAP solo problems", () => {
  it("seeds multiple occupied problems and click-select swaps lists without autoadvance", () => {
    const seeded = seedTapSoloProblems({
      exerciseText: "Solve the recurrence T(n)=2T(n/2)+n.",
      startedTopicId: "t1",
      topics: [
        { id: "t1", title: "Recurrence", subtitle: "", openingQuestion: "Solve the recurrence T(n)=2T(n/2)+n." },
        { id: "t2", title: "Heaps", subtitle: "", openingQuestion: "Insert 7 into this heap." },
        { id: "t3", title: "DFS", subtitle: "", openingQuestion: "Trace DFS on the graph." },
      ],
    });
    expect(seeded.placed.length).toBeGreaterThan(1);
    expect(seeded.placed[0].id).toBe("t1");
    expect(seeded.placed[0].row).toBe(0);
    expect(seeded.placed[0].col).toBe(0);
    expect(seeded.pool).toHaveLength(0);

    const aId = seeded.placed[0].id;
    const bId = seeded.placed[1].id;
    const stashed = stashExerciseSpeech(emptyExerciseDualLists(), "sketch for A");
    let problems = setTapSoloProblemLists(seeded.placed, aId, stashed.lists);
    expect(problems.find((p) => p.id === aId)?.lists.stash).toHaveLength(1);
    expect(problems.find((p) => p.id === bId)?.lists.stash).toHaveLength(0);

    const listsB = problems.find((p) => p.id === bId)!.lists;
    expect(listsB.stash).toHaveLength(0);
    expect(listsB.submitted).toHaveLength(0);

    const beforeCount = problems.length;
    problems = markTapSoloProblemSubmitted(problems, aId);
    expect(problems.find((p) => p.id === aId)?.solutionSubmitted).toBe(true);
    expect(problems.find((p) => p.id === aId)?.done).toBe(true);
    expect(problems.find((p) => p.id === bId)?.solutionSubmitted).toBe(false);
    expect(problems).toHaveLength(beforeCount);

    writeScratch(
      "tap-solo-seed.txt",
      [
        `placed=${seeded.placed.length}`,
        `pool=${seeded.pool.length}`,
        `aStash=${problems.find((p) => p.id === aId)?.lists.stash.length}`,
        `bStash=${problems.find((p) => p.id === bId)?.lists.stash.length}`,
        `submittedA=${problems.find((p) => p.id === aId)?.solutionSubmitted}`,
        `tilesRemain=${problems.length}`,
      ].join("\n"),
    );
  });
});

describe("TAP live map wiring", () => {
  it("dialog + solo maps hide coordinates, skip load-other, and fix dual-list height", () => {
    const tap = readTapScoreSurface();
    expect(tap).toContain("TapSessionMap");
    expect(tap).toContain("TapTurnOverlay");
    expect(tap).toContain("tapConvoBlocksFromAssistantTurns");
    expect(tap).toContain("createMapFogLookup");
    expect(tap).not.toContain("<DialogueSplit");
    expect(tap).not.toContain("formatGridCoordinate");
    expect(tap).not.toContain("Load other problems");
    expect(tap).not.toContain("data-tap-load-other-problems");
    expect(tap).toContain("data-map-fog-veil");
    expect(tap).toContain('data-tap-session-map-origin="0,0"');
    expect(tap).toContain("data-tap-convo-live-split");
    expect(tap).toContain("lg:grid-cols-2");
    expect(tap).toContain('kind="convo-stash"');
    expect(tap).not.toContain("ExerciseStashHistory");
    expect(tap).toContain("stashedThoughts");
    expect(tap).not.toContain("<ActiveThoughtSlots");
    expect(tap).toContain("ThoughtMemoryPanel");
    expect(tap).not.toContain("Submit last Thought");
    expect(tap).toContain("ImDoneAnsweringControl");
    expect(tap).toContain("See Older Thoughts");

    const map = read("components/tap-score/tap-session-map.tsx");
    expect(map).toContain("learnerMapCellChromeClasses");
    expect(map).toContain("tapSessionMapCenterOnOrigin");
    expect(map).toContain("data-tap-session-block-dimmed");
    expect(map).toContain("opacity-25");
    expect(map).toContain("Boolean(block.done)");
    expect(map).not.toContain('status: block.done ? "completed"');
    expect(map).not.toContain("formatGridCoordinate");
    expect(tap).toContain("currentId={convoBlocks[convoBlocks.length - 1]?.id");

    const overlay = read("components/tap-score/tap-turn-overlay.tsx");
    expect(overlay).not.toContain("data-tap-submit-solution");
    expect(overlay).not.toContain("Submit solution");
    expect(overlay).not.toContain("Load other problems");
    expect(overlay).not.toContain("data-tap-load-other-problems");

    const client = readExerciseTapSurface();
    expect(client).toContain("seedTapSoloProblems");
    expect(client).toContain("onSelectSoloProblem");
    expect(client).toContain("onSubmitSoloSolution");
    expect(client).toContain("logEndOfChainOfThought");
    expect(client).toContain("onSubmitSoloSolution()");
    expect(client).not.toContain("onLoadOtherProblems");
    expect(client).not.toContain("Load other problems");
    expect(client).toContain("data-exercise-tap-stash-submit");
    expect(client).toContain("data-exercise-tap-live-split");
    expect(client).toContain("data-exercise-tap-map-pane");
    expect(client).toContain("lg:grid-cols-2");
    expect(client).toContain('kind="solo-stacks"');
    expect(client).not.toContain("max-h-[11rem]");
    expect(client).toContain("overflow-hidden");
    expect(client).toContain("overflow-y-auto");

    const shell = read("components/exercise-tap/ExerciseTapShell.tsx");
    expect(shell).toContain("TapSessionMap");
    expect(shell).toContain('kind="solo"');
    expect(shell).toContain("TapAestheticSection");
    expect(shell).toContain('kind="solo-stacks"');
    expect(shell).not.toContain("h-80");
    expect(shell).not.toContain("compact");

    writeScratch(
      "tap-map-chrome.txt",
      [
        "no formatGridCoordinate on TAP map",
        "no Load other problems",
        "solo live 50/50 map | Stash Submit UI aesthetic",
        "fog veil on empty cells",
      ].join("\n"),
    );
  });
});

describe("knowledge landing Drill labels", () => {
  it("visitor-facing Drill products are Drill with AI and Drill Solo Exercises", () => {
    const client = read("components/MapOfKnowledgeClient.tsx");
    expect(client).toContain('label: "Drill with AI"');
    expect(client).toContain('label: "Drill Solo Exercises"');
    expect(client).toContain("Drill with AI");
    expect(client).toContain("Drill Solo Exercises");
    const exploreCard = client.slice(
      client.indexOf("data-mint-timed-explore-card"),
      client.indexOf("data-mint-timed-drill-card"),
    );
    const drillCard = client.slice(
      client.indexOf("data-mint-timed-drill-card"),
      client.indexOf("data-minted-link-card"),
    );
    expect(exploreCard).not.toMatch(/\bDialog\b/);
    expect(drillCard).not.toMatch(/\bDialog\b/);

    writeScratch(
      "knowledge-drill-labels.txt",
      [
        "Drill with AI",
        "Drill Solo Exercises",
        `exploreCardHasDialog=${/\bDialog\b/.test(exploreCard)}`,
        `drillCardHasDialog=${/\bDialog\b/.test(drillCard)}`,
      ].join("\n"),
    );
  });
});
