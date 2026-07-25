import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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
  it("shows two cards per row; no Snapshot button on dashboard cards", () => {
    const card = join(root, "components/WorkspaceDashboardCard.tsx");
    const dash = join(root, "app/dashboard/page.tsx");
    const route = join(root, "app/api/workspaces/[id]/snapshot-all/route.ts");
    expect(existsSync(card)).toBe(true);
    expect(existsSync(dash)).toBe(true);
    expect(existsSync(route)).toBe(true);

    const cardSrc = readFileSync(card, "utf8");
    const dashSrc = readFileSync(dash, "utf8");
    const routeSrc = readFileSync(route, "utf8");

    // Snapshot is LWM-only; dashboard cards keep pin / archive / visibility only
    expect(cardSrc).not.toContain("data-workspace-snapshot-all");
    expect(cardSrc).not.toContain("onSnapshotAll");
    expect(cardSrc).not.toMatch(/>\s*Snapshot\s*</);
    expect(cardSrc).toContain("publicLabel");
    expect(cardSrc).toContain("privateLabel");
    expect(cardSrc).toContain("onTogglePin");

    expect(dashSrc).toContain("md:grid-cols-2");
    expect(dashSrc).not.toContain("xl:grid-cols-3");
    expect(dashSrc).toContain("data-workspace-cards-grid");
    expect(dashSrc).not.toContain("handleSnapshotAll");
    expect(dashSrc).not.toContain("onSnapshotAll");
    expect(dashSrc).not.toContain("snapshottingWorkspaceId");

    // snapshot-all API remains for in-workspace LWM
    expect(routeSrc).toContain("listWorkspaceSnapshotSubjects");
    expect(routeSrc).toContain("runVerticalScore");
    expect(routeSrc).toContain("Only the workspace owner");
    expect(routeSrc).toContain("application/x-ndjson");
    expect(routeSrc).toContain("stream");
  });

  it("filters workspaces by public / private next to archived", () => {
    const dashSrc = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
    expect(dashSrc).toContain("data-workspace-visibility-filter");
    expect(dashSrc).toContain("workspaceVisibilityFilter");
    expect(dashSrc).toContain('value="public"');
    expect(dashSrc).toContain('value="private"');
    expect(dashSrc).toContain("Show archived");
    // Visibility filter applied in list filtering
    expect(dashSrc).toMatch(/workspaceVisibilityFilter === "public"/);
    expect(dashSrc).toMatch(/workspaceVisibilityFilter === "private"/);
  });
});
