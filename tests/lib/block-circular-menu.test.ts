import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_CIRCULAR_MENU_ACTIONS,
  ILE_EMPTY_CIRCULAR_MENU_ACTIONS,
  ILE_TIM_CIRCULAR_MENU_ACTIONS,
  WORKSPACE_CIRCULAR_MENU_ACTIONS,
  WORKSPACE_CIRCULAR_MENU_DRAWER_IDS,
  blockCircularMenuActions,
  blockCircularMenuDoubleClickIsNoop,
  blockCircularMenuOpensOnEmpty,
  blockCircularMenuOpensOnSelect,
  nextCircularMenuBlockIdOnClick,
  nextCircularMenuEmptyCellOnClick,
  blockCircularMenuProgressFraction,
  blockHasUnseenGatherNotification,
  filterPlannedResourcesByScope,
  gatherJobToBlockProgress,
  ileCircularMenuDisabledActionIds,
  ileWorkOnCompletedRequiresConfirm,
  markGatherResourcesSeen,
  parseGatherSeenBlockIds,
  resolveBlockCircularMenuSurface,
  workspaceCircularMenuDrawerId,
  applyLearnerDrawerRequest,
  nextLearnerDrawerRequest,
  BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX,
  BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX,
  BLOCK_CIRCULAR_MENU_RING_RADIUS_PX,
  BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX,
  circularMenuActionPosition,
} from "@/lib/block-circular-menu";
import { PREVIOUS_SESSIONS_DRAWER_ID } from "@/lib/block-previous-sessions";
import { applyIleChapterUndoDone } from "@/lib/ile-chapter-close-review";
import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function resource(partial: Partial<WorkspaceExternalResource> & { id: string }): WorkspaceExternalResource {
  return {
    workspace_id: "ws",
    title: partial.title || partial.id,
    url: partial.url || "https://example.com",
    resource_type: partial.resource_type ?? "ile_gather",
    description: null,
    source: "link",
    dantes_topic_slug: null,
    meta: partial.meta ?? {},
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("block circular menu catalog", () => {
  it("ILE set is exactly Mark as completed / Edit / Gather resources / see resources; Workspace is Start/Continue/Mark as Done; TAP is empty", () => {
    expect(blockCircularMenuActions("ile").map((a) => a.label)).toEqual([
      "Work",
      "Mark as completed",
      "Edit",
      "Gather resources",
      "See resources",
    ]);
    expect(blockCircularMenuActions("ile").map((a) => a.id)).toEqual(
      ILE_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(blockCircularMenuActions("workspace-learner").map((a) => a.label)).toEqual([
      "Start a new Session",
      "Continue prev Session",
      "Mark as Done",
    ]);
    expect(blockCircularMenuActions("workspace-learner").map((a) => a.id)).toEqual(
      WORKSPACE_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(blockCircularMenuActions("ile", { empty: true }).map((a) => a.id)).toEqual(
      ILE_EMPTY_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(blockCircularMenuActions("ile", { empty: true }).map((a) => a.label)).toEqual([
      "Add chapter",
    ]);
    expect(blockCircularMenuActions("ile", { timUnopened: true }).map((a) => a.id)).toEqual(
      ILE_TIM_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(blockCircularMenuActions("ile", { timUnopened: true }).map((a) => a.label)).toEqual([
      "Accept",
      "Reject",
    ]);
    expect(blockCircularMenuActions("workspace-learner", { timUnopened: true })).toEqual([]);
    expect(blockCircularMenuActions("workspace-learner", { empty: true })).toEqual([]);
    expect(blockCircularMenuActions("none")).toEqual([]);
    expect(resolveBlockCircularMenuSurface({ tap: true, learnerMode: true, suggestMode: "chapter" })).toBe(
      "none",
    );
    expect(resolveBlockCircularMenuSurface({ suggestMode: "chapter" })).toBe("ile");
    expect(resolveBlockCircularMenuSurface({ learnerMode: true })).toBe("workspace-learner");
    expect(resolveBlockCircularMenuSurface({ suggestMode: "block" })).toBe("none");
    expect(ILE_CIRCULAR_MENU_ACTIONS.some((a) => a.id.includes("tap"))).toBe(false);
    expect(WORKSPACE_CIRCULAR_MENU_ACTIONS.some((a) => a.id.includes("tap"))).toBe(false);

    const count = ILE_CIRCULAR_MENU_ACTIONS.length;
    for (let i = 0; i < count; i++) {
      const pos = circularMenuActionPosition(i, count);
      expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(BLOCK_CIRCULAR_MENU_RING_RADIUS_PX, 5);
    }
    expect(BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX).toBeGreaterThanOrEqual(2);
    expect(BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX).toBeGreaterThanOrEqual(36);
    expect(BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX).toBeGreaterThanOrEqual(2);
  });
});

describe("in-block progress, unseen gather dot, resource scope", () => {
  it("running ILE action yields (0,1]; ready-unseen is true, seen or empty is false; chapter/block/missing ids are safe", () => {
    expect(blockCircularMenuProgressFraction(null)).toBe(0);
    expect(blockCircularMenuProgressFraction({ running: false, completed: 2, total: 4 })).toBe(0);
    const started = blockCircularMenuProgressFraction({
      actionId: "gather_resources",
      running: true,
      completed: 0,
      total: 4,
    });
    expect(started).toBeGreaterThan(0);
    expect(started).toBeLessThanOrEqual(1);
    const mid = blockCircularMenuProgressFraction(gatherJobToBlockProgress({
      status: "running",
      completed: 2,
      total: 4,
    }));
    expect(mid).toBe(0.5);
    expect(blockCircularMenuProgressFraction(gatherJobToBlockProgress({
      status: "completed",
      completed: 4,
      total: 4,
    }))).toBe(0);

    expect(blockHasUnseenGatherNotification({ readyCount: 3, seen: false })).toBe(true);
    expect(blockHasUnseenGatherNotification({ readyCount: 3, seen: true })).toBe(false);
    expect(blockHasUnseenGatherNotification({ readyCount: 0, seen: false })).toBe(false);
    expect(blockHasUnseenGatherNotification({})).toBe(false);
    expect(markGatherResourcesSeen(["a"], "b")).toEqual(["a", "b"]);
    expect(markGatherResourcesSeen(["a"], "a")).toEqual(["a"]);
    expect(markGatherResourcesSeen([], "  ")).toEqual([]);
    expect(parseGatherSeenBlockIds('["ch-1","ch-1"]')).toEqual(["ch-1"]);
    expect(parseGatherSeenBlockIds("not-json")).toEqual(["not-json"]);
    expect(parseGatherSeenBlockIds(null)).toEqual([]);

    const rows = [
      resource({ id: "g1", meta: { ile_gather: true, block_id: "b1", chapter_id: "c1" } }),
      resource({ id: "g2", meta: { ile_gather: true, block_id: "b2", chapter_id: "c2" } }),
      resource({ id: "plain", resource_type: "link", meta: {} }),
    ];
    expect(filterPlannedResourcesByScope(rows, { blockId: "b1" }).map((r) => r.id)).toEqual([
      "g1",
      "plain",
    ]);
    expect(filterPlannedResourcesByScope(rows, { chapterId: "c2" }).map((r) => r.id)).toEqual([
      "g2",
      "plain",
    ]);
    expect(filterPlannedResourcesByScope(rows, { blockId: "b1", chapterId: "c1" }).map((r) => r.id)).toEqual([
      "g1",
      "plain",
    ]);
    expect(filterPlannedResourcesByScope(rows, {})).toHaveLength(3);
    expect(filterPlannedResourcesByScope(rows, { blockId: "", chapterId: "  " })).toHaveLength(3);
    expect(filterPlannedResourcesByScope(null, { blockId: "missing" })).toEqual([]);
    expect(filterPlannedResourcesByScope(undefined, { chapterId: "gone" })).toEqual([]);
    expect(() => filterPlannedResourcesByScope(rows, { blockId: undefined, chapterId: undefined })).not.toThrow();
  });
});

describe("circular menu source wiring", () => {
  it("ILE and Workspace render a circular menu; ILE double-click peeks; widget keeps I'm done answering; workspace drawers open", () => {
    const chapter = read("components/ChapterMapPanel.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    const ring = read("components/block-skill-grid/block-circular-menu.tsx");
    const authoring = read("components/block-skill-grid/use-map-authoring.ts");
    const actions = read("components/session-view/ile-chapter-helios-actions.tsx");
    const helios = read("components/SessionHeliosPanel.tsx");
    const view = read("components/SessionView.tsx");
    const sessionList = read("components/SessionList.tsx");
    const learner = read("components/WorkspaceLearnerBlockPane.tsx");
    const wsView = read("components/WorkspaceView.tsx");
    const drawers = read("components/workspace-view/workspace-right-drawers.tsx");
    const preview = read("components/session-view/ile-continue-map-preview.tsx");
    const landing = read("components/AyclLandingClient.tsx");

    expect(ring).toContain("data-block-circular-menu");
    expect(ring).toContain("data-block-circular-menu-ring");
    expect(ring).toContain("work: <Pickaxe");
    expect(ring).toContain("gather_resources: <Binoculars");
    expect(ring).toContain("add_chapter: <Plus");
    expect(ring).toContain("accept_chapter: <Check");
    expect(ring).toContain("reject_chapter: <X");
    expect(ring).toContain("timUnopened");
    expect(chapter).toContain("accept_chapter");
    expect(chapter).toContain("reject_chapter");
    expect(chapter).toContain("onAcceptTimChapter");
    expect(chapter).toContain("onRejectTimChapter");
    expect(view).toContain("handleAcceptTimChapter");
    expect(view).toContain("handleRejectTimChapter");
    expect(ring).not.toContain("work: <MessageSquare");
    expect(ring).not.toContain("gather_resources: <Pickaxe");
    expect(ring).toContain("data-block-circular-menu-action");
    expect(ring).toContain('action.id === "work"');
    expect(ring).toContain("data-block-circular-menu-prominent");
    expect(ring).toContain("outline-offset-[3px]");
    expect(ring).toContain("outline-white/80");
    expect(ring).toContain("data-block-circular-menu-icon");
    expect(ring).toContain("data-block-circular-menu-label");
    expect(ring).toContain("group-hover:hidden");
    expect(ring).toContain("group-hover:inline");
    expect(ring).toContain("cursor-pointer");
    expect(ring).toContain("rounded-full");
    expect(ring).toContain("data-block-circular-progress");
    expect(ring).toContain("data-block-gather-notification");
    expect(world).toContain("BlockCircularMenuRing");
    expect(world).toContain("BlockInTileProgress");
    expect(world).toContain("BlockGatherNotificationDot");
    expect(world).toMatch(/<\/button>\s*\{circularMenuSurface !== "none"/);
    expect(world).toMatch(/<\/button>\s*\{isLabel &&/);
    expect(world).not.toContain("<BlockCircularMenuRing\n                                surface={circularMenuSurface}");
    expect(chapter).toContain('circularMenuSurface="ile"');
    expect(chapter).toContain("onCircularMenuAction");
    expect(chapter).not.toContain("onChapterDoubleClick");
    expect(grid).toContain("blockCircularMenuDoubleClickIsNoop");
    expect(grid).toContain("blockCircularMenuOpensOnSelect");
    expect(grid).toContain("handleBlockDoubleClickGuarded");
    expect(grid).toContain("handleCellSelectWithMenu");
    expect(grid).toContain("nextCircularMenuEmptyCellOnClick");
    expect(grid).toContain("setLocalPendingCell(circularMenuEmptyCell)");
    expect(grid).toContain("handleEmptyCircularMenuAction");
    expect(world).toContain("onEmptyCircularMenuAction");
    expect(world).toContain("empty");
    expect(ring).toContain("data-block-circular-menu-empty");
    expect(authoring).toContain('suggestMode === "chapter"');
    expect(blockCircularMenuOpensOnEmpty("ile")).toBe(true);
    expect(blockCircularMenuOpensOnEmpty("workspace-learner")).toBe(false);
    expect(
      nextCircularMenuEmptyCellOnClick({
        surface: "ile",
        clicked: { row: 2, col: 3 },
        current: null,
      }),
    ).toEqual({ row: 2, col: 3 });
    expect(
      nextCircularMenuEmptyCellOnClick({
        surface: "ile",
        clicked: { row: 2, col: 3 },
        current: { row: 2, col: 3 },
      }),
    ).toBeNull();
    expect(
      nextCircularMenuEmptyCellOnClick({
        surface: "ile",
        clicked: { row: 1, col: 1 },
        current: { row: 2, col: 3 },
      }),
    ).toEqual({ row: 1, col: 1 });
    expect(grid).toContain("blockCircularMenuOpensOnSelect(circularMenuSurface, { exploreOpen: mapExploreOpen })");
    expect(blockCircularMenuOpensOnSelect("workspace-learner", { exploreOpen: true })).toBe(false);
    expect(blockCircularMenuOpensOnSelect("ile", { exploreOpen: true })).toBe(false);
    expect(blockCircularMenuOpensOnSelect("workspace-learner", { exploreOpen: false })).toBe(true);
    expect(
      nextCircularMenuBlockIdOnClick({
        surface: "workspace-learner",
        clickedId: "b-1",
        currentMenuId: null,
        exploreOpen: true,
      }),
    ).toBeNull();
    expect(world).toContain("!mapExploreOpen");
    expect(grid).toContain("nextCircularMenuBlockIdOnClick");
    expect(grid).toContain("clearSelection()");
    expect(nextCircularMenuBlockIdOnClick({
      surface: "ile",
      clickedId: "ch-1",
      currentMenuId: null,
    })).toBe("ch-1");
    expect(nextCircularMenuBlockIdOnClick({
      surface: "ile",
      clickedId: "ch-1",
      currentMenuId: "ch-1",
    })).toBeNull();
    expect(nextCircularMenuBlockIdOnClick({
      surface: "ile",
      clickedId: "ch-2",
      currentMenuId: "ch-1",
    })).toBe("ch-2");
    expect(nextCircularMenuBlockIdOnClick({
      surface: "none",
      clickedId: "ch-1",
      currentMenuId: null,
    })).toBeNull();
    expect(nextCircularMenuBlockIdOnClick({
      surface: "workspace-learner",
      clickedId: "b-1",
      currentMenuId: "b-1",
    })).toBeNull();
    expect(authoring).toContain("handleBlockDoubleClick");

    expect(blockCircularMenuOpensOnSelect("ile")).toBe(true);
    expect(blockCircularMenuOpensOnSelect("workspace-learner")).toBe(true);
    expect(blockCircularMenuOpensOnSelect("none")).toBe(false);
    expect(blockCircularMenuOpensOnSelect(null)).toBe(false);
    expect(blockCircularMenuDoubleClickIsNoop("ile")).toBe(false);
    expect(blockCircularMenuDoubleClickIsNoop("workspace-learner")).toBe(true);
    expect(blockCircularMenuDoubleClickIsNoop("none")).toBe(false);

    expect([...ileCircularMenuDisabledActionIds({ completed: true })]).toEqual([
      "mark_completed",
      "edit",
      "gather_resources",
      "see_resources",
    ]);
    expect(ileCircularMenuDisabledActionIds({ completed: true }).has("work")).toBe(false);
    expect(ileCircularMenuDisabledActionIds({ completed: false }).size).toBe(0);
    expect(ileWorkOnCompletedRequiresConfirm(true)).toBe(true);
    expect(ileWorkOnCompletedRequiresConfirm(false)).toBe(false);
    const undone = applyIleChapterUndoDone(
      [
        { id: "ch-1", status: "completed" },
        { id: "ch-2", status: "pending" },
      ],
      "ch-1",
    );
    expect(undone.changed).toBe(true);
    expect(undone.steps[0].status).toBe("in_progress");
    expect(applyIleChapterUndoDone(undone.steps, "ch-1").changed).toBe(false);

    expect(world).toContain("ileCircularMenuDisabledActionIds");
    expect(world).toContain("disabledIds");
    expect(chapter).toContain("ileWorkOnCompletedRequiresConfirm");
    expect(chapter).toContain("onUndoChapterDone");
    expect(chapter).toContain('testId="ile-undo-chapter-done"');
    expect(view).toContain("handleMarkChapterUndone");
    expect(ring).toContain("disabled={disabled}");

    expect(view).not.toContain("onChapterDoubleClick");
    expect(view).not.toContain("onChapterClick");
    expect(view).toContain("onWorkChapter");
    expect(view).toContain("setHeliosWidgetOpen(true)");
    expect(chapter).toContain('action === "work"');
    expect(chapter).toContain("onWorkChapter");
    expect(view).toContain("await handleLoadChapter(idx)");
    expect(view).toContain("await handleMarkChapterDone({ stepId })");

    expect(actions).toContain("data-ile-chapter-helios-actions");
    expect(actions).toContain("doneAnswering");
    expect(actions).not.toContain('t("chapterMap.edit")');
    expect(actions).not.toContain('t("chapterMap.complete")');
    expect(actions).not.toContain('t("chapterMap.gatherResources")');
    expect(actions).not.toContain("data-ile-gather-resources");
    expect(actions).not.toContain("<Pencil");
    expect(actions).not.toContain("<Pickaxe");
    expect(helios).toContain("ImDoneAnsweringControl");
    expect(helios).toContain("IleChapterHeliosActions");
    expect(helios).toContain("doneAnswering");

    expect(sessionList).toContain('circularMenuSurface={learnerMode ? "workspace-learner" : "none"}');
    expect(wsView).toContain("nextLearnerDrawerRequest");
    expect(learner).toContain("requestedDrawerId");
    expect(drawers).toContain("requestedDrawerId");
    expect(workspaceCircularMenuDrawerId("start_session")).toBe(
      WORKSPACE_CIRCULAR_MENU_DRAWER_IDS.start_session,
    );
    expect(workspaceCircularMenuDrawerId("continue_session")).toBe(PREVIOUS_SESSIONS_DRAWER_ID);
    expect(workspaceCircularMenuDrawerId("mark_done")).toBe("progress");
    expect(applyLearnerDrawerRequest({ defaultOpenId: "practice" })).toBe("practice");
    expect(
      applyLearnerDrawerRequest({
        defaultOpenId: "practice",
        requestedId: "progress",
        requestedNonce: 1,
      }),
    ).toBe("progress");
    expect(
      applyLearnerDrawerRequest({
        defaultOpenId: "practice",
        requestedId: "progress",
        requestedNonce: 2,
      }),
    ).toBe("progress");
    expect(nextLearnerDrawerRequest("mark_done", 9)).toEqual({ id: "progress", nonce: 9 });
    expect(learner).toContain("applyLearnerDrawerRequest");
    expect(learner).toContain("requestedDrawerNonce");
    expect(wsView).toContain("nextLearnerDrawerRequest");
    const drawerStateIdx = wsView.indexOf("const [learnerDrawerRequest, setLearnerDrawerRequest]");
    const loadingReturnIdx = wsView.indexOf("if (loading)");
    expect(drawerStateIdx).toBeGreaterThan(-1);
    expect(loadingReturnIdx).toBeGreaterThan(drawerStateIdx);
    expect(grid).toContain("viewOnly");
    expect(grid).toContain('circularMenuSurfaceProp ?? "none"');
    expect(grid).toContain("if (viewOnly) {");
    expect(preview).toContain("viewOnly");
    expect(landing).toContain("viewOnly");
    expect(preview).not.toContain('circularMenuSurface="');
    expect(landing).not.toContain("circularMenuSurface");
    expect(learner).toContain('drawerId="practice"');
    expect(learner).toContain("drawerId={PREVIOUS_SESSIONS_DRAWER_ID}");
    expect(learner).toContain('drawerId="progress"');
  });
});
