"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_FACTORS,
  SCIENCE_LEARNING_MODEL_ROOT,
  formatScienceLearningModelCost,
  scienceLearningModelCheapestEdge,
  scienceLearningModelFactor,
  scienceLearningModelNodes,
  scienceLearningModelOutgoingEdges,
  scienceLearningModelTravel,
  type ScienceLearningModelNode,
} from "@/lib/science/learning-model-copy";
import { LearningModelFactorCopy } from "@/components/science/LearningModelFactorCopy";
import {
  graphDiamondEdge,
  graphDiamondPointsAttr,
  graphDiamondRadius,
} from "@/lib/graph-diamond";

type Point = { x: number; y: number };
type ExplorerMode = "learn" | "verify";

function factorColor(factorId: string): string {
  if (factorId === "root") return "#e8e8e8";
  return scienceLearningModelFactor(factorId)?.color ?? "#e8e8e8";
}

function nodeDepth(nodes: ScienceLearningModelNode[], id: string): number {
  let depth = 0;
  let current = nodes.find((row) => row.id === id);
  while (current?.parentId) {
    depth += 1;
    current = nodes.find((row) => row.id === current?.parentId);
  }
  return depth;
}

const DRAG_THRESHOLD_PX = 6;
const SPRING_K = 140;
const SPRING_D = 16;

function subtreeIdsOf(nodes: ScienceLearningModelNode[], rootId: string): string[] {
  const ids = [rootId];
  const pending = [rootId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const node of nodes) {
      if (node.parentId === current) {
        ids.push(node.id);
        pending.push(node.id);
      }
    }
  }
  return ids;
}

function layout2d(nodes: ScienceLearningModelNode[], width: number, height: number): Map<string, Point> {
  const placed = new Map<string, Point>();
  const padX = 80;
  const padY = 64;
  const cx = width * 0.5;
  const cy = height * 0.5;
  const span = Math.min(Math.max(120, width - padX * 2), Math.max(120, height - padY * 2));
  placed.set(SCIENCE_LEARNING_MODEL_ROOT.id, { x: cx, y: cy });
  SCIENCE_LEARNING_MODEL_FACTORS.forEach((factor, index) => {
    const baseAngle = (index / SCIENCE_LEARNING_MODEL_FACTORS.length) * Math.PI * 2 - Math.PI / 2;
    const remaining = factor.states.map((state) => state.id);
    let guard = 0;
    while (remaining.length > 0 && guard < 40) {
      guard += 1;
      const ready = remaining.filter((id) => {
        const node = nodes.find((row) => row.id === id);
        return node?.parentId === SCIENCE_LEARNING_MODEL_ROOT.id || placed.has(node?.parentId ?? "");
      });
      if (ready.length === 0) break;
      for (const id of ready) {
        const node = nodes.find((row) => row.id === id);
        if (!node) continue;
        const siblings = nodes.filter(
          (row) => row.parentId === node.parentId && row.factorId === factor.id,
        );
        const siblingIndex = siblings.findIndex((row) => row.id === id);
        const parentPoint = placed.get(node.parentId ?? "") ?? { x: cx, y: cy };
        if (node.parentId === SCIENCE_LEARNING_MODEL_ROOT.id) {
          const radius = span * 0.28;
          placed.set(id, {
            x: cx + Math.cos(baseAngle) * radius,
            y: cy + Math.sin(baseAngle) * radius,
          });
        } else {
          const outward = Math.atan2(parentPoint.y - cy, parentPoint.x - cx);
          const fan =
            siblings.length <= 1
              ? 0
              : (siblingIndex - (siblings.length - 1) / 2) *
                (0.72 / Math.max(1, siblings.length - 1));
          const radius = span * (0.17 + Math.min(nodeDepth(nodes, id), 4) * 0.012);
          placed.set(id, {
            x: parentPoint.x + Math.cos(outward + fan) * radius,
            y: parentPoint.y + Math.sin(outward + fan) * radius,
          });
        }
        remaining.splice(remaining.indexOf(id), 1);
      }
    }
  });
  for (const node of nodes) {
    if (!placed.has(node.id)) placed.set(node.id, { x: cx, y: cy });
  }
  return placed;
}

function labelOffset(point: Point, parent: Point | null, radius: number): Point {
  if (!parent) return { x: 0, y: radius + 16 };
  const dx = point.x - parent.x;
  const dy = point.y - parent.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { x: (dx / len) * (radius + 16), y: (dy / len) * (radius + 16) };
}

function LearningModelMap2D({
  focusId,
  onSelect,
}: {
  focusId: string;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => scienceLearningModelNodes(), []);
  const [size, setSize] = useState({ width: 640, height: 420 });
  const [offsets, setOffsets] = useState<Record<string, Point>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const offsetsRef = useRef<Record<string, Point>>({});
  const velocitiesRef = useRef<Record<string, Point>>({});
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const ignoreClickRef = useRef(false);
  const rafRef = useRef<number | null>(null);

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
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const layout = useMemo(() => layout2d(nodes, size.width, size.height), [nodes, size.height, size.width]);
  const restRoot = layout.get(SCIENCE_LEARNING_MODEL_ROOT.id) ?? { x: size.width / 2, y: size.height / 2 };

  function pointOf(id: string): Point {
    const rest = layout.get(id) ?? restRoot;
    const offset = offsets[id];
    if (!offset) return rest;
    return { x: rest.x + offset.x, y: rest.y + offset.y };
  }

  function stopSpring() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    velocitiesRef.current = {};
  }

  function springHome() {
    stopSpring();
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const prev = offsetsRef.current;
      const next: Record<string, Point> = {};
      let alive = false;
      for (const id of Object.keys(prev)) {
        const current = prev[id];
        const velocity = velocitiesRef.current[id] ?? { x: 0, y: 0 };
        velocity.x += (-SPRING_K * current.x - SPRING_D * velocity.x) * dt;
        velocity.y += (-SPRING_K * current.y - SPRING_D * velocity.y) * dt;
        const x = current.x + velocity.x * dt;
        const y = current.y + velocity.y * dt;
        velocitiesRef.current[id] = velocity;
        if (Math.hypot(x, y) > 0.4 || Math.hypot(velocity.x, velocity.y) > 6) {
          next[id] = { x, y };
          alive = true;
        }
      }
      offsetsRef.current = next;
      setOffsets(next);
      if (alive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        velocitiesRef.current = {};
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function onNodePointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stopSpring();
    offsetsRef.current = {};
    setOffsets({});
    dragRef.current = {
      id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
    setDraggingId(id);
  }

  function onNodePointerMove(event: PointerEvent<HTMLButtonElement>, id: string) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.id !== id) return;
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    event.preventDefault();
    const next: Record<string, Point> = {};
    for (const nodeId of subtreeIdsOf(nodes, id)) {
      next[nodeId] = { x: dx, y: dy };
    }
    offsetsRef.current = next;
    setOffsets(next);
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.id !== id) return;
    dragRef.current = null;
    setDraggingId(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released.
    }
    if (drag.moved) {
      ignoreClickRef.current = true;
      springHome();
    }
  }

  const draggingBranch = draggingId ? subtreeIdsOf(nodes, draggingId) : [];

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 select-none"
      data-learning-model-canvas="2d"
      data-explorer-dragging={draggingId ?? undefined}
      style={{ touchAction: draggingId ? "none" : undefined, cursor: draggingId ? "grabbing" : undefined }}
    >
      <svg
        width={size.width}
        height={size.height}
        className="absolute left-0 top-0 overflow-visible"
        aria-hidden
      >
        <rect width={size.width} height={size.height} fill="#050505" />
        {Array.from({ length: Math.ceil(size.width / 16) + 1 }, (_, i) => (
          <line
            key={`vx-${i}`}
            x1={i * 16}
            y1={0}
            x2={i * 16}
            y2={size.height}
            stroke={i % 5 === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.045)"}
          />
        ))}
        {Array.from({ length: Math.ceil(size.height / 16) + 1 }, (_, i) => (
          <line
            key={`hy-${i}`}
            x1={0}
            y1={i * 16}
            x2={size.width}
            y2={i * 16}
            stroke={i % 5 === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.045)"}
          />
        ))}
        <defs>
          <filter
            id="learning-model-diamond-glow"
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {nodes.map((node) => {
          if (!node.parentId) return null;
          const from = pointOf(node.parentId);
          const to = pointOf(node.id);
          const fromRadius = graphDiamondRadius(node.parentId === SCIENCE_LEARNING_MODEL_ROOT.id);
          const toRadius = graphDiamondRadius(false);
          const segment = graphDiamondEdge(from, to, fromRadius, toRadius);
          const activeEdge = node.id === focusId || node.parentId === focusId;
          return (
            <line
              key={`edge-${node.id}`}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={factorColor(node.factorId)}
              strokeOpacity={activeEdge ? 0.95 : 0.55}
              strokeWidth={activeEdge ? 1.75 : 1.2}
              strokeLinecap="round"
            />
          );
        })}
        {nodes.map((node) => {
          const point = pointOf(node.id);
          const active = node.id === focusId;
          const color = factorColor(node.factorId);
          const radius = graphDiamondRadius(node.id === SCIENCE_LEARNING_MODEL_ROOT.id);
          return (
            <g key={`mark-${node.id}`}>
              <polygon
                points={graphDiamondPointsAttr(point, radius + 3.5)}
                fill="none"
                stroke={active ? "#fff" : color}
                strokeOpacity={active ? 0.35 : 0.18}
                strokeWidth={1}
              />
              <polygon
                data-explorer-diamond={node.id}
                points={graphDiamondPointsAttr(point, radius)}
                fill="#050505"
                stroke={active ? "#fff" : color}
                strokeWidth={active ? 2 : 1.35}
                filter={active ? "url(#learning-model-diamond-glow)" : undefined}
              />
            </g>
          );
        })}
      </svg>
      {nodes.map((node) => {
        const point = pointOf(node.id);
        const parentPoint = node.parentId ? pointOf(node.parentId) : null;
        const active = node.id === focusId;
        const color = factorColor(node.factorId);
        const radius = graphDiamondRadius(node.id === SCIENCE_LEARNING_MODEL_ROOT.id);
        const shift = labelOffset(point, parentPoint, radius);
        const inDragBranch = draggingBranch.includes(node.id);
        const hit = radius * 2 + 12;
        return (
          <button
            key={node.id}
            type="button"
            data-explorer-hidden-state={node.id}
            data-explorer-focus={active ? "true" : undefined}
            data-explorer-draggable="true"
            draggable={false}
            onPointerDown={(event) => onNodePointerDown(event, node.id)}
            onPointerMove={(event) => onNodePointerMove(event, node.id)}
            onPointerUp={(event) => endDrag(event, node.id)}
            onPointerCancel={(event) => endDrag(event, node.id)}
            onClick={(event) => {
              if (ignoreClickRef.current) {
                event.preventDefault();
                ignoreClickRef.current = false;
                return;
              }
              onSelect(node.id);
            }}
            className="absolute cursor-grab touch-none bg-transparent active:cursor-grabbing"
            style={{
              left: point.x,
              top: point.y,
              width: hit,
              height: hit,
              transform: "translate(-50%, -50%)",
              zIndex: inDragBranch ? 5 : 1,
            }}
            aria-label={node.title}
            aria-pressed={active}
          >
            <span
              className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                left: "50%",
                top: "50%",
                color: active ? "#fff" : color,
                transform: `translate(-50%, -50%) translate(${shift.x}px, ${shift.y}px)`,
                textShadow: "0 0 8px #050505, 0 1px 0 #050505",
              }}
            >
              {node.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LearningModelScene() {
  const nodes = useMemo(() => scienceLearningModelNodes(), []);
  const opening = SCIENCE_LEARNING_MODEL_ROOT;
  const [focusId, setFocusId] = useState(opening.id);
  const [log, setLog] = useState<string>(SCIENCE_LEARNING_MODEL_COPY.explorerOpening);
  const [lastToId, setLastToId] = useState<string | null>(null);
  const [explorerMode, setExplorerMode] = useState<ExplorerMode>("learn");
  const [excess, setExcess] = useState(0);
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0);
  const focus = nodes.find((row) => row.id === focusId) ?? opening;
  const focusFactor = scienceLearningModelFactor(focus.factorId);
  const edges = scienceLearningModelOutgoingEdges(focusId);
  const cheapest = scienceLearningModelCheapestEdge(focusId);
  const showCosts = explorerMode === "learn";

  function resetDistance() {
    setExcess(0);
    setSteps(0);
    setDistance(0);
  }

  function selectMode(mode: ExplorerMode) {
    setExplorerMode(mode);
    setLastToId(null);
    resetDistance();
    setLog(
      mode === "learn"
        ? SCIENCE_LEARNING_MODEL_COPY.explorerLearnCaption
        : SCIENCE_LEARNING_MODEL_COPY.explorerVerifyCaption,
    );
  }

  function selectNode(id: string) {
    const node = nodes.find((row) => row.id === id);
    if (!node) return;
    setFocusId(node.id);
    setLastToId(null);
    resetDistance();
    const factor = scienceLearningModelFactor(node.factorId);
    setLog(
      factor
        ? `On hidden state ${node.title} (${factor.label} state factor). ${node.observation}`
        : `On hidden state ${node.title}, the frozen generative model. ${node.observation}`,
    );
  }

  function takeEdge(toId: string) {
    const next = scienceLearningModelTravel(focusId, toId);
    setFocusId(next.focusId);
    setLastToId(toId);
    if (explorerMode === "verify") {
      const nextSteps = steps + 1;
      const nextExcess = Math.round((excess + next.excess) * 10) / 10;
      const nextDistance = Math.round((nextExcess / nextSteps) * 10) / 10;
      setSteps(nextSteps);
      setExcess(nextExcess);
      setDistance(nextDistance);
      setLog(`${next.log} Distance ${formatScienceLearningModelCost(nextDistance)}.`);
      return;
    }
    const extra =
      next.edge && next.excess === 0
        ? ` Cost ${formatScienceLearningModelCost(next.edge.cost)}, the cheapest policy.`
        : next.edge && next.cheapest
          ? ` Cost ${formatScienceLearningModelCost(next.edge.cost)}. Cheapest policy: ${next.cheapest.title} at ${formatScienceLearningModelCost(next.cheapest.cost)}.`
          : "";
    setLog(`${next.log}${extra}`);
  }

  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]"
      data-learning-model-explorer
      data-explorer-mode={explorerMode}
    >
      <div
        className="relative min-h-[28rem] overflow-clip bg-black lg:min-h-[40rem]"
        data-learning-model-schematic
      >
        <LearningModelMap2D focusId={focusId} onSelect={selectNode} />
        <div className="pointer-events-none absolute left-3 top-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            G* · {SCIENCE_LEARNING_MODEL_COPY.schematicTitle}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
            {SCIENCE_LEARNING_MODEL_COPY.explorerDragHint}
          </p>
        </div>
        <ul className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
          {SCIENCE_LEARNING_MODEL_FACTORS.map((factor) => (
            <li
              key={factor.id}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: factor.color }}
            >
              <span className="inline-block h-2 w-2" style={{ background: factor.color }} />
              {factor.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Learn or Verify">
          {(["learn", "verify"] as const).map((mode) => {
            const selected = explorerMode === mode;
            const label = mode === "learn" ? "Learn" : "Verify";
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={selected}
                data-explorer-mode-tab={mode}
                onClick={() => selectMode(mode)}
                className={`flex-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  selected
                    ? "border-white bg-white/10 text-white"
                    : "border-white/25 text-zinc-400 hover:border-white hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">
          <LearningModelFactorCopy
            text={
              explorerMode === "learn"
                ? SCIENCE_LEARNING_MODEL_COPY.explorerLearnCaption
                : SCIENCE_LEARNING_MODEL_COPY.explorerVerifyCaption
            }
          />
        </p>
        <p className="border border-white/15 px-3 py-2 text-xs leading-relaxed text-zinc-300">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            On {focus.title}
            {focusFactor ? (
              <>
                {" · "}
                <span style={{ color: focusFactor.color }}>{focusFactor.label}</span>
              </>
            ) : null}
          </span>
          <span className="mt-1 block">{focus.observation}</span>
          {showCosts && cheapest ? (
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Cheapest policy · {cheapest.title} {formatScienceLearningModelCost(cheapest.cost)}
            </span>
          ) : (
            <span
              className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500"
              data-explorer-distance={distance}
            >
              Distance {formatScienceLearningModelCost(distance)}
              {steps > 0 ? ` · ${steps} ${steps === 1 ? "step" : "steps"}` : ""}
            </span>
          )}
        </p>
        {edges.map((edge) => {
          const isCheapest = cheapest?.toId === edge.toId;
          return (
            <button
              key={edge.toId}
              type="button"
              data-explorer-edge={edge.toId}
              data-explorer-edge-cost={showCosts ? edge.cost : undefined}
              data-explorer-cheapest={showCosts && isCheapest ? "true" : undefined}
              onClick={() => takeEdge(edge.toId)}
              className={`flex items-start gap-3 border px-3 py-3 text-left text-sm ${
                lastToId === edge.toId
                  ? "border-white bg-white/10 text-white"
                  : showCosts && isCheapest
                    ? "border-white/70 text-white"
                    : "border-white/25 text-zinc-200 hover:border-white"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{edge.title}</span>
                  {showCosts ? (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                      cost {formatScienceLearningModelCost(edge.cost)}
                      {isCheapest ? <span className="ml-2 text-white">policy</span> : null}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  {edge.kind === "parent"
                    ? "Return to the coarser hidden state."
                    : "Travel to this hidden state."}
                </span>
              </span>
            </button>
          );
        })}
        <p
          className="border border-white/15 px-3 py-3 text-xs leading-relaxed text-zinc-300"
          data-explorer-projection
        >
          <LearningModelFactorCopy text={log} />
        </p>
      </div>
    </div>
  );
}
