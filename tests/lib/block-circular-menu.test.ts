import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ILE_CIRCULAR_MENU_ACTIONS,
  ILE_EMPTY_CIRCULAR_MENU_ACTIONS,
  WORKSPACE_CIRCULAR_MENU_ACTIONS,
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
  ileVoicePadSpec,
  ileWorkOnCompletedRequiresConfirm,
  markGatherResourcesSeen,
  parseGatherSeenBlockIds,
  resolveBlockCircularMenuSurface,
  workspaceCircularMenuDrawerId,
  workspaceCircularMenuStartsFreshExplore,
  applyLearnerDrawerRequest,
  nextLearnerDrawerRequest,
  BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX,
  BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX,
  BLOCK_CIRCULAR_MENU_RING_RADIUS_PX,
  BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX,
  circularMenuActionPosition,
} from "@/lib/block-circular-menu";
import { applyIleChapterUndoDone } from "@/lib/learn-chapter-close-review";
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
  it("TAP Learning set is exactly Work / Edit; Workspace is Calibrate/Learn/Verify; TAP is empty", () => {
    expect(blockCircularMenuActions("ile").map((a) => a.label)).toEqual([
      "Work",
      "Edit",
    ]);
    expect(blockCircularMenuActions("ile").map((a) => a.id)).not.toContain("gather_resources");
    expect(blockCircularMenuActions("ile").map((a) => a.id)).not.toContain("see_resources");
    expect(blockCircularMenuActions("ile").some((a) => a.id === "mark_completed")).toBe(
      false,
    );
    expect(blockCircularMenuActions("ile").map((a) => a.id)).toEqual(
      ILE_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(blockCircularMenuActions("workspace-learner").map((a) => a.label)).toEqual([
      "Learn",
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
    expect(ileVoicePadSpec({ selection: "chapter" }).actions.map((a) => a.id)).toEqual(
      ILE_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(ileVoicePadSpec({ selection: "empty" }).actions.map((a) => a.id)).toEqual([
      "add_chapter",
    ]);
    expect(ileVoicePadSpec({ selection: "blocked" }).actions).toEqual([]);
    expect(
      ileVoicePadSpec({ selection: "blocked" }).actions.some((a) => a.id === "add_chapter"),
    ).toBe(false);
    expect(
      ileVoicePadSpec({ selection: "chapter", completed: true }).disabledIds.has("edit"),
    ).toBe(true);
    expect(blockCircularMenuActions("ile", { timUnopened: true }).map((a) => a.id)).toEqual(
      ILE_CIRCULAR_MENU_ACTIONS.map((a) => a.id),
    );
    expect(blockCircularMenuActions("ile", { timUnopened: true }).map((a) => a.label)).toEqual([
      "Work",
      "Edit",
    ]);
    expect(blockCircularMenuActions("workspace-learner", { timUnopened: true })).toEqual([]);
    expect(blockCircularMenuActions("workspace-learner", { empty: true })).toEqual([]);
    expect(blockCircularMenuActions("none")).toEqual([]);
    expect(resolveBlockCircularMenuSurface({ tap: true, learnerMode: true })).toBe("none");
    expect(resolveBlockCircularMenuSurface({})).toBe("none");
    expect(resolveBlockCircularMenuSurface({ learnerMode: true })).toBe("none");
    expect(resolveBlockCircularMenuSurface({ practiceMenu: true })).toBe("none");
    expect(ILE_CIRCULAR_MENU_ACTIONS.some((a) => a.id.includes("tap"))).toBe(false);
    expect(WORKSPACE_CIRCULAR_MENU_ACTIONS.some((a) => a.id.includes("tap"))).toBe(false);

    const count = ILE_CIRCULAR_MENU_ACTIONS.length;
    for (let i = 0; i < count; i++) {
      const pos = circularMenuActionPosition(i, count);
      expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(BLOCK_CIRCULAR_MENU_RING_RADIUS_PX, 5);
    }
    expect(BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX).toBe(1);
    expect(BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX).toBeGreaterThanOrEqual(36);
    expect(BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX).toBeGreaterThanOrEqual(2);
  });
});

describe("in-block progress, unseen gather dot, resource scope", () => {
  it("running TAP Learning action yields (0,1]; ready-unseen is true, seen or empty is false; chapter/block/missing ids are safe", () => {
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
