"use client";

import type { RefObject } from "react";
import {
  canDeleteAnnotationLayer,
  shouldShowAnnotationLayerToggles,
  type AnnotationLayer,
} from "@/lib/map-annotation-layers";
import { shouldShowMapNotesPlaneToggle, toggleMapNotesPlaneVisible } from "@/lib/learner-map-notes";
import { MINIMAP_FRAME_HEIGHT, MINIMAP_FRAME_WIDTH } from "@/lib/map-minimap-clusters";
import {
  WORKSPACE_MAP_TOGGLE_IDS,
  nextWorkspaceMapToggle,
  resolveWorkspaceMapToggleId,
  workspaceModeDisplayLabel,
  type WorkspaceInteractionMode,
  type WorkspaceMapToggleId,
} from "@/lib/workspace-mode";
import type { MapOverlayPersistScope } from "@/lib/map-overlay-persist";

export function MapRightStack({
  viewOnly,
  mountMapNotes,
  overlayPersist,
  workspaceId,
  onMapExploreToggle,
  onInteractionModeChange,
  onMapToggle,
  mapNotesCount,
  annotationLayers,
  minimapStackRef,
  learnerMode,
  interactionModeProp,
  mapExploreOpen,
  mapNotesPlaneVisible,
  setMapNotesPlaneVisible,
  handleMapNoteAddAtCenter,
  annotationNameOpen,
  annotationNameDraft,
  setAnnotationNameDraft,
  setAnnotationNameOpen,
  handleAnnotationLayerAdd,
  activeAnnotationLayerId,
  handleAnnotationLayerSelect,
  handleAnnotationLayerToggle,
  handleAnnotationLayerDelete,
}: {
  viewOnly: boolean;
  mountMapNotes: boolean;
  overlayPersist: MapOverlayPersistScope | null;
  workspaceId?: string;
  onMapExploreToggle?: () => void;
  onInteractionModeChange?: (mode: WorkspaceInteractionMode) => void;
  /** Unified 3-state under-minimap handler (Build / Play / Explore). */
  onMapToggle?: (id: WorkspaceMapToggleId) => void;
  mapNotesCount: number;
  annotationLayers: AnnotationLayer[];
  minimapStackRef: RefObject<HTMLDivElement | null>;
  learnerMode: boolean;
  interactionModeProp?: "creator" | "learner";
  mapExploreOpen: boolean;
  mapNotesPlaneVisible: boolean;
  setMapNotesPlaneVisible: (next: boolean | ((prev: boolean) => boolean)) => void;
  handleMapNoteAddAtCenter: () => void;
  annotationNameOpen: boolean;
  annotationNameDraft: string;
  setAnnotationNameDraft: (value: string) => void;
  setAnnotationNameOpen: (open: boolean) => void;
  handleAnnotationLayerAdd: () => void;
  activeAnnotationLayerId: string | null;
  handleAnnotationLayerSelect: (layerId: string) => void;
  handleAnnotationLayerToggle: (layerId: string) => void;
  handleAnnotationLayerDelete: (layerId: string) => void;
}) {
  const show =
    (!viewOnly &&
      (mountMapNotes ||
        overlayPersist ||
        workspaceId ||
        onMapToggle ||
        onMapExploreToggle ||
        onInteractionModeChange)) ||
    (viewOnly &&
      (shouldShowMapNotesPlaneToggle(mapNotesCount) ||
        shouldShowAnnotationLayerToggles(annotationLayers.length)));
  if (!show) return null;

  return (
    <div
      ref={minimapStackRef}
      data-map-minimap-stack
      data-learner-map-notes-toolbar={mountMapNotes ? "true" : undefined}
      data-learner-notes-under-minimap={mountMapNotes ? "true" : undefined}
      data-map-notes-mode={learnerMode ? "learner" : "creator"}
      className="pointer-events-auto absolute right-2 z-20 flex flex-col gap-1"
      style={{
        top: 8 + MINIMAP_FRAME_HEIGHT + 8,
        width: MINIMAP_FRAME_WIDTH,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!viewOnly &&
      (typeof onMapToggle === "function" ||
        typeof onInteractionModeChange === "function") ? (
        <div
          className="flex w-full shrink-0 items-center gap-0.5 rounded-md border border-neutral-700/90 bg-neutral-950/90 p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          data-workspace-mode-toggle
          data-workspace-mode-under-minimap
          data-workspace-mode-toggle-states="build,play,explore"
          role="group"
          aria-label="Workspace mode"
        >
          {WORKSPACE_MAP_TOGGLE_IDS.map((id) => {
            const interaction: WorkspaceInteractionMode =
              interactionModeProp === "learner" || interactionModeProp === "creator"
                ? interactionModeProp
                : learnerMode
                  ? "learner"
                  : "creator";
            const current = resolveWorkspaceMapToggleId({
              interactionMode: interaction,
              exploreOpen: mapExploreOpen,
            });
            const active = current === id;
            const label = workspaceModeDisplayLabel(id);
            return (
              <button
                key={id}
                type="button"
                data-workspace-mode={id}
                data-active={active ? "true" : "false"}
                aria-pressed={active}
                aria-label={label}
                onClick={() => {
                  if (typeof onMapToggle === "function") {
                    onMapToggle(id);
                    return;
                  }
                  const next = nextWorkspaceMapToggle({
                    clicked: id,
                    interactionMode: interaction,
                    exploreOpen: mapExploreOpen,
                  });
                  if (next.exploreOpen !== mapExploreOpen) {
                    onMapExploreToggle?.();
                  }
                  if (next.interactionMode !== interaction) {
                    onInteractionModeChange?.(next.interactionMode);
                  }
                }}
                className={`min-w-0 flex-1 rounded px-1 py-1.5 text-center text-[10px] font-medium uppercase tracking-normal transition ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      {mountMapNotes &&
      (!viewOnly || shouldShowMapNotesPlaneToggle(mapNotesCount)) ? (
        <div
          className="flex items-stretch gap-0.5 rounded-md border border-neutral-700/90 bg-neutral-950/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          data-map-notes-visibility-row
          data-map-notes-visibility={mapNotesPlaneVisible ? "visible" : "hidden"}
        >
          {!viewOnly ? (
            <button
              type="button"
              data-learner-note-add
              data-map-note-add
              title={
                learnerMode
                  ? "Add a personal note in the middle of the map"
                  : "Add an author note in the middle of the map (visible to learners)"
              }
              onClick={() => handleMapNoteAddAtCenter()}
              className="min-w-0 flex-1 px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200 transition hover:text-white"
            >
              Add note
            </button>
          ) : (
            <span className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200">
              Notes
            </span>
          )}
          <button
            type="button"
            data-map-notes-visibility-toggle
            data-learner-notes-visibility-toggle
            data-map-notes-visibility={mapNotesPlaneVisible ? "visible" : "hidden"}
            title={mapNotesPlaneVisible ? "Hide all notes on the map" : "Show notes on the map"}
            aria-label={mapNotesPlaneVisible ? "Hide notes" : "Show notes"}
            aria-pressed={mapNotesPlaneVisible}
            onClick={() =>
              setMapNotesPlaneVisible((prev) => toggleMapNotesPlaneVisible(prev))
            }
            className={`flex shrink-0 items-center justify-center px-1.5 ${
              mapNotesPlaneVisible ? "text-white" : "text-neutral-500"
            }`}
          >
            {mapNotesPlaneVisible ? (
              <svg
                data-map-notes-eye="open"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
                />
                <circle cx="12" cy="12" r="2.75" />
              </svg>
            ) : (
              <svg
                data-map-notes-eye="closed"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 3.5l17 17" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.6 10.7a2.75 2.75 0 003.7 3.7"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.9 5.1A11 11 0 0112 4.9c5.5 0 9 5.9 9.5 7.1-.3.7-1.2 2.4-3 3.9M6.1 6.2C4.1 7.7 3 9.6 2.5 12c.4 1 3.5 6.5 9.5 6.5 1.1 0 2.1-.2 3-.5"
                />
              </svg>
            )}
          </button>
        </div>
      ) : null}

      {mountMapNotes &&
      overlayPersist &&
      (!viewOnly ||
        (shouldShowMapNotesPlaneToggle(mapNotesCount) &&
          shouldShowAnnotationLayerToggles(annotationLayers.length))) ? (
        <div
          data-map-notes-layers-separator
          role="separator"
          aria-hidden
          className="mx-1 my-0.5 h-px shrink-0 bg-neutral-700/70"
        />
      ) : null}

      {overlayPersist &&
      (!viewOnly || shouldShowAnnotationLayerToggles(annotationLayers.length)) ? (
        <div
          data-annotation-layers-stack
          data-annotation-layers-under-notes="true"
          data-annotation-layer-count={annotationLayers.length}
          className="flex flex-col gap-1"
        >
          {!viewOnly && !learnerMode ? (
            annotationNameOpen ? (
              <div
                className="rounded-md border border-neutral-700/90 bg-neutral-950/95 p-1.5 shadow-lg"
                data-annotation-layer-name-form
              >
                <input
                  type="text"
                  data-annotation-layer-name-input
                  value={annotationNameDraft}
                  maxLength={48}
                  placeholder="Layer name"
                  autoFocus
                  onChange={(e) => setAnnotationNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAnnotationLayerAdd();
                    if (e.key === "Escape") {
                      setAnnotationNameOpen(false);
                      setAnnotationNameDraft("");
                    }
                  }}
                  className="mb-1 w-full rounded border border-neutral-700 bg-black/40 px-2 py-1 text-left text-[11px] text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    data-annotation-layer-add-confirm
                    onClick={() => handleAnnotationLayerAdd()}
                    className="flex-1 rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-white hover:bg-white/15"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    data-annotation-layer-add-cancel
                    onClick={() => {
                      setAnnotationNameOpen(false);
                      setAnnotationNameDraft("");
                    }}
                    className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-annotation-layer-add
                title="Add a freehand annotation layer"
                onClick={() => setAnnotationNameOpen(true)}
                className="w-full rounded-md border border-neutral-700/90 bg-neutral-950/90 px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:border-neutral-500 hover:text-white"
              >
                Add layer
              </button>
            )
          ) : null}

          {annotationLayers.map((layer) => {
            const selected =
              !viewOnly && !learnerMode && activeAnnotationLayerId === layer.id;
            const canDelete = canDeleteAnnotationLayer({ learnerMode, viewOnly });
            return (
              <div
                key={layer.id}
                data-annotation-layer-row={layer.id}
                data-annotation-layer-visible={layer.visible ? "true" : "false"}
                className={`flex items-stretch gap-0.5 rounded-md border bg-neutral-950/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
                  selected ? "border-white/40" : "border-neutral-700/90"
                }`}
              >
                {!viewOnly && !learnerMode ? (
                  <button
                    type="button"
                    data-annotation-layer-select={layer.id}
                    data-active={selected ? "true" : "false"}
                    title={
                      selected
                        ? "Drawing on this layer (click to deselect)"
                        : "Select layer to draw"
                    }
                    onClick={() => handleAnnotationLayerSelect(layer.id)}
                    className={`min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                      selected ? "text-white" : "text-neutral-200 hover:text-white"
                    }`}
                  >
                    {layer.name}
                  </button>
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200"
                    data-annotation-layer-label={layer.id}
                  >
                    {layer.name}
                  </span>
                )}
                <button
                  type="button"
                  data-annotation-layer-toggle={layer.id}
                  data-annotation-visibility={layer.visible ? "visible" : "hidden"}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  aria-pressed={layer.visible}
                  onClick={() => handleAnnotationLayerToggle(layer.id)}
                  className={`flex shrink-0 items-center justify-center px-1.5 ${
                    layer.visible ? "text-white" : "text-neutral-500"
                  }`}
                >
                  {layer.visible ? (
                    <svg
                      data-annotation-eye="open"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
                      />
                      <circle cx="12" cy="12" r="2.75" />
                    </svg>
                  ) : (
                    <svg
                      data-annotation-eye="closed"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 3.5l17 17" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.6 10.7a2.75 2.75 0 003.7 3.7"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.9 5.1A11 11 0 0112 4.9c5.5 0 9 5.9 9.5 7.1-.3.7-1.2 2.4-3 3.9M6.1 6.2C4.1 7.7 3 9.6 2.5 12c.4 1 3.5 6.5 9.5 6.5 1.1 0 2.1-.2 3-.5"
                      />
                    </svg>
                  )}
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    data-annotation-layer-delete={layer.id}
                    title="Delete annotation layer"
                    aria-label={`Delete ${layer.name}`}
                    onClick={() => handleAnnotationLayerDelete(layer.id)}
                    className="shrink-0 px-1.5 text-[12px] text-neutral-500 hover:text-red-400"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
