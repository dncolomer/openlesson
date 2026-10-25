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
import { DataStudioHud } from "@/components/data-studio/DataStudioHud";
import { DataStudioInspect } from "@/components/data-studio/DataStudioInspect";
import { DataStudioPlot } from "@/components/data-studio/DataStudioPlot";
import {
  IDENTITY_STUDIO_CAMERA,
  hitTestStudioPoint,
  panStudioCamera,
  studioGridLines,
  zoomStudioCamera,
  type StudioCamera,
} from "@/lib/data-studio-camera";
import {
  DASHBOARD_DATA_STUDIO_PATH,
  DASHBOARD_DATA_STUDIO_RUN_PATH,
  DATA_STUDIO_REGION_QUERY,
  STUDIO_INSPECT_WIDTH_DEFAULT,
  buildDataStudioProjectionView,
  buildStudioRegionDistanceRays,
  clampStudioInspectWidth,
  dataStudioProductLabel,
  filterStudioEmbeddings,
  hiddenStudioRegionIdsForFocus,
  studioHighDimRegionMembership,
  inspectStudioEmbedding,
  mergeStudioInspectPow,
  pruneStudioSelectedIds,
  parseStudioFocusRegionId,
  studioRegionsForSpace,
  studioRunOptions,
  studioFlowOptions,
  studioVisibleRegionIds,
  toggleStudioHiddenId,
  visibleStudioRegions,
  type DataStudioEmbeddingRow,
  type DataStudioInspectPayload,
  type DataStudioProduct,
  type DataStudioSpace,
} from "@/lib/data-studio-view";
import type { DataStudioView } from "@/lib/data-studio-explainer";
import type { FlowPowRow } from "@/lib/flow-embedding";
import {
  type ProjectionAlgorithmId,
  type RegionCentroidInput,
} from "@/lib/knowledge-config";

type StudioPayload = {
  product: DataStudioProduct;
  embeddings: DataStudioEmbeddingRow[];
  regions: RegionCentroidInput[];
  workspaces: Array<{ id: string; title: string; is_play_copy: boolean }>;
};

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
  const regionIds = useMemo(
    () => spaceRegions.map((region) => region.id).filter(Boolean),
    [spaceRegions],
  );
  const visibleRegionIds = useMemo(
    () => studioVisibleRegionIds(regionIds, hiddenRegionIds),
    [hiddenRegionIds, regionIds],
  );
  const regionOptions = useMemo(
    () =>
      spaceRegions.map((region) => ({
        id: region.id,
        label: region.name || region.id,
        keywords: [region.id, region.embedding_model_id, region.source]
          .filter(Boolean)
          .join(" "),
      })),
    [spaceRegions],
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
    setHiddenRegionIds((current) => pruneStudioSelectedIds(current, regionIds));
  }, [regionIds]);

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
          <DataStudioPlot
            product={product}
            view={view}
            loading={loading}
            error={error}
            hostRef={hostRef}
            screen={screen}
            camera={camera}
            dragging={dragging}
            grid={grid}
            visibleOverlays={visibleOverlays}
            colorMembership={colorMembership}
            distanceRays={distanceRays}
            selectedId={selectedId}
            membership={membership}
            coords={projection.coords}
            showDistances={showDistances}
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
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={() => setCamera(IDENTITY_STUDIO_CAMERA)}
            onBackFromHelp={() => setView("map")}
          />
          <DataStudioHud
            productLabel={productLabel}
            space={space}
            onSpaceChange={setSpace}
            algorithm={algorithm}
            onAlgorithmChange={setAlgorithm}
            showFlowFilters={showFlowFilters}
            flowOptions={flowOptions}
            flowIds={flowIds}
            onFlowIdsChange={setFlowIds}
            runOptions={runOptions}
            runIds={runIds}
            onRunIdsChange={setRunIds}
            mapId={mapId}
            onMapIdChange={setMapId}
            maps={maps}
            spaceRegions={spaceRegions}
            regionOptions={regionOptions}
            visibleRegionIds={visibleRegionIds}
            regionIds={regionIds}
            onHiddenRegionIdsChange={setHiddenRegionIds}
            onToggleRegion={(id) =>
              setHiddenRegionIds((current) => toggleStudioHiddenId(current, id))
            }
            view={view}
            colorMembership={colorMembership}
            hiddenRegionIds={hiddenRegionIds}
            filteredCount={filtered.length}
            cameraScale={camera.scale}
            cursor={cursor}
            onResetCamera={() => setCamera(IDENTITY_STUDIO_CAMERA)}
            showDistances={showDistances}
            onToggleDistances={() => setShowDistances((current) => !current)}
            onToggleMembership={() => setColorMembership((current) => !current)}
            onToggleHelp={() => setView((current) => (current === "help" ? "map" : "help"))}
          />
        </div>
        {inspect && view === "map" ? (
          <DataStudioInspect
            inspect={inspect}
            inspectWidth={inspectWidth}
            inspectDistanceRays={inspectDistanceRays}
            shellRef={shellRef}
            onInspectWidthChange={setInspectWidth}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
