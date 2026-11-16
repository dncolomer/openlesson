"use client";

import "katex/dist/katex.min.css";
import type { MutableRefObject } from "react";
import { ILE_WORK_CANVAS_LATEX_OVERLAY, type IleWorkCanvasLatexTarget } from "@/lib/learn-work-canvas-latex";

export function WorkCanvasLatexLayer({
  items,
  hostByIdRef,
}: {
  items: readonly IleWorkCanvasLatexTarget[];
  hostByIdRef: MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  if (!items.length) return null;
  return (
    <div
      data-ile-canvas-latex-layer=""
      className="pointer-events-none absolute inset-0 z-[18] overflow-visible"
    >
      {items.map((item) => (
        <div
          key={item.id}
          ref={(node) => {
            if (node) hostByIdRef.current.set(item.id, node);
            else hostByIdRef.current.delete(item.id);
          }}
          data-ile-canvas-latex={item.id}
          className={`${ILE_WORK_CANVAS_LATEX_OVERLAY} absolute origin-top-left`}
          style={{
            left: 0,
            top: 0,
            width: item.width,
            minHeight: item.height,
            fontSize: item.fontSize,
          }}
          dangerouslySetInnerHTML={{ __html: item.html }}
        />
      ))}
    </div>
  );
}
