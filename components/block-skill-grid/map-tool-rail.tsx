"use client";

import {
  ANNOTATION_STROKE_THICKNESSES,
  type AnnotationDrawTool,
  type AnnotationStrokeThickness,
} from "@/lib/map-annotation-layers";
import type {
  BlockMapToolEnablementInput,
  BlockMapToolId,
  LassoShapeKind,
} from "@/lib/block-map-tools";
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
  overlayAnchorClass = "top-2",
  hidden = false,
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
  /** Extra overlay anchor classes (e.g. ILE chapter maps sit below the PoW bar). */
  overlayAnchorClass?: string;
  /** ILE chapter maps: hide the select/lasso utilities strip under PoW resources. */
  hidden?: boolean;
}) {
  if (hidden || learnerMode || viewOnly) return null;
  // Map actions (merge, split, clone, lock, zoom) are right-pane drawers.
  // This chrome is only the drawing toolbox while a layer is active.
  if (!annotationDrawingActive) return null;

  return (
    <div
      data-block-map-tool-strip
      data-block-map-tool-strip-layout="widget"
      data-annotation-tool-strip={annotationDrawingActive ? "true" : "false"}
      data-annotation-active-layer={activeAnnotationLayerId || undefined}
      className={`pointer-events-auto absolute left-2 z-20 flex max-w-[min(36rem,calc(100%-1rem))] flex-nowrap items-center gap-0.5 overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95 px-1.5 py-1 ${overlayAnchorClass}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
          className="flex flex-nowrap items-center gap-0.5"
          data-annotation-toolbox
          role="group"
          aria-label="Annotation tools"
        >
          <p className="px-1 text-[8px] font-medium uppercase tracking-wide text-neutral-500">
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
                className={`flex h-6 w-6 flex-col items-center justify-center rounded-none border text-white transition ${
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
          <div className="mx-1 h-4 w-px shrink-0 bg-neutral-700/80" aria-hidden />
          <p className="px-1 text-[7px] font-medium uppercase tracking-wide text-neutral-500">
            Width
          </p>
          <div
            className="flex items-center gap-0.5"
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
                  className={`flex h-6 w-6 items-center justify-center rounded-none border transition ${
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
          <div className="mx-1 h-4 w-px shrink-0 bg-neutral-700/80" aria-hidden />
          <button
            type="button"
            data-annotation-exit
            title="Exit annotation drawing"
            onClick={() => setActiveAnnotationLayerId(null)}
            className="flex h-6 w-6 items-center justify-center rounded-none border border-transparent text-[10px] text-neutral-400 hover:border-neutral-600 hover:text-white"
          >
            ✕
          </button>
        </div>
    </div>
  );
}
