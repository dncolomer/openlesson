"use client";

import { useRef } from "react";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";
import {
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
} from "@/components/product-flow/product-flow-form";
import {
  authoringOpeningCanvasScene,
  serializeFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import {
  parseSessionCanvasStyle,
  parseSessionSidebarStyle,
  sessionCanvasExcalidrawChrome,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

export function FlowOpeningCanvasHost({
  scene,
  onSave,
  onCancel,
  sidebarStyle,
}: {
  scene: IleWorkCanvasScene | null;
  onSave: (next: IleWorkCanvasScene | null) => void;
  onCancel: () => void;
  sidebarStyle?: SessionSidebarStyle | null;
}) {
  const authoringStyle = sidebarStyle
    ? {
        ...parseSessionSidebarStyle(sidebarStyle),
        canvas: { ...parseSessionCanvasStyle(sidebarStyle.canvas), zenMode: false },
      }
    : null;
  const chrome = sessionCanvasExcalidrawChrome(authoringStyle?.canvas);
  const liveRef = useRef<IleWorkCanvasScene>(authoringOpeningCanvasScene(scene, chrome));
  const initial = authoringOpeningCanvasScene(scene, chrome);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-white/40 bg-black"
      data-flow-opening-canvas-authoring=""
    >
      <div
        className="absolute right-3 top-3 z-20 flex gap-2"
        data-flow-opening-canvas-actions=""
      >
        <button
          type="button"
          className={FLOW_SECONDARY_BTN}
          onClick={onCancel}
          data-flow-opening-canvas-cancel=""
        >
          Cancel
        </button>
        <button
          type="button"
          className={FLOW_PRIMARY_BTN}
          onClick={() => onSave(serializeFlowOpeningCanvasScene(liveRef.current))}
          data-flow-opening-canvas-save=""
        >
          Save
        </button>
      </div>
      <div className="relative min-h-0 flex-1" data-ile-canvas-stage="">
        <div className="absolute inset-0 flex h-full min-h-0 w-full flex-col">
          <ExcalidrawCanvas
            boardId="flow-opening-canvas-authoring"
            initialSceneData={initial}
            sessionMarkMode="learn"
            sidebarStyle={authoringStyle}
            liveCanvasChrome={Boolean(authoringStyle)}
            onSceneChange={(next) => {
              liveRef.current = authoringOpeningCanvasScene(next, chrome);
            }}
          />
        </div>
      </div>
    </div>
  );
}
