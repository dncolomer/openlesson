/**
 * Data Studio — pure helpers + structural wiring of the workspace Settings surface.
 * Exercises browse, bulk progress, and projection/region studio functions.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBulkSnapshotJobs,
  buildStudioProjectionView,
  consumePlatformBulkNdjson,
  evaluateStudioRegionGeometry,
  formatPlatformBulkSnapshotProgress,
  initialPlatformBulkSnapshotProgress,
  matchesStudioPowFilter,
  matchesStudioPowToSessionLink,
  paginateSlice,
  parseDataStudioTab,
  parsePlatformBulkProgressLine,
  parsePositiveInt,
  parseStudioSessionLinkInput,
  parseStudioSortDirection,
  reducePlatformBulkSnapshotProgress,
  selectWorkspacesForBulkSnapshot,
  sortStudioRows,
  summarizeXaiOrgRows,
  toggleStudioSort,
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

describe("studio session link parse + PoW match (pure)", () => {
  it("parseStudioSessionLinkInput extracts TAP/ILE tokens from URLs and bare tokens", () => {
    expect(parseStudioSessionLinkInput("")).toBeNull();
    expect(parseStudioSessionLinkInput("  ")).toBeNull();

    const bare = parseStudioSessionLinkInput("QPhnhE7qCFgITvWPDNy0fBp7db0G8MBY");
    expect(bare).toEqual({
      token: "QPhnhE7qCFgITvWPDNy0fBp7db0G8MBY",
      kind: null,
    });

    const tap = parseStudioSessionLinkInput(
      "http://localhost:3000/tap/session/abcTOKEN123456",
    );
    expect(tap).toEqual({ token: "abcTOKEN123456", kind: "tap" });

    const ile = parseStudioSessionLinkInput(
      "https://uncertain.systems/ile/session/ileTok_xyz98765",
    );
    expect(ile).toEqual({ token: "ileTok_xyz98765", kind: "ile" });

    const pathOnly = parseStudioSessionLinkInput("/tap/session/pathTokenABCDEF");
    expect(pathOnly?.kind).toBe("tap");
    expect(pathOnly?.token).toBe("pathTokenABCDEF");
  });

  it("matchesStudioPowToSessionLink uses session_id, source_link, and legacy metadata", () => {
    const resolved = {
      kind: "tap" as const,
      linkId: "link-uuid-1",
      sessionId: "link-uuid-1",
      workspaceId: "ws-1",
    };

    expect(
      matchesStudioPowToSessionLink(
        { session_id: "link-uuid-1", metadata: {} },
        resolved,
      ),
    ).toBe(true);

    expect(
      matchesStudioPowToSessionLink(
        {
          session_id: "other",
          metadata: { source_link_kind: "tap", source_link_id: "link-uuid-1" },
        },
        resolved,
      ),
    ).toBe(true);

    expect(
      matchesStudioPowToSessionLink(
        { session_id: null, metadata: { tap_session_id: "link-uuid-1" } },
        resolved,
      ),
    ).toBe(true);

    expect(
      matchesStudioPowToSessionLink(
        { session_id: "nope", metadata: { source_link_id: "other" } },
        resolved,
      ),
    ).toBe(false);

    const ile = {
      kind: "ile" as const,
      linkId: "ile-link-9",
      sessionId: "sess-9",
      workspaceId: "ws-2",
    };
    expect(
      matchesStudioPowToSessionLink(
        { session_id: "sess-9", metadata: null },
        ile,
      ),
    ).toBe(true);
    expect(
      matchesStudioPowToSessionLink(
        { session_id: null, metadata: { ile_link_id: "ile-link-9" } },
        ile,
      ),
    ).toBe(true);
  });
});

describe("sortStudioRows (pure)", () => {
  const rows = [
    { id: "a", name: "Charlie", created_at: "2026-01-03T00:00:00Z", n: 2 },
    { id: "b", name: "Alice", created_at: "2026-01-01T00:00:00Z", n: 10 },
    { id: "c", name: "Bob", created_at: "2026-01-02T00:00:00Z", n: 5 },
  ];

  it("sorts by string and number columns asc/desc and is stable", () => {
    const byName = sortStudioRows(rows, { column: "name", direction: "asc" }, (r, c) =>
      c === "name" ? r.name : null,
    );
    expect(byName.map((r) => r.id)).toEqual(["b", "c", "a"]);

    const byNDesc = sortStudioRows(rows, { column: "n", direction: "desc" }, (r, c) =>
      c === "n" ? r.n : null,
    );
    expect(byNDesc.map((r) => r.id)).toEqual(["b", "c", "a"]);

    const byWhen = sortStudioRows(
      rows,
      { column: "created_at", direction: "asc" },
      (r, c) => (c === "created_at" ? r.created_at : null),
    );
    expect(byWhen.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("toggleStudioSort and parseStudioSortDirection", () => {
    expect(parseStudioSortDirection("asc")).toBe("asc");
    expect(parseStudioSortDirection("DESC")).toBe("desc");
    expect(parseStudioSortDirection("nope", "asc")).toBe("asc");
    expect(toggleStudioSort(null, "name", "asc")).toEqual({
      column: "name",
      direction: "asc",
    });
    expect(
      toggleStudioSort({ column: "name", direction: "asc" }, "name"),
    ).toEqual({ column: "name", direction: "desc" });
    expect(
      toggleStudioSort({ column: "name", direction: "desc" }, "created_at", "desc"),
    ).toEqual({ column: "created_at", direction: "desc" });
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
  it("workspace Settings mounts Data Studio against the workspace PoW route", () => {
    const panel = readFileSync(join(ROOT, "components/WorkspaceDataStudioPanel.tsx"), "utf8");
    expect(panel).toContain("data-workspace-data-studio");
    expect(panel).toContain("/api/workspace/data-studio/pow");
    expect(panel).toContain("data-studio-filter-link");
    expect(panel).toContain("data-studio-pow-details-row");
    expect(panel).toContain("data-studio-bulk-invalidate");
    expect(panel).toContain("data-studio-invalidate");
    expect(existsSync(join(ROOT, "app/api/workspace/data-studio/pow/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/admin"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/admin"))).toBe(false);
  });

  it("workspace pow API resolves TAP/ILE/TAPBench link tokens and matches related PoW", () => {
    const src = readFileSync(join(ROOT, "app/api/workspace/data-studio/pow/route.ts"), "utf8");
    expect(src).toContain("parseStudioSessionLinkInput");
    expect(src).toContain("hashPrivateToken");
    expect(src).toContain("matchesStudioPowToSessionLink");
    expect(src).toContain("workspace_tap_sessions");
    expect(src).toContain("workspace_ile_links");
    expect(src).toContain("workspace_tapbench_links");
    expect(src).toContain("private_token_hash");
    expect(src).toContain("sortStudioRows");
    expect(src).toContain('searchParams.get("link")');
    expect(src).toContain("guardWorkspaceRoute");
    expect(src).not.toContain("requireAdmin");
  });
});
