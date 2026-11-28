import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readKnowledgePanelSurface, readMapGridSurface, readWorkspaceViewSurface } from "../helpers/surface-source";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  availableSectionsForMode,
  blockParticipatesInDag,
  buildLearnerDagView,
  mountsCreatorAuthoringDrawers,
  mountsLearnerPracticeDrawer,
  resolveActiveSectionForMode,
  resolveFixedWorkspaceInteractionMode,
  resolveWorkspaceModeShell,
  DEFAULT_WORKSPACE_INTERACTION_MODE,
  defaultInteractionModeForWorkspace,
  normalizeWorkspaceInteractionMode,
} from "@/lib/workspace-mode";
import {
  blocksUnlockedAfterDone,
  learnerDoneProgressForPhase,
  learnerDoneStatusValue,
  parseLearnerPowSummaryFromApi,
  recommendLearnerDone,
} from "@/lib/workspace-learner-done";
import {
  learnerMapCellChromeClasses,
  learnerMapFreeformColors,
  resolveOccupiedMapChrome,
} from "@/lib/workspace-learner-chrome";
import { tmpdir } from "node:os";

const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-672c722c3036/implementer");

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("workspace mode pure resolvers", () => {
  it("Play mode is the map only; Build is the designer shell", () => {
    expect(
      availableSectionsForMode({ mode: "learner", isLoggedIn: true }),
    ).toEqual(["workspace"]);
    expect(
      availableSectionsForMode({ mode: "learner", isLoggedIn: false }),
    ).toEqual(["workspace"]);
    expect(
      availableSectionsForMode({ mode: "creator", isOwner: true, isLoggedIn: true }),
    ).toEqual(["workspace", "dags", "map_types", "unsys_models", "context", "settings"]);
  });

  it("Creator keeps the learning designer sections", () => {
    const owner = availableSectionsForMode({
      mode: "creator",
      isOwner: true,
    });
    expect(owner).toEqual(["workspace", "dags", "map_types", "unsys_models", "context", "settings"]);
    expect(owner).not.toContain("simulation");
    expect(owner).not.toContain("knowledge");
    expect(owner).not.toContain("goals");
    expect(
      availableSectionsForMode({
        mode: "creator",
        isOwner: true,
        workspaceKind: "knowledge_region",
      }),
    ).toEqual(["workspace", "dags", "map_types", "unsys_models", "context", "settings"]);
    expect(
      availableSectionsForMode({
        mode: "creator",
        isOwner: true,
        workspaceKind: "calibration",
      }),
    ).toEqual(["workspace", "dags", "map_types", "unsys_models", "context", "settings"]);
  });

  it("Learner map chrome: no +, no strip, no multi, minimap on", () => {
    const shell = resolveWorkspaceModeShell({
      mode: "learner",
      isLoggedIn: true,
    });
    expect(shell.map.showEmptyPlus).toBe(false);
    expect(shell.map.showAuthoringToolStrip).toBe(false);
    expect(shell.map.allowMultiSelect).toBe(false);
    expect(shell.map.showMinimap).toBe(true);
    expect(shell.map.allowBlockManipulation).toBe(false);
    expect(shell.soleBlockPane).toBe("learner_practice");
    expect(shell.knowledgeLwmEmbeddingsOnly).toBe(true);
    expect(mountsLearnerPracticeDrawer("learner")).toBe(true);
    expect(mountsCreatorAuthoringDrawers("learner")).toBe(false);
    expect(mountsCreatorAuthoringDrawers("creator")).toBe(true);
    expect(mountsLearnerPracticeDrawer("creator")).toBe(false);
  });

  it("resolveActiveSectionForMode drops settings in learner", () => {
    expect(
      resolveActiveSectionForMode({
        mode: "learner",
        requested: "settings",
        isLoggedIn: true,
      }),
    ).toBe("workspace");
    expect(
      resolveActiveSectionForMode({
        mode: "learner",
        requested: "knowledge",
        isLoggedIn: true,
      }),
    ).toBe("workspace");
  });

});

describe("learner Done + unlock", () => {
  it("parseLearnerPowSummaryFromApi uses post-filter by_type (user-scoped), not sample practice_artifacts", () => {
    // Realistic subjectKey=me response: sample-wide quality tallies are high,
    // but by_type is the filtered (current user) breakdown.
    const userScoped = parseLearnerPowSummaryFromApi({
      stats: {
        total_artifacts: 100,
        practice_artifacts: 40,
        scored_artifacts: 50,
        by_type: [
          { type: "thought", count: 2 },
          { type: "audio", count: 1 },
          { type: "file", count: 0 },
        ],
        filters: { quality: "all", subject_key: "me" },
      },
    });
    // 2+1 = 3 user artifacts — NOT 40 practice or 100 total
    expect(userScoped.powCount).toBe(3);

    // practice_artifacts=0 must NOT zero out scored user PoW when by_type has counts
    const scoredOnlyUser = parseLearnerPowSummaryFromApi({
      stats: {
        total_artifacts: 20,
        practice_artifacts: 0,
        scored_artifacts: 15,
        by_type: [{ type: "thought", count: 4 }],
        filters: { quality: "all", subject_key: "me" },
      },
    });
    expect(scoredOnlyUser.powCount).toBe(4);

    // User has zero PoW: by_type all zero → 0 (do not use workspace totals)
    expect(
      parseLearnerPowSummaryFromApi({
        stats: {
          total_artifacts: 50,
          practice_artifacts: 10,
          by_type: [{ type: "thought", count: 0 }],
          filters: { quality: "all", subject_key: "me" },
        },
      }).powCount,
    ).toBe(0);

    // subject me without by_type: never fall back to sample totals
    expect(
      parseLearnerPowSummaryFromApi({
        stats: {
          total_artifacts: 99,
          practice_artifacts: 50,
          filters: { subject_key: "me", quality: "all" },
        },
      }).powCount,
    ).toBe(0);

    expect(parseLearnerPowSummaryFromApi({}).powCount).toBe(0);
    expect(parseLearnerPowSummaryFromApi(null).powCount).toBe(0);
  });

  it("recommendLearnerDone from PoW summary", () => {
    expect(recommendLearnerDone(null).recommendation).toBe("unknown");
    const empty = recommendLearnerDone({ powCount: 0 });
    expect(empty.recommendation).toBe("not_ok");
    // Advisory only — copy must not imply Done is blocked
    expect(empty.rationale).toMatch(/Mark as Done|still/i);
    expect(recommendLearnerDone({ powCount: 2, latestScore: 70 }).recommendation).toBe(
      "ok",
    );
    expect(recommendLearnerDone({ powCount: 3, latestScore: 20 }).recommendation).toBe(
      "not_ok",
    );
  });

  it("mark-done unlocks dependents; progress phases advance", () => {
    expect(learnerDoneStatusValue()).toBe("completed");
    const blocks = [
      { id: "a", title: "A", status: "available", lock_until_block_ids: [] },
      { id: "b", title: "B", status: "available", lock_until_block_ids: ["a"] },
    ];
    const { unlockedIds, nextBlocks } = blocksUnlockedAfterDone({
      completedBlockId: "a",
      blocks,
    });
    expect(nextBlocks.find((b) => b.id === "a")!.status).toBe("completed");
    expect(unlockedIds).toContain("b");

    const p = learnerDoneProgressForPhase("snapshot_lwm");
    expect(p.percent).toBeGreaterThan(50);
    expect(p.phase).toBe("snapshot_lwm");
  });
});

describe("learner map chrome + DAG view", () => {
  it("learner freeform colors mark selected vs default white", () => {
    const def = learnerMapFreeformColors(false);
    const sel = learnerMapFreeformColors(true);
    expect(def.fill).toMatch(/255/);
    expect(sel.border).not.toBe(def.border);
  });

  it("learner tiles are white by default; only Done uses a distinct color", () => {
    const available = learnerMapCellChromeClasses({
      status: "available",
      selected: false,
    });
    expect(available).toMatch(/white/);
    expect(available).not.toMatch(/emerald|amber|sky-/);

    const start = learnerMapCellChromeClasses({
      status: "available",
      selected: false,
      isStart: true,
    });
    // Starter is still white-themed (flag badge carries starter, not tile tint)
    expect(start).toMatch(/white/);
    expect(start).not.toMatch(/amber|sky-/);

    const done = learnerMapCellChromeClasses({
      status: "completed",
      selected: false,
    });
    expect(done).toMatch(/bg-white/);
    expect(done).toMatch(/border-white/);
    expect(done).not.toMatch(/emerald/);

    const creator = resolveOccupiedMapChrome({
      learnerMode: false,
      status: "completed",
      selected: false,
    });
    expect(creator).toMatch(/bg-white/);
    expect(creator).not.toMatch(/emerald/);
  });

  it("DAG participates when prereqs or unlocks exist", () => {
    const blocks = [
      {
        id: "a",
        title: "A",
        status: "completed",
        lock_until_block_ids: [],
        next_block_ids: ["b"],
      },
      {
        id: "b",
        title: "B",
        status: "available",
        lock_until_block_ids: ["a"],
        next_block_ids: [],
      },
    ];
    expect(
      blockParticipatesInDag({
        blockId: "b",
        lockUntilIds: ["a"],
        peers: blocks,
      }),
    ).toBe(true);
    const view = buildLearnerDagView({ blockId: "b", blocks });
    expect(view.participates).toBe(true);
    expect(view.prerequisites.some((p) => p.id === "a")).toBe(true);
    const viewA = buildLearnerDagView({ blockId: "a", blocks });
    expect(viewA.unlocks.some((u) => u.id === "b")).toBe(true);
  });
});
