"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  DASHBOARD_DATA_STUDIO_PATH,
  DASHBOARD_DATA_STUDIO_RUN_PATH,
  DATA_STUDIO_REGION_QUERY,
  DATA_STUDIO_SPACE_OPTIONS,
  IDENTITY_STUDIO_CAMERA,
  STUDIO_INSPECT_WIDTH_DEFAULT,
  buildDataStudioProjectionView,
  buildStudioRegionDistanceRays,
  clampStudioInspectWidth,
  dataStudioProductLabel,
  filterStudioEmbeddings,
  formatStudioHighDimDistance,
  hiddenStudioRegionIdsForFocus,
  hitTestStudioPoint,
  STUDIO_IN_REGION_FILL,
  STUDIO_IN_REGION_STROKE,
  STUDIO_OUT_REGION_FILL,
  studioHighDimRegionMembership,
  inspectStudioEmbedding,
  mergeStudioInspectPow,
  panStudioCamera,
  pruneStudioSelectedIds,
  parseDataStudioSpace,
  parseStudioFocusRegionId,
  studioCameraTransform,
  studioGridLines,
  studioRegionsForSpace,
  studioRunOptions,
  studioFlowOptions,
  toggleStudioHiddenId,
  visibleStudioRegions,
  zoomStudioCamera,
  type DataStudioEmbeddingRow,
  type DataStudioInspectPayload,
  type DataStudioProduct,
  type DataStudioSpace,
  type StudioCamera,
} from "@/lib/data-studio-view";
import { DataStudioExplainer } from "@/components/data-studio/DataStudioExplainer";
import { StudioMultiSelect } from "@/components/data-studio/StudioMultiSelect";
import type { DataStudioView } from "@/lib/data-studio-explainer";
import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  PROJECTION_ALGORITHM_OPTIONS,
  parseProjectionAlgorithmId,
  type ProjectionAlgorithmId,
  type RegionCentroidInput,
} from "@/lib/knowledge-config";

type StudioPayload = {
  product: DataStudioProduct;
  embeddings: DataStudioEmbeddingRow[];
  regions: RegionCentroidInput[];
  workspaces: Array<{ id: string; title: string; is_play_copy: boolean }>;
};

const SELECT_CLASS =
  "rounded-none border border-white/20 bg-black px-2 py-1 font-mono text-[11px] text-white outline-none focus:border-white/60";

const INSPECT_WIDTH_KEY = "openlesson.data-studio.inspect-width";

export function DataStudioPanel({
  product,
  workspaceId = null,
}: {
  product: DataStudioProduct;
  workspaceId?: string | null;
}) {
  const searchParams = useSearchParams();
  const focusRegionId = parseStudioFocusRegionId(
    searchParams.get(DATA_STUDIO_REGION_QUERY),
  );
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const cameraRef = useRef<StudioCamera>(IDENTITY_STUDIO_CAMERA);
  const [payload, setPayload] = useState<StudioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [algorithm, setAlgorithm] = useState<ProjectionAlgorithmId>("pca");
  const [space, setSpace] = useState<DataStudioSpace>("path");
  const [view, setView] = useState<DataStudioView>("map");
  const [flowIds, setFlowIds] = useState<string[]>([]);
  const [runIds, setRunIds] = useState<string[]>([]);
  const [mapId, setMapId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState({ width: 960, height: 640, margin: 36 });
  const [camera, setCamera] = useState<StudioCamera>(IDENTITY_STUDIO_CAMERA);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showDistances, setShowDistances] = useState(true);
  const [colorMembership, setColorMembership] = useState(true);
  const [hiddenRegionIds, setHiddenRegionIds] = useState<string[]>([]);
  const [inspectWidth, setInspectWidth] = useState(() => {
    if (typeof window === "undefined") return STUDIO_INSPECT_WIDTH_DEFAULT;
    try {
      return clampStudioInspectWidth(
        Number(window.localStorage.getItem(INSPECT_WIDTH_KEY)) || STUDIO_INSPECT_WIDTH_DEFAULT,
      );
    } catch {
      return STUDIO_INSPECT_WIDTH_DEFAULT;
    }
  });
  const [runPow, setRunPow] = useState<FlowPowRow[]>([]);
  const resizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(
    null,
  );
  const shellRef = useRef<HTMLDivElement | null>(null);

  cameraRef.current = camera;

  useEffect(() => {
    try {
      window.localStorage.setItem(INSPECT_WIDTH_KEY, String(inspectWidth));
    } catch {
      /* ignore */
    }
  }, [inspectWidth]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const rect = host.getBoundingClientRect();
      setScreen({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(240, Math.floor(rect.height)),
        margin: 36,
      });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ product });
    if (workspaceId) params.set("workspaceId", workspaceId);
    void fetch(`${DASHBOARD_DATA_STUDIO_PATH}?${params.toString()}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as StudioPayload & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "Could not load Data Studio");
        }
        if (!cancelled) {
          setPayload({
            product: body.product || product,
            embeddings: Array.isArray(body.embeddings) ? body.embeddings : [],
            regions: Array.isArray(body.regions) ? body.regions : [],
            workspaces: Array.isArray(body.workspaces) ? body.workspaces : [],
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPayload(null);
          setError(err instanceof Error ? err.message : "Could not load Data Studio");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product, workspaceId]);

  useEffect(() => {
    if (!focusRegionId || !payload) return;
    const ids = payload.regions
      .map((region) => String(region.id || "").trim())
      .filter(Boolean);
    if (!ids.includes(focusRegionId)) return;
    setHiddenRegionIds(hiddenStudioRegionIdsForFocus(ids, focusRegionId));
  }, [focusRegionId, payload]);

  const rows = payload?.embeddings ?? [];
  const showFlowFilters = product !== "learning";
  const filtered = useMemo(
    () =>
      filterStudioEmbeddings(rows, {
        flowIds: showFlowFilters ? flowIds : [],
        runIds: showFlowFilters ? runIds : [],
        workspaceId: product === "learning" ? mapId : workspaceId,
      }),
    [flowIds, mapId, product, rows, runIds, showFlowFilters, workspaceId],
  );

  const flows = useMemo(() => studioFlowOptions(rows), [rows]);
  const runs = useMemo(() => studioRunOptions(rows, flowIds), [flowIds, rows]);
  const flowOptions = useMemo(
    () =>
      flows.map((flow) => ({
        id: flow.flowId,
        label: `${flow.flowId} (${flow.runCount})`,
        keywords: flow.identities.join(" "),
      })),
    [flows],
  );
  const runOptions = useMemo(
    () =>
      runs.map((run) => ({
        id: run.runId,
        label: run.identity ? `${run.identity} · ${run.runId}` : run.runId,
        keywords: run.flowId ?? "",
      })),
    [runs],
  );
  const maps = payload?.workspaces ?? [];

  const spaceRegions = useMemo(
    () =>
      product === "learning"
        ? []
        : studioRegionsForSpace(payload?.regions ?? [], space),
    [payload?.regions, product, space],
  );

  const projection = useMemo(
    () =>
      buildDataStudioProjectionView({
        embeddings: filtered,
        regions: spaceRegions,
        algorithm,
        space,
        screen,
      }),
    [algorithm, filtered, screen, space, spaceRegions],
  );

  const visibleOverlays = useMemo(
    () => visibleStudioRegions(projection.regionOverlays, hiddenRegionIds),
    [hiddenRegionIds, projection.regionOverlays],
  );

  const membership = useMemo(
    () =>
      colorMembership
        ? studioHighDimRegionMembership({
            embeddings: filtered,
            regions: spaceRegions,
            space,
            hiddenRegionIds,
          })
        : new Map(),
    [colorMembership, filtered, hiddenRegionIds, space, spaceRegions],
  );

  const distanceRays = useMemo(
    () =>
      showDistances
        ? buildStudioRegionDistanceRays({
            embeddings: filtered,
            coords: projection.coords,
            regionOverlays: projection.regionOverlays,
            regions: spaceRegions,
            space,
            hiddenRegionIds,
            selectedPointId: selectedId,
          })
        : [],
    [
      filtered,
      hiddenRegionIds,
      projection.coords,
      projection.regionOverlays,
      selectedId,
      showDistances,
      space,
      spaceRegions,
    ],
  );

  useEffect(() => {
    setFlowIds((current) =>
      pruneStudioSelectedIds(
        current,
        flows.map((flow) => flow.flowId),
      ),
    );
  }, [flows]);

  useEffect(() => {
    setRunIds((current) =>
      pruneStudioSelectedIds(
        current,
        runs.map((run) => run.runId),
      ),
    );
  }, [runs]);

  useEffect(() => {
    setCamera(IDENTITY_STUDIO_CAMERA);
  }, [algorithm, flowIds, runIds, mapId, screen.width, screen.height, space]);

  const selected = useMemo(
    () => filtered.find((row) => row.id === selectedId) ?? null,
    [filtered, selectedId],
  );
  const inspect: DataStudioInspectPayload | null = useMemo(() => {
    const base = inspectStudioEmbedding(selected, space);
    if (!base) return null;
    return runPow.length ? mergeStudioInspectPow(base, runPow) : base;
  }, [runPow, selected, space]);

  const inspectDistanceRays = useMemo(
    () =>
      selected
        ? buildStudioRegionDistanceRays({
            embeddings: [selected],
            coords: projection.coords.filter((point) => point.id === selected.id),
            regionOverlays: projection.regionOverlays,
            regions: spaceRegions,
            space,
            hiddenRegionIds: [],
            selectedPointId: selected.id,
          })
        : [],
    [projection.coords, projection.regionOverlays, selected, space, spaceRegions],
  );

  useEffect(() => {
    if (!selected?.workspace_id) {
      setRunPow([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ workspaceId: selected.workspace_id });
    if (selected.run_id) params.set("runId", selected.run_id);
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
  }, [selected?.id, selected?.run_id, selected?.workspace_id]);

  const grid = useMemo(
    () => studioGridLines({ width: screen.width, height: screen.height, camera }),
    [camera, screen.height, screen.width],
  );

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0 };
    const rect = host.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const selectAt = useCallback(
    (screenX: number, screenY: number) => {
      const id = hitTestStudioPoint(projection.coords, {
        screenX,
        screenY,
        camera: cameraRef.current,
        pixelRadius: 16,
      });
      setSelectedId(id);
    },
    [projection.coords],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = localPoint(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setCamera((current) =>
        zoomStudioCamera(current, {
          factor,
          originX: point.x,
          originY: point.y,
        }),
      );
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [localPoint]);

  const onPointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const point = localPoint(event.clientX, event.clientY);
      setCursor(point);
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (Math.hypot(dx, dy) > 1) drag.moved = true;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      setCamera((current) => panStudioCamera(current, dx, dy));
    },
    [localPoint],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (event.type !== "pointerup" || drag?.moved) return;
      const point = localPoint(event.clientX, event.clientY);
      selectAt(point.x, point.y);
    },
    [localPoint, selectAt],
  );

  const productLabel = dataStudioProductLabel(product);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 select-none flex-col overflow-hidden bg-[#070708] font-mono text-white"
      data-workspace-data-studio=""
      data-data-studio-visual="true"
      data-data-studio-product={product}
      data-data-studio-space={space}
      data-data-studio-view={view}
      data-data-studio-distances={showDistances ? "true" : "false"}
      data-data-studio-membership={colorMembership ? "true" : "false"}
      data-data-studio-focus-region={focusRegionId || undefined}
    >
      <div ref={shellRef} className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1" data-data-studio-plot>
          <div
          ref={hostRef}
          className="absolute inset-0 overflow-hidden bg-[#070708] outline-none"
          tabIndex={0}
          data-data-studio-canvas-host
          onKeyDown={(event) => {
            if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
              event.preventDefault();
              setView((current) => (current === "help" ? "map" : "help"));
              return;
            }
            if (event.key === "Escape" && view === "help") {
              event.preventDefault();
              setView("map");
              return;
            }
            if (view === "help") return;
            if ((event.key === "d" || event.key === "D") && spaceRegions.length > 0) {
              event.preventDefault();
              setShowDistances((current) => !current);
              return;
            }
            if ((event.key === "i" || event.key === "I") && spaceRegions.length > 0) {
              event.preventDefault();
              setColorMembership((current) => !current);
              return;
            }
            const originX = screen.width / 2;
            const originY = screen.height / 2;
            if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              setCamera((current) =>
                zoomStudioCamera(current, { factor: 1.12, originX, originY }),
              );
            } else if (event.key === "-" || event.key === "_") {
              event.preventDefault();
              setCamera((current) =>
                zoomStudioCamera(current, { factor: 1 / 1.12, originX, originY }),
              );
            } else if (event.key === "0") {
              event.preventDefault();
              setCamera(IDENTITY_STUDIO_CAMERA);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              setCamera((current) => panStudioCamera(current, 48, 0));
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setCamera((current) => panStudioCamera(current, -48, 0));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setCamera((current) => panStudioCamera(current, 0, 48));
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setCamera((current) => panStudioCamera(current, 0, -48));
            }
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
            <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-white/30" />
            <span className="absolute right-3 top-3 h-4 w-4 border-r border-t border-white/30" />
            <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/30" />
            <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-white/30" />
          </div>
          {view === "help" ? (
            <DataStudioExplainer product={product} onBack={() => setView("map")} />
          ) : loading ? (
            <p className="relative z-[3] p-4 text-sm text-neutral-500">
              Loading embeddings…
            </p>
          ) : error ? (
            <p
              className="relative z-[3] p-4 text-sm text-red-400"
              data-data-studio-error
            >
              {error}
            </p>
          ) : (
            <svg
              className="relative z-0 h-full w-full touch-none"
              style={{ cursor: dragging ? "grabbing" : "grab" }}
              viewBox={`0 0 ${screen.width} ${screen.height}`}
              data-data-studio-canvas
              data-projection-canvas
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={() => setCamera(IDENTITY_STUDIO_CAMERA)}
            >
              <rect width={screen.width} height={screen.height} fill="#070708" />
              <g data-data-studio-grid>
                {grid.lines.map((line) =>
                  line.axis === "x" ? (
                    <line
                      key={`x-${line.world}`}
                      x1={line.screen}
                      x2={line.screen}
                      y1={0}
                      y2={screen.height}
                      stroke={line.major ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)"}
                      strokeWidth={line.major ? 1 : 0.5}
                    />
                  ) : (
                    <line
                      key={`y-${line.world}`}
                      x1={0}
                      x2={screen.width}
                      y1={line.screen}
                      y2={line.screen}
                      stroke={line.major ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)"}
                      strokeWidth={line.major ? 1 : 0.5}
                    />
                  ),
                )}
                {grid.lines
                  .filter((line) => line.major && line.axis === "x")
                  .map((line) => (
                    <text
                      key={`lx-${line.world}`}
                      x={line.screen + 3}
                      y={12}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                    >
                      {line.world.toFixed(line.world % 1 === 0 ? 0 : 1)}
                    </text>
                  ))}
                {grid.lines
                  .filter((line) => line.major && line.axis === "y")
                  .map((line) => (
                    <text
                      key={`ly-${line.world}`}
                      x={6}
                      y={line.screen - 3}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                    >
                      {line.world.toFixed(line.world % 1 === 0 ? 0 : 1)}
                    </text>
                  ))}
              </g>
              <g transform={studioCameraTransform(camera)}>
                {visibleOverlays.map((region) => (
                  <g key={region.id} data-data-studio-region={region.id}>
                    <circle
                      cx={region.screenX}
                      cy={region.screenY}
                      r={region.screenRadius}
                      fill="rgba(255, 255, 255, 0.05)"
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      data-data-studio-spread-disk=""
                    />
                    {colorMembership && region.membershipScreenRadius > 0 ? (
                      <circle
                        cx={region.screenX}
                        cy={region.screenY}
                        r={region.membershipScreenRadius}
                        fill="none"
                        stroke={STUDIO_IN_REGION_FILL}
                        strokeOpacity={0.7}
                        strokeWidth={1.2}
                        strokeDasharray={`${5 / camera.scale} ${3.5 / camera.scale}`}
                        vectorEffect="non-scaling-stroke"
                        data-data-studio-membership-ring=""
                      />
                    ) : null}
                    <g
                      transform={`translate(${region.screenX + region.screenRadius + 6 / camera.scale} ${region.screenY}) scale(${1 / camera.scale})`}
                    >
                      <text
                        fill="rgba(255,255,255,0.45)"
                        fontSize="9"
                        fontFamily="ui-monospace, monospace"
                        data-data-studio-spread-label=""
                      >
                        spread
                      </text>
                    </g>
                    {colorMembership && region.membershipScreenRadius > 0 ? (
                      <g
                        transform={`translate(${region.screenX + region.membershipScreenRadius + 6 / camera.scale} ${region.screenY + 12 / camera.scale}) scale(${1 / camera.scale})`}
                      >
                        <text
                          fill={STUDIO_IN_REGION_FILL}
                          fillOpacity={0.75}
                          fontSize="9"
                          fontFamily="ui-monospace, monospace"
                          data-data-studio-membership-label=""
                        >
                          in (τ)
                        </text>
                      </g>
                    ) : null}
                    <circle
                      cx={region.screenX}
                      cy={region.screenY}
                      r={2 / camera.scale}
                      fill="rgba(255,255,255,0.7)"
                    />
                    <g
                      transform={`translate(${region.screenX} ${region.screenY - region.screenRadius - 8}) scale(${1 / camera.scale})`}
                    >
                      <text
                        fill="rgba(255,255,255,0.7)"
                        fontSize="10"
                        textAnchor="middle"
                        fontFamily="ui-monospace, monospace"
                      >
                        {region.name}
                      </text>
                    </g>
                  </g>
                ))}
                {distanceRays.map((ray) => {
                  const dimmed = selectedId ? !ray.selected : false;
                  const dash = 6 / camera.scale;
                  return (
                    <g
                      key={`${ray.pointId}-${ray.regionId}`}
                      data-data-studio-distance-ray=""
                      data-data-studio-distance-point={ray.pointId}
                      data-data-studio-distance-region={ray.regionId}
                    >
                      <line
                        x1={ray.x1}
                        y1={ray.y1}
                        x2={ray.x2}
                        y2={ray.y2}
                        stroke={
                          dimmed ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)"
                        }
                        strokeDasharray={`${dash} ${dash * 0.7}`}
                        strokeWidth={ray.selected ? 1.4 : 1}
                        vectorEffect="non-scaling-stroke"
                      />
                      <g
                        transform={`translate(${ray.labelX} ${ray.labelY}) scale(${1 / camera.scale})`}
                      >
                        <text
                          fill={dimmed ? "rgba(255,255,255,0.35)" : "#ffffff"}
                          fontSize="9"
                          textAnchor="middle"
                          fontFamily="ui-monospace, monospace"
                          data-data-studio-distance-norm={String(ray.highDimL2)}
                        >
                          {formatStudioHighDimDistance(ray.highDimL2)}
                        </text>
                      </g>
                    </g>
                  );
                })}
                {projection.coords.map((point) => {
                  const active = point.id === selectedId;
                  const radius = (active ? 5.5 : 3.6) / camera.scale;
                  const member = membership.get(point.id);
                  const inHighDim = Boolean(colorMembership && member?.inRegion);
                  const fill = colorMembership
                    ? inHighDim
                      ? STUDIO_IN_REGION_FILL
                      : STUDIO_OUT_REGION_FILL
                    : active
                      ? "#ffffff"
                      : "rgba(255,255,255,0.82)";
                  const stroke = colorMembership
                    ? inHighDim
                      ? STUDIO_IN_REGION_STROKE
                      : "rgba(0,0,0,0.55)"
                    : active
                      ? "#ffffff"
                      : "rgba(0,0,0,0.6)";
                  return (
                    <g
                      key={point.id}
                      data-data-studio-point={point.id}
                      data-projection-point=""
                      data-data-studio-in-region={
                        colorMembership ? (member?.inRegion ? "true" : "false") : undefined
                      }
                    >
                      <circle
                        cx={point.screenX}
                        cy={point.screenY}
                        r={radius}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={inHighDim ? 1.5 : active ? 1.4 : 0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                      {point.identity ? (
                        <g
                          transform={`translate(${point.screenX + 8 / camera.scale} ${point.screenY - 7 / camera.scale}) scale(${1 / camera.scale})`}
                        >
                          <text
                            fill={
                              inHighDim
                                ? STUDIO_IN_REGION_FILL
                                : active
                                  ? "#ffffff"
                                  : "rgba(255,255,255,0.62)"
                            }
                            fontSize="10"
                            fontFamily="ui-monospace, monospace"
                            data-data-studio-identity={point.identity}
                          >
                            {point.identity}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
          {view === "map" && spaceRegions.length > 0 ? (
            <div
              className="absolute right-3 top-3 z-[3] max-w-[220px] border border-white/15 bg-black/75 px-2 py-1.5"
              data-data-studio-region-legend
            >
              <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-neutral-500">
                Regions
              </p>
              {colorMembership ? (
                <div
                  className="mb-1.5 space-y-1 text-[10px] text-neutral-400"
                  data-data-studio-membership-legend
                >
                  <p className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: STUDIO_IN_REGION_FILL }}
                      />
                      in
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: STUDIO_OUT_REGION_FILL }}
                      />
                      out
                    </span>
                    <span className="text-neutral-600">cosine ≥ τ</span>
                  </p>
                  <p className="text-[9px] leading-snug text-neutral-500">
                    Spread disk = mean ‖builder − centroid‖ of the people who defined
                    the region, flattened to 2D. It is how tight that cohort was. Dashed
                    ring = cosine ≥ τ ball. A bright dot outside the white disk is still
                    in 96-D.
                  </p>
                </div>
              ) : null}
              <ul className="space-y-1">
                {spaceRegions.map((region) => {
                  const visible = !hiddenRegionIds.includes(region.id);
                  return (
                    <li key={region.id}>
                      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-white/80">
                        <input
                          type="checkbox"
                          className="accent-white"
                          checked={visible}
                          onChange={() =>
                            setHiddenRegionIds((current) =>
                              toggleStudioHiddenId(current, region.id),
                            )
                          }
                          data-data-studio-region-toggle={region.id}
                        />
                        <span className={visible ? "text-white" : "text-neutral-500"}>
                          {region.name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {view === "map" ? (
            <p className="pointer-events-none absolute bottom-3 left-3 z-[3] max-w-[min(36rem,calc(100%-14rem))] text-[10px] text-neutral-500">
              {colorMembership
                ? "Spread = mean builder distance to centroid · dashed ring = cosine ≥ τ · rays = ‖x−c‖ in 96-D"
                : showDistances
                  ? "Dashed ‖x−c‖ is L2 in embedding space · Drag to pan · Scroll to zoom"
                  : "Drag to pan · Scroll to zoom · Click a point to inspect"}
            </p>
          ) : null}
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          data-data-studio-hud
        >
          <header
            className="pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100%-15rem)] flex-wrap items-center gap-x-3 gap-y-2 border border-white/15 bg-black/75 px-2 py-1.5"
            data-data-studio-toolbar
          >
            <div className="mr-1 flex items-baseline gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white">
                Data Studio
              </p>
              <span className="text-[11px] text-neutral-500">{productLabel}</span>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              Space
              <select
                className={SELECT_CLASS}
                value={space}
                onChange={(event) => setSpace(parseDataStudioSpace(event.target.value))}
                data-data-studio-space-select
              >
                {DATA_STUDIO_SPACE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              Projection
              <select
                className={SELECT_CLASS}
                value={algorithm}
                onChange={(event) =>
                  setAlgorithm(parseProjectionAlgorithmId(event.target.value, "pca"))
                }
                data-data-studio-algorithm
                data-projection-algorithm-select
              >
                {PROJECTION_ALGORITHM_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.shortLabel}
                  </option>
                ))}
              </select>
            </label>
            {showFlowFilters ? (
              <>
                <StudioMultiSelect
                  label="Flow"
                  options={flowOptions}
                  selected={flowIds}
                  onChange={setFlowIds}
                  emptyLabel="All together"
                  plural="flows"
                  searchPlaceholder="Search flows"
                  marker="data-data-studio-flow-filter"
                  compact
                />
                <StudioMultiSelect
                  label="Run"
                  options={runOptions}
                  selected={runIds}
                  onChange={setRunIds}
                  emptyLabel="All runs"
                  plural="runs"
                  searchPlaceholder="Search runs"
                  marker="data-data-studio-run-filter"
                  compact
                />
              </>
            ) : (
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                Map
                <select
                  className={SELECT_CLASS}
                  value={mapId}
                  onChange={(event) => setMapId(event.target.value)}
                  data-data-studio-map-filter
                >
                  <option value="">All play sessions</option>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </header>
          <div
            className="pointer-events-auto absolute bottom-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2 border border-white/15 bg-black/75 px-2 py-1.5 text-[10px] text-neutral-500"
            data-data-studio-status
          >
            <span data-data-studio-count className="text-white/80">
              {filtered.length} embeddings
            </span>
            <span data-data-studio-camera>×{camera.scale.toFixed(2)}</span>
            <span>
              {cursor ? `${cursor.x.toFixed(0)},${cursor.y.toFixed(0)}` : "—,—"}
            </span>
            <button
              type="button"
              className="border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
              onClick={() => setCamera(IDENTITY_STUDIO_CAMERA)}
              data-data-studio-reset-camera
            >
              Reset
            </button>
            {spaceRegions.length > 0 ? (
              <>
                <button
                  type="button"
                  className={
                    showDistances
                      ? "border border-white/80 bg-white px-2 py-0.5 text-[10px] text-black"
                      : "border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
                  }
                  aria-pressed={showDistances}
                  onClick={() => setShowDistances((current) => !current)}
                  data-data-studio-distances-toggle
                >
                  ‖x−c‖
                </button>
                <button
                  type="button"
                  className={
                    colorMembership
                      ? "border border-white/80 bg-white px-2 py-0.5 text-[10px] text-black"
                      : "border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
                  }
                  aria-pressed={colorMembership}
                  onClick={() => setColorMembership((current) => !current)}
                  data-data-studio-membership-toggle
                >
                  In region
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={
                view === "help"
                  ? "border border-white/80 bg-white px-2 py-0.5 text-[10px] text-black"
                  : "border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
              }
              aria-pressed={view === "help"}
              onClick={() => setView((current) => (current === "help" ? "map" : "help"))}
              data-data-studio-help
            >
              Help
            </button>
          </div>
        </div>
        </div>

        {inspect && view === "map" ? (
          <aside
            className="relative flex shrink-0 select-text flex-col overflow-hidden border-l border-white/15 bg-black/80"
            style={{ width: inspectWidth, maxWidth: "85%" }}
            data-data-studio-inspect
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize inspect panel"
              data-data-studio-resize
              className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize bg-transparent hover:bg-white/25"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                resizeRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startWidth: inspectWidth,
                };
              }}
              onPointerMove={(event) => {
                const drag = resizeRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const max = Math.floor((shellRef.current?.clientWidth || 1200) * 0.78);
                setInspectWidth(
                  clampStudioInspectWidth(drag.startWidth + (drag.startX - event.clientX), max),
                );
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                resizeRef.current = null;
              }}
            />
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 pl-4">
              <p className="text-xs font-medium text-white">Stored record</p>
              <button
                type="button"
                className="text-[11px] text-neutral-500 hover:text-white"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 pl-4 text-[11px] text-neutral-300">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-neutral-500">identity</dt>
                <dd className="text-white" data-data-studio-inspect-identity>
                  {inspect.identity || "—"}
                </dd>
                <dt className="text-neutral-500">flow_id</dt>
                <dd className="break-all">{inspect.flow_id || "—"}</dd>
                <dt className="text-neutral-500">run_id</dt>
                <dd className="break-all">{inspect.run_id || "—"}</dd>
                <dt className="text-neutral-500">flow_kind</dt>
                <dd>{inspect.flow_kind || "—"}</dd>
                <dt className="text-neutral-500">workspace</dt>
                <dd>{inspect.workspace_title || inspect.workspace_id || "—"}</dd>
                <dt className="text-neutral-500">space</dt>
                <dd data-data-studio-inspect-space>
                  {inspect.space === "path_text" ? "Path + text" : "Path"}
                </dd>
                <dt className="text-neutral-500">model</dt>
                <dd className="break-all">{inspect.embedding_model_id}</dd>
              </dl>

              {inspectDistanceRays.length > 0 ? (
                <section className="mt-4" data-data-studio-inspect-distances>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                    ‖x−c‖ embedding L2
                  </p>
                  <ul className="space-y-1">
                    {inspectDistanceRays.map((ray) => (
                      <li
                        key={ray.regionId}
                        className="flex justify-between gap-2 text-white"
                        data-data-studio-inspect-distance={ray.regionId}
                        data-data-studio-inspect-in-region={ray.inRegion ? "true" : "false"}
                      >
                        <span className="truncate text-neutral-300">{ray.regionName}</span>
                        <span className="font-mono">
                          {formatStudioHighDimDistance(ray.highDimL2)}
                          <span
                            className="ml-2"
                            style={{
                              color: ray.inRegion
                                ? STUDIO_IN_REGION_FILL
                                : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {ray.inRegion ? "in" : "out"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="mt-4" data-data-studio-speech>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  Voice transcripts
                </p>
                {inspect.speech.length > 0 ? (
                  <ul className="space-y-2" data-data-studio-transcripts>
                    {inspect.speech.map((line) => (
                      <li
                        key={line.slice(0, 64)}
                        className="whitespace-pre-wrap border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12px] leading-relaxed text-white"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-neutral-500">
                    No spoken lines on this run. Out-loud speech is stored on speech-segment
                    stops as transcript_snapshot, and as a session transcript file.
                  </p>
                )}
              </section>

              {inspect.thoughts.length > 0 ? (
                <section className="mt-4">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                    Thought traces
                  </p>
                  <ul className="space-y-2">
                    {inspect.thoughts.map((line) => (
                      <li
                        key={line.slice(0, 64)}
                        className="whitespace-pre-wrap border border-white/10 px-2 py-1.5 text-neutral-200"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <details className="mt-4" open>
                <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
                  Proof of work ({inspect.pow.length})
                </summary>
                <ol className="mt-2 space-y-2" data-data-studio-pow>
                  {inspect.pow.map((row, index) => (
                    <li
                      key={`${row.tool_name || "pow"}-${row.timestamp_ms || index}`}
                      className="border border-white/10 px-2 py-1.5"
                    >
                      <p className="text-white">
                        {row.tool_name || "tool"}
                        {row.tool_action ? ` · ${row.tool_action}` : ""}
                      </p>
                      {row.timestamp_ms ? (
                        <p className="text-[10px] text-neutral-500">{row.timestamp_ms}</p>
                      ) : null}
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-neutral-400">
                        {JSON.stringify(
                          {
                            type: row.type,
                            payload: row.payload,
                            metadata: row.metadata,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </li>
                  ))}
                </ol>
              </details>

              <details className="mt-4">
                <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
                  Vector · {inspect.space === "path_text" ? "Path + text" : "Path"} (
                  {inspect.vector.length})
                </summary>
                <pre className="mt-1 overflow-x-auto text-[10px] text-neutral-400" data-data-studio-vector>
                  {JSON.stringify(inspect.vector)}
                </pre>
              </details>

              <details className="mt-4">
                <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-neutral-500">
                  Raw embedding
                </summary>
                <pre className="mt-1 max-h-[28rem] overflow-auto text-[10px] text-neutral-400" data-data-studio-raw>
                  {JSON.stringify(inspect.raw, null, 2)}
                </pre>
              </details>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
