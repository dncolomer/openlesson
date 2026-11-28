/**
 * Knowledge-region inspect helpers + overlay Data Studio retirement locks.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStudioProjectionView } from "@/lib/admin/data-studio";
import { createCustomVerificationModelFromVectors } from "@/lib/knowledge-config";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
} from "@/lib/flow-embedding";
import { encodeFlowEmbedding } from "@/lib/flow-embedding-encode";
import { cosineThresholdToL2, l2Distance, l2Normalize } from "@/lib/knowledge-config/math";
import { DASHBOARD_NAV_GROUPS } from "@/lib/dashboard-nav";
import {
  buildDataStudioProjectionView,
  buildStudioRegionDistanceRays,
  formatStudioHighDimDistance,
  hiddenStudioRegionIdsForFocus,
  filterStudioEmbeddings,
  studioHasSimulatedPoints,
  studioPointFill,
  STUDIO_HUMAN_FILL,
  STUDIO_SIMULATED_FILL,
  studioHighDimRegionMembership,
  studioPointInsideHighDimRegion,
  inspectStudioEmbedding,
  parseDataStudioSpace,
  DATA_STUDIO_SPACE_OPTIONS,
  dataStudioSpaceLabel,
  projectStudioEmbeddings2D,
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

const ROOT = join(__dirname, "../..");

function unitVector(seed: number): number[] {
  const v = Array.from({ length: FLOW_EMBEDDING_DIM }, (_, i) =>
    Math.sin(seed * 17 + i * 0.31) + 0.05,
  );
  return l2Normalize(v);
}

describe("studio projection + region geometry (shipped)", () => {
  it("buildStudioProjectionView yields finite screen coords and region radii", async () => {
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
});

describe("data studio overlay retired", () => {
  it("keeps knowledge-region inspect helpers and drops overlay chrome", async () => {
    expect(existsSync(join(ROOT, "app/api/dashboard/data-studio/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/dashboard/data-studio/run/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "components/dashboard/dashboard-data-studio-tab.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/data-studio/DataStudioPanel.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/data-studio/DataStudioPlot.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/data-studio/DataStudioHud.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/data-studio-camera.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/data-studio-explainer.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/workspace/data-studio/pow/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/admin"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/admin"))).toBe(false);

    expect(existsSync(join(ROOT, "components/data-studio/DataStudioInspect.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/data-studio/StudioMultiSelect.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/dashboard/knowledge-regions/run/route.ts"))).toBe(true);
    const inspect = readFileSync(join(ROOT, "components/data-studio/DataStudioInspect.tsx"), "utf8");
    expect(inspect).toContain("export function DataStudioInspectFields");
    expect(inspect).not.toContain("export function DataStudioInspect(");
    expect(inspect).toContain("data-data-studio-speech");
    expect(inspect).toContain("data-stored-record");
    expect(inspect).toContain("Stored capture");
    const select = readFileSync(join(ROOT, "components/data-studio/StudioMultiSelect.tsx"), "utf8");
    expect(select).toContain("data-data-studio-select-search");
    expect(select).toContain("data-data-studio-select-option");
    const run = readFileSync(join(ROOT, "app/api/dashboard/knowledge-regions/run/route.ts"), "utf8");
    expect(run).toContain("flowPowFromWorkspaceRow");
    expect(run).toContain("extractStudioSpeechTranscripts");
    expect(run).toContain("presentStoredRecord");
    expect(run).toContain("xai_file_id");
    expect(run).toContain("requireAuthenticatedUser");
    expect(run).toContain("runId is required");
    expect(run).toContain('eq("owner_user_id", auth.user.id)');
    expect(existsSync(join(ROOT, "app/api/dashboard/knowledge-regions/file/route.ts"))).toBe(true);
    const page = readFileSync(join(ROOT, "components/product-flow/knowledge-region-page.tsx"), "utf8");
    expect(page).toContain("DASHBOARD_KNOWLEDGE_REGION_RUN_PATH");
    expect(page).not.toContain("Open in Data Studio");
    const dash = readFileSync(join(ROOT, "app/dashboard/page.tsx"), "utf8");
    expect(dash).not.toContain("DashboardDataStudioTab");
    expect(dash).toContain("DashboardKnowledgeRegionsTab");
    expect(existsSync(join(ROOT, "lib/workspace-sections.ts"))).toBe(false);
    expect(
      DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label)),
    ).not.toContain("Data Studio");
  });
});

async function studioRow(input: {
  id: string;
  flowKind?: string;
  flowId?: string | null;
  runId?: string | null;
  identity?: string | null;
  source?: string | null;
  prompt: string;
  workspaceId?: string;
  userId?: string | null;
  isPlayCopy?: boolean;
  ownerUserId?: string;
}) : Promise<DataStudioEmbeddingRow> {
  const record = await encodeFlowEmbedding({
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
    source: input.source ?? null,
    vector: record.vector,
    vector_path_text: record.vector_path_text,
    channel_vectors: record.channel_vectors,
    raw: record.raw,
    embedding_model_id: record.embedding_model_id,
    created_at: "2026-10-01T00:00:00.000Z",
    user_id: input.userId ?? null,
    is_play_copy: input.isPlayCopy ?? false,
    owner_user_id: input.ownerUserId ?? "me",
  };
}

describe("studio flow/run filters, inspect, projection", () => {
  it("keeps all-together, drops other flows and runs, and retains identity", async () => {
    const ada = await studioRow({ id: "e1", flowId: "flow-a", runId: "run-1", identity: "ada", prompt: "a" });
    const bea = await studioRow({
      id: "e2",
      flowId: "flow-a",
      runId: "run-2",
      identity: "bea",
      prompt: "b",
    });
    const other = await studioRow({
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

  it("inspects vector, raw, proof of work, and transcripts from a stored embedding", async () => {
    const row = await studioRow({
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
    expect(pathText?.space).toBe("path");
    expect(pathText?.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(pathText?.vector).toEqual(row.vector);
    expect(pathText?.speech).toContain("spoken proof of limits");
    expect(inspect?.raw).toEqual(row.raw);
    expect(inspect?.pow.length).toBeGreaterThan(0);
    expect(inspect?.transcripts).toContain("spoken proof of limits");
    expect(inspect?.speech).toContain("spoken proof of limits");
  });

  it("pulls voice transcripts from transcript_snapshot and session transcript payloads", async () => {
    const snapshot = await studioRow({
      id: "snap-1",
      prompt: "ignored payload json",
    });
    snapshot.raw = (
      await encodeFlowEmbedding({
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
      })
    ).raw;
    const inspect = inspectStudioEmbedding(snapshot);
    expect(inspect?.speech).toEqual([
      "I am thinking about limits out loud",
      "the derivative is the slope",
    ]);
  });

  it("projects two algorithms to finite 2D and overlays region disks in the same frame", async () => {
    const a = await studioRow({ id: "p1", prompt: "alpha", identity: "ada" });
    const b = await studioRow({ id: "p2", prompt: "beta", identity: "bea", runId: "run-2" });
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
    expect(view.coords[0].origin).toBe("human");
  });

  it("maps the cosine ball wider than a tight cohort disk so 2D overlay can disagree with membership", async () => {
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

  it("offers Path only and overlays Path regions", async () => {
    expect(DATA_STUDIO_SPACE_OPTIONS).toEqual([{ id: "path", label: "Path" }]);
    expect(dataStudioSpaceLabel("path")).toBe("Path");
    expect(dataStudioSpaceLabel("path_text")).toBe("Path");
    expect(parseDataStudioSpace("path_text")).toBe("path");
    expect(parseDataStudioSpace("nope")).toBe("path");
    const a = await studioRow({ id: "p1", prompt: "alpha spoken", identity: "ada" });
    const b = await studioRow({ id: "p2", prompt: "beta spoken", identity: "bea", runId: "run-2" });
    expect(studioEmbeddingVector(a, "path")).toEqual(studioEmbeddingVector(b, "path"));
    expect(studioEmbeddingVector(a, "path_text")).toEqual(studioEmbeddingVector(a, "path"));
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
        centroid: studioEmbeddingVector(a, "path"),
        mean_radius: 0.25,
        cosine_threshold: 0.5,
        embedding_model_id: FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
      },
    ];
    expect(studioRegionsForSpace(pathRegions, "path").map((region) => region.id)).toEqual([
      "path-region",
    ]);
    expect(studioRegionsForSpace(pathRegions, "path_text").map((region) => region.id)).toEqual([
      "path-region",
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
    expect(textView.regionOverlays.map((region) => region.id)).toEqual(["path-region"]);
    expect(pathView.coords[0].screenX).toBe(pathView.coords[1].screenX);
    expect(textView.coords[0].screenX).toBe(textView.coords[1].screenX);
  });

  it("labels dashed rays with high-dim L2 and hides selected regions", async () => {
    const aVec = unitVector(1);
    const bVec = unitVector(99);
    const a = {
      ...await studioRow({ id: "p1", prompt: "alpha", identity: "ada" }),
      vector: aVec,
      vector_path_text: aVec,
      channel_vectors: { path: aVec },
      raw: undefined,
    };
    const b = {
      ...await studioRow({ id: "p2", prompt: "beta", identity: "bea", runId: "run-2" }),
      vector: bVec,
      vector_path_text: bVec,
      channel_vectors: { path: bVec },
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
    expect(
      hiddenStudioRegionIdsForFocus(
        [
          { id: "parent", name: "Limits styles" },
          { id: "cluster", name: "Limits styles · Exploit-heavy" },
          { id: "other", name: "Bayes" },
        ],
        "parent",
      ),
    ).toEqual(["other"]);
    const simulated = await studioRow({
      id: "sim-1",
      identity: "Simulated · Exploit-heavy",
      source: "simulated",
      prompt: "agent walk",
    });
    expect(studioHasSimulatedPoints([a, simulated])).toBe(true);
    expect(studioPointFill({ origin: "simulated", colorByOrigin: true })).toBe(
      STUDIO_SIMULATED_FILL,
    );
    expect(studioPointFill({ origin: "human", colorByOrigin: true })).toBe(STUDIO_HUMAN_FILL);
    expect(inspectStudioEmbedding(simulated)?.origin).toBe("simulated");
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
});

