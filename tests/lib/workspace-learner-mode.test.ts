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

const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-672c722c3036/implementer";

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
    ).toEqual(["workspace", "dags", "map_types", "context", "settings"]);
  });

  it("Creator keeps the learning designer sections", () => {
    const owner = availableSectionsForMode({
      mode: "creator",
      isOwner: true,
    });
    expect(owner).toEqual(["workspace", "dags", "map_types", "context", "settings"]);
    expect(owner).not.toContain("simulation");
    expect(owner).not.toContain("knowledge");
    expect(owner).not.toContain("goals");
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

  it("Play mode does not open Knowledge", () => {
    expect(
      resolveActiveSectionForMode({
        mode: "learner",
        requested: "knowledge",
        isOwner: false,
        isOrgAdmin: false,
        isLoggedIn: true,
      }),
    ).toBe("workspace");
    expect(
      availableSectionsForMode({
        mode: "learner",
        isOwner: false,
        isLoggedIn: true,
      }),
    ).toEqual(["workspace"]);

    const view = readWorkspaceViewSurface();
    expect(view).toContain("workspaceShell(");
    expect(view).not.toContain("resolveActiveSectionForMode");
    expect(view).toMatch(
      /selectSection[\s\S]{0,500}shell\.sections\.includes\(section\)/,
    );
    // AYCL token counts as signed-in for Learner Knowledge tab visibility
    expect(view).toMatch(
      /isLoggedIn:\s*Boolean\(currentUserId\)\s*\|\|\s*Boolean\(ayclToken\)/,
    );
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
    expect(empty.rationale).toMatch(/Mark Done anyway|still/i);
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

describe("fixed interaction mode", () => {
  it("keeps creator and learner wire ids and does not offer a mode choice", () => {
    const modeLib = read("lib/workspace-mode.ts");
    expect(modeLib).not.toContain("workspaceModeDisplayLabel");
    expect(modeLib).not.toContain("WORKSPACE_MODE_DISPLAY_LABELS");
    expect(modeLib).not.toContain("workspaceModeControlMounted");
    expect(DEFAULT_WORKSPACE_INTERACTION_MODE).toBe("learner");
    expect(normalizeWorkspaceInteractionMode(undefined)).toBe("learner");
    expect(normalizeWorkspaceInteractionMode("nope")).toBe("learner");
    expect(resolveFixedWorkspaceInteractionMode({})).toBe("learner");
    expect(
      resolveFixedWorkspaceInteractionMode({ workspaceKind: "knowledge_region" }),
    ).toBe("creator");

    // Wire ids still drive authoring vs practice shell (labels only changed)
    expect(mountsCreatorAuthoringDrawers("creator")).toBe(true);
    expect(mountsLearnerPracticeDrawer("creator")).toBe(false);
    expect(mountsCreatorAuthoringDrawers("learner")).toBe(false);
    expect(mountsLearnerPracticeDrawer("learner")).toBe(true);
    const creatorShell = resolveWorkspaceModeShell({
      mode: "creator",
      isOwner: true,
    });
    const learnerShell = resolveWorkspaceModeShell({
      mode: "learner",
      isLoggedIn: true,
    });
    expect(creatorShell.map.showAuthoringToolStrip).toBe(true);
    expect(creatorShell.soleBlockPane).toBe("creator_default");
    expect(learnerShell.map.showAuthoringToolStrip).toBe(false);
    expect(learnerShell.soleBlockPane).toBe("learner_practice");

    const grid = readMapGridSurface();
    const view = readWorkspaceViewSurface();
    const nav = read("components/WorkspaceSectionNav.tsx");
    expect(nav).not.toContain("data-workspace-mode-toggle");
    expect(nav).not.toContain("data-workspace-mode-by-title");
    expect(nav).not.toContain("workspaceModeDisplayLabel");
    expect(nav).not.toContain("workspaceModeControlMounted");
    expect(nav).not.toContain("data-workspace-interaction-mode");
    expect(nav).toContain("data-workspace-section-title");
    expect(grid).not.toContain("data-workspace-mode-under-minimap");
    expect(view).not.toContain("onMapToggle={");
    expect(view).not.toContain("onInteractionModeChange");
    expect(view).not.toContain("resolveFixedWorkspaceInteractionMode");
    expect(view).toContain("workspaceShell(");
    expect(defaultInteractionModeForWorkspace("standard")).toBe("learner");
    expect(defaultInteractionModeForWorkspace(undefined)).toBe(
      DEFAULT_WORKSPACE_INTERACTION_MODE,
    );
    // Toggle must not hardcode Creator/Learner button text
    expect(grid).not.toMatch(/label:\s*"Creator"/);
    expect(grid).not.toMatch(/label:\s*"Learner"/);
    expect(grid).not.toMatch(/>\s*Creator\s*</);
    expect(grid).not.toMatch(/>\s*Learner\s*</);
    expect(modeLib).not.toContain('creator: "Build"');
    expect(modeLib).not.toContain('learner: "Play"');
    expect(modeLib).toContain('"creator"');
    expect(modeLib).toContain('"learner"');

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "build-play-mode-behavior.log"),
      [
        "fixed_learner=" + resolveFixedWorkspaceInteractionMode({}),
        "creator_authoring_drawers=" +
          mountsCreatorAuthoringDrawers("creator"),
        "learner_practice_drawer=" + mountsLearnerPracticeDrawer("learner"),
        "creator_strip=" + creatorShell.map.showAuthoringToolStrip,
        "learner_strip=" + learnerShell.map.showAuthoringToolStrip,
        "interaction_mode_attr=" + nav.includes("data-workspace-interaction-mode"),
      ].join("\n"),
      "utf8",
    );
  });
});

describe("learner mode UI structural", () => {
  it("learner drawer vs creator drawers; map flags; no mode toggle", () => {
    const nav = read("components/WorkspaceSectionNav.tsx");
    const view = readWorkspaceViewSurface();
    const grid = readMapGridSurface();
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    const perf = read("components/WorkspacePerformancePanel.tsx");
    const mapGround = read("app/api/workspace/map-ground/route.ts");

    expect(nav).not.toContain("data-workspace-mode-toggle");
    expect(nav).not.toContain("data-workspace-mode-by-title");
    expect(nav).not.toContain("data-workspace-interaction-mode");
    expect(view).not.toContain("onMapToggle={");
    expect(grid).not.toContain("data-workspace-mode-under-minimap");
    expect(view).not.toContain("selectInteractionMode");
    expect(grid).not.toMatch(/label:\s*"Creator"/);
    expect(grid).not.toMatch(/label:\s*"Learner"/);
    expect(view).toContain("WorkspaceLearnerBlockPane");
    expect(view).not.toContain("resolveFixedWorkspaceInteractionMode");
    expect(view).toContain("workspaceShell(");
    expect(view).not.toContain("clearMapChromeForModeFlip");
    const selection = read("components/workspace-view/use-workspace-map-selection.ts");
    expect(selection).not.toContain("workspaceModeFlipClearsMapSelection");
    expect(view).not.toContain("if (next === interactionMode) return");
    expect(view).toContain("showLearnerDrawer");
    expect(view).toContain("showCreatorDrawers");
    expect(grid).toContain("learnerModeRef");
    expect(grid).not.toContain("workspaceModeFlipClearsMapSelection");
    expect(grid).not.toMatch(
      /if \(workspaceModeFlipClearsMapSelection\(\)\) \{[\s\S]*?setSelectedBlockIds\(\[\]\)/,
    );
    // Practice Explore/Drill live on learner drawer; authoring on creator drawers.
    // (SessionItem still supports hidePracticeLaunch; map shell uses mode panes.)
    expect(view).toMatch(
      /showLearnerDrawer[\s\S]*WorkspaceLearnerBlockPane/,
    );
    // Learner pane mounts only when showLearnerDrawer (not in creator branch)
    expect(view).toMatch(
      /showCreatorDrawers[\s\S]*WorkspaceBlockDetailPane/,
    );
    expect(view).not.toContain("mountsCreatorAuthoringDrawers");
    expect(view).not.toContain("mountsLearnerPracticeDrawer");
    // Real PoW stats path + parser (user-scoped, all quality — not practice-only)
    expect(view).toContain("parseLearnerPowSummaryFromApi");
    expect(view).toContain('subjectKey: "me"');
    expect(view).toContain('quality: "all"');
    expect(view).toContain("proof-of-work-stats");
    expect(view).toContain("blockId");
    expect(view).not.toContain('quality: "practice"');
    // Real Explore / Drill entry points via product intent
    expect(view).toContain("onLaunchIntent");
    expect(view).toContain("WORKSPACE_LEARNER_LAUNCH_PATH");
    expect(view).toContain("/session?id=");
    expect(view).toContain("/workspace/${workspaceId}/tap?");
    expect(view).toContain('params.set("interactionKind", "exercise")');
    expect(view).toContain("onSavePlanningPrompt");
    // Done: set_block_status, then Generator/Dynamic effects, then soft snapshot
    expect(view).toContain("set_block_status");
    expect(view).toContain("generatorTargetCellsAfterDone");
    expect(view).toContain("runBlockEffectGenerate");
    expect(view).toContain("snapshot-all");
    expect(view).toContain("onPhase");
    // Effects must not wait on snapshot-all (order: applying_unlocks before snapshot)
    const markDoneStart = view.indexOf("onMarkDone={async");
    const applyingIdx = view.indexOf('report("applying_unlocks")', markDoneStart);
    const snapIdx = view.indexOf('report("snapshot_lwm")', markDoneStart);
    expect(markDoneStart).toBeGreaterThan(-1);
    expect(applyingIdx).toBeGreaterThan(markDoneStart);
    expect(snapIdx).toBeGreaterThan(applyingIdx);
    expect(view).toContain("lwmEmbeddingsOnly={knowledgeLwmEmbeddingsOnly}");
    expect(grid).toContain("learnerMode");
    expect(grid).toContain("data-learner-mode");
    expect(grid).toContain("data-empty-cell-plus");
    expect(grid).toContain("data-map-minimap");
    expect(read("components/WorkspaceSectionNav.tsx")).not.toContain(
      "data-workspace-mode-toggle",
    );
    expect(read("components/WorkspaceSectionNav.tsx")).not.toContain(
      "data-workspace-interaction-mode",
    );
    // Empty learner maps keep the same grid shell (minimap, no mode toggle).
    expect(grid).not.toContain("nodes.length === 0 && !canEdit");
    expect(grid).not.toMatch(
      /if \(nodes\.length === 0 && !canEdit\)[\s\S]{0,80}labels\.emptyCell/,
    );
    // Work drawer: BlockDetailCard launch UI
    expect(learner).toContain("BlockDetailCard");
    expect(learner).toContain('drawerId="practice"');
    expect(learner).toContain("LEARNER_WORK_DRAWER_TITLE");
    expect(learner).toContain("GENERATE_INSIGHTS_ACTION_LABEL");
    expect(learner).toContain("data-generate-insights-drawer");
    expect(learner).toContain("data-generate-insights-prompt");
    expect(learner).toContain("data-generate-insights-action");
    expect(learner).not.toContain('title="Practice"');
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
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    expect(grid + badges).not.toContain("data-learner-locked-label");
    expect(grid + badges).toContain("data-learner-locked-icon");
    expect(grid + badges).toContain("data-learner-dep-highlight");
    expect(learner).toContain("data-learner-pow-summary-stats");
    expect(learner).toContain("data-learner-mark-done");
    expect(learner).toContain("Mark Done anyway");
    // Force mark done is not gated on map lock or PoW Not OK
    expect(learner).toContain("disabled={busy || !onMarkDone || isCompleted}");
    expect(learner).not.toContain("disabled={busy || locked || !onMarkDone || isCompleted}");
    expect(learner).toContain("data-learner-done-panel");
    expect(learner).toContain("data-learner-dag");
    expect(learner).toContain("onPhase");
    // Creator drawer not in learner pane
    expect(learner).not.toContain("WorkspaceBlockDetailPane");
    // Knowledge LWM+embeddings only; subject locked to self (no multi-user inspect)
    expect(perf).toContain("lwmEmbeddingsOnly");
    expect(perf).toContain("data-knowledge-lwm-embeddings-only");
    expect(perf).toContain("LEARNER_KNOWLEDGE_SUBVIEWS");
    expect(perf).toContain("lockSubjectToSelf={lwmEmbeddingsOnly}");
    const knowledgePanel = readKnowledgePanelSurface();
    expect(knowledgePanel).toContain("resolveModelsTabCanInspectOthers");
    expect(knowledgePanel).toContain("lockSubjectToSelf");
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
        "toggle_by_title=" +
          read("components/WorkspaceSectionNav.tsx").includes(
            "data-workspace-mode-by-title",
          ),
        "nav_mode_toggle_off=" + view.includes("showModeToggle={false}"),
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
        "lwm_only=" + view.includes("lwmEmbeddingsOnly={knowledgeLwmEmbeddingsOnly}"),
        "await_status=" + view.includes("set_block_status"),
        "await_snapshot=" + view.includes("snapshot-all"),
        "onPhase=" + view.includes("onPhase"),
        "grid_learner=" + grid.includes("data-learner-mode"),
        "creator_gated=" + view.includes("showCreatorDrawers"),
      ].join("\n") + "\n",
    );
  });
});
