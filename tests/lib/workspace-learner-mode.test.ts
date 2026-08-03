import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  availableSectionsForMode,
  blockParticipatesInDag,
  buildLearnerDagView,
  mountsCreatorAuthoringDrawers,
  mountsLearnerPracticeDrawer,
  resolveActiveSectionForMode,
  resolveWorkspaceModeShell,
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

const SCRATCH =
  process.env.GROK_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1fc58fd2694a/implementer";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("workspace mode pure resolvers", () => {
  it("Learner sections: workspace + knowledge when logged in", () => {
    expect(
      availableSectionsForMode({ mode: "learner", isLoggedIn: true }),
    ).toEqual(["workspace", "knowledge"]);
    expect(
      availableSectionsForMode({ mode: "learner", isLoggedIn: false }),
    ).toEqual(["workspace"]);
  });

  it("Creator keeps full owner sections", () => {
    const owner = availableSectionsForMode({
      mode: "creator",
      isOwner: true,
    });
    expect(owner).toContain("workspace");
    expect(owner).toContain("context");
    expect(owner).toContain("simulation");
    expect(owner).toContain("knowledge");
    expect(owner).toContain("settings");
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
    ).toBe("knowledge");
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
    expect(recommendLearnerDone({ powCount: 0 }).recommendation).toBe("not_ok");
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
    expect(done).toMatch(/emerald/);

    const creator = resolveOccupiedMapChrome({
      learnerMode: false,
      status: "completed",
      selected: false,
    });
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

describe("learner mode UI structural", () => {
  it("toggle near title; learner drawer vs creator drawers; map flags", () => {
    const nav = read("components/WorkspaceSectionNav.tsx");
    const view = read("components/WorkspaceView.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    const perf = read("components/WorkspacePerformancePanel.tsx");
    const mapGround = read("app/api/workspace/map-ground/route.ts");

    expect(nav).toContain("data-workspace-mode-toggle");
    expect(nav).toContain("data-workspace-mode={m.id}");
    expect(nav).toContain('id: "creator"');
    expect(nav).toContain('id: "learner"');
    expect(view).toContain("WorkspaceLearnerBlockPane");
    expect(view).toContain("selectInteractionMode");
    // Mode flip clears sole / multi / empty selection (both directions)
    expect(view).toMatch(
      /selectInteractionMode[\s\S]*?clearWorkspaceBlockSelection\(\)/,
    );
    expect(view).toMatch(
      /selectInteractionMode[\s\S]*?clearWorkspaceFilledBlockSelection\(\)/,
    );
    expect(view).toMatch(
      /selectInteractionMode[\s\S]*?clearWorkspaceAddTarget\(\)/,
    );
    expect(view).toContain("if (next === interactionMode) return");
    expect(view).toContain("showLearnerDrawer");
    expect(view).toContain("showCreatorDrawers");
    // Map chrome also drops local selectedBlockIds when learnerMode flips
    expect(grid).toContain("learnerModeRef");
    expect(grid).toMatch(
      /learnerModeRef\.current === learnerMode[\s\S]*?setSelectedBlockIds\(\[\]\)/,
    );
    // Creator detail must hide Explore/Drill (Learner-only pane).
    expect(view).toContain("hidePracticeLaunch");
    expect(view).toMatch(
      /showLearnerDrawer[\s\S]*WorkspaceLearnerBlockPane/,
    );
    // Learner pane mounts only when showLearnerDrawer (not in creator branch)
    expect(view).toMatch(
      /showCreatorDrawers[\s\S]*WorkspaceBlockDetailPane/,
    );
    // Real PoW stats path + parser (user-scoped, all quality — not practice-only)
    expect(view).toContain("parseLearnerPowSummaryFromApi");
    expect(view).toContain('subjectKey: "me"');
    expect(view).toContain('quality: "all"');
    expect(view).toContain("proof-of-work-stats");
    expect(view).toContain("blockId");
    expect(view).not.toContain('quality: "practice"');
    // Real Explore / Drill entry points via product intent
    expect(view).toContain("onLaunchIntent");
    expect(view).toContain("createSession");
    expect(view).toContain("/session?id=");
    expect(view).toContain("/workspace/${workspaceId}/tap?");
    expect(view).toContain('params.set("interactionKind", "exercise")');
    expect(view).toContain("onSavePlanningPrompt");
    // Done awaits set_block_status + snapshot-all with onPhase
    expect(view).toContain("set_block_status");
    expect(view).toContain("snapshot-all");
    expect(view).toContain("onPhase");
    expect(view).toContain("lwmEmbeddingsOnly={modeShell.knowledgeLwmEmbeddingsOnly}");
    expect(grid).toContain("learnerMode");
    expect(grid).toContain("data-learner-mode");
    expect(grid).toContain("data-empty-cell-plus");
    expect(grid).toContain("data-map-minimap");
    // Practice drawer: BlockDetailCard launch UI
    expect(learner).toContain("BlockDetailCard");
    expect(learner).toContain('drawerId="practice"');
    expect(learner).toContain("data-learner-explore-drill");
    expect(learner).toContain("data-learner-launch-card");
    expect(learner).toContain("data-learner-planning-prompt");
    expect(learner).toContain("data-customize-session");
    expect(learner).toContain("allowTimed");
    expect(learner).toContain("onLaunchIntent");
    // Progress drawer: PoW summary + Mark as Done
    expect(learner).toContain('drawerId="progress"');
    expect(learner).toContain('title="Progress"');
    expect(learner).toContain("data-learner-progress-pane");
    // Dependencies drawer + mini canvas (local DAG)
    expect(learner).toContain('drawerId="dependencies"');
    expect(learner).toContain("data-learner-dag-drawer");
    expect(learner).toContain("MultiBlockDagCanvas");
    expect(learner).toContain("readOnly");
    expect(grid).toContain("data-learner-locked-label");
    expect(grid).toContain("data-learner-locked-icon");
    expect(grid).toContain("data-learner-dep-highlight");
    expect(learner).toContain("data-learner-pow-summary-stats");
    expect(learner).toContain("data-learner-mark-done");
    expect(learner).toContain("data-learner-done-panel");
    expect(learner).toContain("data-learner-dag");
    expect(learner).toContain("onPhase");
    // Creator drawer not in learner pane
    expect(learner).not.toContain("WorkspaceBlockDetailPane");
    // Knowledge LWM+embeddings only
    expect(perf).toContain("lwmEmbeddingsOnly");
    expect(perf).toContain("data-knowledge-lwm-embeddings-only");
    expect(perf).toContain("LEARNER_KNOWLEDGE_SUBVIEWS");
    expect(mapGround).toContain("set_block_status");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "workspace-learner-mode.log"),
      [
        "workspace-learner-mode",
        "learner_sections=" +
          availableSectionsForMode({ mode: "learner", isLoggedIn: true }).join(","),
        "map_no_plus=" +
          String(
            !resolveWorkspaceModeShell({ mode: "learner" }).map.showEmptyPlus,
          ),
        "map_no_strip=" +
          String(
            !resolveWorkspaceModeShell({ mode: "learner" }).map
              .showAuthoringToolStrip,
          ),
        "pow_parse=" +
          parseLearnerPowSummaryFromApi({
            stats: {
              practice_artifacts: 40,
              total_artifacts: 100,
              by_type: [{ type: "thought", count: 7 }],
              filters: { subject_key: "me", quality: "all" },
            },
          }).powCount,
        "done_ok=" +
          recommendLearnerDone({ powCount: 1, latestScore: 80 }).recommendation,
      ].join("\n") + "\n",
    );
    writeFileSync(
      join(SCRATCH, "workspace-learner-mode-ui.log"),
      [
        "workspace-learner-mode-ui",
        "toggle=" + nav.includes("data-workspace-mode-toggle"),
        "learner_pane=" + view.includes("WorkspaceLearnerBlockPane"),
        "learner_launch_card=" + learner.includes("data-learner-launch-card"),
        "learner_timebox=" + learner.includes("allowTimed"),
        "learner_custom_prompt=" + learner.includes("data-learner-planning-prompt"),
        "real_session=" + view.includes("createSession"),
        "real_tap=" + view.includes("/tap?"),
        "launch_intent=" + view.includes("onLaunchIntent"),
        "pow_parser=" + view.includes("parseLearnerPowSummaryFromApi"),
        "subject_me=" + view.includes('subjectKey: "me"'),
        "quality_all=" + view.includes('quality: "all"'),
        "not_practice_only=" + String(!view.includes('quality: "practice"')),
        "lwm_only=" + view.includes("lwmEmbeddingsOnly={modeShell.knowledgeLwmEmbeddingsOnly}"),
        "await_status=" + view.includes("set_block_status"),
        "await_snapshot=" + view.includes("snapshot-all"),
        "onPhase=" + view.includes("onPhase"),
        "grid_learner=" + grid.includes("data-learner-mode"),
        "creator_gated=" + view.includes("showCreatorDrawers"),
      ].join("\n") + "\n",
    );
  });
});
