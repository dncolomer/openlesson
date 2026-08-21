"use client";

import type { ComponentProps, PointerEvent, RefObject } from "react";
import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import { shouldRenderMapNotesOnPlane } from "@/lib/learner-map-notes";
import { MapToolRail } from "@/components/block-skill-grid/map-tool-rail";
import { MapAuthoringForms } from "@/components/block-skill-grid/map-authoring-forms";
import { MapStatusBar } from "@/components/block-skill-grid/map-status-bar";
import { MapRightStack } from "@/components/block-skill-grid/map-right-stack";
import { MapJobIndicators } from "@/components/block-skill-grid/map-job-indicators";
import { MapGestureOverlays } from "@/components/block-skill-grid/map-gesture-overlays";
import { MapWorldLayer } from "@/components/block-skill-grid/map-world-layer";
import { MapMinimapChrome } from "@/components/block-skill-grid/map-minimap-chrome";

export type MapGridShellProps = {
  rail: ComponentProps<typeof MapToolRail>;
  world: ComponentProps<typeof MapWorldLayer>;
  gestures: ComponentProps<typeof MapGestureOverlays>;
  minimap: ComponentProps<typeof MapMinimapChrome>;
  right: ComponentProps<typeof MapRightStack>;
  jobs: ComponentProps<typeof MapJobIndicators>;
  status: ComponentProps<typeof MapStatusBar>;
  forms: ComponentProps<typeof MapAuthoringForms>;
  chrome: {
    viewportRef: RefObject<HTMLDivElement | null>;
    spaceHeld: boolean;
    zoom: number;
    pan: { x: number; y: number };
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  };
};

export function MapGridShell({
  rail,
  world,
  gestures,
  minimap,
  right,
  jobs,
  status,
  forms,
  chrome,
}: MapGridShellProps) {
  const activeLassoShape = world.activeLassoShape;
  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-neutral-800/60 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),rgba(8,8,8,0.98))]"
      data-block-map-tool={rail.activeTool}
      data-lasso-shape={activeLassoShape || undefined}
      data-space-pan={chrome.spaceHeld ? "true" : "false"}
      data-selected-block-count={world.selectedBlockIds.length}
      data-selected-block-ids={world.selectedBlockIds.join(",")}
      data-learner-mode={world.learnerMode ? "true" : "false"}
      data-map-view-only={world.viewOnly ? "true" : "false"}
      data-learner-notes={world.mountMapNotes ? "true" : "false"}
      data-map-notes={world.mountMapNotes ? "true" : "false"}
      data-map-notes-plane-visible={
        world.mountMapNotes && shouldRenderMapNotesOnPlane(right.mapNotesPlaneVisible)
          ? "true"
          : "false"
      }
      data-annotation-layers={String(world.annotationLayers.length)}
      data-annotation-drawing={gestures.annotationDrawingActive ? "true" : "false"}
      data-clone-armed={rail.cloneArmed ? "true" : "false"}
      data-map-minimap="true"
    >
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <MapToolRail {...rail} />

        <div
          ref={chrome.viewportRef}
          className={`relative min-h-0 flex-1 touch-none overflow-hidden ${
            chrome.spaceHeld
              ? "cursor-grab active:cursor-grabbing"
              : gestures.annotationDrawingActive ||
                  gestures.selectiveExplanationActive
                ? "cursor-crosshair"
                : activeLassoShape
                  ? "cursor-crosshair"
                  : rail.activeTool === "select"
                    ? "cursor-grab"
                    : "cursor-default"
          }`}
          data-map-lasso-mode={activeLassoShape || "false"}
          data-map-lasso-shape={activeLassoShape || undefined}
          data-annotation-drawing={gestures.annotationDrawingActive ? "true" : "false"}
          data-selective-explanation-active={
            gestures.selectiveExplanationActive ? "true" : "false"
          }
          onPointerDown={chrome.onPointerDown}
          onPointerMove={chrome.onPointerMove}
          onPointerUp={chrome.onPointerUp}
          onPointerCancel={chrome.onPointerUp}
        >
          <MapGestureOverlays {...gestures} />
          <MapMinimapChrome {...minimap} />
          <MapRightStack {...right} />
          <MapJobIndicators {...jobs} />

          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: `${SKILL_GRID_PITCH}px ${SKILL_GRID_PITCH}px`,
              transform: `translate(${chrome.pan.x % SKILL_GRID_PITCH}px, ${chrome.pan.y % SKILL_GRID_PITCH}px) scale(${chrome.zoom})`,
              transformOrigin: "0 0",
            }}
          />

          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${chrome.pan.x}px, ${chrome.pan.y}px) scale(${chrome.zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <MapWorldLayer {...world} />
          </div>

          <MapStatusBar {...status} />
        </div>
      </div>

      <MapAuthoringForms {...forms} />
    </div>
  );
}
