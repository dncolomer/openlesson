import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import {
  dashboardPinsStorageKey,
  loadPinnedWorkspaceIds,
  savePinnedWorkspaceIds,
  sortWorkspacesPinnedFirst,
  togglePinnedWorkspaceId,
} from "@/lib/dashboard-workspace-pins";

const ROOT = process.cwd();

describe("sortWorkspacesPinnedFirst", () => {
  it("places pinned before unpinned; secondary created_at desc", () => {
    const rows = [
      { id: "a", created_at: "2026-07-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-07-10T00:00:00.000Z" },
      { id: "c", created_at: "2026-07-05T00:00:00.000Z" },
    ];
    const sorted = sortWorkspacesPinnedFirst(rows, new Set(["a", "c"]));
    expect(sorted.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("keeps only unpinned order by date when none pinned", () => {
    const rows = [
      { id: "old", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "new", created_at: "2026-06-01T00:00:00.000Z" },
    ];
    expect(sortWorkspacesPinnedFirst(rows, []).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("togglePinnedWorkspaceId is stable", () => {
    const empty = new Set<string>();
    const one = togglePinnedWorkspaceId(empty, "w1");
    expect([...one]).toEqual(["w1"]);
    const off = togglePinnedWorkspaceId(one, "w1");
    expect(off.has("w1")).toBe(false);
  });
});

describe("dashboard pin persistence (localStorage)", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("save then load restores pinned ids (simulated reload)", () => {
    const userId = "user-abc";
    expect(dashboardPinsStorageKey(userId)).toContain(userId);
    savePinnedWorkspaceIds(userId, new Set(["ws1", "ws2"]));
    const reloaded = loadPinnedWorkspaceIds(userId);
    expect(reloaded.has("ws1")).toBe(true);
    expect(reloaded.has("ws2")).toBe(true);
    expect(reloaded.size).toBe(2);
  });

  it("unknown user / empty returns empty set", () => {
    expect(loadPinnedWorkspaceIds(null).size).toBe(0);
    expect(loadPinnedWorkspaceIds("nobody").size).toBe(0);
  });
});

describe("Dashboard pin UI surface", () => {
  it("card and page wire pin control + sort helper", () => {
    const card = fs.readFileSync(path.join(ROOT, "components/WorkspaceDashboardCard.tsx"), "utf8");
    expect(card).toContain("data-workspace-pin");
    expect(card).toContain("onTogglePin");
    expect(card).toMatch(/Pin|Unpin|pinned/i);

    const page = fs.readFileSync(path.join(ROOT, "app/dashboard/page.tsx"), "utf8");
    expect(page).toContain("sortWorkspacesPinnedFirst");
    expect(page).toContain("loadPinnedWorkspaceIds");
    expect(page).toContain("savePinnedWorkspaceIds");
    expect(page).toContain("onTogglePin");
    expect(page).toContain("pinnedWorkspaceIds");
  });
});
