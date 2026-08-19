"use client";

import {
  ANNOTATION_STROKE_THICKNESSES,
  type AnnotationDrawTool,
  type AnnotationStrokeThickness,
} from "@/lib/map-annotation-layers";
import {
  LASSO_SHAPE_ORDER,
  isBlockMapToolEnabled,
  lassoShapeLabel,
  lassoShapeTooltip,
  type BlockMapToolEnablementInput,
  type BlockMapToolId,
  type LassoShapeKind,
} from "@/lib/block-map-tools";
import { LassoShapeIcon, toolTooltip } from "@/components/block-skill-grid/map-tool-icons";
import { MapToolStripButton } from "@/components/block-skill-grid/map-tool-strip-button";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";

export function MapToolRail({
  learnerMode,
  viewOnly,
  annotationDrawingActive,
  activeAnnotationLayerId,
  annotationDrawTool,
  setAnnotationDrawTool,
  annotationStrokeThickness,
  setAnnotationStrokeThickness,
  setActiveAnnotationLayerId,
  modeTools,
  actionTools,
  viewportTools,
  activeTool,
  lassoShape,
  setLassoShape,
  toolEnablement,
  labels,
  cloneArmed,
  onCloneCancel,
  prereqEditActive,
  stagedPrereqCount,
  onToolClick,
}: {
  learnerMode: boolean;
  viewOnly: boolean;
  annotationDrawingActive: boolean;
  activeAnnotationLayerId: string | null;
  annotationDrawTool: AnnotationDrawTool;
  setAnnotationDrawTool: (tool: AnnotationDrawTool) => void;
  annotationStrokeThickness: AnnotationStrokeThickness;
  setAnnotationStrokeThickness: (w: AnnotationStrokeThickness) => void;
  setActiveAnnotationLayerId: (id: string | null) => void;
  modeTools: BlockMapToolId[];
  actionTools: BlockMapToolId[];
  viewportTools: BlockMapToolId[];
  activeTool: BlockMapToolId;
  lassoShape: LassoShapeKind;
  setLassoShape: (shape: LassoShapeKind) => void;
  toolEnablement: BlockMapToolEnablementInput;
  labels: BlockSkillGridProps["labels"];
  cloneArmed: boolean;
  onCloneCancel?: () => void;
  prereqEditActive: boolean;
  stagedPrereqCount: number;
  onToolClick: (tool: BlockMapToolId) => void;
}) {
  if (learnerMode || viewOnly) return null;

  const renderToolButton = (tool: BlockMapToolId) => {
    const enabled =
      isBlockMapToolEnabled(tool, toolEnablement) ||
      (tool === "clone" && cloneArmed && Boolean(onCloneCancel));
    const isActiveMode =
      ((tool === "select" || tool === "lasso") && activeTool === tool) ||
      (tool === "lock_until" && prereqEditActive) ||
      (tool === "clone" && cloneArmed);
    const title =
      tool === "lock_until" && prereqEditActive
        ? stagedPrereqCount === 0
          ? "Confirm: clear all prerequisites for this block"
          : "Confirm: save staged prerequisites (empty set clears all)"
        : tool === "lasso"
          ? `${toolTooltip(tool, labels, { cloneArmed })} · ${lassoShapeTooltip(lassoShape)}`
          : toolTooltip(tool, labels, { cloneArmed });
    return (
      <MapToolStripButton
        key={tool}
        tool={tool}
        enabled={enabled}
        isActiveMode={isActiveMode}
        title={title}
        cloneArmed={cloneArmed}
        lassoShape={lassoShape}
        prereqEditActive={prereqEditActive}
        onClick={() => onToolClick(tool)}
      />
    );
  };

  return (
    <div
      data-block-map-tool-strip
      data-annotation-tool-strip={annotationDrawingActive ? "true" : "false"}
      data-annotation-active-layer={activeAnnotationLayerId || undefined}
      className="flex h-full w-11 shrink-0 flex-col items-center border-r border-neutral-800/80 bg-neutral-950/95 py-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {annotationDrawingActive ? (
        <div
          className="flex flex-col items-center gap-0.5"
          data-annotation-toolbox
          role="group"
          aria-label="Annotation tools"
        >
          <p className="mb-1 px-0.5 text-center text-[8px] font-medium uppercase tracking-wide text-neutral-500">
            Draw
          </p>
          {(
            [
              { id: "circle" as const, label: "Circle", title: "Circle (white)" },
              { id: "square" as const, label: "Square", title: "Square (white)" },
              {
                id: "freehand" as const,
                label: "Free",
                title: "Freehand (white)",
              },
              {
                id: "eraser" as const,
                label: "Erase",
                title: "Eraser — remove strokes under the brush",
              },
            ] as const
          ).map((tool) => {
            const active = annotationDrawTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                data-annotation-tool={tool.id}
                data-active={active ? "true" : "false"}
                title={tool.title}
                aria-label={tool.title}
                aria-pressed={active}
                onClick={() => setAnnotationDrawTool(tool.id)}
                className={`flex h-8 w-8 flex-col items-center justify-center rounded border text-white transition ${
                  active
                    ? "border-white/50 bg-white/15"
                    : "border-transparent text-white/70 hover:border-neutral-600 hover:bg-white/5 hover:text-white"
                }`}
              >
                {tool.id === "circle" ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="7" />
                  </svg>
                ) : tool.id === "square" ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden
                  >
                    <rect x="5" y="5" width="14" height="14" rx="1" />
                  </svg>
                ) : tool.id === "freehand" ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M5 17c2-4 4-8 7-8s5 2 7 6" />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M16.5 3.5l4 4-11 11H5.5v-4.1l11-10.9z" />
                    <path d="M14 6l4 4" />
                  </svg>
                )}
                <span className="sr-only">{tool.label}</span>
              </button>
            );
          })}
          <div className="my-1.5 h-px w-6 bg-neutral-700/80" aria-hidden />
          <p className="mb-0.5 px-0.5 text-center text-[7px] font-medium uppercase tracking-wide text-neutral-500">
            Width
          </p>
          <div
            className="flex flex-col items-center gap-0.5"
            data-annotation-thickness-group
            role="group"
            aria-label="Stroke thickness"
          >
            {ANNOTATION_STROKE_THICKNESSES.map((w, idx) => {
              const active = annotationStrokeThickness === w;
              const label = idx === 0 ? "Thin" : idx === 1 ? "Medium" : "Thick";
              const dot = idx === 0 ? 4 : idx === 1 ? 7 : 10;
              return (
                <button
                  key={w}
                  type="button"
                  data-annotation-thickness={w}
                  data-active={active ? "true" : "false"}
                  title={`${label} stroke`}
                  aria-label={`${label} stroke`}
                  aria-pressed={active}
                  onClick={() => setAnnotationStrokeThickness(w)}
                  className={`flex h-7 w-8 items-center justify-center rounded border transition ${
                    active
                      ? "border-white/50 bg-white/15"
                      : "border-transparent hover:border-neutral-600 hover:bg-white/5"
                  }`}
                >
                  <span
                    className="rounded-full bg-white"
                    style={{ width: dot, height: dot }}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
          <div className="my-1.5 h-px w-6 bg-neutral-700/80" aria-hidden />
          <button
            type="button"
            data-annotation-exit
            title="Exit annotation drawing (back to map tools)"
            onClick={() => setActiveAnnotationLayerId(null)}
            className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-[10px] text-neutral-400 hover:border-neutral-600 hover:text-white"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-0.5">
            {modeTools.map(renderToolButton)}
            {activeTool === "lasso" ? (
              <div
                className="mt-1 flex flex-col items-center gap-0.5 border-t border-neutral-800 pt-1"
                data-lasso-shape-submenu
                role="group"
                aria-label="Lasso shape"
              >
                {LASSO_SHAPE_ORDER.map((shape) => {
                  const active = lassoShape === shape;
                  return (
                    <button
                      key={shape}
                      type="button"
                      data-lasso-shape-option={shape}
                      data-active={active ? "true" : "false"}
                      title={lassoShapeTooltip(shape)}
                      aria-label={lassoShapeTooltip(shape)}
                      aria-pressed={active}
                      onClick={() => setLassoShape(shape)}
                      className={`flex h-7 w-7 items-center justify-center rounded border text-[10px] transition ${
                        active
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-transparent text-neutral-400 hover:border-neutral-700 hover:text-white"
                      }`}
                    >
                      <LassoShapeIcon shape={shape} className="h-3.5 w-3.5" />
                      <span className="sr-only">{lassoShapeLabel(shape)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {actionTools.length > 0 && (
            <>
              <div className="my-1.5 h-px w-6 shrink-0 bg-neutral-700/80" aria-hidden />
              <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto">
                {actionTools.map(renderToolButton)}
              </div>
            </>
          )}
          {viewportTools.length > 0 && (
            <>
              <div className="my-1.5 h-px w-6 shrink-0 bg-neutral-700/80" aria-hidden />
              <div className="flex flex-col items-center gap-0.5">
                {viewportTools.map(renderToolButton)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
