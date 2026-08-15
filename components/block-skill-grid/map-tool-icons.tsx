"use client";

import {
  DEFAULT_LASSO_SHAPE,
  type BlockMapToolId,
  type LassoShapeKind,
} from "@/lib/block-map-tools";

export type BlockMapToolLabelOverrides = {
  select?: string;
  merge?: string;
  split?: string;
  move?: string;
  generateShape?: string;
  clearSelection?: string;
  lockUntil?: string;
  markUnusable?: string;
  zoomIn: string;
  zoomOut: string;
  recenter: string;
};

export function toolTooltip(
  id: BlockMapToolId,
  labels: BlockMapToolLabelOverrides,
  opts?: { cloneArmed?: boolean },
): string {
  switch (id) {
    case "select":
      return (
        labels.select ||
        "Select — click block/empty · drag block to move · drag empty or Space/middle to pan · Shift multi"
      );
    case "move":
      return labels.move || "Move — use Select (click-and-drag)";
    case "lasso":
      return "Lasso — region select (choose rect / circle / freehand in submenu)";
    case "lasso_circle":
      return "Circle lasso — drag from center to select blocks or empty cells";
    case "lasso_freehand":
      return "Freehand lasso — draw a path to select blocks or empty cells";
    case "merge":
      return labels.merge || "Merge";
    case "split":
      return labels.split || "Split";
    case "clone":
      return opts?.cloneArmed
        ? "Clone armed — click an empty cell to paste (click again to cancel)"
        : "Clone — select one block, then click empty cell to paste a copy";
    case "generate_shape":
      return labels.generateShape || "Generate in shape";
    case "lock_until":
      return (
        labels.lockUntil ||
        "Lock until — select target, enter prereq mode, multi-select prereqs, confirm"
      );
    case "mark_unusable":
      return (
        labels.markUnusable ||
        "Unusable ground — multi-select empty cells, then click to mark/clear"
      );
    case "clear_selection":
      return labels.clearSelection || "Clear selection";
    case "zoom_in":
      return labels.zoomIn;
    case "zoom_out":
      return labels.zoomOut;
    case "recenter":
      return labels.recenter;
    default:
      return id;
  }
}

/** Lasso shape icons — marquee / ellipse / classic rope-loop freehand. */
export function LassoShapeIcon({
  shape,
  className = "h-4 w-4",
}: {
  shape: LassoShapeKind;
  className?: string;
}) {
  if (shape === "circle") {
    return (
      <svg
        className={className}
        data-tool-icon="lasso-circle"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeDasharray="3 2"
        aria-hidden
      >
        <circle cx="12" cy="12" r="7" />
      </svg>
    );
  }
  if (shape === "freehand") {
    return (
      <svg
        className={className}
        data-tool-icon="lasso-freehand"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeDasharray="2.6 2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 7.5c1.2-1.8 3.2-2.6 5.2-2.3 2.1.3 3.6 1.6 4.3 3.4.6 1.6.3 3.4-.8 4.7-1 1.1-2.5 1.7-4 1.6-1.2-.1-2.3-.7-3.1-1.6-.7-.8-1.1-1.8-1.2-2.9-.1-1.3.3-2.6 1.2-3.5" />
        <path d="M8.6 15.2c-1.1.9-1.7 2.2-1.6 3.5.1 1.4 1 2.6 2.3 3.2 1.2.6 2.6.5 3.7-.2 1.1-.7 1.8-1.9 1.9-3.2.1-1.1-.3-2.2-1.1-3" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      data-tool-icon="lasso"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeDasharray="3.5 2.5"
      aria-hidden
    >
      <rect x="4.5" y="5.5" width="15" height="13" rx="1.5" />
    </svg>
  );
}

export function ToolIcon({
  id,
  lassoShape = DEFAULT_LASSO_SHAPE,
}: {
  id: BlockMapToolId;
  lassoShape?: LassoShapeKind;
}) {
  const common = "h-4 w-4";
  switch (id) {
    case "select":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M4.5 3.5l13 6.2-5.4 2.1-2.1 5.4L4.5 3.5z" />
        </svg>
      );
    case "move":
      return (
        <svg
          className={common}
          data-tool-icon="move-hand"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.5 11V7.5a1.5 1.5 0 113 0V11m0 0V6.75a1.5 1.5 0 113 0V11m0 0V7.5a1.5 1.5 0 113 0V11m0 0v-1.25a1.5 1.5 0 113 0V14a5 5 0 01-5 5H11a5 5 0 01-5-5v-2.5a1.5 1.5 0 113 0V11"
          />
        </svg>
      );
    case "lasso":
      return <LassoShapeIcon shape={lassoShape} className={common} />;
    case "lasso_circle":
      return <LassoShapeIcon shape="circle" className={common} />;
    case "lasso_freehand":
      return <LassoShapeIcon shape="freehand" className={common} />;
    case "merge":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v8a2 2 0 002 2h3m8-12h3a2 2 0 012 2v8a2 2 0 01-2 2h-3m-6-4h6" />
        </svg>
      );
    case "split":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v8a2 2 0 002 2h3m8-12h3a2 2 0 012 2v8a2 2 0 01-2 2h-3M12 3v18" />
        </svg>
      );
    case "clone":
      return (
        <svg
          className={common}
          data-tool-icon="clone"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2M16 3H10a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7l-4-4z"
          />
        </svg>
      );
    case "generate_shape":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zM4 16h6v4H4v-4zm10-2h6v6h-6v-6z" />
        </svg>
      );
    case "lock_until":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V7a4.5 4.5 0 10-9 0v3.5M6.75 10.5h10.5a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5z"
          />
        </svg>
      );
    case "mark_unusable":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
      );
    case "clear_selection":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "zoom_in":
      return <span className="text-base leading-none">+</span>;
    case "zoom_out":
      return <span className="text-base leading-none">−</span>;
    case "recenter":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8M4 12a8 8 0 1016 0 8 8 0 00-16 0z" />
        </svg>
      );
    default:
      return null;
  }
}
