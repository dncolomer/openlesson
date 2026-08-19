"use client";

import {
  ANNOTATION_STROKE_COLOR,
  annotationFreehandPathD,
  type AnnotationLayer,
} from "@/lib/map-annotation-layers";

export function MapAnnotationStrokes({
  annotationLayers,
}: {
  annotationLayers: AnnotationLayer[];
}) {
  return (
    <svg
      data-annotation-strokes-layer
      className="pointer-events-none absolute left-0 top-0 z-[20] overflow-visible"
      style={{ width: 1, height: 1 }}
      aria-hidden
    >
      {annotationLayers.map((layer) => {
        if (!layer.visible) return null;
        return (
          <g
            key={layer.id}
            data-annotation-layer-strokes={layer.id}
            data-annotation-layer-name={layer.name}
          >
            {layer.strokes.map((stroke) => {
              if (stroke.kind === "circle") {
                return (
                  <circle
                    key={stroke.id}
                    data-annotation-stroke={stroke.id}
                    data-annotation-stroke-kind="circle"
                    cx={stroke.cx ?? 0}
                    cy={stroke.cy ?? 0}
                    r={stroke.r ?? 1}
                    fill="none"
                    stroke={ANNOTATION_STROKE_COLOR}
                    strokeWidth={stroke.strokeWidth}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              if (stroke.kind === "square") {
                return (
                  <rect
                    key={stroke.id}
                    data-annotation-stroke={stroke.id}
                    data-annotation-stroke-kind="square"
                    x={stroke.x ?? 0}
                    y={stroke.y ?? 0}
                    width={stroke.width ?? 1}
                    height={stroke.height ?? 1}
                    fill="none"
                    stroke={ANNOTATION_STROKE_COLOR}
                    strokeWidth={stroke.strokeWidth}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              return (
                <path
                  key={stroke.id}
                  data-annotation-stroke={stroke.id}
                  data-annotation-stroke-kind="freehand"
                  d={annotationFreehandPathD(stroke.points)}
                  fill="none"
                  stroke={ANNOTATION_STROKE_COLOR}
                  strokeWidth={stroke.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
