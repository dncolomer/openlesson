"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { StudioMultiSelect } from "@/components/data-studio/StudioMultiSelect";
import { KnowledgeRegionInspect } from "@/components/product-flow/knowledge-region-inspect";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_DANGER_BTN,
  FLOW_FORM_INPUT,
  FLOW_FORM_LABEL,
  FLOW_FORM_TEXTAREA,
  FLOW_GHOST_BTN,
  FLOW_PRIMARY_BTN,
  FlowFormCard,
  FlowFormHeader,
} from "@/components/product-flow/product-flow-form";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import {
  DASHBOARD_KNOWLEDGE_REGION_RUN_PATH,
  STUDIO_HUMAN_FILL,
  STUDIO_SIMULATED_FILL,
  buildDataStudioProjectionView,
  inspectStudioEmbedding,
  mergeStudioInspectPow,
  type DataStudioInspectPayload,
} from "@/lib/data-studio-view";
import {
  parseProjectionAlgorithmId,
  PROJECTION_ALGORITHM_OPTIONS,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import {
  clampKnowledgeRegionFigurePan,
  clusterVisibleInKnowledgeRegion,
  diamondGlyphPoints,
  KNOWLEDGE_REGION_ANALYSIS_FILL,
  KNOWLEDGE_REGION_FIGURE_ZOOM_FIT,
  KNOWLEDGE_REGION_MAP_SIZE,
  knowledgeRegionAnalysisPointLabel,
  knowledgeRegionFigureMode,
  knowledgeRegionFigureSpace,
  knowledgeRegionFigureTrack,
  knowledgeRegionFigureFocusOnPoints,
  knowledgeRegionFigureLabelOffset,
  knowledgeRegionFigureLabelScale,
  knowledgeRegionFigureLabelTransform,
  knowledgeRegionFigureOverviewLabels,
  knowledgeRegionFigureShowSegmentLabel,
  knowledgeRegionFigureStepLabelOffset,
  knowledgeRegionFigureViewBox,
  knowledgeRegionFigureZoomIn,
  knowledgeRegionFigureZoomOut,
  knowledgeRegionIdentityKey,
  knowledgeRegionIdentityLabel,
  knowledgeRegionIdentityOptions,
  knowledgeRegionSampleIdForIdentity,
  knowledgeRegionUnsysDistance,
  knowledgeRegionVisibleIdsFromSelection,
  parseKnowledgeRegionFigureMode,
  parseKnowledgeRegionFigureSpace,
  parseKnowledgeRegionFigureTrack,
  presentKnowledgeRegionClusterDistances,
  presentKnowledgeRegionFigure,
  resolveKnowledgeRegionPointKind,
  type KnowledgeRegionFigureMode,
  type KnowledgeRegionFigureSpace,
  type KnowledgeRegionFigureTrack,
  type KnowledgeRegionPointKind,
} from "@/lib/knowledge-region-figure";
import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  DASHBOARD_KNOWLEDGE_REGIONS_PATH,
  dashboardKnowledgeRegionSimulationPath,
} from "@/lib/dashboard-knowledge-regions";
import {
  EXPLORATION_STRATEGIES,
  explorationStrategyFromSimulatedEmbedding,
  parseCustomExplorationStrategy,
  REGION_SIMULATION_DEFAULT_SAMPLES,
  REGION_SIMULATION_MAX_SAMPLES,
  REGION_SIMULATION_MIN_SAMPLES,
  type ExplorationStrategyId,
} from "@/lib/region-simulation";
import {
  type KnowledgeRegionDetails,
  type KnowledgeRegionDetailsSample,
} from "@/lib/knowledge-region-details";
import { productFlowKindLabel, type ProductFlowKind } from "@/lib/product-flow";
import { parseLtiRosterNames } from "@/lib/lti/nrps";

const FIGURE_SCREEN = {
  width: KNOWLEDGE_REGION_MAP_SIZE,
  height: KNOWLEDGE_REGION_MAP_SIZE,
  margin: 36,
};

const CONTROL_SELECT =
  "h-7 w-full min-w-0 border border-white/20 bg-black px-2 font-mono text-[11px] text-white outline-none focus:border-white/55";
const MODE_BTN =
  "h-7 flex-1 border text-[10px] uppercase tracking-[0.14em]";
const MODE_ON = `${MODE_BTN} border-white bg-white/10 text-white`;
const MODE_OFF = `${MODE_BTN} border-white/20 text-neutral-500 hover:text-white`;
const ZOOM_BTN =
  "h-7 min-w-7 border border-white/25 bg-black/70 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:border-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40";
const POINT_KIND_IDS: readonly KnowledgeRegionPointKind[] = [
  "simulated",
  "cohort",
  "analysis",
];

function toggleId<T extends string>(current: readonly T[], id: T): T[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

export function KnowledgeRegionPage({
  kind,
  regionId,
  detailsUrl,
  mode = "view",
}: {
  kind: ProductFlowKind;
  regionId: string;
  detailsUrl?: string;
  mode?: "view" | "edit";
}) {
  const router = useRouter();
  const productLabel = productFlowKindLabel(kind);
  const [details, setDetails] = useState<KnowledgeRegionDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleClusterIds, setVisibleClusterIds] = useState<string[] | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [visiblePointKinds, setVisiblePointKinds] = useState<KnowledgeRegionPointKind[]>([
    "simulated",
  ]);
  const [algorithm, setAlgorithm] = useState<ProjectionAlgorithmId>("pca");
  const [figureMode, setFigureMode] = useState<KnowledgeRegionFigureMode>("individual");
  const [figureZoom, setFigureZoom] = useState(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT);
  const [figurePan, setFigurePan] = useState({ x: 0, y: 0 });
  const figureFrameRef = useRef<HTMLDivElement | null>(null);
  const figureDragRef = useRef<{
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const figurePannedRef = useRef(false);
  const [runPow, setRunPow] = useState<FlowPowRow[]>([]);
  const [rosterNames, setRosterNames] = useState<Record<string, string>>({});
  const [addStrategyIds, setAddStrategyIds] = useState<ExplorationStrategyId[]>([]);
  const [customName, setCustomName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [customStrategies, setCustomStrategies] = useState<
    Array<{ id: ExplorationStrategyId; name: string; instructions: string }>
  >([]);
  const [addSamples, setAddSamples] = useState(REGION_SIMULATION_DEFAULT_SAMPLES);
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState("");
  const figureSpace = knowledgeRegionFigureSpace(figureMode);
  const figureTrack = knowledgeRegionFigureTrack(figureMode);

  const loadDetails = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ kind });
    const href =
      detailsUrl ||
      `${DASHBOARD_KNOWLEDGE_REGIONS_PATH}/${encodeURIComponent(regionId)}?${params}`;
    void fetch(href)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(payload, "Could not load knowledge region"));
        }
        const next = payload.details as KnowledgeRegionDetails | undefined;
        if (!cancelled) {
          setDetails(next && next.id ? next : null);
          setRosterNames(parseLtiRosterNames(payload.rosterNames));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetails(null);
          setRosterNames({});
          setError(err instanceof Error ? err.message : "Could not load knowledge region");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, regionId, detailsUrl]);

  useEffect(() => {
    return loadDetails();
  }, [loadDetails]);

  const clusterIds = useMemo(
    () => (details?.clusters ?? []).map((cluster) => cluster.id),
    [details?.clusters],
  );

  const samples = useMemo(() => {
    const listed = details?.samples ?? [];
    return listed.filter((sample) => {
      if (!visiblePointKinds.includes(sample.pointKind)) return false;
      if (
        sample.clusterId &&
        !clusterVisibleInKnowledgeRegion(sample.clusterId, visibleClusterIds)
      ) {
        return sample.pointKind !== "simulated";
      }
      return true;
    });
  }, [details?.samples, visibleClusterIds, visiblePointKinds]);

  const identityPoints = useMemo(
    () =>
      samples.map((sample) => ({
        id: sample.id,
        identity: sample.identity,
        createdAt: sample.embedding.created_at ?? null,
      })),
    [samples],
  );

  const identityOptions = useMemo(
    () => knowledgeRegionIdentityOptions(identityPoints, rosterNames),
    [identityPoints, rosterNames],
  );

  const selectedSample: KnowledgeRegionDetailsSample | null =
    samples.find((sample) => sample.id === selectedSampleId) ?? null;
  const selectedIdentityKey = selectedSample
    ? knowledgeRegionIdentityKey(selectedSample)
    : "";

  const inspect: DataStudioInspectPayload | null = useMemo(() => {
    const base = inspectStudioEmbedding(selectedSample?.embedding);
    if (!base) return null;
    return runPow.length ? mergeStudioInspectPow(base, runPow) : base;
  }, [runPow, selectedSample]);

  const clusterDistances = useMemo(() => {
    if (!details || !selectedSample) return [];
    return presentKnowledgeRegionClusterDistances({
      vector: selectedSample.embedding.vector,
      clusters: details.clusters,
      regions: details.regions,
    });
  }, [details, selectedSample]);

  useEffect(() => {
    if (!selectedSample?.workspace_id && !selectedSample?.run_id) {
      setRunPow([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedSample.workspace_id) params.set("workspaceId", selectedSample.workspace_id);
    if (selectedSample.run_id) params.set("runId", selectedSample.run_id);
    void fetch(`${DASHBOARD_KNOWLEDGE_REGION_RUN_PATH}?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { pow?: FlowPowRow[] };
        if (!cancelled && response.ok && Array.isArray(body.pow)) {
          setRunPow(body.pow);
        }
      })
      .catch(() => {
        if (!cancelled) setRunPow([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSample?.id, selectedSample?.run_id, selectedSample?.workspace_id]);

  useEffect(() => {
    if (selectedSample && !visiblePointKinds.includes(selectedSample.pointKind)) {
      setSelectedSampleId(null);
    }
  }, [selectedSample, visiblePointKinds]);

  const projection = useMemo(() => {
    if (!details?.embeddings.length) return null;
    return buildDataStudioProjectionView({
      embeddings: details.embeddings,
      regions: details.regions,
      algorithm,
      screen: FIGURE_SCREEN,
    });
  }, [algorithm, details]);

  const figure = useMemo(() => {
    if (!details || !projection) return null;
    const parentOverlay = projection.regionOverlays.find((region) => region.id === details.id);
    return presentKnowledgeRegionFigure({
      points: projection.coords.map((point) => {
        const sample = details.samples.find((row) => row.id === point.id);
        return {
          id: point.id,
          x: point.screenX,
          y: point.screenY,
          origin: point.origin,
          clusterId: sample?.clusterId ?? null,
          identity: point.identity,
          pointKind: sample?.pointKind,
          vector: sample?.embedding.vector ?? null,
          createdAt: sample?.embedding.created_at ?? null,
          unsysDistance: knowledgeRegionUnsysDistance(sample?.embedding.raw),
        };
      }),
      clusters: details.clusters.map((cluster) => ({
        id: cluster.id,
        strategyName: cluster.strategyName,
        vector: details.regions.find((region) => region.id === cluster.id)?.centroid ?? null,
      })),
      parent: {
        id: details.id,
        name: details.name,
        center: parentOverlay
          ? { x: parentOverlay.screenX, y: parentOverlay.screenY }
          : null,
      },
      visiblePointKinds,
      analysisLabel: knowledgeRegionAnalysisPointLabel(details.kind),
      visibleClusterIds,
      selectedPointId: selectedSampleId,
      mode: figureMode,
    });
  }, [details, figureMode, projection, selectedSampleId, visibleClusterIds, visiblePointKinds]);

  const pathIds = useMemo(
    () => new Set((figure?.path?.steps ?? []).map((step) => step.id)),
    [figure?.path],
  );

  const figureViewBox = useMemo(
    () =>
      knowledgeRegionFigureViewBox({
        size: figure?.map.size ?? KNOWLEDGE_REGION_MAP_SIZE,
        zoom: figureZoom,
        panX: figurePan.x,
        panY: figurePan.y,
      }),
    [figure?.map.size, figurePan.x, figurePan.y, figureZoom],
  );
  const overviewLabels = knowledgeRegionFigureOverviewLabels(figureZoom);
  const pointLabelReach = knowledgeRegionFigureLabelOffset(figureZoom);

  function applyFigureZoom(next: number) {
    setFigureZoom(next);
    setFigurePan((pan) => ({
      x: clampKnowledgeRegionFigurePan(pan.x, KNOWLEDGE_REGION_MAP_SIZE, next),
      y: clampKnowledgeRegionFigurePan(pan.y, KNOWLEDGE_REGION_MAP_SIZE, next),
    }));
  }

  function fitFigure() {
    setFigureZoom(KNOWLEDGE_REGION_FIGURE_ZOOM_FIT);
    setFigurePan({ x: 0, y: 0 });
  }

  function focusIdentity() {
    const key =
      selectedIdentityKey ||
      (selectedSample ? knowledgeRegionIdentityKey(selectedSample) : "") ||
      identityOptions[0]?.id ||
      "";
    if (!key) return;
    if (figureTrack !== "path") setTrack("path");
    if (key !== selectedIdentityKey) selectIdentity(key);
    const points = (figure?.glyphs ?? []).filter(
      (point) => knowledgeRegionIdentityKey(point) === key,
    );
    const camera = knowledgeRegionFigureFocusOnPoints(
      points,
      figure?.map.size ?? KNOWLEDGE_REGION_MAP_SIZE,
    );
    setFigureZoom(camera.zoom);
    setFigurePan({ x: camera.panX, y: camera.panY });
  }

  function onFigurePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (figureZoom <= KNOWLEDGE_REGION_FIGURE_ZOOM_FIT || event.button !== 0) return;
    figurePannedRef.current = false;
    figureDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      panX: figurePan.x,
      panY: figurePan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onFigurePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = figureDragRef.current;
    const frame = figureFrameRef.current;
    if (!drag || !frame) return;
    const width = frame.clientWidth || 1;
    const scale = figureViewBox.width / width;
    const nextX = drag.panX - (event.clientX - drag.clientX) * scale;
    const nextY = drag.panY - (event.clientY - drag.clientY) * scale;
    if (
      Math.abs(event.clientX - drag.clientX) > 3 ||
      Math.abs(event.clientY - drag.clientY) > 3
    ) {
      figurePannedRef.current = true;
    }
    setFigurePan({
      x: clampKnowledgeRegionFigurePan(nextX, KNOWLEDGE_REGION_MAP_SIZE, figureZoom),
      y: clampKnowledgeRegionFigurePan(nextY, KNOWLEDGE_REGION_MAP_SIZE, figureZoom),
    });
  }

  function onFigurePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (figureDragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    figureDragRef.current = null;
  }

  function selectIdentity(key: string) {
    const id = knowledgeRegionSampleIdForIdentity({
      points: identityPoints,
      identityKey: key,
      currentId: selectedSampleId,
    });
    if (id) setSelectedSampleId(id);
  }

  function setMode(next: KnowledgeRegionFigureMode) {
    const mode = parseKnowledgeRegionFigureMode(next);
    setFigureMode(mode);
    if (knowledgeRegionFigureTrack(mode) !== "path" || selectedSampleId) return;
    const first = identityOptions[0];
    if (first) selectIdentity(first.id);
  }

  function setSpace(next: KnowledgeRegionFigureSpace) {
    setMode(
      knowledgeRegionFigureMode(parseKnowledgeRegionFigureSpace(next), figureTrack),
    );
  }

  function setTrack(next: KnowledgeRegionFigureTrack) {
    setMode(
      knowledgeRegionFigureMode(figureSpace, parseKnowledgeRegionFigureTrack(next)),
    );
  }

  const simulationPath = dashboardKnowledgeRegionSimulationPath(regionId);
  const catalogStrategyIds = new Set(EXPLORATION_STRATEGIES.map((row) => row.id));
  const existingCustomStrategies = (details?.strategies ?? []).filter(
    (row) => row.id && !catalogStrategyIds.has(row.id),
  );
  const recoveredCustomStrategies = (() => {
    const seen = new Set<string>();
    const out: Array<{ id: ExplorationStrategyId; name: string; instructions: string }> = [];
    for (const sample of details?.samples ?? []) {
      const strategy = explorationStrategyFromSimulatedEmbedding(sample.embedding);
      if (!strategy || catalogStrategyIds.has(strategy.id) || seen.has(strategy.id)) continue;
      if (!strategy.instructions) continue;
      seen.add(strategy.id);
      out.push({
        id: strategy.id,
        name: strategy.name,
        instructions: strategy.instructions,
      });
    }
    return out;
  })();
  function addCustomStrategy() {
    const parsed = parseCustomExplorationStrategy({
      name: customName,
      instructions: customInstructions,
    });
    if (!parsed) return;
    setCustomStrategies((current) =>
      current.some((row) => row.id === parsed.id) ? current : [...current, parsed],
    );
    setAddStrategyIds((current) =>
      current.includes(parsed.id) ? current : [...current, parsed.id],
    );
    setCustomName("");
    setCustomInstructions("");
  }

  async function mutateSimulation(body: Record<string, unknown>): Promise<void> {
    setSimBusy(true);
    setSimError("");
    try {
      const response = await fetch(simulationPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not add simulated samples"));
      }
      loadDetails();
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Could not update simulated data");
    } finally {
      setSimBusy(false);
    }
  }

  async function trashRegion(): Promise<void> {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Trash this knowledge region? Data on the flows stays.")
    ) {
      return;
    }
    setSimBusy(true);
    setSimError("");
    try {
      const response = await fetch(
        `${DASHBOARD_KNOWLEDGE_REGIONS_PATH}/${encodeURIComponent(regionId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not trash knowledge region"));
      }
      router.push("/dashboard?tab=regions");
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Could not trash knowledge region");
      setSimBusy(false);
    }
  }

  return (
    <ProductSurface
      label={`${productLabel} knowledge region`}
      activeTab={dashboardTabForProductSurface(kind, "region")}
    >
      <div
        className="mx-auto min-h-[32rem] w-full max-w-5xl space-y-6"
        data-knowledge-region-details={kind}
        data-knowledge-region-mode={mode}
      >
          <FlowFormHeader
            backHref="/dashboard?tab=regions"
            backLabel="Back to knowledge regions"
            title={
              details
                ? mode === "edit"
                  ? `Edit ${details.name}`
                  : details.name
                : loading
                  ? "Knowledge region"
                  : "Region not found"
            }
            description={
              mode === "edit"
                ? "Add another simulation round. Trashing the region leaves flow data in place."
                : details?.description ||
                  (loading
                    ? `Loading this ${productLabel.toLowerCase()} region.`
                    : `This ${productLabel.toLowerCase()} knowledge region could not be opened.`)
            }
            extra={
              details && mode === "view" ? (
                <div className="mt-6 space-y-4">
                  <details
                    className="border border-white/15"
                    data-knowledge-region-summary=""
                  >
                    <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                      Region details
                    </summary>
                    <dl className="grid gap-4 border-t border-white/10 px-3 py-3 text-sm text-neutral-300 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <dt className={FLOW_FORM_LABEL}>Flows</dt>
                        <dd className="mt-1 text-white">
                          {details.flows.map((flow) => flow.name).join(", ") || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className={FLOW_FORM_LABEL}>Strategies</dt>
                        <dd className="mt-1 text-white">
                          {details.strategies.map((row) => row.name).join(", ") || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className={FLOW_FORM_LABEL}>Samples per strategy</dt>
                        <dd className="mt-1 text-white">{details.samplesPerStrategy || "—"}</dd>
                      </div>
                      <div>
                        <dt className={FLOW_FORM_LABEL}>Simulated samples</dt>
                        <dd className="mt-1 text-white">{details.simulatedCount}</dd>
                      </div>
                      <div>
                        <dt className={FLOW_FORM_LABEL}>Reference</dt>
                        <dd className="mt-1 text-white">{details.cohortCount}</dd>
                      </div>
                      <div>
                        <dt className={FLOW_FORM_LABEL}>
                          {knowledgeRegionAnalysisPointLabel(details.kind)}
                        </dt>
                        <dd className="mt-1 text-white">{details.analysisCount}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
              ) : null
            }
          />

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          {loading ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Loading
            </p>
          ) : details ? (
            <>
              {mode === "edit" ? (
              <FlowFormCard data-knowledge-region-simulation="" data-knowledge-region-edit="">
                <div className="space-y-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                      Simulated data
                    </p>
                    <p className="mt-1 text-sm text-neutral-400">
                      Add another simulation round to this region, including a custom behaviour
                      strategy. Simulated and human data stay on the flows if you trash the
                      region.
                    </p>
                  </div>
                  <fieldset className="space-y-2" data-knowledge-region-add-strategies="">
                    <legend className={FLOW_FORM_LABEL}>Add exploration strategies</legend>
                    {EXPLORATION_STRATEGIES.map((strategy) => (
                      <label
                        key={strategy.id}
                        className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                      >
                        <input
                          type="checkbox"
                          checked={addStrategyIds.includes(strategy.id)}
                          onChange={() => setAddStrategyIds(toggleId(addStrategyIds, strategy.id))}
                          data-knowledge-region-add-strategy={strategy.id}
                        />
                        <span>
                          <span className="block">{strategy.name}</span>
                          <span className="block text-xs text-neutral-400">{strategy.description}</span>
                        </span>
                      </label>
                    ))}
                    {existingCustomStrategies.map((strategy) => (
                      <label
                        key={strategy.id}
                        className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                      >
                        <input
                          type="checkbox"
                          checked={addStrategyIds.includes(strategy.id)}
                          onChange={() => setAddStrategyIds(toggleId(addStrategyIds, strategy.id))}
                          data-knowledge-region-add-strategy={strategy.id}
                        />
                        <span>{strategy.name}</span>
                      </label>
                    ))}
                    {customStrategies.map((strategy) => (
                      <label
                        key={strategy.id}
                        className="flex cursor-pointer items-start gap-3 border border-white/20 px-3 py-2 text-sm text-white"
                        data-knowledge-region-custom-strategy={strategy.id}
                      >
                        <input
                          type="checkbox"
                          checked={addStrategyIds.includes(strategy.id)}
                          onChange={() => setAddStrategyIds(toggleId(addStrategyIds, strategy.id))}
                          data-knowledge-region-add-strategy={strategy.id}
                        />
                        <span>
                          <span className="block">{strategy.name}</span>
                          <span className="block text-xs text-neutral-400">{strategy.instructions}</span>
                        </span>
                      </label>
                    ))}
                    <div className="space-y-2 border border-dashed border-white/20 px-3 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                        Custom strategy
                      </p>
                      <input
                        value={customName}
                        onChange={(event) => setCustomName(event.target.value)}
                        placeholder="Strategy name"
                        data-knowledge-region-custom-name=""
                        className={FLOW_FORM_INPUT}
                      />
                      <textarea
                        value={customInstructions}
                        onChange={(event) => setCustomInstructions(event.target.value)}
                        placeholder="Prompt for this exploration style"
                        rows={3}
                        data-knowledge-region-custom-instructions=""
                        className={FLOW_FORM_TEXTAREA}
                      />
                      <button
                        type="button"
                        disabled={!customName.trim() || !customInstructions.trim()}
                        onClick={addCustomStrategy}
                        data-knowledge-region-add-custom=""
                        className={FLOW_GHOST_BTN}
                      >
                        Add strategy
                      </button>
                    </div>
                  </fieldset>
                  <label className="block space-y-1">
                    <span className={FLOW_FORM_LABEL}>Samples per strategy</span>
                    <input
                      type="number"
                      min={REGION_SIMULATION_MIN_SAMPLES}
                      max={REGION_SIMULATION_MAX_SAMPLES}
                      value={addSamples}
                      onChange={(event) =>
                        setAddSamples(
                          Math.max(
                            REGION_SIMULATION_MIN_SAMPLES,
                            Math.min(
                              REGION_SIMULATION_MAX_SAMPLES,
                              Math.round(
                                Number(event.target.value) || REGION_SIMULATION_DEFAULT_SAMPLES,
                              ),
                            ),
                          ),
                        )
                      }
                      data-knowledge-region-add-samples=""
                      className={FLOW_FORM_INPUT}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={simBusy || !addStrategyIds.length}
                    data-knowledge-region-add-simulation=""
                    className={FLOW_PRIMARY_BTN}
                    onClick={() =>
                      void mutateSimulation({
                        strategyIds: addStrategyIds,
                        customStrategies: [
                          ...recoveredCustomStrategies,
                          ...customStrategies,
                        ].filter((row) => addStrategyIds.includes(row.id)),
                        samplesPerStrategy: addSamples,
                      })
                    }
                  >
                    {simBusy ? "Updating simulation…" : "Add simulated samples"}
                  </button>
                  {simError ? <p className="text-sm text-red-300">{simError}</p> : null}
                  {details.clusters.length ? (
                    <ul className="space-y-2" data-knowledge-region-edit-clusters="">
                      {details.clusters.map((cluster) => (
                        <li
                          key={cluster.id}
                          className="flex items-center justify-between gap-3 border border-white/15 px-3 py-2 text-sm text-white"
                        >
                          <span>
                            {cluster.strategyName}
                            <span className="ml-2 text-neutral-500">{cluster.sampleCount}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button
                    type="button"
                    disabled={simBusy}
                    data-knowledge-region-trash=""
                    className={FLOW_DANGER_BTN}
                    onClick={() => void trashRegion()}
                  >
                    Trash knowledge region
                  </button>
                </div>
              </FlowFormCard>
              ) : null}
              {mode === "view" && figure ? (
                <FlowFormCard className="overflow-hidden p-4 sm:p-5">
                  <div className="grid items-start gap-5 lg:grid-cols-[7fr_3fr]">
                  <div
                    ref={figureFrameRef}
                    className={`relative aspect-square w-full overflow-hidden bg-black ${
                      figureZoom > KNOWLEDGE_REGION_FIGURE_ZOOM_FIT ? "cursor-grab" : ""
                    }`}
                    data-knowledge-region-figure-frame=""
                    data-knowledge-region-figure-zoom={String(figureZoom)}
                    onPointerDown={onFigurePointerDown}
                    onPointerMove={onFigurePointerMove}
                    onPointerUp={onFigurePointerUp}
                    onPointerCancel={onFigurePointerUp}
                  >
                  <div
                    className="absolute right-2 top-2 z-10 flex gap-1"
                    data-knowledge-region-figure-zoom-controls=""
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={ZOOM_BTN}
                      data-knowledge-region-figure-zoom-out=""
                      aria-label="Zoom out"
                      disabled={figureZoom <= KNOWLEDGE_REGION_FIGURE_ZOOM_FIT}
                      onClick={() => applyFigureZoom(knowledgeRegionFigureZoomOut(figureZoom))}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={ZOOM_BTN}
                      data-knowledge-region-figure-zoom-fit=""
                      aria-label="Fit figure"
                      onClick={() => fitFigure()}
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      className={ZOOM_BTN}
                      data-knowledge-region-figure-zoom-in=""
                      aria-label="Zoom in"
                      onClick={() => applyFigureZoom(knowledgeRegionFigureZoomIn(figureZoom))}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={ZOOM_BTN}
                      data-knowledge-region-identity-focus=""
                      aria-label="Identity focus"
                      disabled={!selectedIdentityKey && !identityOptions[0]}
                      onClick={() => focusIdentity()}
                    >
                      Focus
                    </button>
                  </div>
                  <svg
                    viewBox={figureViewBox.value}
                    className="block h-full w-full"
                    data-knowledge-region-figure=""
                    data-knowledge-region-figure-mode={figureMode}
                    role="img"
                    aria-label={`${details.name} embedding map`}
                  >
                    <defs>
                      <clipPath id={`kr-disk-${details.id}`}>
                        <circle cx={figure.map.cx} cy={figure.map.cy} r={figure.map.radius} />
                      </clipPath>
                    </defs>
                    <circle
                      cx={figure.map.cx}
                      cy={figure.map.cy}
                      r={figure.map.radius}
                      fill="#070707"
                      stroke="rgba(255,255,255,0.42)"
                      strokeWidth={1.1}
                      data-knowledge-region-rim=""
                    />
                    <g data-knowledge-region-polar="">
                      {figure.grid.rings.map((r) => (
                        <circle
                          key={r}
                          cx={figure.grid.cx}
                          cy={figure.grid.cy}
                          r={r}
                          fill="none"
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth={r === figure.map.radius ? 0 : 0.75}
                        />
                      ))}
                      {figure.grid.spokes.map((spoke, index) => (
                        <line
                          key={index}
                          x1={spoke.x1}
                          y1={spoke.y1}
                          x2={spoke.x2}
                          y2={spoke.y2}
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth={0.7}
                        />
                      ))}
                    </g>
                    <g clipPath={`url(#kr-disk-${details.id})`}>
                      {figure.sections.map((section) => (
                        <path
                          key={section.clusterId}
                          d={section.path}
                          fill={section.color}
                          fillOpacity={0.16}
                          stroke={section.color}
                          strokeOpacity={0.55}
                          strokeWidth={1}
                          data-knowledge-region-section={section.clusterId}
                        />
                      ))}
                      {figure.contours.map((contour) => (
                        <path
                          key={`${contour.clusterId}-${contour.level}`}
                          d={contour.path}
                          fill={contour.color}
                          fillOpacity={0.07 + contour.level * 0.09}
                          fillRule="nonzero"
                          stroke={contour.color}
                          strokeOpacity={0.55 - contour.level * 0.1}
                          strokeWidth={1.05 - contour.level * 0.18}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          data-knowledge-region-contour={contour.clusterId}
                          data-knowledge-region-contour-level={contour.level}
                        />
                      ))}
                      {figure.rays.map((ray) => (
                        <g key={ray.clusterId} data-knowledge-region-ray={ray.clusterId}>
                          <line
                            x1={ray.x1}
                            y1={ray.y1}
                            x2={ray.x2}
                            y2={ray.y2}
                            stroke="rgba(255,255,255,0.45)"
                            strokeWidth={0.9}
                          />
                          {knowledgeRegionFigureShowSegmentLabel(
                            ray.x1,
                            ray.y1,
                            ray.x2,
                            ray.y2,
                            figureZoom,
                          ) ? (
                            <g
                              transform={knowledgeRegionFigureLabelTransform(
                                ray.midX,
                                ray.midY,
                                figureZoom,
                              )}
                              data-knowledge-region-figure-label="ray"
                            >
                              <rect
                                x={-18}
                                y={-8}
                                width={36}
                                height={14}
                                rx={3}
                                fill="#0b0b0b"
                                stroke="rgba(255,255,255,0.25)"
                              />
                              <text
                                x={0}
                                y={3}
                                textAnchor="middle"
                                fill="rgba(255,255,255,0.82)"
                                fontSize={9}
                                fontFamily="ui-monospace, monospace"
                              >
                                {ray.label}
                              </text>
                            </g>
                          ) : null}
                        </g>
                      ))}
                      {figure.path ? (
                        <g data-knowledge-region-path={figure.path.key}>
                          {figure.path.segments.map((segment) => (
                            <g
                              key={`${segment.fromId}:${segment.toId}`}
                              data-knowledge-region-path-segment={`${segment.fromId}:${segment.toId}`}
                            >
                              <line
                                x1={segment.x1}
                                y1={segment.y1}
                                x2={segment.x2}
                                y2={segment.y2}
                                stroke="rgba(255,255,255,0.72)"
                                strokeWidth={1.2}
                              />
                              {knowledgeRegionFigureShowSegmentLabel(
                                segment.x1,
                                segment.y1,
                                segment.x2,
                                segment.y2,
                                figureZoom,
                              ) ? (
                                <g
                                  transform={knowledgeRegionFigureLabelTransform(
                                    segment.midX,
                                    segment.midY,
                                    figureZoom,
                                  )}
                                  data-knowledge-region-figure-label="segment"
                                >
                                  <rect
                                    x={-18}
                                    y={-8}
                                    width={36}
                                    height={14}
                                    rx={3}
                                    fill="#0b0b0b"
                                    stroke="rgba(255,255,255,0.25)"
                                  />
                                  <text
                                    x={0}
                                    y={3}
                                    textAnchor="middle"
                                    fill="rgba(255,255,255,0.82)"
                                    fontSize={9}
                                    fontFamily="ui-monospace, monospace"
                                  >
                                    {segment.label}
                                  </text>
                                </g>
                              ) : null}
                            </g>
                          ))}
                          {figure.path.steps.map((step) => {
                            const offset = knowledgeRegionFigureStepLabelOffset(
                              step,
                              figure.path!.steps,
                              figureZoom,
                            );
                            return (
                              <g
                                key={step.id}
                                transform={knowledgeRegionFigureLabelTransform(
                                  step.x,
                                  step.y,
                                  figureZoom,
                                )}
                                data-knowledge-region-figure-label="step"
                                data-knowledge-region-path-step={step.id}
                              >
                                <text
                                  x={offset.x}
                                  y={offset.y}
                                  fill="rgba(255,255,255,0.9)"
                                  fontSize={9}
                                  fontFamily="ui-monospace, monospace"
                                >
                                  {step.index}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      ) : null}
                      {figure.glyphs.map((point) => {
                        const kind = resolveKnowledgeRegionPointKind(point);
                        const fill =
                          kind === "simulated"
                            ? STUDIO_SIMULATED_FILL
                            : kind === "analysis"
                              ? KNOWLEDGE_REGION_ANALYSIS_FILL
                              : STUDIO_HUMAN_FILL;
                        const open = point.glyph === "open-circle" || point.glyph === "open-diamond";
                        const selected = point.id === selectedSampleId;
                        const onPath = figureTrack !== "path" || pathIds.has(point.id);
                        const radius = selected ? 5.5 : 4.2;
                        const rosterName = knowledgeRegionIdentityLabel(
                          point.identity,
                          rosterNames,
                        );
                        const showRosterName = Boolean(
                          point.identity && rosterNames[String(point.identity).trim()],
                        );
                        return (
                          <g
                            key={point.id}
                            className="cursor-pointer"
                            opacity={onPath ? 1 : 0.22}
                            data-knowledge-region-figure-point={point.id}
                            data-knowledge-region-glyph={point.glyph}
                            data-knowledge-region-point-kind={kind}
                            data-knowledge-region-on-path={
                              figureTrack === "path" ? String(onPath) : undefined
                            }
                            onClick={() => {
                              if (figurePannedRef.current) return;
                              setSelectedSampleId(point.id);
                            }}
                          >
                            <title>{showRosterName ? rosterName : point.identity || point.id}</title>
                            {point.glyph === "diamond" || point.glyph === "open-diamond" ? (
                              <polygon
                                points={diamondGlyphPoints(point.x, point.y, radius)}
                                fill={open ? "none" : fill}
                                stroke={fill}
                                strokeWidth={open ? 1.35 : 1.05}
                              />
                            ) : (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={radius}
                                fill={open ? "none" : fill}
                                stroke={fill}
                                strokeWidth={open ? 1.35 : 1.05}
                              />
                            )}
                            {showRosterName && figureTrack !== "path" ? (
                              <g
                                transform={knowledgeRegionFigureLabelTransform(
                                  point.x,
                                  point.y,
                                  figureZoom,
                                )}
                                data-knowledge-region-figure-label="roster"
                                data-knowledge-region-roster-name={point.id}
                              >
                                <text
                                  x={pointLabelReach}
                                  y={3}
                                  fill="rgba(255,255,255,0.92)"
                                  fontSize={9}
                                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                                >
                                  {rosterName}
                                </text>
                              </g>
                            ) : null}
                          </g>
                        );
                      })}
                      {figure.centroids.map((centroid) => (
                        <g
                          key={centroid.id}
                          data-knowledge-region-center={centroid.id}
                          stroke={centroid.color}
                          strokeWidth={1.15}
                        >
                          <line
                            x1={centroid.x - 7}
                            y1={centroid.y}
                            x2={centroid.x + 7}
                            y2={centroid.y}
                          />
                          <line
                            x1={centroid.x}
                            y1={centroid.y - 7}
                            x2={centroid.x}
                            y2={centroid.y + 7}
                          />
                        </g>
                      ))}
                      {figure.focus ? (
                        <circle
                          cx={figure.focus.x}
                          cy={figure.focus.y}
                          r={11 * knowledgeRegionFigureLabelScale(figureZoom)}
                          fill="none"
                          stroke="white"
                          strokeWidth={1.35 * knowledgeRegionFigureLabelScale(figureZoom)}
                          data-knowledge-region-focus=""
                        />
                      ) : null}
                    </g>
                    {overviewLabels
                      ? figure.badges.map((badge) => (
                          <g
                            key={badge.id}
                            transform={knowledgeRegionFigureLabelTransform(
                              badge.x + badge.width / 2,
                              badge.y + 9,
                              figureZoom,
                            )}
                            data-knowledge-region-figure-label="badge"
                            data-knowledge-region-badge={badge.kind}
                            data-knowledge-region-cluster-label={
                              badge.kind === "cluster" ? badge.id : undefined
                            }
                          >
                            <rect
                              x={-badge.width / 2}
                              y={-9}
                              width={badge.width}
                              height={18}
                              rx={4}
                              fill="#101010"
                              stroke={badge.color}
                              strokeWidth={0.9}
                            />
                            <text
                              x={0}
                              y={3.5}
                              textAnchor="middle"
                              fill={badge.color}
                              fontSize={10}
                            >
                              {badge.label}
                            </text>
                          </g>
                        ))
                      : null}
                  </svg>
                  </div>
                  <div
                    className="space-y-2 border border-white/15 bg-black/50 px-3 py-2.5"
                    data-knowledge-region-controls=""
                  >
                    <div data-knowledge-region-figure-mode="">
                      <div data-knowledge-region-figure-space="">
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                          Space
                        </span>
                        <div
                          className="mt-0.5 flex flex-wrap gap-1"
                          role="tablist"
                          aria-label="Figure space"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={figureSpace === "full"}
                            className={figureSpace === "full" ? MODE_ON : MODE_OFF}
                            data-knowledge-region-figure-space-option="full"
                            onClick={() => setSpace("full")}
                          >
                            Full space
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={figureSpace === "quadrant"}
                            className={figureSpace === "quadrant" ? MODE_ON : MODE_OFF}
                            data-knowledge-region-figure-space-option="quadrant"
                            data-knowledge-region-figure-mode-option="quadrant"
                            onClick={() => setSpace("quadrant")}
                          >
                            Quadrants
                          </button>
                        </div>
                      </div>
                      <div className="mt-2" data-knowledge-region-figure-track="">
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                          Track
                        </span>
                        <div
                          className="mt-0.5 flex flex-wrap gap-1"
                          role="tablist"
                          aria-label="Figure track"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={figureTrack === "individual"}
                            className={figureTrack === "individual" ? MODE_ON : MODE_OFF}
                            data-knowledge-region-figure-track-option="individual"
                            data-knowledge-region-figure-mode-option="individual"
                            onClick={() => setTrack("individual")}
                          >
                            Individual
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={figureTrack === "path"}
                            className={figureTrack === "path" ? MODE_ON : MODE_OFF}
                            data-knowledge-region-figure-track-option="path"
                            data-knowledge-region-figure-mode-option="path"
                            onClick={() => setTrack("path")}
                          >
                            Path
                          </button>
                        </div>
                      </div>
                    </div>
                    {figureTrack === "path" ? (
                      <div className="flex min-w-0 w-full flex-col gap-1">
                      <label className="flex min-w-0 w-full flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                          Identity
                        </span>
                        <select
                          className={CONTROL_SELECT}
                          value={selectedIdentityKey}
                          onChange={(event) => selectIdentity(event.target.value)}
                          data-knowledge-region-identity=""
                        >
                          <option value="">Select identity</option>
                          {identityOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className={ZOOM_BTN}
                        data-knowledge-region-identity-focus=""
                        disabled={!selectedIdentityKey && !identityOptions[0]}
                        onClick={() => focusIdentity()}
                      >
                        Identity focus
                      </button>
                      </div>
                    ) : null}
                    {figureSpace === "quadrant" ? null : (
                    <label className="flex min-w-0 w-full flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                        Project
                      </span>
                      <select
                        className={CONTROL_SELECT}
                        value={algorithm}
                        onChange={(event) =>
                          setAlgorithm(parseProjectionAlgorithmId(event.target.value, "pca"))
                        }
                        data-knowledge-region-projection=""
                        data-projection-algorithm-select=""
                      >
                        {PROJECTION_ALGORITHM_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.shortLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    )}
                    <div data-knowledge-region-clusters="">
                      <StudioMultiSelect
                        label="Clusters"
                        compact
                        showSearch={details.clusters.length > 6}
                        options={details.clusters.map((cluster) => ({
                          id: cluster.id,
                          label: cluster.strategyName,
                        }))}
                        selected={visibleClusterIds ?? clusterIds}
                        onChange={(ids) =>
                          setVisibleClusterIds(
                            knowledgeRegionVisibleIdsFromSelection(ids, clusterIds),
                          )
                        }
                        emptyLabel="None"
                        allLabel="All clusters"
                        plural="clusters"
                        searchPlaceholder="Search clusters"
                        marker="data-knowledge-region-clusters"
                      />
                    </div>
                    <div
                      data-knowledge-region-legend=""
                      data-knowledge-region-show-real={String(
                        visiblePointKinds.includes("cohort") ||
                          visiblePointKinds.includes("analysis"),
                      )}
                    >
                      <StudioMultiSelect
                        label="Points"
                        compact
                        showSearch={false}
                        options={POINT_KIND_IDS.map((id) => ({
                          id,
                          label:
                            id === "analysis"
                              ? knowledgeRegionAnalysisPointLabel(details.kind)
                              : id === "cohort"
                                ? "Reference"
                                : "Simulated",
                        }))}
                        selected={visiblePointKinds}
                        onChange={(ids) =>
                          setVisiblePointKinds(
                            POINT_KIND_IDS.filter((id) => ids.includes(id)),
                          )
                        }
                        emptyLabel="None"
                        allLabel="All types"
                        plural="types"
                        marker="data-knowledge-region-legend"
                      />
                    </div>
                  </div>
                  </div>
                </FlowFormCard>
              ) : null}

              {mode === "view" && inspect && selectedSample ? (
                <KnowledgeRegionInspect
                  inspect={inspect}
                  sample={selectedSample}
                  distances={clusterDistances}
                  path={
                    figure?.path
                      ? {
                          ...figure.path,
                          label: knowledgeRegionIdentityLabel(figure.path.key, rosterNames),
                        }
                      : null
                  }
                  unsysDistance={knowledgeRegionUnsysDistance(selectedSample.embedding.raw)}
                  mode={figureMode}
                  productKind={details.kind}
                  identityLabel={knowledgeRegionIdentityLabel(
                    selectedSample.identity,
                    rosterNames,
                  )}
                  onClose={() => setSelectedSampleId(null)}
                  onSelectStep={setSelectedSampleId}
                />
              ) : null}
            </>
          ) : null}
      </div>
    </ProductSurface>
  );
}
