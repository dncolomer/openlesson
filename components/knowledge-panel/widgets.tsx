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
import type { ModelsTabSubjectRef } from "@/lib/pow-api/models-tab-scope";
import type { LwmHistoryRunLike } from "@/lib/pow-api/lwm-snapshot-history-ui";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import {
  projectTrajectoryAndRegions,
  parseProjectionAlgorithmId,
  computeProjectionFitBounds,
  fitViewTransform,
  zoomViewTransform,
  panViewTransform,
  dataToScreen,
  screenToData,
  mapRadiusToScreen,
  clampZoom,
  type KnowledgeRegionOverlay2D,
  type ViewTransform,
  type ScreenRect,
  type ProjectionDisplayMode,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import {
  MAP_INFINITE_GRID,
  mapInfiniteGridPatternAttrs,
  mapInfiniteGridPatternFill,
} from "@/lib/map-of-knowledge";

export interface LwmSnapshotHistoryRun extends LwmHistoryRunLike {
  id: string;
  ran_at: string;
  score: number;
  ghc_score: number | null;
  report?: PerformanceReport | null;
  source?: string;
  vertical?: string;
}

export interface ProjectionCoord {
  t: string;
  as_of_ms: number;
  x: number;
  y: number;
  confidence: number;
  /** Stable subject key `u:<id>` / `g:<id>` for multi-subject coloring. */
  subjectKey?: string;
}

export const REGION_OVERLAY_COLORS = [
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#a3a3a3",
  "#60a5fa",
  "#fb7185",
];

/** Distinct colors for multi-subject trajectory points / paths. */
export const SUBJECT_TRAJECTORY_COLORS = [
  "#a78bfa",
  "#e5e5e5",
  "#f472b6",
  "#34d399",
  "#a3a3a3",
  "#60a5fa",
  "#fb7185",
  "#d4d4d4",
];

export interface AvailableSubject {
  user_id: string | null;
  guest_user_id: string | null;
  embedding_model_id: string;
  as_of_ms: number;
  confidence: number;
}

export interface KnowledgeConfigResponse {
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

export function trajectoryPointSubjectKey(p: {
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
export function selectDisplayCoords(
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

export function subjectColorForKey(key: string | undefined, keyOrder: string[]): string {
  if (!key || keyOrder.length === 0) return "#a78bfa";
  const idx = keyOrder.indexOf(key);
  const i = idx >= 0 ? idx : 0;
  return SUBJECT_TRAJECTORY_COLORS[i % SUBJECT_TRAJECTORY_COLORS.length];
}

export function subjectOptionKey(s: ModelsTabSubjectRef): string {
  if (s.guest_user_id) return `g:${s.guest_user_id}`;
  if (s.user_id) return `u:${s.user_id}`;
  return "aggregate";
}

export function subjectOptionLabel(s: AvailableSubject, currentUserId?: string | null): string {
  if (s.user_id && currentUserId && s.user_id === currentUserId) return "You";
  if (s.user_id) return `User ${s.user_id.slice(0, 8)}…`;
  if (s.guest_user_id) return `Guest ${s.guest_user_id.slice(0, 8)}…`;
  return "Workspace aggregate";
}

export function selectValueFromSubject(
  userId: string,
  guestUserId: string,
  currentUserId?: string | null,
): string {
  if (guestUserId) return `g:${guestUserId}`;
  if (userId) return `u:${userId}`;
  if (currentUserId) return `u:${currentUserId}`;
  return "";
}

/** Full-bleed infinite grid canvas; small margin keeps points off the absolute edge. */
const PROJECTION_SCREEN: ScreenRect = { width: 960, height: 560, margin: 16 };

export function ProjectionSpaceWidget({
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
        className="flex min-h-[28rem] h-full w-full flex-1 items-center justify-center rounded-none border border-neutral-800 bg-neutral-950/60 text-xs text-neutral-500"
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
            className="flex items-center gap-0.5 rounded-none border border-neutral-700 bg-neutral-950 p-0.5"
            data-projection-display-toggle
            role="group"
            aria-label="Projection display mode"
          >
            <button
              type="button"
              onClick={() => onDisplayModeChange?.("trajectory")}
              className={`rounded-none px-2.5 py-1 text-[11px] transition ${
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
              className={`rounded-none px-2.5 py-1 text-[11px] transition ${
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
            className="rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:border-neutral-500"
            data-projection-zoom-in
            aria-label="Zoom in"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            className="rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:border-neutral-500"
            data-projection-zoom-out
            aria-label="Zoom out"
          >
            Zoom −
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-200 transition hover:border-neutral-500"
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

      <div
        className="relative min-h-0 w-full flex-1 overflow-hidden rounded-none border border-neutral-800"
        style={{ backgroundColor: MAP_INFINITE_GRID.background }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="h-full min-h-[28rem] w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label="Knowledge config projection space with infinite grid and zoom"
          data-projection-canvas
          data-map-infinite-grid-surface="workspace-local"
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
              <stop offset="100%" stopColor="#e5e5e5" stopOpacity="0.95" />
            </linearGradient>
            <clipPath id="projection-plot-clip">
              <rect x={0} y={0} width={w} height={h} />
            </clipPath>
            {(() => {
              const g = mapInfiniteGridPatternAttrs(`${MAP_INFINITE_GRID.patternId}-workspace`);
              return (
                <pattern
                  id={g.id}
                  width={g.width}
                  height={g.height}
                  patternUnits={g.patternUnits}
                >
                  <path d={g.pathD} fill="none" stroke={g.stroke} strokeWidth={g.strokeWidth} />
                </pattern>
              );
            })()}
          </defs>

          {/* Shared infinite grid canvas (no axes / tick labels) */}
          <g data-map-infinite-grid data-projection-grid>
            <rect width={w} height={h} fill={MAP_INFINITE_GRID.background} />
            <rect
              width={w}
              height={h}
              fill={mapInfiniteGridPatternFill(`${MAP_INFINITE_GRID.patternId}-workspace`)}
            />
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
                      ? "#e5e5e5"
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
                    : "#e5e5e5";
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
                fill="#e5e5e5"
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

export function Chip({ children }: { children: ReactNode; tone?: "neutral" | "cyan" | "amber" }) {
  const cls = "border-neutral-800 bg-neutral-900 text-neutral-300";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{children}</span>
  );
}

export function SectionCard({
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
      className="w-full space-y-3 rounded-none border border-neutral-800 bg-neutral-950/40 p-4"
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

export function UserPicker({
  valueUserId,
  valueGuestUserId,
  currentUserId,
  availableSubjects,
  canInspectOthers,
  onChange,
  "data-picker": dataPicker,
  ariaLabel,
  /** Compact LWM toolbar: no visible “User” label, tighter select. */
  compact = false,
}: {
  valueUserId: string;
  valueGuestUserId: string;
  currentUserId?: string | null;
  availableSubjects: AvailableSubject[];
  canInspectOthers: boolean;
  onChange: (next: { userId: string; guestUserId: string }) => void;
  "data-picker"?: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  const fieldClass = compact
    ? "w-full rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-white"
    : "w-full rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white";

  if (!canInspectOthers) {
    return (
      <div className="w-full" data-models-user-picker={dataPicker}>
        <select
          value={currentUserId ? `u:${currentUserId}` : ""}
          disabled
          className={fieldClass}
          aria-label={ariaLabel}
          data-models-user-select={dataPicker}
        >
          <option value={currentUserId ? `u:${currentUserId}` : ""}>You</option>
        </select>
      </div>
    );
  }

  return (
    <div className="w-full" data-models-user-picker={dataPicker}>
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
    </div>
  );
}

/**
 * Embeddings multiselect: owners pick multiple subjects; non-owners locked to self.
 * Selection keys are `u:<id>` / `g:<id>` (same as available-subjects options).
 */
export function EmbeddingsUserMultiPicker({
  selectedKeys,
  currentUserId,
  availableSubjects,
  canInspectOthers,
  onChange,
  ariaLabel,
  /** When true, list fills remaining sidebar height instead of a short max-h cap. */
  fillHeight = false,
}: {
  selectedKeys: string[];
  currentUserId?: string | null;
  availableSubjects: AvailableSubject[];
  canInspectOthers: boolean;
  onChange: (keys: string[]) => void;
  ariaLabel: string;
  fillHeight?: boolean;
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
            className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
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
      className={
        fillHeight
          ? "flex min-h-0 w-full flex-1 flex-col"
          : "w-full"
      }
      data-models-user-picker="embeddings"
      data-embeddings-user-multiselect="true"
      data-embeddings-user-list-fill={fillHeight ? "true" : "false"}
    >
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Users
        </span>
        <span className="text-[10px] text-neutral-500" data-embeddings-selected-count>
          {selectedKeys.length || 0} selected
        </span>
      </div>
      <ul
        className={
          fillHeight
            ? "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-none border border-neutral-800 bg-neutral-950/50 p-1"
            : "flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-none border border-neutral-800 bg-neutral-950/50 p-1"
        }
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
                  className={`flex cursor-pointer items-center gap-2 rounded-none px-1.5 py-1.5 text-xs transition ${
                    checked
                      ? "bg-neutral-800/80 text-white"
                      : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    className="rounded-none border-neutral-500"
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
      <p className="mt-1 shrink-0 text-[10px] leading-snug text-neutral-500">
        Multi-select to compare trajectories on the projection.
      </p>
    </div>
  );
}

