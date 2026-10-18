import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readDashboardSurface } from "../helpers/surface-source";
import {
  collectWorkspaceSnapshotSubjects,
  dedupeSnapshotSubjects,
  subjectKey,
} from "@/lib/pow-api/workspace-snapshot-subjects";

const root = join(__dirname, "../..");

describe("workspace snapshot-all subjects (pure)", () => {
  it("dedupes users and guests; guest wins when both present", () => {
    const subjects = dedupeSnapshotSubjects([
      { user_id: "u1" },
      { user_id: "u1" },
      { guest_user_id: "g1" },
      { user_id: "u2", guest_user_id: "g2" },
      { user_id: "  " },
      {},
    ]);
    expect(subjects).toEqual([
      { user_id: "u1", guest_user_id: null },
      { guest_user_id: "g1", user_id: null },
      { guest_user_id: "g2", user_id: null },
    ]);
    expect(subjectKey({ user_id: "u1" })).toBe("u:u1");
    expect(subjectKey({ guest_user_id: "g1" })).toBe("g:g1");
  });

  it("collects owner + pow + sessions + knowledge subjects", () => {
    const subjects = collectWorkspaceSnapshotSubjects({
      ownerUserId: "owner",
      powRows: [
        { user_id: "u1", guest_user_id: null },
        { user_id: null, guest_user_id: "g1" },
      ],
      sessionRows: [{ user_id: "u2" }, { user_id: "owner" }],
      knowledgeSubjects: [{ user_id: "u3" }],
    });
    const keys = subjects.map(subjectKey).sort();
    expect(keys).toEqual(["g:g1", "u:owner", "u:u1", "u:u2", "u:u3"].sort());
  });
});

describe("workspace dashboard card layout", () => {
  it("lists workspaces in a paginated table; no Snapshot button on dashboard rows", () => {
    const dash = join(root, "app/dashboard/page.tsx");
    const route = join(root, "app/api/workspaces/[id]/snapshot-all/route.ts");
    expect(existsSync(dash)).toBe(true);
    expect(existsSync(route)).toBe(true);

    const dashSrc = readDashboardSurface();
    const routeSrc = readFileSync(route, "utf8");

    expect(dashSrc).toContain("data-dashboard-workspace-table");
    expect(dashSrc).toContain("data-dashboard-workspace-pagination");
    expect(dashSrc).toContain("data-workspace-pin");
    expect(dashSrc).toContain("handleTogglePin");
    expect(dashSrc).not.toContain("data-workspace-cards-grid");
    expect(dashSrc).not.toContain("handleSnapshotAll");
    expect(dashSrc).not.toContain("onSnapshotAll");
    expect(dashSrc).not.toContain("snapshottingWorkspaceId");
    expect(dashSrc).not.toContain("data-workspace-snapshot-all");

    // snapshot-all API remains for in-workspace LWM
    expect(routeSrc).toContain("listWorkspaceSnapshotSubjects");
    expect(routeSrc).toContain("runVerticalScore");
    expect(routeSrc).toContain("Only the workspace owner");
    expect(routeSrc).toContain("application/x-ndjson");
    expect(routeSrc).toContain("stream");
  });

  it("filters workspaces by public / private / AYCL next to archived", () => {
    const dashSrc = readDashboardSurface();
    const storageSrc = readFileSync(join(root, "lib/storage/workspaces.ts"), "utf8");
    expect(dashSrc).toContain("data-workspace-visibility-filter");
    expect(dashSrc).toContain("workspaceVisibilityFilter");
    expect(dashSrc).toContain("workspaceMatchesDashboardListFilter");
    expect(dashSrc).toContain('value="public"');
    expect(dashSrc).toContain('value="private"');
    expect(dashSrc).toContain('value="aycl"');
    expect(dashSrc).toContain("Show archived");
    expect(storageSrc).toContain("is_all_you_can_learn");
    expect(dashSrc).toContain("AYCL");
    expect(dashSrc).toContain("data-workspace-aycl");
  });
});
