"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  layoutSessionBranchField,
  type SessionBranchFieldPoint,
} from "@/lib/session-branch-field-layout";
import type { SessionBranchModel } from "@/lib/session-branch-model";

function pointOf(
  points: SessionBranchFieldPoint[],
  id: string,
): SessionBranchFieldPoint | undefined {
  return points.find((point) => point.id === id);
}

/**
 * Geometric hidden-state field. The Harness tab draws it as a panel.
 * hud/underlay stay for tests; live flows no longer paint it on the stage.
 */
export function SessionBranchFieldMap({
  model,
  variant = "hud",
  revealedIds = null,
  currentIds = [],
}: {
  model: SessionBranchModel | null | undefined;
  variant?: "hud" | "underlay" | "panel";
  /** When set, every other node is fog. Calibrate passes the path + stills. */
  revealedIds?: ReadonlySet<string> | null;
  currentIds?: readonly string[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });

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

  const layout = useMemo(() => {
    if (!model) return { points: [] as SessionBranchFieldPoint[], edges: [] };
    return layoutSessionBranchField(model, size.width, size.height);
  }, [model, size.height, size.width]);

  if (!model) return null;

  const current = new Set(currentIds);
  const focusId = model.focusId;
  const byId = new Map(model.branches.map((branch) => [branch.id, branch]));

  return (
    <div
      ref={hostRef}
      data-session-branch-field-map=""
      data-session-branch-field-variant={variant}
      className={
        variant === "panel"
          ? "pointer-events-none relative h-full min-h-[10rem] w-full"
          : `pointer-events-none absolute inset-0 ${variant === "underlay" ? "z-0" : "z-[8]"}`
      }
      aria-hidden
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="h-full w-full"
      >
        {layout.edges.map((edge) => {
          const from = pointOf(layout.points, edge.from);
          const to = pointOf(layout.points, edge.to);
          if (!from || !to) return null;
          const fogged =
            revealedIds != null && !revealedIds.has(edge.to) && !revealedIds.has(edge.from);
          return (
            <line
              key={`${edge.from}:${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="white"
              strokeWidth={fogged ? 0.6 : 1}
              opacity={fogged ? 0.06 : variant === "hud" ? 0.18 : 0.28}
            />
          );
        })}
        {layout.points.map((point) => {
          const branch = byId.get(point.id);
          const fogged = revealedIds != null && !revealedIds.has(point.id);
          const focused = point.id === focusId;
          const currentStill = current.has(point.id);
          const open = branch?.status === "open";
          const radius = focused || currentStill ? 4.5 : open ? 3 : 2;
          const opacity = fogged
            ? 0.07
            : focused || currentStill
              ? 0.95
              : open
                ? variant === "hud"
                  ? 0.45
                  : 0.7
                : variant === "hud"
                  ? 0.18
                  : 0.28;
          return (
            <circle
              key={point.id}
              data-session-branch-node={point.id}
              data-session-branch-node-fog={fogged ? "true" : undefined}
              data-session-branch-node-focus={focused ? "true" : undefined}
              cx={point.x}
              cy={point.y}
              r={radius}
              fill="white"
              opacity={opacity}
            />
          );
        })}
      </svg>
    </div>
  );
}
