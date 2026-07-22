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
  resolveModelsTabScope,
  type ModelsTabSubjectRef,
} from "@/lib/pow-api/models-tab-scope";
import {
  projectTrajectoryAndRegions,
  PROJECTION_ALGORITHM_OPTIONS,
  parseProjectionAlgorithmId,
  computeProjectionFitBounds,
  selectProjectionDisplayPoints,
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

interface ProjectionCoord {
  t: string;
  as_of_ms: number;
  x: number;
  y: number;
  confidence: number;
}

const REGION_OVERLAY_COLORS = [
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb7185",
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
    }>;
    projection: {
      algorithm?: string;
      frame_id: string;
      coords: ProjectionCoord[];
    };
  };
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
    () => selectProjectionDisplayPoints(coords, displayMode),
    [coords, displayMode],
  );

  const bounds = useMemo(
    () =>
      computeProjectionFitBounds(
        coords.map((c) => ({ x: c.x, y: c.y })),
        regionOverlays.map((r) => ({ x: r.x, y: r.y, radius: r.radius })),
        displayMode,
      ),
    [coords, regionOverlays, displayMode],
  );

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
  const path =
    showTrajectory && displayCoords.length > 1
      ? displayCoords
          .map((c, i) => {
            const p = mapPoint(c.x, c.y);
            return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          })
          .join(" ")
      : "";

  const last = coords.length > 0 ? coords[coords.length - 1] : null;

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

            {path ? (
              <path
                d={path}
                fill="none"
                stroke="url(#knowledgecfg-path)"
                strokeWidth="2.25"
                strokeLinejoin="round"
                data-projection-path
              />
            ) : null}
            {showTrajectory
              ? displayCoords.map((c, i) => {
                  const p = mapPoint(c.x, c.y);
                  const isLast = i === displayCoords.length - 1;
                  const isFirst = i === 0;
                  const order = i + 1;
                  const fill = isLast ? "#22d3ee" : isFirst ? "#a78bfa" : "#818cf8";
                  const r = isLast ? 5 : isFirst ? 3.5 : 2.75;
                  return (
                    <g
                      key={`${c.as_of_ms}-${i}`}
                      data-projection-point={isLast ? "latest" : isFirst ? "start" : "path"}
                      data-projection-order={order}
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
                        fill={isLast ? "#a5f3fc" : isFirst ? "#ddd6fe" : "#c7d2fe"}
                        fontSize="10"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fontWeight={isFirst || isLast ? 600 : 500}
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
            {last && !showTrajectory ? (
              <g
                data-projection-point="latest"
                data-projection-latest-position
                data-projection-order={coords.length}
              >
                <circle
                  cx={mapPoint(last.x, last.y).x}
                  cy={mapPoint(last.x, last.y).y}
                  r={7}
                  fill="#22d3ee"
                  stroke="#ecfeff"
                  strokeWidth="1.25"
                />
                <text
                  x={mapPoint(last.x, last.y).x + 8}
                  y={mapPoint(last.x, last.y).y - 6}
                  fill="#a5f3fc"
                  fontSize="10"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontWeight={600}
                  className="select-none"
                  paintOrder="stroke"
                  stroke="#070708"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  data-projection-order-label={coords.length}
                >
                  {coords.length}
                </text>
              </g>
            ) : null}
            {last && showTrajectory ? (
              <circle
                cx={mapPoint(last.x, last.y).x}
                cy={mapPoint(last.x, last.y).y}
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

  // Independent per-section user pickers (no global user/user_group/all scope).
  const [embUserId, setEmbUserId] = useState("");
  const [embGuestUserId, setEmbGuestUserId] = useState("");
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

  // Default both pickers to current user when empty.
  useEffect(() => {
    if (!currentUserId) return;
    if (!embUserId && !embGuestUserId) setEmbUserId(currentUserId);
    if (!lwmUserId && !lwmGuestUserId) setLwmUserId(currentUserId);
  }, [currentUserId, embGuestUserId, embUserId, lwmGuestUserId, lwmUserId]);

  const embScope = useMemo(
    () =>
      resolveModelsTabScope({
        mode: "user",
        currentUserId,
        targetUserId: embUserId || null,
        targetGuestUserId: embGuestUserId || null,
        canInspectOthers,
      }),
    [canInspectOthers, currentUserId, embGuestUserId, embUserId],
  );

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

  const loadLwm = useCallback(async () => {
    setLwmLoading(true);
    setLwmError(null);
    try {
      const payload = await fetchKnowledgeConfig(lwmScope.query);
      setLwmData(payload);
      mergeAvailableSubjects(payload);
    } catch (err) {
      setLwmError(err instanceof Error ? err.message : "Failed to load learning world model");
    } finally {
      setLwmLoading(false);
    }
  }, [fetchKnowledgeConfig, lwmScope.query, mergeAvailableSubjects]);

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
  const lwmUpdatedAt = useMemo(() => {
    const candidates = [
      wm?.updated_at,
      kc?.as_of,
      snapshotEligibility?.last_eval_at,
    ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (candidates.length === 0) return null;
    let best: { iso: string; ms: number } | null = null;
    for (const iso of candidates) {
      const ms = Date.parse(iso);
      if (!Number.isFinite(ms)) continue;
      if (!best || ms > best.ms) best = { iso, ms };
    }
    return best;
  }, [kc?.as_of, snapshotEligibility?.last_eval_at, wm?.updated_at]);

  const lwmUpdatedLabel = useMemo(() => {
    if (!lwmUpdatedAt) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(lwmUpdatedAt.ms));
    } catch {
      return lwmUpdatedAt.iso;
    }
  }, [lwmUpdatedAt]);

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
      return projectTrajectoryAndRegions({
        points: rawPoints.map((p) => ({
          t: p.t,
          as_of_ms: p.as_of_ms,
          vector: Array.isArray(p.vector) ? p.vector : [],
          confidence: p.confidence,
        })),
        regions: regionInputs,
        algorithm: projectionAlgorithm,
      });
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

              <UserPicker
                data-picker="embeddings"
                ariaLabel="Embeddings projections user"
                valueUserId={embUserId}
                valueGuestUserId={embGuestUserId}
                currentUserId={currentUserId}
                availableSubjects={availableSubjects}
                canInspectOthers={canInspectOthers}
                onChange={({ userId, guestUserId }) => {
                  setEmbUserId(userId);
                  setEmbGuestUserId(guestUserId);
                }}
              />

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
                {projectionDisplayMode === "trajectory" ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-violet-400" /> start
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> latest
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-pink-400 bg-pink-400/30" />{" "}
                  region overlay
                </span>
                <span data-projection-mode-hint>
                  {projectionDisplayMode === "latest"
                    ? "Latest position only · view fits position + selected regions"
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

      {/* Learning World Model (own Knowledge tab) */}
      {showLwm ? (
      <SectionCard
        data-section="lwm"
        description="Select a user, generate a snapshot, and read the skill card on the right."
      >
        <div
          className="grid w-full gap-5 lg:grid-cols-2 lg:items-start lg:gap-6"
          data-lwm-split-layout
        >
          {/* Left: user + controls + how to read LWM vs Embeddings */}
          <div className="flex min-w-0 flex-col gap-4" data-lwm-controls-column>
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
          }}
        />

        {/* Generate new snapshot — enabled only when selected user has unsnapshotted PoW */}
        <div className="space-y-2" data-lwm-snapshot-controls>
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
            className="w-full rounded-lg bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
            data-lwm-generate-snapshot
          >
            {snapshotLoading ? "Generating snapshot…" : "Generate new snapshot"}
          </button>
          {snapshotEligibility?.allowed === false ? (
            <p className="text-[11px] text-neutral-500" data-lwm-snapshot-gate>
              {snapshotEligibility.message ||
                "No new proof of work since the last snapshot for this user."}
            </p>
          ) : null}
          {snapshotError ? (
            <p className="text-xs text-red-400" data-lwm-snapshot-error>
              {snapshotError}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void loadLwm()}
          disabled={lwmLoading}
          className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
        >
          {lwmLoading ? "Refreshing…" : "Refresh LWM"}
        </button>

        <div
          className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-xs leading-relaxed text-neutral-400"
          data-lwm-vs-embeddings
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[1.4px] text-neutral-300">
            How to read this
          </p>
          <p className="mt-2 text-neutral-300">
            <span className="font-medium text-white">LWM (this tab)</span> is a{" "}
            <span className="text-cyan-200/90">symbolic skill card</span>: score, strengths,
            friction, evidence appetite, and exploration for one person at the last snapshot.
            Use it when you want a scannable read of readiness and gaps.
          </p>
          <p className="mt-2">
            <span className="font-medium text-white">Embeddings (Models tab)</span> is{" "}
            <span className="text-violet-200/90">geometry over time</span>: fixed-dimension
            knowledge configs projected in 2D, trajectories, and distance to knowledge regions.
            Use it when you want motion, cohort regions, and proximity — not a prose profile.
          </p>
          <p className="mt-3 text-neutral-300" data-lwm-ghc-explain>
            <span className="font-medium text-white">GHC (Genuine Human Cognition)</span> is a{" "}
            <span className="text-amber-200/90">secondary authenticity signal</span> on the same
            snapshot (0–100). It reflects how much the proof of work looks like real human
            reasoning under pressure — think-aloud pacing, hesitation/repair, System 1 vs System 2
            traces — not just correct final answers. High LWM Snapshot with low GHC can mean
            polished outputs without grounded cognition; both scores should be read together.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-neutral-500">
            <li>Same proof of work feeds both; LWM is the narrative scorecard.</li>
            <li>Embeddings answer “where is this person in knowledge space?”</li>
            <li>Generate a new snapshot after new PoW to refresh both.</li>
          </ul>
        </div>
          </div>

          {/* Right: skill card */}
          <div className="min-w-0" data-lwm-card-column>
        {lwmError ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {lwmError}
          </div>
        ) : null}

        {lwmLoading && !wm ? (
          <p className="text-xs text-neutral-500">Loading learning world model…</p>
        ) : !wm ? (
          <p className="text-xs text-neutral-500">No learning world model for this user yet.</p>
        ) : (
          <div
            className="relative w-full overflow-hidden rounded-2xl border border-cyan-900/40 bg-gradient-to-br from-neutral-950 via-neutral-950 to-cyan-950/30 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_20px_50px_rgba(0,0,0,0.45)]"
            data-lwm-skill-card
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
              aria-hidden
            />
            {/* Floating last-snapshot timestamp */}
            <div
              className="absolute right-3 top-3 z-10 max-w-[min(100%,14rem)] rounded-lg border border-white/15 bg-black/70 px-2.5 py-1.5 text-right shadow-lg backdrop-blur-sm sm:right-4 sm:top-4"
              data-lwm-last-updated
            >
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[1.4px] text-neutral-400">
                Last snapshot
              </p>
              <p className="mt-0.5 text-xs font-medium tabular-nums text-white sm:text-sm">
                {lwmUpdatedLabel || "Not yet"}
              </p>
            </div>

            {/* Header: Snapshot score + GHC side by side */}
            <div className="border-b border-white/5 px-4 pb-4 pt-12 sm:px-5 sm:pt-14">
              <div className="flex min-w-0 flex-wrap items-start gap-3 pr-0 sm:pr-2">
                <div
                  className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  data-lwm-skill-score
                >
                  <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-cyan-100">
                    {scores?.verification_score != null
                      ? Math.round(scores.verification_score)
                      : "—"}
                  </span>
                  <span className="mt-1 font-mono text-[9px] uppercase tracking-[1.2px] text-cyan-300/80">
                    snap
                  </span>
                </div>
                <div
                  className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  data-lwm-ghc-score
                >
                  <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-amber-100">
                    {scores?.ghc_score != null ? Math.round(scores.ghc_score) : "—"}
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
                  {wm.inferred_goal?.text ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                      {wm.inferred_goal.text}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-neutral-500">Learning World Model skill profile</p>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="flex flex-wrap gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
              {kc && !kc.empty ? (
                <Chip>
                  conf {(kc.confidence * 100).toFixed(0)}% · {kc.pow_event_count} PoW
                </Chip>
              ) : null}
              {scores?.verification_score == null && scores?.ghc_score == null ? (
                <span className="text-xs text-neutral-500">No scores yet</span>
              ) : null}
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              {wm.evidence_appetite &&
                ((wm.evidence_appetite.want_more?.length ?? 0) > 0 ||
                  (wm.evidence_appetite.saturated?.length ?? 0) > 0) && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Evidence appetite
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(wm.evidence_appetite.want_more || []).map((item) => (
                        <Chip key={`want-${item}`} tone="cyan">
                          + {item}
                        </Chip>
                      ))}
                      {(wm.evidence_appetite.saturated || []).map((item) => (
                        <Chip key={`sat-${item}`} tone="amber">
                          sat {item}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

              {wm.learning_profile?.strengths && wm.learning_profile.strengths.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                    Strengths
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {wm.learning_profile.strengths.slice(0, 12).map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {wm.learning_profile?.friction_patterns &&
                wm.learning_profile.friction_patterns.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Friction patterns
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {wm.learning_profile.friction_patterns.slice(0, 8).map((s) => (
                        <Chip key={s} tone="amber">
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

              {wm.exploration &&
                ((wm.exploration.blind_spots?.length ?? 0) > 0 ||
                  (wm.exploration.pathways_touched?.length ?? 0) > 0) && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Exploration
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(wm.exploration.pathways_touched || []).slice(0, 6).map((p) => (
                        <Chip key={`path-${p}`}>{p}</Chip>
                      ))}
                      {(wm.exploration.blind_spots || []).slice(0, 6).map((b) => (
                        <Chip key={`blind-${b}`} tone="amber">
                          blind: {b}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

              {!scores?.verification_score &&
                !(wm.evidence_appetite?.want_more?.length || wm.evidence_appetite?.saturated?.length) &&
                !(wm.learning_profile?.strengths?.length) && (
                  <p className="text-xs text-neutral-500">
                    LWM is empty for this user. Generate a new snapshot when proof of work exists
                    to fill evidence appetite and strengths.
                  </p>
                )}
            </div>
          </div>
        )}
          </div>
        </div>
      </SectionCard>
      ) : null}

    </div>
  );
}
