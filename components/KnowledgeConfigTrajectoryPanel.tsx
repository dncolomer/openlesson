"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { KnowledgeRegionListItem } from "@/components/CustomVerificationModelsPanel";
import {
  resolveEmbeddingsSubjectSelection,
  resolveModelsTabScope,
  type ModelsTabSubjectRef,
} from "@/lib/pow-api/models-tab-scope";
import {
  dualScoreSeriesFromRuns,
  filterLwmHistoryByDateWindow,
  scoreSeriesPolyline,
  selectLwmHistoryRun,
  timelineMarkersFromRuns,
  type LwmHistoryRunLike,
} from "@/lib/pow-api/lwm-snapshot-history-ui";
import {
  projectTrajectoryAndRegions,
  PROJECTION_ALGORITHM_OPTIONS,
  parseProjectionAlgorithmId,
  computeProjectionFitBounds,
  fitViewTransform,
  zoomViewTransform,
  panViewTransform,
  dataToScreen,
  screenToData,
  mapRadiusToScreen,
  generateGridTicks,
  clampZoom,
  type KnowledgeRegionOverlay2D,
  type ViewTransform,
  type ScreenRect,
  type ProjectionDisplayMode,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";

/** Snapshot-history row shape used by LWM timeline. */
interface LwmSnapshotHistoryRun extends LwmHistoryRunLike {
  id: string;
  ran_at: string;
  score: number;
  ghc_score: number | null;
  report?: PerformanceReport | null;
  source?: string;
  vertical?: string;
}

interface ProjectionCoord {
  t: string;
  as_of_ms: number;
  x: number;
  y: number;
  confidence: number;
  /** Stable subject key `u:<id>` / `g:<id>` for multi-subject coloring. */
  subjectKey?: string;
}

const REGION_OVERLAY_COLORS = [
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb7185",
];

/** Distinct colors for multi-subject trajectory points / paths. */
const SUBJECT_TRAJECTORY_COLORS = [
  "#a78bfa",
  "#22d3ee",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb7185",
  "#c084fc",
];

interface AvailableSubject {
  user_id: string | null;
  guest_user_id: string | null;
  embedding_model_id: string;
  as_of_ms: number;
  confidence: number;
}

interface KnowledgeConfigResponse {
  knowledge_config: {
    embedding_model_id: string;
    dim: number;
    confidence: number;
    pow_event_count: number;
    as_of?: string;
    empty?: boolean;
  };
  learning_world_model?: {
    updated_at?: string;
    exploration?: {
      blind_spots?: string[];
      pathways_touched?: string[];
    };
    evidence_appetite?: {
      want_more?: string[];
      saturated?: string[];
    };
    learning_profile?: {
      strengths?: string[];
      friction_patterns?: string[];
    };
    scores_snapshot?: {
      /** History wire key for LWM Snapshot primary score (not a product score type name). */
      verification_score?: number | null;
      augmentation_score?: number | null;
      optimization_score?: number | null;
      ghc_score?: number | null;
    };
    inferred_goal?: {
      text?: string;
      confidence?: number;
    };
  };
  scope?: {
    mode: string;
    kind: string;
    label: string;
  };
  available_subjects?: AvailableSubject[];
  trajectory: {
    point_count: number;
    path_length: number;
    /** High-D snapshots used for client-side re-projection under any algorithm. */
    points?: Array<{
      t: string;
      as_of_ms: number;
      vector: number[];
      confidence: number;
      trigger?: string;
      pow_event_count?: number;
      subject_user_id?: string | null;
      subject_guest_user_id?: string | null;
    }>;
    projection: {
      algorithm?: string;
      frame_id: string;
      coords: ProjectionCoord[];
    };
  };
}

function trajectoryPointSubjectKey(p: {
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
}): string | undefined {
  const guest = p.subject_guest_user_id?.trim();
  if (guest) return `g:${guest}`;
  const user = p.subject_user_id?.trim();
  if (user) return `u:${user}`;
  return undefined;
}

/** Latest mode: one last point per subject when multi; else single last point. */
function selectDisplayCoords(
  coords: ProjectionCoord[],
  mode: ProjectionDisplayMode,
): ProjectionCoord[] {
  if (!coords.length) return [];
  if (mode === "trajectory") return coords;
  const keys = new Set(coords.map((c) => c.subjectKey).filter(Boolean) as string[]);
  if (keys.size <= 1) return [coords[coords.length - 1]];
  const latestByKey = new Map<string, ProjectionCoord>();
  for (const c of coords) {
    const k = c.subjectKey || "aggregate";
    const prev = latestByKey.get(k);
    if (!prev || c.as_of_ms >= prev.as_of_ms) latestByKey.set(k, c);
  }
  return Array.from(latestByKey.values());
}

function subjectColorForKey(key: string | undefined, keyOrder: string[]): string {
  if (!key || keyOrder.length === 0) return "#a78bfa";
  const idx = keyOrder.indexOf(key);
  const i = idx >= 0 ? idx : 0;
  return SUBJECT_TRAJECTORY_COLORS[i % SUBJECT_TRAJECTORY_COLORS.length];
}

function subjectOptionKey(s: ModelsTabSubjectRef): string {
  if (s.guest_user_id) return `g:${s.guest_user_id}`;
  if (s.user_id) return `u:${s.user_id}`;
  return "aggregate";
}

function subjectOptionLabel(s: AvailableSubject, currentUserId?: string | null): string {
  if (s.user_id && currentUserId && s.user_id === currentUserId) return "You";
  if (s.user_id) return `User ${s.user_id.slice(0, 8)}…`;
  if (s.guest_user_id) return `Guest ${s.guest_user_id.slice(0, 8)}…`;
  return "Workspace aggregate";
}

function selectValueFromSubject(
  userId: string,
  guestUserId: string,
  currentUserId?: string | null,
): string {
  if (guestUserId) return `g:${guestUserId}`;
  if (userId) return `u:${userId}`;
  if (currentUserId) return `u:${currentUserId}`;
  return "";
}

const PROJECTION_SCREEN: ScreenRect = { width: 960, height: 560, margin: 48 };

function ProjectionSpaceWidget({
  coords,
  regionOverlays = [],
  displayMode = "trajectory",
  onDisplayModeChange,
}: {
  coords: ProjectionCoord[];
  regionOverlays?: KnowledgeRegionOverlay2D[];
  displayMode?: ProjectionDisplayMode;
  onDisplayModeChange?: (mode: ProjectionDisplayMode) => void;
}) {
  const displayCoords = useMemo(
    () => selectDisplayCoords(coords, displayMode),
    [coords, displayMode],
  );

  const subjectKeyOrder = useMemo(() => {
    const seen: string[] = [];
    for (const c of coords) {
      if (c.subjectKey && !seen.includes(c.subjectKey)) seen.push(c.subjectKey);
    }
    return seen;
  }, [coords]);

  const multiSubject = subjectKeyOrder.length > 1;

  const bounds = useMemo(() => {
    // Fit on the points actually shown (latest-per-subject when multi) + regions.
    const fitPts = selectDisplayCoords(coords, displayMode);
    return computeProjectionFitBounds(
      fitPts.map((c) => ({ x: c.x, y: c.y })),
      regionOverlays.map((r) => ({ x: r.x, y: r.y, radius: r.radius })),
      "trajectory", // already filtered; avoid double-trimming to a single last point
    );
  }, [coords, regionOverlays, displayMode]);

  const [view, setView] = useState<ViewTransform | null>(null);
  const [cursorData, setCursorData] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    active: boolean;
    lastSx: number;
    lastSy: number;
  }>({ active: false, lastSx: 0, lastSy: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Re-fit when mode, points, or selected regions change so latest + regions stay visible.
  useEffect(() => {
    if (!bounds) {
      setView(null);
      return;
    }
    setView(fitViewTransform(bounds, { padFraction: 0.14, zoom: 1, panX: 0, panY: 0 }));
  }, [bounds]);

  const activeView = view;

  const ticks = useMemo(
    () => (activeView ? generateGridTicks(activeView, 8) : { xTicks: [], yTicks: [] }),
    [activeView],
  );

  const mapPoint = useCallback(
    (x: number, y: number) => {
      if (!activeView) return { x: 0, y: 0 };
      return dataToScreen(x, y, activeView, PROJECTION_SCREEN);
    },
    [activeView],
  );

  if (!bounds || !activeView) {
    return (
      <div
        className="flex min-h-[28rem] h-full w-full flex-1 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/60 text-xs text-neutral-500"
        data-projection-widget
        data-projection-empty
      >
        No knowledge config samples yet for this user. Generate an LWM Snapshot when new
        proof of work exists — or overlay a knowledge region.
      </div>
    );
  }

  const w = PROJECTION_SCREEN.width;
  const h = PROJECTION_SCREEN.height;
  const m = PROJECTION_SCREEN.margin;

  const showTrajectory = displayMode === "trajectory";
  const latestPoints = selectDisplayCoords(coords, "latest");

  /** One path per subject when multi-select; single chronological path otherwise. */
  const subjectPaths: Array<{ key: string; d: string }> = (() => {
    if (!showTrajectory || displayCoords.length < 2) return [];
    if (!multiSubject) {
      const d = displayCoords
        .map((c, i) => {
          const p = mapPoint(c.x, c.y);
          return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ");
      return d ? [{ key: "all", d }] : [];
    }
    const byKey = new Map<string, ProjectionCoord[]>();
    for (const c of displayCoords) {
      const k = c.subjectKey || "aggregate";
      const list = byKey.get(k) || [];
      list.push(c);
      byKey.set(k, list);
    }
    const out: Array<{ key: string; d: string }> = [];
    for (const [key, pts] of byKey) {
      if (pts.length < 2) continue;
      const sorted = [...pts].sort((a, b) => a.as_of_ms - b.as_of_ms);
      const d = sorted
        .map((c, i) => {
          const p = mapPoint(c.x, c.y);
          return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(" ");
      out.push({ key, d });
    }
    return out;
  })();

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * w;
    const sy = ((e.clientY - rect.top) / rect.height) * h;
    const focus = screenToData(sx, sy, activeView, PROJECTION_SCREEN);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setView(zoomViewTransform(activeView, activeView.zoom * factor, focus.x, focus.y));
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      active: true,
      lastSx: ((e.clientX - rect.left) / rect.width) * w,
      lastSy: ((e.clientY - rect.top) / rect.height) * h,
    };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * w;
    const sy = ((e.clientY - rect.top) / rect.height) * h;
    setCursorData(screenToData(sx, sy, activeView, PROJECTION_SCREEN));

    if (!dragRef.current.active) return;
    const dSx = sx - dragRef.current.lastSx;
    const dSy = sy - dragRef.current.lastSy;
    dragRef.current.lastSx = sx;
    dragRef.current.lastSy = sy;
    // Screen delta → data delta (invert SVG y).
    const innerW = w - 2 * m;
    const innerH = h - 2 * m;
    const dDataX = -(dSx / innerW) * activeView.spanX;
    const dDataY = (dSy / innerH) * activeView.spanY;
    setView(panViewTransform(activeView, dDataX, dDataY));
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const resetView = () => {
    setView(fitViewTransform(bounds, { padFraction: 0.12, zoom: 1, panX: 0, panY: 0 }));
  };

  const zoomBy = (factor: number) => {
    const focusX = activeView.originX + activeView.spanX / 2;
    const focusY = activeView.originY + activeView.spanY / 2;
    setView(zoomViewTransform(activeView, clampZoom(activeView.zoom * factor), focusX, focusY));
  };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col gap-2"
      data-projection-widget
      data-projection-professional
      data-projection-display-mode={displayMode}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" data-projection-zoom-controls>
          <div
            className="flex items-center gap-0.5 rounded-lg border border-neutral-700 bg-neutral-950 p-0.5"
            data-projection-display-toggle
            role="group"
            aria-label="Projection display mode"
          >
            <button
              type="button"
              onClick={() => onDisplayModeChange?.("trajectory")}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                displayMode === "trajectory"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              data-projection-mode-trajectory
              aria-pressed={displayMode === "trajectory"}
            >
              Trajectory
            </button>
            <button
              type="button"
              onClick={() => onDisplayModeChange?.("latest")}
              className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                displayMode === "latest"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              data-projection-mode-latest
              aria-pressed={displayMode === "latest"}
            >
              Latest position
            </button>
          </div>
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:border-neutral-500"
            data-projection-zoom-in
            aria-label="Zoom in"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:border-neutral-500"
            data-projection-zoom-out
            aria-label="Zoom out"
          >
            Zoom −
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:border-neutral-500"
            data-projection-reset
            aria-label="Reset view"
          >
            Fit
          </button>
          <span className="ml-1 font-mono text-[10px] text-neutral-500" data-projection-zoom-level>
            {activeView.zoom.toFixed(2)}×
          </span>
        </div>
        <div
          className="font-mono text-[10px] tabular-nums text-neutral-500"
          data-projection-cursor-coords
        >
          {cursorData
            ? `x ${cursorData.x.toFixed(4)} · y ${cursorData.y.toFixed(4)}`
            : "Scroll to zoom · drag to pan"}
        </div>
      </div>

      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-[#070708]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="h-full min-h-[28rem] w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label="Knowledge config projection space with grid, coordinates, and zoom"
          data-projection-canvas
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={(e) => {
            setCursorData(null);
            endDrag(e);
          }}
        >
          <defs>
            <linearGradient id="knowledgecfg-path" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.95" />
            </linearGradient>
            <clipPath id="projection-plot-clip">
              <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} />
            </clipPath>
          </defs>

          {/* Plot background */}
          <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill="#0b0b0d" />

          {/* Coordinate grid */}
          <g data-projection-grid>
            {ticks.xTicks.map((t, i) => {
              const p = mapPoint(t.data, activeView.originY);
              return (
                <g key={`vx-${i}-${t.data}`}>
                  <line
                    x1={p.x}
                    y1={m}
                    x2={p.x}
                    y2={h - m}
                    stroke="#1f1f23"
                    strokeWidth={1}
                  />
                  <text
                    x={p.x}
                    y={h - m + 16}
                    fill="#737373"
                    fontSize="11"
                    textAnchor="middle"
                    className="select-none"
                    data-projection-tick-x
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}
            {ticks.yTicks.map((t, i) => {
              const p = mapPoint(activeView.originX, t.data);
              return (
                <g key={`hy-${i}-${t.data}`}>
                  <line
                    x1={m}
                    y1={p.y}
                    x2={w - m}
                    y2={p.y}
                    stroke="#1f1f23"
                    strokeWidth={1}
                  />
                  <text
                    x={m - 8}
                    y={p.y + 4}
                    fill="#737373"
                    fontSize="11"
                    textAnchor="end"
                    className="select-none"
                    data-projection-tick-y
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Axis spines */}
          <g data-projection-axes>
            <line x1={m} y1={h - m} x2={w - m} y2={h - m} stroke="#404040" strokeWidth={1.25} />
            <line x1={m} y1={m} x2={m} y2={h - m} stroke="#404040" strokeWidth={1.25} />
            <text
              x={(m + w - m) / 2}
              y={h - 10}
              fill="#a3a3a3"
              fontSize="12"
              textAnchor="middle"
              className="select-none"
            >
              projection x
            </text>
            <text
              x={14}
              y={(m + h - m) / 2}
              fill="#a3a3a3"
              fontSize="12"
              textAnchor="middle"
              transform={`rotate(-90 14 ${(m + h - m) / 2})`}
              className="select-none"
            >
              projection y
            </text>
          </g>

          <g clipPath="url(#projection-plot-clip)">
            {/* Region overlays */}
            {regionOverlays.map((region, i) => {
              const color = REGION_OVERLAY_COLORS[i % REGION_OVERLAY_COLORS.length];
              const c = mapPoint(region.x, region.y);
              const rr = mapRadiusToScreen(region.radius, activeView, PROJECTION_SCREEN);
              return (
                <g key={region.id} data-region-overlay={region.id}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={rr}
                    fill={color}
                    fillOpacity={0.1}
                    stroke={color}
                    strokeOpacity={0.85}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                  />
                  <circle cx={c.x} cy={c.y} r={3.5} fill={color} stroke="#0a0a0a" strokeWidth={0.8} />
                  <text
                    x={c.x + 8}
                    y={c.y - 8}
                    fill={color}
                    fontSize="11"
                    className="select-none"
                  >
                    {region.name.length > 22 ? `${region.name.slice(0, 20)}…` : region.name}
                  </text>
                </g>
              );
            })}

            {subjectPaths.map((sp) => (
              <path
                key={sp.key}
                d={sp.d}
                fill="none"
                stroke={
                  multiSubject
                    ? subjectColorForKey(sp.key === "all" ? undefined : sp.key, subjectKeyOrder)
                    : "url(#knowledgecfg-path)"
                }
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeOpacity={multiSubject ? 0.9 : 1}
                data-projection-path
                data-projection-path-subject={sp.key === "all" ? undefined : sp.key}
              />
            ))}
            {showTrajectory
              ? displayCoords.map((c, i) => {
                  const p = mapPoint(c.x, c.y);
                  const order = i + 1;
                  const latestForSubject =
                    multiSubject && c.subjectKey
                      ? latestPoints.some(
                          (lp) =>
                            lp.subjectKey === c.subjectKey && lp.as_of_ms === c.as_of_ms,
                        )
                      : i === displayCoords.length - 1;
                  const isFirst = multiSubject
                    ? displayCoords.findIndex((x) => x.subjectKey === c.subjectKey) === i
                    : i === 0;
                  const fill = multiSubject
                    ? subjectColorForKey(c.subjectKey, subjectKeyOrder)
                    : latestForSubject
                      ? "#22d3ee"
                      : isFirst
                        ? "#a78bfa"
                        : "#818cf8";
                  const r = latestForSubject ? 5 : isFirst ? 3.5 : 2.75;
                  return (
                    <g
                      key={`${c.subjectKey || "s"}-${c.as_of_ms}-${i}`}
                      data-projection-point={
                        latestForSubject ? "latest" : isFirst ? "start" : "path"
                      }
                      data-projection-order={order}
                      data-projection-subject={c.subjectKey}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={r}
                        fill={fill}
                        opacity={0.5 + 0.5 * Math.min(1, c.confidence)}
                      />
                      <text
                        x={p.x + 6}
                        y={p.y - 5}
                        fill={latestForSubject ? "#a5f3fc" : isFirst ? "#ddd6fe" : "#c7d2fe"}
                        fontSize="10"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fontWeight={isFirst || latestForSubject ? 600 : 500}
                        className="select-none"
                        paintOrder="stroke"
                        stroke="#070708"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        data-projection-order-label={order}
                      >
                        {order}
                      </text>
                    </g>
                  );
                })
              : null}
            {!showTrajectory
              ? latestPoints.map((lp, i) => {
                  const p = mapPoint(lp.x, lp.y);
                  const fill = multiSubject
                    ? subjectColorForKey(lp.subjectKey, subjectKeyOrder)
                    : "#22d3ee";
                  return (
                    <g
                      key={`latest-${lp.subjectKey || "s"}-${lp.as_of_ms}-${i}`}
                      data-projection-point="latest"
                      data-projection-latest-position
                      data-projection-subject={lp.subjectKey}
                      data-projection-order={i + 1}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={7}
                        fill={fill}
                        stroke="#ecfeff"
                        strokeWidth="1.25"
                      />
                      <text
                        x={p.x + 8}
                        y={p.y - 6}
                        fill="#a5f3fc"
                        fontSize="10"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fontWeight={600}
                        className="select-none"
                        paintOrder="stroke"
                        stroke="#070708"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        data-projection-order-label={i + 1}
                      >
                        {i + 1}
                      </text>
                    </g>
                  );
                })
              : null}
            {showTrajectory && !multiSubject && latestPoints[0] ? (
              <circle
                cx={mapPoint(latestPoints[0].x, latestPoints[0].y).x}
                cy={mapPoint(latestPoints[0].x, latestPoints[0].y).y}
                r={6}
                fill="#22d3ee"
                stroke="#ecfeff"
                strokeWidth="1.25"
                data-projection-point="latest"
                data-projection-latest-position
                pointerEvents="none"
              />
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "cyan" | "amber" }) {
  const cls =
    tone === "cyan"
      ? "border-cyan-900/60 bg-cyan-950/40 text-cyan-200"
      : tone === "amber"
        ? "border-amber-900/60 bg-amber-950/30 text-amber-200"
        : "border-neutral-800 bg-neutral-900 text-neutral-300";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{children}</span>
  );
}

function SectionCard({
  title,
  description,
  children,
  headerRight,
  "data-section": dataSection,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
  "data-section"?: string;
}) {
  const hasHeader = Boolean(title || description || headerRight);
  return (
    <section
      data-models-section={dataSection}
      data-section={dataSection}
      className="w-full space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4"
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title ? <h3 className="text-sm font-medium text-white">{title}</h3> : null}
            {description ? (
              <div
                className={`text-xs leading-relaxed text-neutral-500 ${title ? "mt-1" : ""}`}
              >
                {description}
              </div>
            ) : null}
          </div>
          {headerRight}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function UserPicker({
  valueUserId,
  valueGuestUserId,
  currentUserId,
  availableSubjects,
  canInspectOthers,
  onChange,
  "data-picker": dataPicker,
  ariaLabel,
}: {
  valueUserId: string;
  valueGuestUserId: string;
  currentUserId?: string | null;
  availableSubjects: AvailableSubject[];
  canInspectOthers: boolean;
  onChange: (next: { userId: string; guestUserId: string }) => void;
  "data-picker"?: string;
  ariaLabel: string;
}) {
  const fieldClass =
    "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white";

  if (!canInspectOthers) {
    return (
      <div className="w-full" data-models-user-picker={dataPicker}>
        <label className="block w-full">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            User
          </span>
          <select
            value={currentUserId ? `u:${currentUserId}` : ""}
            disabled
            className={fieldClass}
            aria-label={ariaLabel}
            data-models-user-select={dataPicker}
          >
            <option value={currentUserId ? `u:${currentUserId}` : ""}>You</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="w-full" data-models-user-picker={dataPicker}>
      <label className="block w-full">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          User
        </span>
        <select
          value={selectValueFromSubject(valueUserId, valueGuestUserId, currentUserId)}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("g:")) {
              onChange({ userId: "", guestUserId: v.slice(2) });
            } else if (v.startsWith("u:")) {
              onChange({ userId: v.slice(2), guestUserId: "" });
            } else {
              onChange({ userId: currentUserId || "", guestUserId: "" });
            }
          }}
          className={fieldClass}
          aria-label={ariaLabel}
          data-models-user-select={dataPicker}
        >
          {currentUserId ? (
            <option value={`u:${currentUserId}`}>You</option>
          ) : (
            <option value="">Select user</option>
          )}
          {availableSubjects
            .filter((s) => s.user_id && s.user_id !== currentUserId)
            .map((s) => (
              <option key={subjectOptionKey(s)} value={`u:${s.user_id}`}>
                {subjectOptionLabel(s, currentUserId)}
              </option>
            ))}
          {availableSubjects
            .filter((s) => s.guest_user_id)
            .map((s) => (
              <option key={subjectOptionKey(s)} value={`g:${s.guest_user_id}`}>
                {subjectOptionLabel(s, currentUserId)}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

/**
 * Embeddings multiselect: owners pick multiple subjects; non-owners locked to self.
 * Selection keys are `u:<id>` / `g:<id>` (same as available-subjects options).
 */
function EmbeddingsUserMultiPicker({
  selectedKeys,
  currentUserId,
  availableSubjects,
  canInspectOthers,
  onChange,
  ariaLabel,
}: {
  selectedKeys: string[];
  currentUserId?: string | null;
  availableSubjects: AvailableSubject[];
  canInspectOthers: boolean;
  onChange: (keys: string[]) => void;
  ariaLabel: string;
}) {
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selfKey = currentUserId ? `u:${currentUserId}` : "";

  if (!canInspectOthers) {
    return (
      <div
        className="w-full"
        data-models-user-picker="embeddings"
        data-embeddings-user-multiselect="false"
      >
        <label className="block w-full">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            User
          </span>
          <select
            value={selfKey}
            disabled
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            aria-label={ariaLabel}
            data-models-user-select="embeddings"
          >
            <option value={selfKey}>You</option>
          </select>
        </label>
      </div>
    );
  }

  const options: AvailableSubject[] = [];
  const seen = new Set<string>();
  if (currentUserId) {
    options.push({
      user_id: currentUserId,
      guest_user_id: null,
      embedding_model_id: "",
      as_of_ms: 0,
      confidence: 0,
    });
    seen.add(selfKey);
  }
  for (const s of availableSubjects) {
    const key = subjectOptionKey(s);
    if (key === "aggregate" || seen.has(key)) continue;
    seen.add(key);
    options.push(s);
  }

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      // Keep at least one subject when possible (prefer self).
      if (next.size <= 1) return;
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  return (
    <div
      className="w-full"
      data-models-user-picker="embeddings"
      data-embeddings-user-multiselect="true"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Users
        </span>
        <span className="text-[10px] text-neutral-500" data-embeddings-selected-count>
          {selectedKeys.length || 0} selected
        </span>
      </div>
      <ul
        className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950/50 p-1"
        role="group"
        aria-label={ariaLabel}
        data-models-user-select="embeddings"
        data-embeddings-user-multi-list
      >
        {options.length === 0 ? (
          <li className="px-1.5 py-1.5 text-[11px] text-neutral-500">No subjects yet</li>
        ) : (
          options.map((s, i) => {
            const key = subjectOptionKey(s);
            const checked = selected.has(key);
            const color = SUBJECT_TRAJECTORY_COLORS[i % SUBJECT_TRAJECTORY_COLORS.length];
            return (
              <li key={key}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs transition ${
                    checked
                      ? "bg-neutral-800/80 text-white"
                      : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="rounded border-neutral-500"
                    data-embeddings-user-toggle={key}
                  />
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {subjectOptionLabel(s, currentUserId)}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
      <p className="mt-1 text-[10px] leading-snug text-neutral-500">
        Multi-select to compare trajectories on the projection.
      </p>
    </div>
  );
}

export type KnowledgePanelView = "models" | "lwm";

interface KnowledgeConfigTrajectoryPanelProps {
  workspaceId: string;
  currentUserId?: string | null;
  /** Owners may inspect other users. */
  isOwner?: boolean;
  ayclToken?: string;
  /**
   * models — embeddings + custom knowledge regions
   * lwm — Learning World Model only (own Knowledge tab)
   */
  panelView?: KnowledgePanelView;
}

export function KnowledgeConfigTrajectoryPanel({
  workspaceId,
  currentUserId = null,
  isOwner = false,
  ayclToken,
  panelView = "models",
}: KnowledgeConfigTrajectoryPanelProps) {
  const showModels = panelView === "models";
  const showLwm = panelView === "lwm";
  const canInspectOthers = Boolean(isOwner);

  // Embeddings: multiselect subject keys (`u:` / `g:`). LWM stays single-select.
  const [embSelectedKeys, setEmbSelectedKeys] = useState<string[]>([]);
  const [lwmUserId, setLwmUserId] = useState("");
  const [lwmGuestUserId, setLwmGuestUserId] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotEligibility, setSnapshotEligibility] = useState<{
    allowed: boolean;
    message?: string;
    last_eval_at?: string | null;
    new_pow_count?: number | null;
  } | null>(null);

  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [embData, setEmbData] = useState<KnowledgeConfigResponse | null>(null);
  const [lwmData, setLwmData] = useState<KnowledgeConfigResponse | null>(null);
  const [embLoading, setEmbLoading] = useState(false);
  const [lwmLoading, setLwmLoading] = useState(false);
  const [embError, setEmbError] = useState<string | null>(null);
  const [lwmError, setLwmError] = useState<string | null>(null);
  /** Full snapshot-history list for the selected LWM subject (timeline + trends). */
  const [lwmHistoryRuns, setLwmHistoryRuns] = useState<LwmSnapshotHistoryRun[]>([]);
  const [lwmHistoryLoading, setLwmHistoryLoading] = useState(false);
  const [selectedLwmRunId, setSelectedLwmRunId] = useState<string | null>(null);
  /** Date window (yyyy-mm-dd) focusing the timeline + trends. */
  const [lwmFromDate, setLwmFromDate] = useState("");
  const [lwmToDate, setLwmToDate] = useState("");
  const [lwmReportOpen, setLwmReportOpen] = useState(true);

  /** Saved knowledge regions (cohort + synthetic) for multi-select overlay. */
  const [knowledgeRegions, setKnowledgeRegions] = useState<KnowledgeRegionListItem[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(new Set());
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [projectionDisplayMode, setProjectionDisplayMode] =
    useState<ProjectionDisplayMode>("trajectory");
  const [projectionAlgorithm, setProjectionAlgorithm] =
    useState<ProjectionAlgorithmId>("random");
  /** Knowledge distance for overlaid regions vs the selected Embeddings user. */
  const [overlayDistances, setOverlayDistances] = useState<
    Record<
      string,
      {
        knowledge_distance: number;
        cosine_similarity: number;
        cosine_distance: number;
        in_region: boolean;
        region_name: string;
        error?: string;
      }
    >
  >({});
  const [overlayDistancesLoading, setOverlayDistancesLoading] = useState(false);

  // Default pickers to current user when empty.
  useEffect(() => {
    if (!currentUserId) return;
    setEmbSelectedKeys((prev) => (prev.length === 0 ? [`u:${currentUserId}`] : prev));
    if (!lwmUserId && !lwmGuestUserId) setLwmUserId(currentUserId);
  }, [currentUserId, lwmGuestUserId, lwmUserId]);

  // Non-owners cannot keep multi-select; force self.
  useEffect(() => {
    if (canInspectOthers || !currentUserId) return;
    const selfKey = `u:${currentUserId}`;
    setEmbSelectedKeys((prev) =>
      prev.length === 1 && prev[0] === selfKey ? prev : [selfKey],
    );
  }, [canInspectOthers, currentUserId]);

  const embScope = useMemo(
    () =>
      resolveEmbeddingsSubjectSelection({
        selectedKeys: embSelectedKeys,
        currentUserId,
        canInspectOthers,
      }),
    [canInspectOthers, currentUserId, embSelectedKeys],
  );

  /** Primary subject for Knowledge-distance overlay (first selected / self). */
  const embUserId = embScope.subjects[0]?.user_id ?? "";
  const embGuestUserId = embScope.subjects[0]?.guest_user_id ?? "";

  const lwmScope = useMemo(
    () =>
      resolveModelsTabScope({
        mode: "user",
        currentUserId,
        targetUserId: lwmUserId || null,
        targetGuestUserId: lwmGuestUserId || null,
        canInspectOthers,
      }),
    [canInspectOthers, currentUserId, lwmGuestUserId, lwmUserId],
  );

  const fetchKnowledgeConfig = useCallback(
    async (query: Record<string, string | undefined>) => {
      const response = await fetch("/api/workspace/knowledge-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          max_points: 120,
          ...query,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load knowledge config");
      return json as KnowledgeConfigResponse;
    },
    [ayclToken, workspaceId],
  );

  const mergeAvailableSubjects = useCallback((payload: KnowledgeConfigResponse) => {
    if (!Array.isArray(payload.available_subjects)) return;
    setAvailableSubjects((prev) => {
      const byKey = new Map(prev.map((s) => [subjectOptionKey(s), s]));
      for (const s of payload.available_subjects!) {
        byKey.set(subjectOptionKey(s), s);
      }
      return Array.from(byKey.values());
    });
  }, []);

  const loadEmbeddings = useCallback(async () => {
    setEmbLoading(true);
    setEmbError(null);
    try {
      const payload = await fetchKnowledgeConfig(embScope.query);
      setEmbData(payload);
      mergeAvailableSubjects(payload);
    } catch (err) {
      setEmbError(err instanceof Error ? err.message : "Failed to load embeddings");
    } finally {
      setEmbLoading(false);
    }
  }, [embScope.query, fetchKnowledgeConfig, mergeAvailableSubjects]);

  const loadSnapshotHistory = useCallback(async () => {
    if (!showLwm) return;
    setLwmHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceId,
        limit: "100",
        vertical: "verification",
      });
      if (ayclToken) params.set("ayclToken", ayclToken);
      if (lwmGuestUserId) params.set("guest_user_id", lwmGuestUserId);
      else if (lwmUserId) params.set("user_id", lwmUserId);
      else if (currentUserId) params.set("user_id", currentUserId);
      // Server-side date bounds when set (also re-windowed client-side for focus).
      if (lwmFromDate) params.set("from", `${lwmFromDate}T00:00:00.000Z`);
      if (lwmToDate) params.set("to", `${lwmToDate}T23:59:59.999Z`);

      const response = await fetch(`/api/workspace/snapshot-history?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLwmHistoryRuns([]);
        return;
      }
      const runs = (Array.isArray(data.runs) ? data.runs : []).map(
        (r: Record<string, unknown>) =>
          ({
            id: String(r.id || ""),
            ran_at: String(r.ran_at || r.created_at || ""),
            score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
            ghc_score:
              r.ghc_score == null
                ? null
                : typeof r.ghc_score === "number"
                  ? r.ghc_score
                  : Number(r.ghc_score),
            report:
              r.report && typeof r.report === "object"
                ? (r.report as PerformanceReport)
                : null,
            source: typeof r.source === "string" ? r.source : undefined,
            vertical: typeof r.vertical === "string" ? r.vertical : undefined,
          }) satisfies LwmSnapshotHistoryRun,
      ).filter((r: LwmSnapshotHistoryRun) => r.id && r.ran_at);
      setLwmHistoryRuns(runs);
    } catch {
      setLwmHistoryRuns([]);
    } finally {
      setLwmHistoryLoading(false);
    }
  }, [
    ayclToken,
    currentUserId,
    lwmFromDate,
    lwmGuestUserId,
    lwmToDate,
    lwmUserId,
    showLwm,
    workspaceId,
  ]);

  const loadLwm = useCallback(async () => {
    setLwmLoading(true);
    setLwmError(null);
    try {
      const payload = await fetchKnowledgeConfig(lwmScope.query);
      setLwmData(payload);
      mergeAvailableSubjects(payload);
      await loadSnapshotHistory();
    } catch (err) {
      setLwmError(err instanceof Error ? err.message : "Failed to load learning world model");
    } finally {
      setLwmLoading(false);
    }
  }, [fetchKnowledgeConfig, loadSnapshotHistory, lwmScope.query, mergeAvailableSubjects]);

  const loadSnapshotEligibility = useCallback(async () => {
    if (!currentUserId && !lwmUserId && !lwmGuestUserId) {
      setSnapshotEligibility(null);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("workspaceId", workspaceId);
      params.set("limit", "1");
      if (ayclToken) params.set("ayclToken", ayclToken);
      const subjectUser = lwmUserId || currentUserId;
      if (lwmGuestUserId) params.set("guest_user_id", lwmGuestUserId);
      else if (subjectUser) params.set("user_id", subjectUser);

      const response = await fetch(`/api/workspace/snapshot-history?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSnapshotEligibility({ allowed: true });
        return;
      }
      const eligibility = (data.eligibility || {}) as Record<
        string,
        { allowed?: boolean; message?: string; last_eval_at?: string | null; new_pow_count?: number | null }
      >;
      // Single strategy: verification / lwm snapshot gate
      const status = eligibility.verification ?? Object.values(eligibility)[0];
      if (!status) {
        setSnapshotEligibility({ allowed: true });
        return;
      }
      setSnapshotEligibility({
        allowed: status.allowed !== false,
        message: status.message,
        last_eval_at: status.last_eval_at,
        new_pow_count: status.new_pow_count,
      });
    } catch {
      setSnapshotEligibility({ allowed: true });
    }
  }, [ayclToken, currentUserId, lwmGuestUserId, lwmUserId, workspaceId]);

  const generateSnapshot = useCallback(async () => {
    if (snapshotEligibility && !snapshotEligibility.allowed) {
      setSnapshotError(
        snapshotEligibility.message ||
          "No new proof of work since the last LWM Snapshot for this user.",
      );
      return;
    }
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const body: Record<string, string> = { workspaceId };
      if (ayclToken) body.ayclToken = ayclToken;
      if (lwmGuestUserId) body.guest_user_id = lwmGuestUserId;
      else if (lwmUserId) body.user_id = lwmUserId;

      const response = await fetch("/api/workspace/performance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to generate LWM Snapshot",
        );
      }
      await loadLwm();
      await loadSnapshotEligibility();
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to generate LWM Snapshot");
    } finally {
      setSnapshotLoading(false);
    }
  }, [
    ayclToken,
    loadLwm,
    loadSnapshotEligibility,
    lwmGuestUserId,
    lwmUserId,
    snapshotEligibility,
    workspaceId,
  ]);

  const loadRegionsForOverlay = useCallback(async () => {
    if (!showModels) return;
    setRegionsLoading(true);
    setRegionsError(null);
    try {
      const res = await fetch(
        `/api/workspace/custom-knowledge-regions?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not load knowledge regions",
        );
      }
      const nextModels = (Array.isArray(data.models) ? data.models : []).map(
        (m: Record<string, unknown>) =>
          ({
            id: String(m.id),
            name: String(m.name),
            description: (m.description as string | null) ?? null,
            subject_count: Number(m.subject_count) || 0,
            cosine_threshold: Number(m.cosine_threshold) || 0.5,
            cohort_cohesion: Number(m.cohort_cohesion) || 0,
            mean_radius: Number(m.mean_radius) || 0,
            embedding_model_id: String(m.embedding_model_id || ""),
            centroid: Array.isArray(m.centroid) ? (m.centroid as number[]) : [],
            created_at: String(m.created_at || ""),
          }) satisfies KnowledgeRegionListItem,
      );
      setKnowledgeRegions(nextModels);
      // Drop selections for regions that no longer exist.
      setSelectedRegionIds((prev) => {
        const ids = new Set(nextModels.map((r: KnowledgeRegionListItem) => r.id));
        const next = new Set<string>();
        for (const id of prev) {
          if (ids.has(id)) next.add(id);
        }
        return next;
      });
    } catch (err) {
      setKnowledgeRegions([]);
      setRegionsError(err instanceof Error ? err.message : "Could not load knowledge regions");
    } finally {
      setRegionsLoading(false);
    }
  }, [showModels, workspaceId]);

  useEffect(() => {
    if (!showModels) return;
    void loadEmbeddings();
  }, [loadEmbeddings, showModels]);

  useEffect(() => {
    if (!showModels) return;
    void loadRegionsForOverlay();
  }, [loadRegionsForOverlay, showModels]);

  useEffect(() => {
    if (!showLwm) return;
    void loadLwm();
  }, [loadLwm, showLwm]);

  useEffect(() => {
    if (!showLwm) return;
    void loadSnapshotEligibility();
  }, [loadSnapshotEligibility, showLwm]);

  // When regions are overlaid, compute Knowledge distance for the selected Embeddings user.
  useEffect(() => {
    if (!showModels) return;
    const ids = Array.from(selectedRegionIds);
    if (ids.length === 0) {
      setOverlayDistances({});
      setOverlayDistancesLoading(false);
      return;
    }
    if (!embUserId && !embGuestUserId) {
      setOverlayDistances({});
      return;
    }

    let cancelled = false;
    setOverlayDistancesLoading(true);

    void (async () => {
      const next: typeof overlayDistances = {};
      await Promise.all(
        ids.map(async (regionId) => {
          try {
            const res = await fetch("/api/workspace/custom-knowledge-regions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "knowledge_distance",
                workspaceId,
                regionId,
                ...(embUserId ? { user_id: embUserId } : {}),
                ...(embGuestUserId ? { guest_user_id: embGuestUserId } : {}),
                ...(ayclToken ? { ayclToken } : {}),
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (cancelled) return;
            if (!res.ok) {
              next[regionId] = {
                knowledge_distance: NaN,
                cosine_similarity: NaN,
                cosine_distance: NaN,
                in_region: false,
                region_name:
                  knowledgeRegions.find((r) => r.id === regionId)?.name ?? regionId,
                error:
                  typeof data.error === "string" ? data.error : "Distance unavailable",
              };
              return;
            }
            const kd = data.knowledge_distance as {
              knowledge_distance: number;
              cosine_similarity: number;
              cosine_distance: number;
              in_region: boolean;
              region_name?: string;
            };
            next[regionId] = {
              knowledge_distance: Number(kd.knowledge_distance),
              cosine_similarity: Number(kd.cosine_similarity),
              cosine_distance: Number(kd.cosine_distance),
              in_region: Boolean(kd.in_region),
              region_name:
                kd.region_name ||
                knowledgeRegions.find((r) => r.id === regionId)?.name ||
                regionId,
            };
          } catch (err) {
            if (cancelled) return;
            next[regionId] = {
              knowledge_distance: NaN,
              cosine_similarity: NaN,
              cosine_distance: NaN,
              in_region: false,
              region_name:
                knowledgeRegions.find((r) => r.id === regionId)?.name ?? regionId,
              error: err instanceof Error ? err.message : "Distance unavailable",
            };
          }
        }),
      );
      if (!cancelled) {
        setOverlayDistances(next);
        setOverlayDistancesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ayclToken,
    embGuestUserId,
    embUserId,
    knowledgeRegions,
    selectedRegionIds,
    showModels,
    workspaceId,
  ]);

  const wm = lwmData?.learning_world_model;
  const scores = wm?.scores_snapshot;
  const kc = lwmData?.knowledge_config;

  /** Client-side date window focus (also sent server-side on history load). */
  const windowedLwmRuns = useMemo(
    () =>
      filterLwmHistoryByDateWindow(lwmHistoryRuns, {
        from: lwmFromDate || null,
        to: lwmToDate || null,
      }),
    [lwmFromDate, lwmHistoryRuns, lwmToDate],
  );

  const selectedLwmRun = useMemo(
    () => selectLwmHistoryRun(windowedLwmRuns, selectedLwmRunId),
    [selectedLwmRunId, windowedLwmRuns],
  );

  // Keep selection valid when window / subject history changes.
  useEffect(() => {
    if (!selectedLwmRun) {
      if (selectedLwmRunId) setSelectedLwmRunId(null);
      return;
    }
    if (selectedLwmRun.id !== selectedLwmRunId) {
      setSelectedLwmRunId(selectedLwmRun.id);
    }
  }, [selectedLwmRun, selectedLwmRunId]);

  const lwmTimelineMarkers = useMemo(
    () => timelineMarkersFromRuns(windowedLwmRuns),
    [windowedLwmRuns],
  );

  const lwmScoreSeries = useMemo(
    () => dualScoreSeriesFromRuns(windowedLwmRuns),
    [windowedLwmRuns],
  );

  const selectedRunReport = useMemo(() => {
    const report = selectedLwmRun?.report;
    return report && typeof report === "object" ? (report as PerformanceReport) : null;
  }, [selectedLwmRun]);

  /** Prefer selected history scores; fall back to live LWM snapshot scores. */
  const displaySnapScore =
    selectedLwmRun != null
      ? Math.round(selectedLwmRun.score)
      : scores?.verification_score != null
        ? Math.round(scores.verification_score)
        : null;
  const displayGhcScore =
    selectedLwmRun != null
      ? selectedLwmRun.ghc_score != null
        ? Math.round(selectedLwmRun.ghc_score)
        : null
      : scores?.ghc_score != null
        ? Math.round(scores.ghc_score)
        : null;

  const lwmUpdatedLabel = useMemo(() => {
    const iso = selectedLwmRun?.ran_at || wm?.updated_at || kc?.as_of || null;
    if (!iso) return null;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return iso;
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ms));
    } catch {
      return iso;
    }
  }, [kc?.as_of, selectedLwmRun?.ran_at, wm?.updated_at]);

  /** Joint 2D layout under the selected algorithm (trajectory + selected regions). */
  const projectedLayout = useMemo(() => {
    const selected = knowledgeRegions.filter(
      (r) => selectedRegionIds.has(r.id) && Array.isArray(r.centroid) && r.centroid.length > 0,
    );
    const regionInputs = selected.map((r) => ({
      id: r.id,
      name: r.name,
      centroid: r.centroid,
      mean_radius: r.mean_radius,
      cosine_threshold: r.cosine_threshold,
      source: r.description?.includes("[synthetic:grok-4.5]") ? "synthetic:grok-4.5" : "cohort",
    }));

    const rawPoints = embData?.trajectory.points;
    if (Array.isArray(rawPoints) && rawPoints.length > 0) {
      const layout = projectTrajectoryAndRegions({
        points: rawPoints.map((p) => ({
          t: p.t,
          as_of_ms: p.as_of_ms,
          vector: Array.isArray(p.vector) ? p.vector : [],
          confidence: p.confidence,
        })),
        regions: regionInputs,
        algorithm: projectionAlgorithm,
      });
      // Re-attach subject identity by index (joint layout preserves point order).
      return {
        ...layout,
        coords: layout.coords.map((c, i) => ({
          ...c,
          subjectKey: trajectoryPointSubjectKey(rawPoints[i] || {}),
        })),
      };
    }

    // Fallback: server-provided coords (random frame) when high-D points are absent.
    const serverCoords = embData?.trajectory.projection.coords ?? [];
    if (projectionAlgorithm === "random" || serverCoords.length === 0) {
      const regionOnly = projectTrajectoryAndRegions({
        points: [],
        regions: regionInputs,
        algorithm: projectionAlgorithm,
      });
      return {
        ...regionOnly,
        coords: serverCoords.map((c) => ({
          t: c.t,
          as_of_ms: c.as_of_ms,
          x: c.x,
          y: c.y,
          confidence: c.confidence,
          subjectKey: c.subjectKey,
        })),
      };
    }

    return projectTrajectoryAndRegions({
      points: [],
      regions: regionInputs,
      algorithm: projectionAlgorithm,
    });
  }, [embData, knowledgeRegions, projectionAlgorithm, selectedRegionIds]);

  const coords = projectedLayout.coords;
  const regionOverlays = projectedLayout.regionOverlays as KnowledgeRegionOverlay2D[];

  const toggleRegionOverlay = (id: string) => {
    setSelectedRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summary = useMemo(() => {
    if (!embData) return null;
    return {
      confidence: embData.knowledge_config.confidence,
      pathLength: embData.trajectory.path_length,
      points: embData.trajectory.point_count,
      model: embData.knowledge_config.embedding_model_id,
      empty: embData.knowledge_config.empty,
    };
  }, [embData]);

  return (
    <div
      className={
        showModels
          ? "flex w-full min-h-0 flex-1 flex-col overflow-hidden"
          : "flex w-full min-h-0 flex-1 flex-col gap-5 overflow-y-auto"
      }
      data-models-tab={showModels ? "true" : undefined}
      data-lwm-tab={showLwm ? "true" : undefined}
      data-knowledge-panel-view={panelView}
    >
      {/* Embeddings: left sidebar (user + regions) | right projection — no whole-tab scroll */}
      {showModels ? (
        <div
          data-section="embeddings-projections"
          data-models-section="embeddings-projections"
          data-embeddings-layout="sidebar-projection"
          className="flex min-h-0 w-full flex-1 flex-col gap-2"
          aria-label="Embeddings Projections"
        >
          <div className="flex min-h-0 flex-1 gap-3">
            {/* Left sidebar: pickers only */}
            <aside
              data-embeddings-sidebar
              className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto sm:w-64"
            >
              <p className="text-[11px] leading-relaxed text-neutral-500">
                Trajectory in{" "}
                <span className="font-mono text-neutral-400">knowledgecfg-v1-d64</span>. Overlay
                regions from Settings.
              </p>

              {/* data-picker="embeddings" anchors sidebar layout tests + multiselect control */}
              <div data-picker="embeddings" className="w-full">
                <EmbeddingsUserMultiPicker
                  ariaLabel="Embeddings projections users"
                  selectedKeys={embSelectedKeys}
                  currentUserId={currentUserId}
                  availableSubjects={availableSubjects}
                  canInspectOthers={canInspectOthers}
                  onChange={setEmbSelectedKeys}
                />
              </div>

              <div className="w-full" data-projection-algorithm-picker>
                <label className="block w-full">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                    Projection
                  </span>
                  <select
                    value={projectionAlgorithm}
                    onChange={(e) =>
                      setProjectionAlgorithm(parseProjectionAlgorithmId(e.target.value, "random"))
                    }
                    aria-label="2D projection algorithm"
                    data-projection-algorithm-select
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white outline-none transition hover:border-neutral-500 focus:border-neutral-500"
                  >
                    {PROJECTION_ALGORITHM_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} title={opt.description}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div
                data-region-overlay-picker
                aria-label="Region overlay multi-select"
                className="flex min-h-0 flex-1 flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    Overlay knowledge regions
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadRegionsForOverlay()}
                    disabled={regionsLoading}
                    className="shrink-0 text-[11px] text-neutral-400 underline decoration-neutral-700 underline-offset-2 transition hover:text-neutral-200 disabled:opacity-40"
                    data-region-overlay-refresh
                  >
                    {regionsLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>

                <div data-region-overlay-body className="min-h-0 flex-1">
                  {regionsLoading && knowledgeRegions.length === 0 ? (
                    <p className="text-xs text-neutral-500" data-region-overlay-loading>
                      Loading knowledge regions…
                    </p>
                  ) : regionsError ? (
                    <div className="text-xs text-red-300" data-region-overlay-error>
                      <p>{regionsError}</p>
                      <button
                        type="button"
                        onClick={() => void loadRegionsForOverlay()}
                        className="mt-1 text-[11px] text-red-200 underline decoration-red-800 underline-offset-2 hover:text-white"
                      >
                        Retry
                      </button>
                    </div>
                  ) : knowledgeRegions.length === 0 ? (
                    <div className="text-xs text-neutral-400" data-region-overlay-empty>
                      <p className="font-medium text-neutral-300">No knowledge regions yet</p>
                      <p className="mt-1 text-neutral-500">
                        Create under Settings → Custom Knowledge Regions, then multi-select here.
                      </p>
                    </div>
                  ) : (
                    <ul
                      className="flex flex-col gap-1"
                      data-region-overlay-list
                      role="group"
                      aria-label="Select regions to overlay"
                    >
                      {knowledgeRegions.map((r, i) => {
                        const checked = selectedRegionIds.has(r.id);
                        const color = REGION_OVERLAY_COLORS[i % REGION_OVERLAY_COLORS.length];
                        const hasCentroid = Array.isArray(r.centroid) && r.centroid.length > 0;
                        const dist = checked ? overlayDistances[r.id] : undefined;
                        return (
                          <li key={r.id}>
                            <label
                              className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs transition ${
                                checked
                                  ? "bg-neutral-800/80 text-white"
                                  : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                              } ${!hasCentroid ? "opacity-50" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!hasCentroid}
                                onChange={() => toggleRegionOverlay(r.id)}
                                className="rounded border-neutral-500"
                                data-region-overlay-toggle={r.id}
                              />
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate">{r.name}</span>
                              {!hasCentroid ? (
                                <span className="shrink-0 text-[10px] text-neutral-500">
                                  no centroid
                                </span>
                              ) : null}
                              {checked && dist && !dist.error && Number.isFinite(dist.knowledge_distance) ? (
                                <span
                                  className="shrink-0 font-mono text-[10px] text-violet-200"
                                  data-knowledge-distance-inline={r.id}
                                  title={`Knowledge distance ${dist.knowledge_distance.toFixed(4)}`}
                                >
                                  d={dist.knowledge_distance.toFixed(3)}
                                </span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {regionOverlays.length > 0 ? (
                  <div className="space-y-2" data-region-overlay-distances>
                    <p className="text-[11px] text-cyan-200/80" data-region-overlay-count>
                      {regionOverlays.length} region{regionOverlays.length === 1 ? "" : "s"} selected
                      {overlayDistancesLoading ? " · computing distance…" : ""}
                    </p>
                    <ul className="space-y-1.5" data-knowledge-distance-list>
                      {regionOverlays.map((overlay, i) => {
                        const dist = overlayDistances[overlay.id];
                        const color =
                          REGION_OVERLAY_COLORS[i % REGION_OVERLAY_COLORS.length];
                        return (
                          <li
                            key={overlay.id}
                            className="rounded-md bg-neutral-900/70 px-2 py-1.5 text-[10px]"
                            data-knowledge-distance={overlay.id}
                          >
                            <div className="flex items-center gap-1.5 text-neutral-200">
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {overlay.name}
                              </span>
                            </div>
                            {dist?.error ? (
                              <p className="mt-0.5 text-amber-200/90">{dist.error}</p>
                            ) : dist && Number.isFinite(dist.knowledge_distance) ? (
                              <div className="mt-1 flex flex-wrap gap-1.5 text-neutral-400">
                                <span className="rounded-full border border-violet-800/60 bg-violet-950/40 px-1.5 py-0.5 font-mono text-violet-100">
                                  dist {dist.knowledge_distance.toFixed(4)}
                                </span>
                                <span className="rounded-full border border-neutral-700 px-1.5 py-0.5 font-mono">
                                  cos {dist.cosine_similarity.toFixed(3)}
                                </span>
                                <span
                                  className={`rounded-full border px-1.5 py-0.5 ${
                                    dist.in_region
                                      ? "border-emerald-800 text-emerald-300"
                                      : "border-amber-900 text-amber-200"
                                  }`}
                                >
                                  {dist.in_region ? "In region" : "Outside"}
                                </span>
                              </div>
                            ) : overlayDistancesLoading ? (
                              <p className="mt-0.5 text-neutral-500">Computing…</p>
                            ) : (
                              <p className="mt-0.5 text-neutral-500">—</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : knowledgeRegions.length > 0 && !regionsLoading ? (
                  <p className="text-[11px] text-neutral-500" data-region-overlay-hint>
                    Select regions to draw on the projection and see Knowledge distance.
                  </p>
                ) : null}
              </div>

              {summary ? (
                <div className="mt-auto shrink-0 border-t border-neutral-800/80 pt-3">
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div>
                      <dt className="text-neutral-500">Confidence</dt>
                      <dd className="font-mono text-neutral-200">
                        {(summary.confidence * 100).toFixed(0)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Path</dt>
                      <dd className="font-mono text-neutral-200">
                        {summary.pathLength.toFixed(3)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Samples</dt>
                      <dd className="font-mono text-neutral-200">{summary.points}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-neutral-500">Model</dt>
                      <dd className="truncate font-mono text-neutral-300">{summary.model}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </aside>

            {/* Right: projection fills remaining height */}
            <div
              data-embeddings-projection
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-neutral-500">
                  {embScope.label ? (
                    <span className="text-neutral-400">{embScope.label}</span>
                  ) : (
                    <span>Knowledge config trajectory</span>
                  )}
                  {summary ? (
                    <span className="text-neutral-600">
                      {" "}
                      · {summary.points} sample{summary.points === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => void loadEmbeddings()}
                  disabled={embLoading}
                  data-embeddings-refresh
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
                >
                  <svg
                    className={`h-3 w-3 ${embLoading ? "animate-spin" : ""}`}
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 1v3l2-1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {embLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {embError ? (
                <div className="shrink-0 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {embError}
                </div>
              ) : null}

              {embLoading && !embData && regionOverlays.length === 0 ? (
                <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-neutral-500">
                  Loading trajectory…
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ProjectionSpaceWidget
                    coords={coords}
                    regionOverlays={regionOverlays}
                    displayMode={projectionDisplayMode}
                    onDisplayModeChange={setProjectionDisplayMode}
                  />
                </div>
              )}

              <div className="flex shrink-0 flex-wrap gap-2 text-[10px] text-neutral-500">
                {embScope.kind === "multi" && embScope.subjects.length > 1 ? (
                  embScope.subjects.map((s, i) => {
                    const key = subjectOptionKey(s);
                    const color =
                      SUBJECT_TRAJECTORY_COLORS[i % SUBJECT_TRAJECTORY_COLORS.length];
                    const label =
                      s.guest_user_id
                        ? `Guest ${s.guest_user_id.slice(0, 8)}…`
                        : s.user_id && s.user_id === currentUserId
                          ? "You"
                          : s.user_id
                            ? `User ${s.user_id.slice(0, 8)}…`
                            : key;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1"
                        data-embeddings-subject-legend={key}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />{" "}
                        {label}
                      </span>
                    );
                  })
                ) : (
                  <>
                    {projectionDisplayMode === "trajectory" ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-violet-400" /> start
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" /> latest
                    </span>
                  </>
                )}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-pink-400 bg-pink-400/30" />{" "}
                  region overlay
                </span>
                <span data-projection-mode-hint>
                  {projectionDisplayMode === "latest"
                    ? embScope.kind === "multi"
                      ? "Latest position per selected user · view fits positions + regions"
                      : "Latest position only · view fits position + selected regions"
                    : embScope.kind === "multi"
                      ? "Multi-user trajectories · ℝ⁶⁴ → 2D"
                      : "Full trajectory · ℝ⁶⁴ → 2D"}
                </span>
                <span className="text-neutral-400" data-projection-algorithm-hint>
                  ·{" "}
                  {PROJECTION_ALGORITHM_OPTIONS.find((o) => o.id === projectionAlgorithm)?.label ??
                    projectionAlgorithm}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Learning World Model — timeline + dual score trends + selected snapshot card */}
      {showLwm ? (
        <section
          data-section="lwm"
          data-lwm-layout="timeline"
          className="flex w-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4"
        >
          {/* Nav: user + date window + generate */}
          <div
            className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-800 bg-neutral-950/50 p-3"
            data-lwm-filters
          >
            <div className="min-w-[11rem] flex-1" data-lwm-controls-column>
              <UserPicker
                data-picker="lwm"
                ariaLabel="Learning world model user"
                valueUserId={lwmUserId}
                valueGuestUserId={lwmGuestUserId}
                currentUserId={currentUserId}
                availableSubjects={availableSubjects}
                canInspectOthers={canInspectOthers}
                onChange={({ userId, guestUserId }) => {
                  setLwmUserId(userId);
                  setLwmGuestUserId(guestUserId);
                  setSelectedLwmRunId(null);
                }}
              />
            </div>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
              From
              <input
                type="date"
                value={lwmFromDate}
                onChange={(e) => setLwmFromDate(e.target.value)}
                data-lwm-date-from
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
              To
              <input
                type="date"
                value={lwmToDate}
                onChange={(e) => setLwmToDate(e.target.value)}
                data-lwm-date-to
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-500"
              />
            </label>
            {(lwmFromDate || lwmToDate) && (
              <button
                type="button"
                data-lwm-date-clear
                onClick={() => {
                  setLwmFromDate("");
                  setLwmToDate("");
                }}
                className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-[11px] text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
              >
                Clear dates
              </button>
            )}
            <div className="ml-auto flex flex-col items-stretch gap-1" data-lwm-snapshot-controls>
              <button
                type="button"
                onClick={() => void generateSnapshot()}
                disabled={
                  snapshotLoading ||
                  (!currentUserId && !lwmUserId && !lwmGuestUserId) ||
                  snapshotEligibility?.allowed === false
                }
                title={
                  snapshotEligibility?.allowed === false
                    ? snapshotEligibility.message ||
                      "No new proof of work since the last LWM Snapshot for this user."
                    : "Generate a new Learning World Model Snapshot for the selected user"
                }
                className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                data-lwm-generate-snapshot
              >
                {snapshotLoading ? "Generating…" : "Generate snapshot"}
              </button>
              {snapshotEligibility?.allowed === false ? (
                <p className="max-w-[14rem] text-[10px] text-neutral-500" data-lwm-snapshot-gate>
                  {snapshotEligibility.message || "No new PoW since last snapshot."}
                </p>
              ) : null}
              {snapshotError ? (
                <p className="max-w-[14rem] text-[10px] text-red-400" data-lwm-snapshot-error>
                  {snapshotError}
                </p>
              ) : null}
            </div>
          </div>

          {lwmError ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {lwmError}
            </div>
          ) : null}

          {/* Horizontal snapshot timeline */}
          <div
            className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-4"
            data-lwm-timeline
            role="listbox"
            aria-label="Snapshot timeline"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[1.4px] text-neutral-400">
                Timeline
              </span>
              <span className="text-[10px] text-neutral-500" data-lwm-timeline-count>
                {lwmHistoryLoading
                  ? "Loading…"
                  : `${windowedLwmRuns.length} snapshot${windowedLwmRuns.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {windowedLwmRuns.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500" data-lwm-timeline-empty>
                {lwmHistoryLoading
                  ? "Loading snapshots…"
                  : "No snapshots in this window. Generate one or widen the date range."}
              </p>
            ) : (
              <div className="relative mx-2 h-16" data-lwm-timeline-track>
                <div
                  className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-neutral-700"
                  aria-hidden
                />
                {lwmTimelineMarkers.map((m) => {
                  const selected = selectedLwmRun?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-lwm-timeline-point={m.id}
                      title={`${m.ran_at} · snap ${m.snapshotScore ?? "—"} · GHC ${m.ghcScore ?? "—"}`}
                      onClick={() => setSelectedLwmRunId(m.id)}
                      className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                      style={{ left: `${m.t * 100}%` }}
                    >
                      <span
                        className={`block h-3.5 w-3.5 rounded-full border-2 transition ${
                          selected
                            ? "scale-125 border-cyan-200 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.55)]"
                            : "border-neutral-500 bg-neutral-800 hover:border-cyan-400/80 hover:bg-cyan-900/50"
                        }`}
                      />
                      <span
                        className={`max-w-[4.5rem] truncate font-mono text-[9px] tabular-nums ${
                          selected ? "text-cyan-200" : "text-neutral-500"
                        }`}
                      >
                        {new Date(m.atMs).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dual score trend */}
          <div
            className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"
            data-lwm-score-trend
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[1.4px] text-neutral-400">
                Score trends
              </span>
              <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full bg-cyan-400" /> Snapshot
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full bg-amber-400" /> GHC
                </span>
              </div>
            </div>
            {lwmScoreSeries.length < 1 ? (
              <p className="py-8 text-center text-xs text-neutral-500">No score history yet.</p>
            ) : (
              <svg
                viewBox="0 0 480 140"
                className="h-36 w-full"
                role="img"
                aria-label="Snapshot and GHC scores over time"
                data-lwm-score-trend-chart
              >
                {[0, 25, 50, 75, 100].map((y) => {
                  const py = 8 + (1 - y / 100) * 124;
                  return (
                    <g key={y}>
                      <line
                        x1={8}
                        x2={472}
                        y1={py}
                        y2={py}
                        stroke="#262626"
                        strokeWidth={1}
                      />
                      <text x={4} y={py + 3} fill="#525252" fontSize={9} textAnchor="start">
                        {y}
                      </text>
                    </g>
                  );
                })}
                {(() => {
                  const snap = scoreSeriesPolyline(lwmScoreSeries, "snapshotScore", 480, 140, 8);
                  const ghc = scoreSeriesPolyline(lwmScoreSeries, "ghcScore", 480, 140, 8);
                  return (
                    <>
                      {ghc ? (
                        <polyline
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={ghc}
                          data-lwm-trend-ghc
                        />
                      ) : null}
                      {snap ? (
                        <polyline
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth={2.25}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={snap}
                          data-lwm-trend-snapshot
                        />
                      ) : null}
                      {lwmScoreSeries.map((p) => {
                        if (p.snapshotScore == null) return null;
                        const minT = lwmScoreSeries[0].atMs;
                        const maxT = lwmScoreSeries[lwmScoreSeries.length - 1].atMs;
                        const span = Math.max(1, maxT - minT);
                        const x = 8 + ((p.atMs - minT) / span) * 464;
                        const y = 8 + (1 - p.snapshotScore / 100) * 124;
                        const selected = selectedLwmRun?.id === p.id;
                        return (
                          <circle
                            key={p.id}
                            cx={x}
                            cy={y}
                            r={selected ? 4.5 : 3}
                            fill={selected ? "#a5f3fc" : "#22d3ee"}
                            className="cursor-pointer"
                            onClick={() => setSelectedLwmRunId(p.id)}
                            data-lwm-trend-point={p.id}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            )}
          </div>

          {/* Unified selected snapshot card */}
          <div className="min-w-0" data-lwm-card-column>
            {lwmLoading && !wm && windowedLwmRuns.length === 0 ? (
              <p className="text-xs text-neutral-500">Loading learning world model…</p>
            ) : !selectedLwmRun && !wm ? (
              <p className="text-xs text-neutral-500" data-lwm-empty>
                No snapshots yet for this user.
              </p>
            ) : (
              <div
                className="relative w-full overflow-hidden rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-neutral-950 via-neutral-950 to-cyan-950/30 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_20px_50px_rgba(0,0,0,0.45)]"
                data-lwm-skill-card
                data-lwm-selected-run={selectedLwmRun?.id || undefined}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                  aria-hidden
                />
                <div
                  className="absolute right-3 top-3 z-10 max-w-[min(100%,14rem)] rounded-lg border border-white/15 bg-black/70 px-2.5 py-1.5 text-right shadow-lg backdrop-blur-sm sm:right-4 sm:top-4"
                  data-lwm-last-updated
                >
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[1.4px] text-neutral-400">
                    Snapshot
                  </p>
                  <p className="mt-0.5 text-xs font-medium tabular-nums text-white sm:text-sm">
                    {lwmUpdatedLabel || "Not yet"}
                  </p>
                </div>

                <div className="border-b border-white/5 px-4 pb-4 pt-12 sm:px-5 sm:pt-14">
                  <div className="flex min-w-0 flex-wrap items-start gap-3 pr-0 sm:pr-2">
                    <div
                      className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      data-lwm-skill-score
                    >
                      <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-cyan-100">
                        {displaySnapScore != null ? displaySnapScore : "—"}
                      </span>
                      <span className="mt-1 font-mono text-[9px] uppercase tracking-[1.2px] text-cyan-300/80">
                        snap
                      </span>
                    </div>
                    <div
                      className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      data-lwm-ghc-score
                    >
                      <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-amber-100">
                        {displayGhcScore != null ? displayGhcScore : "—"}
                      </span>
                      <span className="mt-1 font-mono text-[9px] uppercase tracking-[1.2px] text-amber-300/80">
                        GHC
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-mono text-[10px] font-medium uppercase tracking-[1.6px] text-cyan-300/90">
                        LWM Snapshot · GHC
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-white">
                        {lwmScope.label || "Selected user"}
                      </p>
                      {selectedRunReport?.summary || wm?.inferred_goal?.text ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                          {typeof selectedRunReport?.summary === "string"
                            ? selectedRunReport.summary
                            : wm?.inferred_goal?.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
                  {kc && !kc.empty ? (
                    <Chip>
                      conf {(kc.confidence * 100).toFixed(0)}% · {kc.pow_event_count} PoW
                    </Chip>
                  ) : null}
                  {selectedLwmRun?.source ? <Chip>{selectedLwmRun.source}</Chip> : null}
                  {windowedLwmRuns.length > 0 ? (
                    <Chip tone="cyan">{windowedLwmRuns.length} in window</Chip>
                  ) : null}
                </div>

                {wm ? (
                  <div className="space-y-3 border-b border-white/5 px-4 py-3 sm:px-5">
                    {wm.learning_profile?.strengths && wm.learning_profile.strengths.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {wm.learning_profile.strengths.slice(0, 8).map((s) => (
                          <Chip key={s}>{s}</Chip>
                        ))}
                      </div>
                    ) : null}
                    {wm.evidence_appetite &&
                    ((wm.evidence_appetite.want_more?.length ?? 0) > 0 ||
                      (wm.evidence_appetite.saturated?.length ?? 0) > 0) ? (
                      <div className="flex flex-wrap gap-1">
                        {(wm.evidence_appetite.want_more || []).slice(0, 6).map((item) => (
                          <Chip key={`want-${item}`} tone="cyan">
                            + {item}
                          </Chip>
                        ))}
                        {(wm.evidence_appetite.saturated || []).slice(0, 4).map((item) => (
                          <Chip key={`sat-${item}`} tone="amber">
                            sat {item}
                          </Chip>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="px-4 py-3 sm:px-5" data-lwm-selected-snapshot-report>
                  <button
                    type="button"
                    data-lwm-report-toggle
                    onClick={() => setLwmReportOpen((v) => !v)}
                    className="mb-2 flex w-full items-center justify-between text-left font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-400 hover:text-neutral-200"
                  >
                    <span>Report detail</span>
                    <span className="text-neutral-500">{lwmReportOpen ? "Hide" : "Show"}</span>
                  </button>
                  {lwmReportOpen ? (
                    selectedRunReport ? (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 sm:p-4">
                        <PerformanceReportCard
                          report={selectedRunReport}
                          layout="spacious"
                          label="Snapshot report"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">
                        No report payload on this snapshot.
                      </p>
                    )
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

    </div>
  );
}
