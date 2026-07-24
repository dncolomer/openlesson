import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

describe("guest subjects + isolation", () => {
  it("guest PoW upload does not fall back user_id to workspace owner", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "lib/pow-api/upload-workspace-proof-of-work.ts"),
      "utf8",
    );
    expect(src).toContain("participantGuestUserId ? null : participantUserId || billingUserId");
    expect(src).not.toMatch(/user_id:\s*participantUserId\s*\|\|\s*billingUserId\s*,/);
  });

  it("owner-scoped performance context excludes guest_user_id rows", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/pow-api/performance-context.ts"), "utf8");
    expect(src).toContain('.is("guest_user_id", null)');
    expect(src).toContain('.eq("guest_user_id", evidenceFilter.guestUserId)');
  });

  it("knowledge-config available subjects use PoW ∪ link guests", () => {
    const route = fs.readFileSync(
      path.join(ROOT, "app/api/workspace/knowledge-config/route.ts"),
      "utf8",
    );
    expect(route).toContain("listWorkspaceAvailableSubjectsForUi");
    expect(route).not.toContain("listSubjectsWithKnowledgeConfig");

    const subjects = fs.readFileSync(
      path.join(ROOT, "lib/pow-api/workspace-snapshot-subjects.ts"),
      "utf8",
    );
    expect(subjects).toContain("listWorkspaceAvailableSubjectsForUi");
    expect(subjects).toContain("workspace_tap_sessions");
    expect(subjects).toContain("workspace_ile_links");
  });

  it("LWM tab surfaces latest snapshot report detail", () => {
    const panel = fs.readFileSync(
      path.join(ROOT, "components/KnowledgeConfigTrajectoryPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("data-lwm-latest-snapshot-report");
    expect(panel).toContain("PerformanceReportCard");
    expect(panel).toContain("loadLatestSnapshotReport");
  });
});
