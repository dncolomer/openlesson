"use client";

import type { PointerEvent } from "react";
import {
  ANNOTATION_STROKE_COLOR,
  annotationFreehandPathD,
  type AnnotationDrawTool,
  type AnnotationPoint,
} from "@/lib/map-annotation-layers";
import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";

export type LassoOverlay =
  | { kind: "rect"; left: number; top: number; width: number; height: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "freehand"; points: Array<{ x: number; y: number }> };

export type AnnotationDrawPreview = {
  kind: AnnotationDrawTool;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  points: AnnotationPoint[];
  strokeWidth: number;
};

export function MapGestureOverlays({
  selectiveDrawOverlay,
  selectiveExplanationPolygon,
  selectiveExplanationActive,
  lassoOverlay,
  annotationDrawingActive,
  annotationDrawPreview,
  zoom,
  pan,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  selectiveDrawOverlay: Array<{ x: number; y: number }> | null;
  selectiveExplanationPolygon?: Array<{ x: number; y: number }> | null;
  selectiveExplanationActive: boolean;
  lassoOverlay: LassoOverlay | null;
  annotationDrawingActive: boolean;
  annotationDrawPreview: AnnotationDrawPreview | null;
  zoom: number;
  pan: { x: number; y: number };
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
        {/* Selective Explanation live free-shape (independent of lasso selection). */}
        {selectiveDrawOverlay && selectiveDrawOverlay.length > 0 ? (
          <svg
            data-selective-explanation-draw
            className="pointer-events-none absolute inset-0 z-[14] h-full w-full overflow-visible"
            aria-hidden
          >
            <polygon
              fill="rgba(255, 255, 255, 0.08)"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={selectiveDrawOverlay.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          </svg>
        ) : null}
        {/* Completed selective overlay in world/grid space (rendered via continuous grid → screen). */}
        {selectiveExplanationPolygon &&
        selectiveExplanationPolygon.length >= 3 &&
        !selectiveDrawOverlay ? (
          <svg
            data-selective-explanation-overlay
            className="pointer-events-none absolute inset-0 z-[13] h-full w-full overflow-visible"
            aria-hidden
          >
            <polygon
              fill="rgba(255, 255, 255, 0.06)"
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeDasharray="4 3"
              points={selectiveExplanationPolygon
                .map((p) => {
                  const sx = p.x * SKILL_GRID_PITCH * zoom + pan.x;
                  const sy = p.y * SKILL_GRID_PITCH * zoom + pan.y;
                  return `${sx},${sy}`;
                })
                .join(" ")}
            />
          </svg>
        ) : null}
        {/* Full-map surface for Selective Explanation free-shape.
            Stay mounted for the entire active draw lifetime (mirror annotation surface).
            Unmounting on selectiveDrawOverlay would release pointer capture mid-gesture. */}
        {selectiveExplanationActive ? (
          <div
            data-selective-explanation-surface
            className="absolute inset-0 z-[11] cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : null}
        {lassoOverlay?.kind === "rect" ? (
          <div
            data-map-lasso-rect
            className="pointer-events-none absolute z-[12] border border-neutral-500/80 bg-neutral-800/10"
            style={{
              left: lassoOverlay.left,
              top: lassoOverlay.top,
              width: lassoOverlay.width,
              height: lassoOverlay.height,
            }}
          />
        ) : null}
        {lassoOverlay?.kind === "circle" ? (
          <div
            data-map-lasso-circle
            className="pointer-events-none absolute z-[12] rounded-full border border-neutral-500/80 bg-neutral-800/10"
            style={{
              left: lassoOverlay.cx - lassoOverlay.r,
              top: lassoOverlay.cy - lassoOverlay.r,
              width: lassoOverlay.r * 2,
              height: lassoOverlay.r * 2,
            }}
          />
        ) : null}
        {lassoOverlay?.kind === "freehand" && lassoOverlay.points.length > 0 ? (
          <svg
            data-map-lasso-freehand
            className="pointer-events-none absolute inset-0 z-[12] h-full w-full overflow-visible"
            aria-hidden
          >
            <polygon
              fill="rgba(34, 211, 238, 0.08)"
              stroke="rgba(34, 211, 238, 0.85)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={lassoOverlay.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          </svg>
        ) : null}

        {/* Full-map capture surface while annotation drawing is active (draw over blocks).
            Sits under minimap/stack chrome (z-20) so those stay clickable. */}
        {annotationDrawingActive ? (
          <div
            data-annotation-draw-surface
            className="absolute inset-0 z-[11] cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : null}

        {/* Live annotation draw preview (viewport-local, white / eraser dashed) */}
        {annotationDrawPreview ? (
          <svg
            data-annotation-draw-preview
            data-annotation-preview-kind={annotationDrawPreview.kind}
            className="pointer-events-none absolute inset-0 z-[13] h-full w-full overflow-visible"
            aria-hidden
          >
            {annotationDrawPreview.kind === "circle" ? (
              <circle
                cx={
                  (annotationDrawPreview.startX + annotationDrawPreview.curX) / 2
                }
                cy={
                  (annotationDrawPreview.startY + annotationDrawPreview.curY) / 2
                }
                r={Math.max(
                  1,
                  Math.hypot(
                    annotationDrawPreview.curX - annotationDrawPreview.startX,
                    annotationDrawPreview.curY - annotationDrawPreview.startY,
                  ) / 2,
                )}
                fill="none"
                stroke={ANNOTATION_STROKE_COLOR}
                strokeWidth={annotationDrawPreview.strokeWidth}
              />
            ) : annotationDrawPreview.kind === "square" ? (
              <rect
                x={Math.min(
                  annotationDrawPreview.startX,
                  annotationDrawPreview.curX,
                )}
                y={Math.min(
                  annotationDrawPreview.startY,
                  annotationDrawPreview.curY,
                )}
                width={Math.max(
                  1,
                  Math.abs(
                    annotationDrawPreview.curX - annotationDrawPreview.startX,
                  ),
                )}
                height={Math.max(
                  1,
                  Math.abs(
                    annotationDrawPreview.curY - annotationDrawPreview.startY,
                  ),
                )}
                fill="none"
                stroke={ANNOTATION_STROKE_COLOR}
                strokeWidth={annotationDrawPreview.strokeWidth}
              />
            ) : annotationDrawPreview.kind === "eraser" ? (
              <path
                d={annotationFreehandPathD(annotationDrawPreview.points)}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={Math.max(
                  6,
                  annotationDrawPreview.strokeWidth * 3,
                )}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 4"
              />
            ) : (
              <path
                d={annotationFreehandPathD(annotationDrawPreview.points)}
                fill="none"
                stroke={ANNOTATION_STROKE_COLOR}
                strokeWidth={annotationDrawPreview.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        ) : null}
    </>
  );
}
