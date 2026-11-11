"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { StudioMultiSelect } from "@/components/data-studio/StudioMultiSelect";
import { KnowledgeRegionInspect } from "@/components/product-flow/knowledge-region-inspect";
import { ProductSurface } from "@/components/product-flow/product-surface";
import {
  FLOW_FORM_LABEL,
  FLOW_GHOST_BTN,
  FlowFormCard,
  FlowFormHeader,
} from "@/components/product-flow/product-flow-form";
import { dashboardTabForProductSurface } from "@/lib/dashboard-nav";
import {
  DASHBOARD_DATA_STUDIO_RUN_PATH,
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
  clusterVisibleInKnowledgeRegion,
  diamondGlyphPoints,
  KNOWLEDGE_REGION_ANALYSIS_FILL,
  KNOWLEDGE_REGION_MAP_SIZE,
  knowledgeRegionAnalysisPointLabel,
  knowledgeRegionVisibleIdsFromSelection,
  presentKnowledgeRegionClusterDistances,
  presentKnowledgeRegionFigure,
  resolveKnowledgeRegionPointKind,
  type KnowledgeRegionPointKind,
} from "@/lib/knowledge-region-figure";
import type { FlowPowRow } from "@/lib/flow-embedding";
import { DASHBOARD_KNOWLEDGE_REGIONS_PATH } from "@/lib/dashboard-knowledge-regions";
import {
  type KnowledgeRegionDetails,
  type KnowledgeRegionDetailsSample,
} from "@/lib/knowledge-region-details";
import {
  productFlowKindLabel,
  productRegionStudioPath,
  type ProductFlowKind,
} from "@/lib/product-flow";

const FIGURE_SCREEN = {
  width: KNOWLEDGE_REGION_MAP_SIZE,
  height: KNOWLEDGE_REGION_MAP_SIZE,
  margin: 36,
};

const CONTROL_SELECT =
  "h-7 w-full min-w-0 border border-white/20 bg-black px-2 font-mono text-[11px] text-white outline-none focus:border-white/55";
const POINT_KIND_IDS: readonly KnowledgeRegionPointKind[] = [
  "simulated",
  "cohort",
  "analysis",
];

export function KnowledgeRegionPage({
  kind,
  regionId,
}: {
  kind: ProductFlowKind;
  regionId: string;
}) {
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
  const [runPow, setRunPow] = useState<FlowPowRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ kind });
    void fetch(`${DASHBOARD_KNOWLEDGE_REGIONS_PATH}/${encodeURIComponent(regionId)}?${params}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(payload, "Could not load knowledge region"));
        }
        const next = payload.details as KnowledgeRegionDetails | undefined;
        if (!cancelled) setDetails(next && next.id ? next : null);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetails(null);
          setError(err instanceof Error ? err.message : "Could not load knowledge region");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, regionId]);

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

  const selectedSample: KnowledgeRegionDetailsSample | null =
    samples.find((sample) => sample.id === selectedSampleId) ?? null;

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
    void fetch(`${DASHBOARD_DATA_STUDIO_RUN_PATH}?${params.toString()}`)
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
    });
  }, [details, projection, selectedSampleId, visibleClusterIds, visiblePointKinds]);

  return (
    <ProductSurface
      label={`${productLabel} knowledge region`}
      activeTab={dashboardTabForProductSurface(kind, "region")}
    >
      <div className="mx-auto min-h-[32rem] w-full max-w-5xl space-y-6" data-knowledge-region-details={kind}>
          <FlowFormHeader
            backHref={`/dashboard?tab=${kind}_regions`}
            backLabel="Back to knowledge regions"
            title={details?.name || (loading ? "Knowledge region" : "Region not found")}
            description={
              details?.description ||
              (loading
                ? `Loading this ${productLabel.toLowerCase()} region.`
                : `This ${productLabel.toLowerCase()} knowledge region could not be opened.`)
            }
            extra={
              details ? (
                <div className="mt-6 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={details.studioPath || productRegionStudioPath(kind, details.id)}
                      className={FLOW_GHOST_BTN}
                      data-open-region-data-studio={details.id}
                    >
                      Open in Data Studio
                    </Link>
                  </div>
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
              {figure ? (
                <FlowFormCard className="overflow-hidden p-4 sm:p-5">
                  <div className="grid items-start gap-5 lg:grid-cols-[7fr_3fr]">
                  <div className="w-full overflow-hidden bg-black">
                  <svg
                    viewBox={`0 0 ${figure.map.size} ${figure.map.size}`}
                    className="block h-auto w-full"
                    data-knowledge-region-figure=""
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
                          <rect
                            x={ray.midX - 18}
                            y={ray.midY - 8}
                            width={36}
                            height={14}
                            rx={3}
                            fill="#0b0b0b"
                            stroke="rgba(255,255,255,0.25)"
                          />
                          <text
                            x={ray.midX}
                            y={ray.midY + 3}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.82)"
                            fontSize={9}
                            fontFamily="ui-monospace, monospace"
                          >
                            {ray.label}
                          </text>
                        </g>
                      ))}
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
                        const radius = selected ? 5.5 : 4.2;
                        return (
                          <g
                            key={point.id}
                            className="cursor-pointer"
                            data-knowledge-region-figure-point={point.id}
                            data-knowledge-region-glyph={point.glyph}
                            data-knowledge-region-point-kind={kind}
                            onClick={() => setSelectedSampleId(point.id)}
                          >
                            <title>{point.identity || point.id}</title>
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
                          r={11}
                          fill="none"
                          stroke="white"
                          strokeWidth={1.35}
                          data-knowledge-region-focus=""
                        />
                      ) : null}
                    </g>
                    {figure.badges.map((badge) => (
                      <g
                        key={badge.id}
                        data-knowledge-region-badge={badge.kind}
                        data-knowledge-region-cluster-label={
                          badge.kind === "cluster" ? badge.id : undefined
                        }
                      >
                        <rect
                          x={badge.x}
                          y={badge.y}
                          width={badge.width}
                          height={18}
                          rx={4}
                          fill="#101010"
                          stroke={badge.color}
                          strokeWidth={0.9}
                        />
                        <text
                          x={badge.x + badge.width / 2}
                          y={badge.y + 12.5}
                          textAnchor="middle"
                          fill={badge.color}
                          fontSize={10}
                        >
                          {badge.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                  </div>
                  <div
                    className="space-y-2 border border-white/15 bg-black/50 px-3 py-2.5"
                    data-knowledge-region-controls=""
                  >
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

              {inspect && selectedSample ? (
                <KnowledgeRegionInspect
                  inspect={inspect}
                  sample={selectedSample}
                  distances={clusterDistances}
                  productKind={details.kind}
                  onClose={() => setSelectedSampleId(null)}
                />
              ) : null}
            </>
          ) : null}
      </div>
    </ProductSurface>
  );
}
