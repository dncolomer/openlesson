"use client";

import { useEffect, useState } from "react";
import { exportWorkCanvasPngDataUrl } from "@/components/excalidraw-canvas/excalidraw-api";
import { FLOW_SECONDARY_BTN } from "@/components/product-flow/product-flow-form";
import {
  authoringOpeningCanvasScene,
  flowOpeningCanvasExtractText,
} from "@/lib/flow-opening-canvas";
import {
  ileWorkCanvasPersistSignature,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export function FlowOpeningCanvasPreview({
  scene,
  onEdit,
}: {
  scene: IleWorkCanvasScene;
  onEdit: () => void;
}) {
  const prepared = authoringOpeningCanvasScene(scene);
  const signature = ileWorkCanvasPersistSignature(prepared);
  const excerpt = flowOpeningCanvasExtractText(prepared);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const next = authoringOpeningCanvasScene(scene);
    setSrc(null);
    void exportWorkCanvasPngDataUrl({
      elements: next.elements,
      appState: next.appState,
      files: next.files,
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scene, signature]);

  return (
    <div className="space-y-2" data-flow-opening-canvas-preview="">
      <button
        type="button"
        onClick={onEdit}
        data-flow-opening-canvas-preview-open=""
        className="relative block w-full overflow-hidden border border-white/40 bg-[#0a0a0a] text-left transition hover:border-white/70"
      >
        {src ? (
          <img
            src={src}
            alt="Prepared Work canvas"
            data-flow-opening-canvas-preview-img=""
            className="mx-auto max-h-72 w-full object-contain"
          />
        ) : (
          <div
            className="flex min-h-48 items-center justify-center px-4 py-8"
            data-flow-opening-canvas-preview-fallback=""
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
              {excerpt || "Canvas prepared"}
            </p>
          </div>
        )}
      </button>
      <button
        type="button"
        className={`${FLOW_SECONDARY_BTN} w-full`}
        onClick={onEdit}
        data-flow-opening-canvas-open=""
      >
        Edit canvas
      </button>
    </div>
  );
}
