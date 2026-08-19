"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANNOTATION_DEFAULT_STROKE_WIDTH,
  canDeleteAnnotationLayer,
  canDrawOnAnnotationLayer,
  createAnnotationLayer,
  deleteAnnotationLayer,
  loadAnnotationLayers,
  saveAnnotationLayers,
  toggleAnnotationLayerVisible,
  upsertAnnotationLayer,
  type AnnotationDrawTool,
  type AnnotationLayer,
  type AnnotationPoint,
  type AnnotationStrokeThickness,
} from "@/lib/map-annotation-layers";
import type { MapOverlayPersistScope } from "@/lib/map-overlay-persist";

export function useMapAnnotations(input: {
  overlayPersist: MapOverlayPersistScope | null;
  learnerMode: boolean;
  viewOnly: boolean;
  mountMapNotes: boolean;
}) {
  const { overlayPersist, learnerMode, viewOnly, mountMapNotes } = input;

  const [annotationLayers, setAnnotationLayers] = useState<AnnotationLayer[]>(
    [],
  );
  const [activeAnnotationLayerId, setActiveAnnotationLayerId] = useState<
    string | null
  >(null);
  const [annotationDrawTool, setAnnotationDrawTool] =
    useState<AnnotationDrawTool>("freehand");
  const [annotationStrokeThickness, setAnnotationStrokeThickness] =
    useState<AnnotationStrokeThickness>(ANNOTATION_DEFAULT_STROKE_WIDTH);
  const [annotationNameDraft, setAnnotationNameDraft] = useState("");
  const [annotationNameOpen, setAnnotationNameOpen] = useState(false);
  const annotationDrawRef = useRef<{
    pointerId: number;
    layerId: string;
    kind: AnnotationDrawTool;
    startLocal: AnnotationPoint;
    curLocal: AnnotationPoint;
    pointsLocal: AnnotationPoint[];
  } | null>(null);
  const [annotationDrawPreview, setAnnotationDrawPreview] = useState<{
    kind: AnnotationDrawTool;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    points: AnnotationPoint[];
    strokeWidth: number;
  } | null>(null);
  const minimapStackRef = useRef<HTMLDivElement>(null);
  const [minimapStackHeight, setMinimapStackHeight] = useState(0);

  useEffect(() => {
    if (!overlayPersist) {
      setAnnotationLayers([]);
      setActiveAnnotationLayerId(null);
      return;
    }
    setAnnotationLayers(
      loadAnnotationLayers({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
      }),
    );
  }, [overlayPersist]);

  useEffect(() => {
    const el = minimapStackRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setMinimapStackHeight(el?.offsetHeight ?? 0);
      return;
    }
    const ro = new ResizeObserver(() => {
      setMinimapStackHeight(el.offsetHeight);
    });
    ro.observe(el);
    setMinimapStackHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [annotationLayers.length, mountMapNotes, learnerMode, annotationNameOpen]);

  useEffect(() => {
    if (learnerMode) {
      setActiveAnnotationLayerId(null);
      setAnnotationNameOpen(false);
      annotationDrawRef.current = null;
      setAnnotationDrawPreview(null);
    }
  }, [learnerMode]);

  const persistAnnotationLayers = useCallback(
    (next: AnnotationLayer[]) => {
      setAnnotationLayers(next);
      if (viewOnly || !overlayPersist) return;
      saveAnnotationLayers({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
        layers: next,
      });
    },
    [overlayPersist, viewOnly],
  );

  const annotationDrawingActive =
    !viewOnly &&
    !learnerMode &&
    canDrawOnAnnotationLayer({ learnerMode, viewOnly }) &&
    Boolean(activeAnnotationLayerId);

  const handleAnnotationLayerAdd = useCallback(() => {
    if (viewOnly || learnerMode || !overlayPersist) return;
    const name =
      annotationNameDraft.trim() || `Layer ${annotationLayers.length + 1}`;
    const layer = createAnnotationLayer({ name });
    persistAnnotationLayers(upsertAnnotationLayer(annotationLayers, layer));
    setAnnotationNameDraft("");
    setAnnotationNameOpen(false);
    setActiveAnnotationLayerId(layer.id);
    setAnnotationDrawTool("freehand");
  }, [
    annotationLayers,
    annotationNameDraft,
    learnerMode,
    persistAnnotationLayers,
    overlayPersist,
    viewOnly,
  ]);

  const handleAnnotationLayerSelect = useCallback(
    (layerId: string) => {
      if (viewOnly || learnerMode) return;
      setActiveAnnotationLayerId((prev) => (prev === layerId ? null : layerId));
    },
    [learnerMode, viewOnly],
  );

  const handleAnnotationLayerDelete = useCallback(
    (layerId: string) => {
      if (!canDeleteAnnotationLayer({ learnerMode, viewOnly })) return;
      const next = deleteAnnotationLayer(annotationLayers, layerId, {
        learnerMode,
        viewOnly,
      });
      persistAnnotationLayers(next);
      if (activeAnnotationLayerId === layerId) {
        setActiveAnnotationLayerId(null);
      }
    },
    [
      activeAnnotationLayerId,
      annotationLayers,
      learnerMode,
      persistAnnotationLayers,
      viewOnly,
    ],
  );

  const handleAnnotationLayerToggle = useCallback(
    (layerId: string) => {
      const existing = annotationLayers.find((l) => l.id === layerId);
      if (!existing) return;
      persistAnnotationLayers(
        upsertAnnotationLayer(
          annotationLayers,
          toggleAnnotationLayerVisible(existing),
        ),
      );
    },
    [annotationLayers, persistAnnotationLayers],
  );

  return {
    annotationLayers,
    setAnnotationLayers,
    activeAnnotationLayerId,
    setActiveAnnotationLayerId,
    annotationDrawTool,
    setAnnotationDrawTool,
    annotationStrokeThickness,
    setAnnotationStrokeThickness,
    annotationNameDraft,
    setAnnotationNameDraft,
    annotationNameOpen,
    setAnnotationNameOpen,
    annotationDrawRef,
    annotationDrawPreview,
    setAnnotationDrawPreview,
    minimapStackRef,
    minimapStackHeight,
    persistAnnotationLayers,
    annotationDrawingActive,
    handleAnnotationLayerAdd,
    handleAnnotationLayerSelect,
    handleAnnotationLayerDelete,
    handleAnnotationLayerToggle,
  };
}
