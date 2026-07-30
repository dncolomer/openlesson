/**
 * Admin Data Studio — pure helpers + structural wiring of shipped surfaces.
 * Exercises real access, bulk progress, and projection/region studio functions.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBulkSnapshotJobs,
  buildStudioProjectionView,
  consumePlatformBulkNdjson,
  decideDataStudioAccess,
  evaluateStudioRegionGeometry,
  formatPlatformBulkSnapshotProgress,
  initialPlatformBulkSnapshotProgress,
  isAdminProfile,
  matchesStudioPowFilter,
  paginateSlice,
  parseDataStudioTab,
  parsePlatformBulkProgressLine,
  parsePositiveInt,
  reducePlatformBulkSnapshotProgress,
  selectWorkspacesForBulkSnapshot,
  summarizeXaiOrgRows,
  workspaceBulkLabel,
} from "@/lib/admin/data-studio";
import {
  createCustomVerificationModelFromVectors,
  KNOWLEDGE_CONFIG_DIM,
} from "@/lib/knowledge-config";
import { l2Normalize } from "@/lib/knowledge-config/math";

const ROOT = join(__dirname, "../..");

function unitVector(seed: number): number[] {
  const v = Array.from({ length: KNOWLEDGE_CONFIG_DIM }, (_, i) =>
    Math.sin(seed * 17 + i * 0.31) + 0.05,
  );
  return l2Normalize(v);
}

describe("data studio access (pure)", () => {
  it("isAdminProfile requires truthy is_admin", () => {
    expect(isAdminProfile(null)).toBe(false);
    expect(isAdminProfile({ is_admin: false })).toBe(false);
    expect(isAdminProfile({ is_admin: true })).toBe(true);
  });

  it("decideDataStudioAccess mirrors requireAdmin status codes", () => {
    expect(decideDataStudioAccess({ userId: null, isAdmin: true })).toEqual({
      allowed: false,
      status: 401,
      error: "Not authenticated",
    });
    expect(decideDataStudioAccess({ userId: "u1", isAdmin: false })).toEqual({
      allowed: false,
      status: 403,
      error: "Admin access required",
    });
    expect(decideDataStudioAccess({ userId: "u1", isAdmin: true })).toEqual({
      allowed: true,
    });
  });
});

describe("data studio browse helpers (pure)", () => {
  it("paginateSlice pages and clamps", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const page1 = paginateSlice(items, 1, 3);
    expect(page1.items).toEqual([0, 1, 2]);
    expect(page1.totalPages).toBe(4);
    const pageLast = paginateSlice(items, 99, 3);
    expect(pageLast.page).toBe(4);
    expect(pageLast.items).toEqual([9]);
  });

  it("matchesStudioPowFilter by workspace, type, and search", () => {
    const row = {
      workspace_id: "ws1",
      proof_of_work_type: "tool",
      file_name: "trace.json",
      tool_name: "editor",
      device_name: null,
    };
    expect(matchesStudioPowFilter(row, { workspaceId: "ws1" })).toBe(true);
    expect(matchesStudioPowFilter(row, { workspaceId: "ws2" })).toBe(false);
    expect(matchesStudioPowFilter(row, { proofOfWorkType: "tool" })).toBe(true);
    expect(matchesStudioPowFilter(row, { search: "editor" })).toBe(true);
    expect(matchesStudioPowFilter(row, { search: "missing" })).toBe(false);
  });

  it("parsePositiveInt and tabs", () => {
    expect(parsePositiveInt("12", 1, 50)).toBe(12);
    expect(parsePositiveInt("nope", 5)).toBe(5);
    expect(parsePositiveInt("999", 1, 100)).toBe(100);
    expect(parseDataStudioTab("bulk")).toBe("bulk");
    expect(parseDataStudioTab("nope")).toBe("overview");
  });

  it("summarizeXaiOrgRows counts ready keys and collections", () => {
    const s = summarizeXaiOrgRows([
      { xai_api_key_status: "ready", xai_collection_status: "pending" },
      { xai_api_key_status: "error", xai_collection_status: "ready" },
      { xai_api_key_status: "ready", xai_collection_status: "ready" },
    ]);
    expect(s.organizationsWithXaiKey).toBe(2);
    expect(s.organizationsWithXaiCollection).toBe(2);
  });
});

describe("platform bulk snapshot progress (pure)", () => {
  it("selects workspaces by ids or all eligible", () => {
    const workspaces = [
      { id: "a", title: "Alpha", status: "active" },
      { id: "b", title: "Beta", status: "archived" },
      { id: "c", root_topic: "Gamma", status: "active" },
    ];
    expect(selectWorkspacesForBulkSnapshot(workspaces, { all: true }).map((w) => w.id)).toEqual([
      "a",
      "c",
    ]);
    expect(
      selectWorkspacesForBulkSnapshot(workspaces, {
        all: true,
        includeArchived: true,
      }).map((w) => w.id),
    ).toEqual(["a", "b", "c"]);
    expect(
      selectWorkspacesForBulkSnapshot(workspaces, { workspaceIds: ["b", "c"] }).map((w) => w.id),
    ).toEqual(["c"]);
    expect(selectWorkspacesForBulkSnapshot(workspaces, {})).toEqual([]);
    expect(workspaceBulkLabel({ id: "xyzxyzxyz", title: null, root_topic: null })).toBe("xyzxyzxy");
  });

  it("builds multi-workspace jobs from subject maps", () => {
    const jobs = buildBulkSnapshotJobs({
      workspaces: [
        { id: "w1", title: "One" },
        { id: "w2", title: "Two" },
      ],
      subjectsByWorkspace: {
        w1: [{ user_id: "u1" }, { guest_user_id: "g1" }],
        w2: [{ user_id: "u2" }],
      },
      currentUserId: "u1",
    });
    expect(jobs).toHaveLength(3);
    expect(jobs[0].workspace_label).toBe("One");
    expect(jobs[0].subject_label).toBe("You");
    expect(jobs[1].subject.guest_user_id).toBe("g1");
    expect(jobs[2].workspace_id).toBe("w2");
  });

  it("reduces start → jobs → complete with correct summary counts", () => {
    let state = initialPlatformBulkSnapshotProgress();
    expect(formatPlatformBulkSnapshotProgress(state)).toBe("");

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "start",
      total_workspaces: 2,
      total_jobs: 3,
    });
    expect(state.phase).toBe("running");
    expect(state.total_jobs).toBe(3);

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "workspace_start",
      workspace_id: "w1",
      workspace_label: "One",
      workspace_index: 1,
      total_workspaces: 2,
      subject_count: 2,
    });
    expect(state.currentWorkspaceLabel).toBe("One");

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "job_start",
      index: 1,
      total: 3,
      workspace_id: "w1",
      user_id: "u1",
      guest_user_id: null,
      label: "You",
    });
    expect(state.currentLabel).toBe("You");

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "job",
      index: 1,
      total: 3,
      workspace_id: "w1",
      user_id: "u1",
      guest_user_id: null,
      status: "ok",
    });
    expect(state.succeeded).toBe(1);
    expect(state.completed).toBe(1);

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "job",
      index: 2,
      total: 3,
      workspace_id: "w1",
      user_id: null,
      guest_user_id: "g1",
      status: "skipped",
      code: "no_new_pow",
    });
    expect(state.skipped).toBe(1);

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "workspace_complete",
      workspace_id: "w1",
      workspace_label: "One",
      succeeded: 1,
      skipped: 1,
      failed: 0,
      total: 2,
    });
    expect(state.workspaceSummaries).toHaveLength(1);

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "job",
      index: 3,
      total: 3,
      workspace_id: "w2",
      user_id: "u2",
      guest_user_id: null,
      status: "failed",
      error: "boom",
    });
    expect(state.failed).toBe(1);

    state = reducePlatformBulkSnapshotProgress(state, {
      type: "complete",
      total_workspaces: 2,
      total_jobs: 3,
      succeeded: 1,
      skipped: 1,
      failed: 1,
    });
    expect(state.phase).toBe("complete");
    expect(state.succeeded).toBe(1);
    expect(state.skipped).toBe(1);
    expect(state.failed).toBe(1);
    expect(state.summary).toMatch(/1 ok/);
    expect(formatPlatformBulkSnapshotProgress(state)).toMatch(/Bulk complete/i);
  });

  it("parses and consumes platform bulk NDJSON lines", () => {
    const line = JSON.stringify({
      type: "job",
      index: 1,
      total: 2,
      workspace_id: "w1",
      user_id: "u1",
      guest_user_id: null,
      status: "ok",
    });
    const ev = parsePlatformBulkProgressLine(line);
    expect(ev?.type).toBe("job");
    if (ev?.type === "job") expect(ev.status).toBe("ok");

    const { events, rest } = consumePlatformBulkNdjson("", `${line}\n{"type":"comp`);
    expect(events).toHaveLength(1);
    expect(rest).toContain('"type":"comp');
  });
});

describe("studio projection + region geometry (shipped)", () => {
  it("buildStudioProjectionView yields finite screen coords and region radii", () => {
    const v1 = unitVector(1);
    const v2 = unitVector(2);
    const v3 = unitVector(3);
    const model = createCustomVerificationModelFromVectors({
      name: "cohort",
      vectors: [v1, v2],
    });

    const layout = buildStudioProjectionView({
      points: [
        { t: "2026-01-01", as_of_ms: 1, vector: v1, confidence: 0.5 },
        { t: "2026-01-02", as_of_ms: 2, vector: v2, confidence: 0.6 },
        { t: "2026-01-03", as_of_ms: 3, vector: v3, confidence: 0.7 },
      ],
      regions: [
        {
          id: "r1",
          name: "cohort",
          centroid: model.centroid,
          mean_radius: model.mean_radius,
          cosine_threshold: model.cosine_threshold,
        },
      ],
      algorithm: "random",
      displayMode: "trajectory",
      screen: { width: 720, height: 420, margin: 40 },
    });

    expect(layout.coords.length).toBe(3);
    expect(layout.regionOverlays.length).toBe(1);
    expect(layout.bounds).not.toBeNull();
    expect(layout.view).not.toBeNull();
    for (const c of layout.coords) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
      expect(Number.isFinite(c.screenX)).toBe(true);
      expect(Number.isFinite(c.screenY)).toBe(true);
      expect(c.screenX).toBeGreaterThanOrEqual(0);
      expect(c.screenX).toBeLessThanOrEqual(720);
    }
    const overlay = layout.regionOverlays[0];
    expect(overlay.screenRadius).toBeGreaterThan(0);
    expect(Number.isFinite(overlay.screenRadius)).toBe(true);

    const latest = buildStudioProjectionView({
      points: [
        { t: "a", as_of_ms: 1, vector: v1, confidence: 0.5 },
        { t: "b", as_of_ms: 2, vector: v2, confidence: 0.6 },
      ],
      regions: [],
      displayMode: "latest",
    });
    expect(latest.coords.length).toBe(1);
  });

  it("evaluateStudioRegionGeometry scores centroid inside region", () => {
    const vectors = [unitVector(10), unitVector(11), unitVector(12)];
    const model = createCustomVerificationModelFromVectors({
      name: "experts",
      vectors,
    });
    const { score, knowledge_distance } = evaluateStudioRegionGeometry({
      model,
      vector: model.centroid,
    });
    expect(score.in_region).toBe(true);
    expect(score.validation_score).toBeGreaterThan(50);
    expect(knowledge_distance.knowledge_distance).toBeLessThan(0.5);
    expect(Number.isFinite(knowledge_distance.l2_distance)).toBe(true);
  });
});

describe("data studio structural wiring", () => {
  it("admin shell and page wire Data Studio under admin", () => {
    const shell = readFileSync(join(ROOT, "components/admin/AdminShell.tsx"), "utf8");
    expect(shell).toContain("/admin/data-studio");
    expect(shell).toContain("Data Studio");

    const pagePath = join(ROOT, "app/admin/data-studio/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, "utf8");
    expect(page).toContain("useAdminGuard");
    expect(page).toContain("/api/admin/data-studio/");
    expect(page).toContain("data-admin-data-studio");
    expect(page).toContain("data-studio-panel=\"pow\"");
    expect(page).toContain("data-studio-panel=\"xai\"");
    expect(page).toContain("data-studio-panel=\"snapshots\"");
    expect(page).toContain("data-studio-panel=\"regions\"");
    expect(page).toContain("data-studio-panel=\"bulk\"");
    expect(page).toContain("data-studio-panel=\"projections\"");
  });

  it("all Data Studio API routes call requireAdmin", () => {
    const routes = [
      "app/api/admin/data-studio/overview/route.ts",
      "app/api/admin/data-studio/pow/route.ts",
      "app/api/admin/data-studio/snapshots/route.ts",
      "app/api/admin/data-studio/regions/route.ts",
      "app/api/admin/data-studio/xai/route.ts",
      "app/api/admin/data-studio/projection/route.ts",
      "app/api/admin/data-studio/bulk-snapshot/route.ts",
    ];
    for (const rel of routes) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toContain('from "@/lib/admin/require-admin"');
      expect(src).toContain("requireAdmin()");
      // Every handler path must gate before work
      const handlerCount = (src.match(/export async function (GET|POST)/g) || []).length;
      const requireCount = (src.match(/requireAdmin\(\)/g) || []).length;
      expect(requireCount).toBeGreaterThanOrEqual(handlerCount);
    }
  });

  it("bulk snapshot route reuses runVerticalScore and listWorkspaceSnapshotSubjects", () => {
    const src = readFileSync(
      join(ROOT, "app/api/admin/data-studio/bulk-snapshot/route.ts"),
      "utf8",
    );
    expect(src).toContain("runVerticalScore");
    expect(src).toContain("listWorkspaceSnapshotSubjects");
    expect(src).toContain("selectWorkspacesForBulkSnapshot");
    expect(src).toContain("buildBulkSnapshotJobs");
    expect(src).toContain("application/x-ndjson");
  });

  it("projection route uses buildStudioProjectionView + trajectory loader", () => {
    const src = readFileSync(
      join(ROOT, "app/api/admin/data-studio/projection/route.ts"),
      "utf8",
    );
    expect(src).toContain("buildStudioProjectionView");
    expect(src).toContain("loadKnowledgeConfigTrajectory");
    expect(src).toContain("custom_verification_models");
  });
});
