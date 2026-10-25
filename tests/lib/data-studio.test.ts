/**
 * Data Studio — pure helpers + structural wiring of the workspace Settings surface.
 * Exercises browse, bulk progress, and projection/region studio functions.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildStudioProjectionView,
  evaluateStudioRegionGeometry,
  matchesStudioPowFilter,
  matchesStudioPowToSessionLink,
  paginateSlice,
  parseDataStudioTab,
  parsePositiveInt,
  parseStudioSessionLinkInput,
  parseStudioSortDirection,
  sortStudioRows,
  summarizeXaiOrgRows,
  toggleStudioSort,
} from "@/lib/admin/data-studio";
import { createCustomVerificationModelFromVectors } from "@/lib/knowledge-config";
import {
  completeFlowEmbedding,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
} from "@/lib/flow-embedding";
import { cosineThresholdToL2, l2Distance, l2Normalize } from "@/lib/knowledge-config/math";
import {
  availableWorkspaceSections,
  resolveWorkspaceSectionLayout,
} from "@/lib/workspace-sections";
import {
  DASHBOARD_NAV_GROUPS,
  dashboardStudioProduct,
  isDashboardStudioTab,
} from "@/lib/dashboard-nav";
import {
  IDENTITY_STUDIO_CAMERA,
  hitTestStudioPoint,
  panStudioCamera,
  studioCameraTransform,
  studioGridLines,
  studioNiceGridStep,
  studioScreenToWorld,
  zoomStudioCamera,
} from "@/lib/data-studio-camera";
import {
  buildDataStudioProjectionView,
  buildStudioRegionDistanceRays,
  clampStudioInspectWidth,
  formatStudioHighDimDistance,
  hiddenStudioRegionIdsForFocus,
  filterStudioEmbeddings,
  studioHighDimRegionMembership,
  studioPointInsideHighDimRegion,
  includeLearningStudioEmbedding,
  inspectStudioEmbedding,
  parseDataStudioSpace,
  DATA_STUDIO_SPACE_OPTIONS,
  dataStudioSpaceLabel,
  presentDashboardDataStudio,
  projectStudioEmbeddings2D,
  scopeLearningStudioEmbeddings,
  studioEmbeddingVector,
  studioRegionsForSpace,
  studioFlowOptions,
  STUDIO_IN_REGION_FILL,
  studioCountPhrase,
  studioMultiSelectSummary,
  studioOptionMatchesQuery,
  pruneStudioSelectedIds,
  studioHiddenRegionIdsFromVisible,
  studioVisibleRegionIds,
  toggleStudioSelectedId,
  studioRunOptions,
  toggleStudioHiddenId,
  visibleStudioRegions,
  type DataStudioEmbeddingRow,
} from "@/lib/data-studio-view";
import {
  dataStudioExplainer,
  parseDataStudioView,
} from "@/lib/data-studio-explainer";

const ROOT = join(__dirname, "../..");

function unitVector(seed: number): number[] {
  const v = Array.from({ length: FLOW_EMBEDDING_DIM }, (_, i) =>
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
    expect(parseDataStudioTab("bulk")).toBe("overview");
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
  it("parseStudioSessionLinkInput extracts TAP/TAP Learning tokens from URLs and bare tokens", () => {
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
    expect(Number.isFinite(overlay.membershipScreenRadius)).toBe(true);
    expect(overlay.membershipScreenRadius).toBeGreaterThan(0);

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

  it("workspace pow API resolves TAP/TAP Learning/TAPBench link tokens and matches related PoW", () => {
    const src = readFileSync(join(ROOT, "app/api/workspace/data-studio/pow/route.ts"), "utf8");
    expect(src).toContain("parseStudioSessionLinkInput");
    expect(src).toContain("hashPrivateToken");
    expect(src).toContain("matchesStudioPowToSessionLink");
    expect(src).toContain("workspace_calibrate_sessions");
    expect(src).toContain("workspace_learn_links");
    expect(src).not.toContain("workspace_tapbench_links");
    expect(src).toContain("private_token_hash");
    expect(src).toContain("sortStudioRows");
    expect(src).toContain('searchParams.get("link")');
    expect(src).toContain("guardWorkspaceRoute");
    expect(src).not.toContain("requireAdmin");
  });
});

function studioRow(input: {
  id: string;
  flowKind?: string;
  flowId?: string | null;
  runId?: string | null;
  identity?: string | null;
  prompt: string;
  workspaceId?: string;
  userId?: string | null;
  isPlayCopy?: boolean;
  ownerUserId?: string;
}): DataStudioEmbeddingRow {
  const record = completeFlowEmbedding({
    flowKind: (input.flowKind as "verify" | "calibrate" | "learn") || "verify",
    pow: [
      {
        type: "tool",
        tool_name: "tap-speech-segment",
        tool_action: "speech_stop",
        timestamp_ms: 1,
        payload: input.prompt,
        metadata: { transcript: input.prompt, text: input.prompt },
      },
    ],
  });
  return {
    id: input.id,
    workspace_id: input.workspaceId ?? "ws-1",
    flow_kind: input.flowKind ?? "verify",
    flow_id: input.flowId ?? "flow-a",
    run_id: input.runId ?? "run-1",
    identity: input.identity ?? "ada",
    vector: record.vector,
    raw: record.raw,
    embedding_model_id: record.embedding_model_id,
    created_at: "2026-10-01T00:00:00.000Z",
    user_id: input.userId ?? null,
    is_play_copy: input.isPlayCopy ?? false,
    owner_user_id: input.ownerUserId ?? "me",
  };
}

/** Matches `app/api/dashboard/data-studio/route.ts` mapping of StoredFlowEmbedding. */
function dashboardApiEmbedding(input: {
  id: string;
  flowKind?: string;
  flowId?: string | null;
  runId?: string | null;
  identity?: string | null;
  prompt: string;
  workspaceId?: string;
}): DataStudioEmbeddingRow {
  const record = completeFlowEmbedding({
    flowKind: (input.flowKind as "verify" | "calibrate" | "learn") || "verify",
    pow: [
      {
        type: "tool",
        tool_name: "tap-speech-segment",
        tool_action: "speech_stop",
        timestamp_ms: 1,
        payload: input.prompt,
        metadata: { transcript: input.prompt, text: input.prompt },
      },
    ],
  });
  return {
    id: input.id,
    workspace_id: input.workspaceId ?? "ws-1",
    flow_kind: input.flowKind ?? "verify",
    flow_id: input.flowId ?? "flow-a",
    run_id: input.runId ?? "run-1",
    identity: input.identity ?? "ada",
    vector: record.vector,
    raw: record.raw,
    embedding_model_id: record.embedding_model_id,
    created_at: "2026-10-01T00:00:00.000Z",
    source: null,
  };
}

describe("product Data Studio chrome", () => {
  it("lists Data Studio on verification, calibration, and learning product chrome", () => {
    expect(
      availableWorkspaceSections({ isOwner: true, workspaceKind: "knowledge_region" }),
    ).toContain("data_studio");
    expect(
      availableWorkspaceSections({ isOwner: true, workspaceKind: "calibration" }),
    ).toContain("data_studio");
    expect(availableWorkspaceSections({ isOwner: true })).not.toContain("data_studio");
    expect(resolveWorkspaceSectionLayout("data_studio").mountsDataStudioPanel).toBe(true);

    const learning = DASHBOARD_NAV_GROUPS.find((group) => group.id === "learning");
    const verification = DASHBOARD_NAV_GROUPS.find((group) => group.id === "verification");
    const calibration = DASHBOARD_NAV_GROUPS.find((group) => group.id === "calibration");
    expect(learning?.items.some((item) => item.label === "Data Studio")).toBe(true);
    expect(verification?.items.some((item) => item.label === "Data Studio")).toBe(true);
    expect(calibration?.items.some((item) => item.label === "Data Studio")).toBe(true);
    expect(isDashboardStudioTab("learning_studio")).toBe(true);
    expect(dashboardStudioProduct("calibration_studio")).toBe("calibration");

    const hosts = readFileSync(join(ROOT, "components/workspace-view/workspace-section-hosts.tsx"), "utf8");
    expect(hosts).toContain("DataStudioPanel");
    expect(hosts).toContain("data-workspace-data-studio-host");
    expect(hosts).toContain('visibleSections.includes("data_studio")');

    expect(existsSync(join(ROOT, "lib/data-studio-camera.ts"))).toBe(true);
    expect(readFileSync(join(ROOT, "lib/data-studio-view.ts"), "utf8")).toContain(
      'from "@/lib/data-studio-camera"',
    );
    expect(existsSync(join(ROOT, "components/data-studio/DataStudioPlot.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/data-studio/DataStudioHud.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/data-studio/DataStudioInspect.tsx"))).toBe(true);
    const visual = [
      "components/data-studio/DataStudioPanel.tsx",
      "components/data-studio/DataStudioPlot.tsx",
      "components/data-studio/DataStudioHud.tsx",
      "components/data-studio/DataStudioInspect.tsx",
    ]
      .map((rel) => readFileSync(join(ROOT, rel), "utf8"))
      .join("\n");
    expect(visual).toContain("<DataStudioPlot");
    expect(visual).toContain("<DataStudioHud");
    expect(visual).toContain("<DataStudioInspect");
    expect(visual).toContain("data-workspace-data-studio");
    expect(visual).toContain("data-data-studio-visual");
    expect(visual).toContain("data-data-studio-product");
    expect(visual).toContain("data-data-studio-plot");
    expect(visual).toContain("data-data-studio-hud");
    expect(visual).toContain("data-data-studio-toolbar");
    expect(visual).toContain("data-data-studio-toolbar-grid");
    expect(visual).toContain("minmax(7.5rem,1fr)");
    expect(visual).toContain("data-data-studio-status");
    expect(visual).toContain("data-data-studio-flow-filter");
    expect(visual).toContain("data-data-studio-run-filter");
    expect(visual).toContain("data-data-studio-region-filter");
    expect(visual).toContain("StudioMultiSelect");
    const select = readFileSync(join(ROOT, "components/data-studio/StudioMultiSelect.tsx"), "utf8");
    expect(select).toContain("data-data-studio-select-search");
    expect(select).toContain("data-data-studio-select-option");
    expect(select).toContain("aria-multiselectable");
    expect(visual).toContain("compact");
    expect(visual).toContain("data-data-studio-inspect");
    expect(visual).toContain("data-data-studio-speech");
    expect(visual).toContain("data-data-studio-resize");
    expect(visual).toContain("data-data-studio-grid");
    expect(visual).toContain("data-data-studio-reset-camera");
    expect(visual).toContain("data-data-studio-camera");
    expect(visual).toContain("data-data-studio-space-select");
    expect(visual).toContain("dataStudioSpaceLabel");
    expect(visual).toContain("All together");
    expect(visual).toContain("data-data-studio-help");
    expect(visual).toContain("data-data-studio-view");
    expect(visual).toContain("data-data-studio-distances-toggle");
    expect(visual).toContain("data-data-studio-membership-toggle");
    expect(visual).toContain("const [showDistances, setShowDistances] = useState(true)");
    expect(visual).toContain("const [colorMembership, setColorMembership] = useState(true)");
    expect(visual).toContain("data-data-studio-spread-disk");
    expect(visual).toContain("data-data-studio-spread-label");
    expect(visual).toContain("data-data-studio-membership-ring");
    expect(visual).toContain("studioHighDimRegionMembership");
    expect(visual).toContain("STUDIO_IN_REGION_FILL");
    expect(visual).toContain("membershipScreenRadius");
    expect(visual).toContain("data-data-studio-region-legend");
    expect(visual).toContain("data-data-studio-region-toggle");
    expect(visual).toContain("data-data-studio-distance-ray");
    expect(visual).toContain("strokeDasharray");
    expect(visual).toContain("data-data-studio-inspect-distances");
    expect(visual).toContain("data-data-studio-focus-region");
    expect(visual).toContain("DATA_STUDIO_REGION_QUERY");
    expect(visual).toContain("hiddenStudioRegionIdsForFocus");
    expect(visual).toContain("DataStudioExplainer");
    const explainer = readFileSync(
      join(ROOT, "components/data-studio/DataStudioExplainer.tsx"),
      "utf8",
    );
    expect(explainer).toContain("data-data-studio-explainer");
    expect(explainer).toContain("data-data-studio-explainer-figure");
    expect(explainer).toContain("Back to map");

    const dash = readFileSync(join(ROOT, "app/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("DashboardDataStudioTab");
    expect(existsSync(join(ROOT, "app/api/dashboard/data-studio/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "components/dashboard/dashboard-data-studio-tab.tsx"))).toBe(true);
    const api = readFileSync(join(ROOT, "app/api/dashboard/data-studio/route.ts"), "utf8");
    expect(api).toContain("presentDashboardDataStudio");
    expect(api).toContain("listFlowEmbeddingsForWorkspaces");
    expect(api).not.toContain("denyWorkspaceFeatureById");
  });
});

describe("Data Studio help explainer", () => {
  it("swaps the map for a product explainer with walk, spaces, overlay, and inspect", () => {
    expect(parseDataStudioView("help")).toBe("help");
    expect(parseDataStudioView("map")).toBe("map");
    expect(parseDataStudioView("nope")).toBe("map");
    const verification = dataStudioExplainer("verification");
    const calibration = dataStudioExplainer("calibration");
    const learning = dataStudioExplainer("learning");
    expect(verification.figures.map((figure) => figure.id)).toEqual([
      "walk",
      "spaces",
      "overlay",
      "inspect",
    ]);
    expect(verification.lede).toContain("Verify");
    expect(verification.figures[2]?.body).toContain("flow");
    expect(verification.figures[2]?.body).toContain("dashed ring");
    expect(verification.figures[2]?.body).toContain("white disk");
    expect(calibration.figures[2]?.body).toContain("dashed ring");
    expect(calibration.lede).toContain("Calibrate");
    expect(calibration.figures[2]?.title).toContain("Sounding");
    expect(learning.lede).toContain("Learn");
    expect(learning.figures[2]?.body).toContain("play");
    expect(learning.controls).toContain("map");
    expect(verification.figures[1]?.body).toContain("Path + Text");
  });
});

describe("studio flow/run filters, inspect, projection, learning scope", () => {
  it("keeps all-together, drops other flows and runs, and retains identity", () => {
    const ada = studioRow({ id: "e1", flowId: "flow-a", runId: "run-1", identity: "ada", prompt: "a" });
    const bea = studioRow({
      id: "e2",
      flowId: "flow-a",
      runId: "run-2",
      identity: "bea",
      prompt: "b",
    });
    const other = studioRow({
      id: "e3",
      flowId: "flow-b",
      runId: "run-9",
      identity: "cam",
      prompt: "c",
    });
    const together = filterStudioEmbeddings([ada, bea, other], {});
    expect(together.map((row) => row.id)).toEqual(["e1", "e2", "e3"]);
    expect(together.every((row) => row.identity)).toBe(true);
    expect(filterStudioEmbeddings([ada, bea, other], { flowId: "flow-a" }).map((row) => row.id)).toEqual([
      "e1",
      "e2",
    ]);
    expect(
      filterStudioEmbeddings([ada, bea, other], { flowId: "flow-a", runId: "run-2" }).map(
        (row) => row.id,
      ),
    ).toEqual(["e2"]);
    expect(
      filterStudioEmbeddings([ada, bea, other], { flowIds: ["flow-a", "flow-b"] }).map(
        (row) => row.id,
      ),
    ).toEqual(["e1", "e2", "e3"]);
    expect(
      filterStudioEmbeddings([ada, bea, other], {
        flowIds: ["flow-a"],
        runIds: ["run-1", "run-2"],
      }).map((row) => row.id),
    ).toEqual(["e1", "e2"]);
    expect(studioFlowOptions([ada, bea, other]).map((flow) => flow.flowId)).toEqual([
      "flow-a",
      "flow-b",
    ]);
    expect(studioRunOptions([ada, bea, other], "flow-a").map((run) => run.runId)).toEqual([
      "run-1",
      "run-2",
    ]);
    expect(studioRunOptions([ada, bea, other], ["flow-a", "flow-b"]).map((run) => run.runId)).toEqual(
      ["run-1", "run-2", "run-9"],
    );
    expect(studioRunOptions([ada, bea, other], "flow-a")[0]?.identity).toBe("ada");
    expect(studioOptionMatchesQuery({ id: "flow-a", label: "Limits (2)", keywords: "ada bea" }, "ada")).toBe(
      true,
    );
    expect(studioOptionMatchesQuery({ id: "flow-a", label: "Limits (2)" }, "bayes")).toBe(false);
    expect(studioMultiSelectSummary(["flow-a"], [{ id: "flow-a", label: "Limits (2)" }], "All together", "flows")).toBe(
      "Limits (2)",
    );
    expect(studioMultiSelectSummary(["a", "b"], [], "All together", "flows")).toBe("2 flows");
    expect(studioCountPhrase(1, "flows")).toBe("1 flow");
    expect(studioCountPhrase(2, "regions")).toBe("2 regions");
    expect(
      studioMultiSelectSummary(
        ["flow-a"],
        [{ id: "flow-a", label: "7d676f16-aaaa-bbbb-cccc-1234567890ab (6)" }],
        "All together",
        "flows",
        undefined,
        true,
      ),
    ).toBe("1 flow");
    expect(
      studioMultiSelectSummary(
        ["r1", "r2"],
        [
          { id: "r1", label: "ε-δ walkers" },
          { id: "r2", label: "Bayes" },
        ],
        "None",
        "regions",
        "All regions",
      ),
    ).toBe("All regions");
    expect(studioVisibleRegionIds(["r1", "r2"], ["r2"])).toEqual(["r1"]);
    expect(studioHiddenRegionIdsFromVisible(["r1", "r2"], ["r1"])).toEqual(["r2"]);
    expect(studioHiddenRegionIdsFromVisible(["r1", "r2"], [])).toEqual(["r1", "r2"]);
    expect(toggleStudioSelectedId(["flow-a"], "flow-b")).toEqual(["flow-a", "flow-b"]);
    expect(toggleStudioSelectedId(["flow-a", "flow-b"], "flow-a")).toEqual(["flow-b"]);
    expect(pruneStudioSelectedIds(["run-1", "run-9"], ["run-1", "run-2"])).toEqual(["run-1"]);
    const kept = ["run-1", "run-2"];
    expect(pruneStudioSelectedIds(kept, ["run-1", "run-2"])).toBe(kept);
  });

  it("inspects vector, raw, proof of work, and transcripts from a stored embedding", () => {
    const row = studioRow({
      id: "inspect-1",
      identity: "ada",
      flowId: "flow-a",
      runId: "run-1",
      prompt: "spoken proof of limits",
    });
    const inspect = inspectStudioEmbedding(row);
    expect(inspect?.identity).toBe("ada");
    expect(inspect?.flow_id).toBe("flow-a");
    expect(inspect?.run_id).toBe("run-1");
    expect(inspect?.space).toBe("path");
    expect(inspect?.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(inspect?.vector).toEqual(row.vector);
    expect(inspect?.vector.length).toBe(FLOW_EMBEDDING_DIM);
    const pathText = inspectStudioEmbedding(row, "path_text");
    expect(pathText?.space).toBe("path_text");
    expect(pathText?.embedding_model_id).toBe(FLOW_EMBEDDING_PATH_TEXT_MODEL_ID);
    expect(pathText?.vector).not.toEqual(row.vector);
    expect(pathText?.speech).toContain("spoken proof of limits");
    expect(inspect?.raw).toEqual(row.raw);
    expect(inspect?.pow.length).toBeGreaterThan(0);
    expect(inspect?.transcripts).toContain("spoken proof of limits");
    expect(inspect?.speech).toContain("spoken proof of limits");
  });

  it("pulls voice transcripts from transcript_snapshot and session transcript payloads", () => {
    const snapshot = studioRow({
      id: "snap-1",
      prompt: "ignored payload json",
    });
    snapshot.raw = completeFlowEmbedding({
      flowKind: "verify",
      pow: [
        {
          type: "tool",
          tool_name: "speech-segment",
          tool_action: "speech_stop",
          timestamp_ms: 2,
          payload: JSON.stringify({ type: "uncertain_systems_tap_speech_segment" }),
          metadata: { transcript_snapshot: "I am thinking about limits out loud" },
        },
        {
          type: "tool",
          tool_name: "transcript",
          tool_action: "complete",
          timestamp_ms: 3,
          payload: JSON.stringify({
            type: "uncertain_systems_tap_transcript",
            transcript: [{ role: "learner", text: "the derivative is the slope" }],
          }),
          metadata: { message_count: 1 },
        },
      ],
    }).raw;
    const inspect = inspectStudioEmbedding(snapshot);
    expect(inspect?.speech).toEqual([
      "I am thinking about limits out loud",
      "the derivative is the slope",
    ]);
    expect(clampStudioInspectWidth(120)).toBe(280);
    expect(clampStudioInspectWidth(2000)).toBe(960);
    expect(clampStudioInspectWidth(500)).toBe(500);
  });

  it("projects two algorithms to finite 2D and overlays region disks in the same frame", () => {
    const a = studioRow({ id: "p1", prompt: "alpha", identity: "ada" });
    const b = studioRow({ id: "p2", prompt: "beta", identity: "bea", runId: "run-2" });
    const pca = projectStudioEmbeddings2D([a, b], "pca");
    const random = projectStudioEmbeddings2D([a, b], "random");
    expect(pca).toHaveLength(2);
    expect(random).toHaveLength(2);
    expect(pca.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(random.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    const view = buildDataStudioProjectionView({
      embeddings: [a, b],
      regions: [
        {
          id: "region-1",
          name: "Limits",
          centroid: a.vector,
          mean_radius: 0.25,
          cosine_threshold: 0.5,
        },
      ],
      algorithm: "pca",
      screen: { width: 800, height: 500, margin: 32 },
    });
    expect(view.coords).toHaveLength(2);
    expect(view.regionOverlays).toHaveLength(1);
    expect(view.regionOverlays[0].screenRadius).toBeGreaterThan(0);
    expect(Number.isFinite(view.regionOverlays[0].screenX)).toBe(true);
    expect(view.coords[0].identity).toBe("ada");
  });

  it("maps the cosine ball wider than a tight cohort disk so 2D overlay can disagree with membership", () => {
    expect(cosineThresholdToL2(1)).toBe(0);
    expect(cosineThresholdToL2(0)).toBeCloseTo(Math.SQRT2, 10);
    expect(cosineThresholdToL2(0.98)).toBeCloseTo(Math.sqrt(2 * (1 - 0.98)), 10);
    expect(STUDIO_IN_REGION_FILL).toBe("#00ffc2");
    const tau = 0.98;
    const view = buildStudioProjectionView({
      points: [
        { t: "a", as_of_ms: 1, vector: unitVector(1), confidence: 1 },
        { t: "b", as_of_ms: 2, vector: unitVector(1.02), confidence: 1 },
      ],
      regions: [
        {
          id: "tight",
          name: "tight",
          centroid: unitVector(1),
          mean_radius: 0.008,
          cosine_threshold: tau,
        },
      ],
      algorithm: "random",
      screen: { width: 800, height: 500, margin: 32 },
    });
    const overlay = view.regionOverlays[0];
    expect(overlay.membershipRadius).toBeGreaterThan(overlay.radius);
    expect(overlay.membershipScreenRadius).toBeGreaterThan(overlay.screenRadius);
  });

  it("switches Path and Path + Text spaces and overlays only matching regions", () => {
    expect(DATA_STUDIO_SPACE_OPTIONS).toEqual([
      { id: "path", label: "Path" },
      { id: "path_text", label: "Path + Text" },
    ]);
    expect(dataStudioSpaceLabel("path")).toBe("Path");
    expect(dataStudioSpaceLabel("path_text")).toBe("Path + Text");
    expect(parseDataStudioSpace("path_text")).toBe("path_text");
    expect(parseDataStudioSpace("nope")).toBe("path");
    const a = studioRow({ id: "p1", prompt: "alpha spoken", identity: "ada" });
    const b = studioRow({ id: "p2", prompt: "beta spoken", identity: "bea", runId: "run-2" });
    expect(studioEmbeddingVector(a, "path")).toEqual(studioEmbeddingVector(b, "path"));
    expect(studioEmbeddingVector(a, "path_text")).not.toEqual(studioEmbeddingVector(b, "path_text"));
    const pathRegions = [
      {
        id: "path-region",
        name: "Walk",
        centroid: studioEmbeddingVector(a, "path"),
        mean_radius: 0.25,
        cosine_threshold: 0.5,
        embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
      },
      {
        id: "text-region",
        name: "Speech",
        centroid: studioEmbeddingVector(a, "path_text"),
        mean_radius: 0.25,
        cosine_threshold: 0.5,
        embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
      },
    ];
    expect(studioRegionsForSpace(pathRegions, "path").map((region) => region.id)).toEqual([
      "path-region",
    ]);
    expect(studioRegionsForSpace(pathRegions, "path_text").map((region) => region.id)).toEqual([
      "text-region",
    ]);
    const pathView = buildDataStudioProjectionView({
      embeddings: [a, b],
      regions: pathRegions,
      algorithm: "pca",
      space: "path",
      screen: { width: 800, height: 500, margin: 32 },
    });
    const textView = buildDataStudioProjectionView({
      embeddings: [a, b],
      regions: pathRegions,
      algorithm: "pca",
      space: "path_text",
      screen: { width: 800, height: 500, margin: 32 },
    });
    expect(pathView.regionOverlays.map((region) => region.id)).toEqual(["path-region"]);
    expect(textView.regionOverlays.map((region) => region.id)).toEqual(["text-region"]);
    expect(pathView.coords[0].screenX).toBe(pathView.coords[1].screenX);
    expect(textView.coords[0].screenX).not.toBe(textView.coords[1].screenX);
  });

  it("labels dashed rays with high-dim L2 and hides selected regions", () => {
    const a = {
      ...studioRow({ id: "p1", prompt: "alpha", identity: "ada" }),
      vector: unitVector(1),
      raw: undefined,
    };
    const b = {
      ...studioRow({ id: "p2", prompt: "beta", identity: "bea", runId: "run-2" }),
      vector: unitVector(99),
      raw: undefined,
    };
    const regions = [
      {
        id: "region-1",
        name: "Limits",
        centroid: a.vector,
        mean_radius: 0.25,
        cosine_threshold: 0.99,
      },
      {
        id: "region-2",
        name: "Other",
        centroid: b.vector,
        mean_radius: 0.25,
        cosine_threshold: 0.99,
      },
    ];
    const view = buildDataStudioProjectionView({
      embeddings: [a, b],
      regions,
      algorithm: "pca",
      screen: { width: 800, height: 500, margin: 32 },
    });
    expect(visibleStudioRegions(view.regionOverlays, ["region-2"]).map((region) => region.id)).toEqual([
      "region-1",
    ]);
    expect(toggleStudioHiddenId([], "region-1")).toEqual(["region-1"]);
    expect(toggleStudioHiddenId(["region-1"], "region-1")).toEqual([]);
    const rays = buildStudioRegionDistanceRays({
      embeddings: [a, b],
      coords: view.coords,
      regionOverlays: view.regionOverlays,
      regions,
      hiddenRegionIds: ["region-2"],
      selectedPointId: "p1",
    });
    expect(rays).toHaveLength(2);
    expect(rays.every((ray) => ray.regionId === "region-1")).toBe(true);
    const ada = rays.find((ray) => ray.pointId === "p1")!;
    const bea = rays.find((ray) => ray.pointId === "p2")!;
    expect(ada.highDimL2).toBe(0);
    expect(bea.highDimL2).toBeCloseTo(l2Distance(b.vector, a.vector), 6);
    const projected = Math.hypot(bea.x2 - bea.x1, bea.y2 - bea.y1);
    expect(bea.highDimL2).not.toBeCloseTo(projected, 5);
    expect(ada.selected).toBe(true);
    expect(bea.selected).toBe(false);
    expect(formatStudioHighDimDistance(0.28416)).toBe("0.2842");
    expect(hiddenStudioRegionIdsForFocus(["region-1", "region-2"], "region-1")).toEqual([
      "region-2",
    ]);
    expect(hiddenStudioRegionIdsForFocus(["region-1", "region-2"], "")).toEqual([]);
    expect(ada.inRegion).toBe(true);
    expect(bea.inRegion).toBe(false);
    expect(
      studioPointInsideHighDimRegion(a.vector, {
        centroid: a.vector,
        cosine_threshold: 0.99,
      }),
    ).toBe(true);
    expect(
      studioPointInsideHighDimRegion(b.vector, {
        centroid: a.vector,
        cosine_threshold: 0.99,
      }),
    ).toBe(false);
    const members = studioHighDimRegionMembership({
      embeddings: [a, b],
      regions,
      hiddenRegionIds: ["region-2"],
    });
    expect(members.get("p1")?.inRegion).toBe(true);
    expect(members.get("p2")?.inRegion).toBe(false);
  });

  it("includes play-copy Learn rows and drops authored maps", () => {
    const play = studioRow({
      id: "play-1",
      flowKind: "learn",
      prompt: "played copy",
      workspaceId: "copy-1",
      isPlayCopy: true,
      ownerUserId: "me",
      userId: "me",
    });
    const ownAuthored = studioRow({
      id: "own-1",
      flowKind: "learn",
      prompt: "I played my map",
      workspaceId: "authored-1",
      isPlayCopy: false,
      ownerUserId: "me",
      userId: "me",
    });
    const buyer = studioRow({
      id: "buyer-1",
      flowKind: "learn",
      prompt: "buyer session",
      workspaceId: "authored-1",
      isPlayCopy: false,
      ownerUserId: "me",
      userId: "buyer",
    });
    const scoped = scopeLearningStudioEmbeddings([play, ownAuthored, buyer], {
      viewerUserId: "me",
      workspaces: [
        { id: "copy-1", owner_user_id: "me", is_play_copy: true },
        { id: "authored-1", owner_user_id: "me", is_play_copy: false },
      ],
    });
    expect(scoped.map((row) => row.id)).toEqual(["play-1"]);
    const presented = presentDashboardDataStudio({
      product: "learning",
      viewerUserId: "me",
      workspaces: [
        {
          id: "copy-1",
          title: "Copy",
          user_id: "me",
          workspace_kind: "standard",
          is_play_copy: true,
        },
        {
          id: "authored-1",
          title: "Sold map",
          user_id: "me",
          workspace_kind: "standard",
          is_play_copy: false,
        },
      ],
      embeddings: [play, ownAuthored, buyer],
    });
    expect(presented.embeddings.map((row) => row.id)).toEqual(["play-1"]);
    expect(presented.workspaces.map((row) => row.id)).toEqual(["copy-1"]);
    expect(presented.regions).toEqual([]);
  });

  it("excludes API-shaped authored Learn rows that have no user_id", () => {
    const playCopyWorkspace = {
      id: "copy-1",
      owner_user_id: "me",
      user_id: "me",
      is_play_copy: true,
    };
    const authoredWorkspace = {
      id: "authored-1",
      owner_user_id: "me",
      user_id: "me",
      is_play_copy: false,
    };
    const play = dashboardApiEmbedding({
      id: "play-api",
      flowKind: "learn",
      prompt: "played copy",
      workspaceId: "copy-1",
    });
    const authoredAnonymous = dashboardApiEmbedding({
      id: "authored-api",
      flowKind: "learn",
      prompt: "org play on sold map",
      workspaceId: "authored-1",
    });
    expect("user_id" in play).toBe(false);
    expect("user_id" in authoredAnonymous).toBe(false);
    expect(
      includeLearningStudioEmbedding({
        viewerUserId: "me",
        workspace: playCopyWorkspace,
        embedding: play,
      }),
    ).toBe(true);
    expect(
      includeLearningStudioEmbedding({
        viewerUserId: "me",
        workspace: authoredWorkspace,
        embedding: authoredAnonymous,
      }),
    ).toBe(false);
    const presented = presentDashboardDataStudio({
      product: "learning",
      viewerUserId: "me",
      workspaces: [
        {
          id: "copy-1",
          title: "Copy",
          user_id: "me",
          workspace_kind: "standard",
          is_play_copy: true,
        },
        {
          id: "authored-1",
          title: "Sold map",
          user_id: "me",
          workspace_kind: "standard",
          is_play_copy: false,
        },
      ],
      embeddings: [play, authoredAnonymous],
    });
    expect(presented.embeddings.map((row) => row.id)).toEqual(["play-api"]);
  });

  it("pans, zooms around a cursor, and hit-tests through the camera", () => {
    const panned = panStudioCamera(IDENTITY_STUDIO_CAMERA, 40, -12);
    expect(panned).toEqual({ x: 40, y: -12, scale: 1 });
    expect(studioCameraTransform(panned)).toBe("translate(40 -12) scale(1)");

    const zoomed = zoomStudioCamera(IDENTITY_STUDIO_CAMERA, {
      factor: 2,
      originX: 100,
      originY: 50,
    });
    expect(zoomed.scale).toBe(2);
    const world = studioScreenToWorld(IDENTITY_STUDIO_CAMERA, 100, 50);
    const worldAfter = studioScreenToWorld(zoomed, 100, 50);
    expect(worldAfter.x).toBeCloseTo(world.x);
    expect(worldAfter.y).toBeCloseTo(world.y);

    const clamped = zoomStudioCamera(IDENTITY_STUDIO_CAMERA, {
      factor: 1000,
      originX: 0,
      originY: 0,
    });
    expect(clamped.scale).toBe(16);

    expect(studioNiceGridStep(1)).toBeGreaterThan(0);
    expect(studioNiceGridStep(4)).toBeLessThan(studioNiceGridStep(1));
    const grid = studioGridLines({
      width: 400,
      height: 300,
      camera: zoomed,
    });
    expect(grid.step).toBeGreaterThan(0);
    expect(grid.lines.some((line) => line.axis === "x" && line.major)).toBe(true);
    expect(grid.lines.some((line) => line.axis === "y")).toBe(true);

    const points = [
      { id: "near", screenX: 80, screenY: 40 },
      { id: "far", screenX: 300, screenY: 200 },
    ];
    expect(
      hitTestStudioPoint(points, {
        screenX: 80,
        screenY: 40,
        camera: IDENTITY_STUDIO_CAMERA,
      }),
    ).toBe("near");
    const zoomedHit = zoomStudioCamera(IDENTITY_STUDIO_CAMERA, {
      factor: 2,
      originX: 80,
      originY: 40,
    });
    expect(
      hitTestStudioPoint(points, {
        screenX: 80,
        screenY: 40,
        camera: zoomedHit,
      }),
    ).toBe("near");
    expect(
      hitTestStudioPoint(points, {
        screenX: 0,
        screenY: 0,
        camera: IDENTITY_STUDIO_CAMERA,
        pixelRadius: 8,
      }),
    ).toBeNull();
  });
});

