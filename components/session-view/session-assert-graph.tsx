"use client";

import { useEffect, useState } from "react";
import {
  useSessionBranchSlot,
  type SessionBranchSlot,
} from "@/components/session-view/session-policy-context";
import {
  cheapestAssertAction,
  layoutSessionAssertGraph,
  sessionAssertRevealOrder,
  type SessionAssertGraphNode,
} from "@/lib/session-assert-graph";
import { sessionBranchFieldCounts, type SessionBranchModel } from "@/lib/session-branch-model";
import { SESSION_MARK_BUTTONS } from "@/lib/session-marks";

const PACE_MS = 140;

const LABEL = "font-mono text-[9px] uppercase tracking-[0.22em] text-white/45";

const REVEAL_STYLE = `
@keyframes session-assert-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.session-assert-in {
  animation: session-assert-in 480ms ease-out;
}
[data-session-assert-graph] svg {
  display: block;
  width: min(100%, 200px);
  height: auto;
}
@media (max-width: 720px) {
  [data-session-assert-graph] svg {
    width: min(100%, 128px);
  }
}
`;

function actionLabel(id: string): string {
  return SESSION_MARK_BUTTONS.find((button) => button.id === id)?.label ?? id;
}

function useSlowReveal(ids: readonly string[]): number {
  const signature = ids.join("\0");
  const [count, setCount] = useState(0);
  useEffect(() => {
    const total = signature ? signature.split("\0").length : 0;
    if (total === 0) {
      setCount(0);
      return;
    }
    setCount((current) => Math.min(current, total));
    const timer = window.setInterval(() => {
      setCount((current) => (current >= total ? current : current + 1));
    }, PACE_MS);
    return () => window.clearInterval(timer);
  }, [signature]);
  return count;
}

function nodeMark(node: SessionAssertGraphNode) {
  if (node.focused) {
    return (
      <g data-session-assert-node={node.id} data-session-assert-focused="true">
        <rect
          x={node.x - 9}
          y={node.y - 9}
          width={18}
          height={18}
          fill="none"
          stroke="white"
          strokeWidth={1}
        />
        <circle cx={node.x} cy={node.y} r={4.5} fill="white" />
      </g>
    );
  }
  if (node.status === "closed") {
    return (
      <rect
        data-session-assert-node={node.id}
        data-session-assert-state="closed"
        x={node.x - 3}
        y={node.y - 3}
        width={6}
        height={6}
        fill="white"
      />
    );
  }
  if (node.status === "latent") {
    return (
      <circle
        data-session-assert-node={node.id}
        data-session-assert-state="latent"
        cx={node.x}
        cy={node.y}
        r={2.6}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeDasharray="1.4 1.6"
      />
    );
  }
  return (
    <circle
      data-session-assert-node={node.id}
      data-session-assert-state="open"
      cx={node.x}
      cy={node.y}
      r={3.2}
      fill="#0a0a0a"
      stroke="white"
      strokeWidth={1}
    />
  );
}

export function SessionAssertGraphView({
  slot,
  showPrices = true,
  shownCount,
}: {
  slot: SessionBranchSlot | null;
  showPrices?: boolean;
  /** Tests pin the revealed prefix. Live view omits this and reveals one node at a time. */
  shownCount?: number;
}) {
  const model = slot?.status === "ready" ? slot.model : null;
  const order = model ? sessionAssertRevealOrder(model) : [];
  const paced = useSlowReveal(shownCount == null ? order : []);
  const visible = shownCount == null ? paced : shownCount;
  if (!slot || slot.status === "idle") return null;
  if (slot.status === "preparing" || (slot.status === "ready" && !model)) {
    return (
      <p
        data-session-assert-graph
        data-session-assert-status="preparing"
        className="px-3 py-3 font-mono text-[11px] leading-snug text-white/70"
      >
        The field is still being written.
      </p>
    );
  }
  if (slot.status === "failed" || !model) {
    return (
      <p
        data-session-assert-graph
        data-session-assert-status="failed"
        className="px-3 py-3 font-mono text-[11px] leading-snug text-white/70"
      >
        {slot.error || "The field could not be prepared."}
      </p>
    );
  }
  return (
    <SessionAssertGraphFrame model={model} showPrices={showPrices} shownCount={Math.min(visible, order.length)} />
  );
}

export function SessionAssertGraphFrame({
  model,
  showPrices,
  shownCount,
}: {
  model: SessionBranchModel;
  showPrices: boolean;
  shownCount: number;
}) {
  const layout = layoutSessionAssertGraph(model);
  const order = sessionAssertRevealOrder(model);
  const shown = new Set(order.slice(0, Math.max(0, shownCount)));
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const counts = sessionBranchFieldCounts(model);
  const focus = layout.focus;
  const cheapest = cheapestAssertAction(focus);
  const focusNode = focus ? byId.get(focus.id) : null;

  const ringDepths = new Set(
    layout.nodes.filter((node) => shown.has(node.id) && node.depth > 0).map((node) => node.depth),
  );
  return (
    <div data-session-assert-graph data-session-assert-status="ready" className="flex flex-col gap-3 px-3 py-2 text-white">
      <style>{REVEAL_STYLE}</style>
      <div className="flex items-baseline justify-between gap-2">
        <p className={LABEL}>This node</p>
        <p data-session-assert-shown={String(shown.size)} className="font-mono text-[9px] tracking-[0.16em] text-white/45">
          {shown.size} / {counts.total}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="mx-auto overflow-visible"
        role="img"
        aria-label={focus ? `Field graph. Current node ${focus.title}.` : "Field graph."}
      >
        {layout.rings.map((ring) =>
          ringDepths.has(ring.depth) ? (
            <circle
              key={ring.depth}
              data-session-assert-ring={ring.depth}
              cx={layout.width / 2}
              cy={layout.height / 2}
              r={ring.radius}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={0.6}
            />
          ) : null,
        )}
        {layout.edges.map((edge) => {
          if (!shown.has(edge.from) || !shown.has(edge.to)) return null;
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const onPath = focusNode != null && (to.id === focusNode.id || from.id === focusNode.id);
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              className="session-assert-in"
              data-session-assert-edge={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={onPath ? "white" : "rgba(255,255,255,0.35)"}
              strokeWidth={onPath ? 1.25 : 0.75}
            />
          );
        })}
        {layout.nodes.map((node) =>
          shown.has(node.id) ? (
            <g key={node.id} className="session-assert-in">
              <title>{node.title}</title>
              {nodeMark(node)}
            </g>
          ) : null,
        )}
      </svg>
      {focus && shown.has(focus.id) ? (
        <div data-session-assert-focus={focus.id} className="border border-white px-2 py-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">{focus.title}</p>
          {focus.territory ? (
            <p className="mt-1 font-mono text-[10px] leading-snug text-white/55">{focus.territory}</p>
          ) : null}
          {focus.observation && focus.observation !== focus.territory ? (
            <p className="mt-1 font-mono text-[11px] leading-snug text-white/80">{focus.observation}</p>
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-[10px] text-white/45">The current node has not been drawn yet.</p>
      )}
      {focus && shown.has(focus.id) ? (
        <ul data-session-assert-actions className="flex flex-col gap-1.5">
          {focus.actions.map((action) => {
            const low = action.id === cheapest;
            return (
              <li
                key={action.id}
                data-session-assert-action={action.id}
                data-session-assert-cheapest={low ? "true" : undefined}
                className={low ? "border border-white px-2 py-1.5" : "border border-white/25 px-2 py-1.5"}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {actionLabel(action.id)}
                  </span>
                  {showPrices ? (
                    <span data-session-assert-price={action.id} className="font-mono text-[10px] text-white/55">
                      {action.price}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 font-mono text-[10px] leading-snug text-white/70">{action.leads}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function SessionAssertGraph({ showPrices = true }: { showPrices?: boolean }) {
  return <SessionAssertGraphView slot={useSessionBranchSlot()} showPrices={showPrices} />;
}
