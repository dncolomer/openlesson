"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { inspectAuthorUnsysFocus } from "@/lib/author-unsys-model";
import {
  AUTHOR_UNSYS_ROOT_COLOR,
  authorUnsysGraphEdges,
  authorUnsysRegionColor,
  seedAuthorUnsysPositions,
  type AuthorUnsysGraphPoint,
} from "@/lib/author-unsys-layout";
import type { SessionBranchModel } from "@/lib/session-branch-model";

const DRAG_THRESHOLD_PX = 4;
const GRID_FINE = 16;
const GRID_COARSE = 80;
const ZOOM_MIN = 0.12;
const ZOOM_MAX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pricedEdges(model: SessionBranchModel) {
  const prices = new Map<string, number>();
  for (const branch of model.branches) {
    for (const edge of branch.edges) {
      prices.set(`${branch.id}->${edge.toId}`, edge.price);
    }
  }
  return authorUnsysGraphEdges(model).map((edge) => ({
    ...edge,
    price: prices.get(`${edge.from}->${edge.to}`) ?? null,
  }));
}

export function WorkspaceUnsysSeedGraph({
  model,
  focusId,
  disabled = false,
  onSelect,
}: {
  model: SessionBranchModel | null;
  focusId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 480 });
  const [positions, setPositions] = useState<Record<string, AuthorUnsysGraphPoint>>(
    {},
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{
    kind: "node" | "pan";
    id?: string;
    pointerId: number;
    originX: number;
    originY: number;
    start: AuthorUnsysGraphPoint;
    moved: boolean;
  } | null>(null);
  const ignoreClickRef = useRef(false);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const panRef = useRef(pan);
  panRef.current = pan;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      setSize({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!model) {
      setPositions({});
      return;
    }
    setPositions((current) =>
      seedAuthorUnsysPositions(model, size.width, size.height, current),
    );
  }, [model, size.height, size.width]);

  const edges = useMemo(() => (model ? pricedEdges(model) : []), [model]);
  const restRoot = {
    x: size.width / 2,
    y: size.height / 2,
  };
  const recommendedToId = inspectAuthorUnsysFocus(model, focusId)?.recommendedToId ?? null;

  function clientToGraph(clientX: number, clientY: number): AuthorUnsysGraphPoint {
    const host = hostRef.current;
    if (!host) return restRoot;
    const rect = host.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / scaleRef.current,
      y: (clientY - rect.top - panRef.current.y) / scaleRef.current,
    };
  }

  function onBackgroundPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || disabled) return;
    if (
      (event.target as HTMLElement).closest(
        "[data-author-unsys-node], [data-author-unsys-action-lead]",
      )
    ) {
      return;
    }
    dragRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start: { ...panRef.current },
      moved: false,
    };
  }

  function onNodePointerDown(event: PointerEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0 || disabled) return;
    event.stopPropagation();
    const current = positionsRef.current[id] ?? restRoot;
    dragRef.current = {
      kind: "node",
      id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start: current,
      moved: false,
    };
    onSelect(id);
  }

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.originX;
      const dy = event.clientY - drag.originY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      event.preventDefault();
      if (drag.kind === "pan") {
        setPan({ x: drag.start.x + dx, y: drag.start.y + dy });
        return;
      }
      if (!drag.id) return;
      const next = {
        x: drag.start.x + dx / scaleRef.current,
        y: drag.start.y + dy / scaleRef.current,
      };
      setPositions((current) => ({ ...current, [drag.id!]: next }));
    };
    const onUp = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (drag.moved) ignoreClickRef.current = true;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const point = clientToGraph(event.clientX, event.clientY);
      const nextScale = clamp(
        scaleRef.current * (event.deltaY < 0 ? 1.08 : 0.92),
        ZOOM_MIN,
        ZOOM_MAX,
      );
      const rect = host.getBoundingClientRect();
      setPan({
        x: event.clientX - rect.left - point.x * nextScale,
        y: event.clientY - rect.top - point.y * nextScale,
      });
      setScale(nextScale);
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, []);

  const fine = GRID_FINE * scale;
  const coarse = GRID_COARSE * scale;

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 cursor-grab overflow-hidden select-none"
      data-author-unsys-graph
      data-author-unsys-graph-infinite=""
      data-learning-model-canvas="2d"
      onPointerDown={onBackgroundPointerDown}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        data-author-unsys-graph-grid=""
        style={{
          backgroundColor: "#050505",
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: `${fine}px ${fine}px, ${fine}px ${fine}px, ${coarse}px ${coarse}px, ${coarse}px ${coarse}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        <svg
          className="pointer-events-none absolute overflow-visible"
          width={1}
          height={1}
          aria-hidden
        >
          {edges.map((edge) => {
            const from = positions[edge.from] ?? restRoot;
            const to = positions[edge.to] ?? restRoot;
            const fromFocus = edge.from === focusId;
            const recommended = fromFocus && edge.to === recommendedToId;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={
                  recommended
                    ? "#fff"
                    : model
                      ? authorUnsysRegionColor(model, edge.to)
                      : AUTHOR_UNSYS_ROOT_COLOR
                }
                strokeOpacity={fromFocus || recommended ? 1 : 0.75}
                strokeWidth={recommended ? 2.25 : fromFocus ? 1.75 : 1.25}
              />
            );
          })}
        </svg>

        {edges.map((edge) => {
          if (edge.price == null) return null;
          const from = positions[edge.from] ?? restRoot;
          const to = positions[edge.to] ?? restRoot;
          const recommended = edge.from === focusId && edge.to === recommendedToId;
          return (
            <button
              key={`lead-${edge.from}-${edge.to}`}
              type="button"
              data-author-unsys-action-lead={edge.to}
              data-author-unsys-action-lead-child={edge.to}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]"
              style={{
                left: (from.x + to.x) / 2,
                top: (from.y + to.y) / 2,
                borderColor: recommended ? "#fff" : "rgba(255,255,255,0.35)",
                color: recommended ? "#fff" : "#d4d4d4",
                background: "#050505",
              }}
              disabled={disabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(edge.to);
              }}
            >
              {edge.price}
            </button>
          );
        })}

        {(model?.branches ?? []).map((branch) => {
          const point = positions[branch.id] ?? restRoot;
          const active = branch.id === focusId;
          const recommended = branch.id === recommendedToId;
          const color =
            branch.id === model?.rootId
              ? AUTHOR_UNSYS_ROOT_COLOR
              : model
                ? authorUnsysRegionColor(model, branch.id)
                : AUTHOR_UNSYS_ROOT_COLOR;
          return (
            <div
              key={branch.id}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: point.x, top: point.y, zIndex: active ? 6 : 2 }}
              data-author-unsys-node={branch.id}
              data-author-unsys-focus={active ? "true" : "false"}
              onPointerDown={(event) => onNodePointerDown(event, branch.id)}
              onClick={() => {
                if (ignoreClickRef.current) {
                  ignoreClickRef.current = false;
                  return;
                }
                onSelect(branch.id);
              }}
            >
              <span
                className="block rotate-45 cursor-grab border bg-black"
                style={{
                  borderColor: active || recommended ? "#fff" : color,
                  borderWidth: active || recommended ? 2 : 1.25,
                  width: branch.id === model?.rootId ? 18 : 14,
                  height: branch.id === model?.rootId ? 18 : 14,
                }}
              />
              <span
                className="pointer-events-none mt-2 max-w-[9rem] truncate whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: active ? "#fff" : color }}
              >
                {branch.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
