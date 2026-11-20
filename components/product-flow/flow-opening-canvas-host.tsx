"use client";

import { useRef } from "react";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import {
  FLOW_PRIMARY_BTN,
  FLOW_SECONDARY_BTN,
} from "@/components/product-flow/product-flow-form";
import {
  authoringOpeningCanvasScene,
  serializeFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas";

export function FlowOpeningCanvasHost({
  scene,
  topicName,
  onSave,
  onCancel,
}: {
  scene: IleWorkCanvasScene | null;
  topicName?: string;
  onSave: (next: IleWorkCanvasScene | null) => void;
  onCancel: () => void;
}) {
  const liveRef = useRef<IleWorkCanvasScene>(authoringOpeningCanvasScene(scene));
  const initial = authoringOpeningCanvasScene(scene);

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
      <SessionWorkSurface
        mode="ile"
        authoring
        chapters={
          <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
            {topicName?.trim() || "Work"}
          </p>
        }
        focus={<SessionGuidePanel guide="learn" />}
        actions={
          <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            Exit
          </p>
        }
        stage={
          <ExcalidrawCanvas
            boardId="flow-opening-canvas-authoring"
            initialSceneData={initial}
            sessionMarkMode="learn"
            onSceneChange={(next) => {
              liveRef.current = authoringOpeningCanvasScene(next);
            }}
          />
        }
      />
    </div>
  );
}
