"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyLearnerNoteResize,
  canDeleteMapNote,
  canEditMapNoteContent,
  canMutateMapNoteGeometry,
  defaultMapNotesPlaneVisible,
  deleteLearnerMapNote,
  loadCreatorMapNotes,
  loadLearnerMapNotes,
  mapNoteSourceOf,
  mapNotesForPlaneRender,
  saveCreatorMapNotes,
  saveLearnerMapNotes,
  toggleLearnerMapNoteCollapsed,
  toggleMapNotesPlaneVisible,
  updateLearnerMapNote,
  upsertLearnerMapNote,
  type LearnerMapNote,
} from "@/lib/learner-map-notes";
import type { MapOverlayPersistScope } from "@/lib/map-overlay-persist";

export function useMapNotes(input: {
  mountMapNotes: boolean;
  overlayPersist: MapOverlayPersistScope | null;
  learnerMode: boolean;
  viewOnly: boolean;
  resolvedLearnerScope: string;
}) {
  const {
    mountMapNotes,
    overlayPersist,
    learnerMode,
    viewOnly,
    resolvedLearnerScope,
  } = input;

  const [creatorNotes, setCreatorNotes] = useState<LearnerMapNote[]>([]);
  const [learnerNotes, setLearnerNotes] = useState<LearnerMapNote[]>([]);
  const [mapNotesPlaneVisible, setMapNotesPlaneVisible] = useState(
    defaultMapNotesPlaneVisible,
  );

  useEffect(() => {
    if (!mountMapNotes || !overlayPersist) {
      setCreatorNotes([]);
      setLearnerNotes([]);
      return;
    }
    const persist = {
      workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
      sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
      mapKind: overlayPersist.kind,
    };
    setCreatorNotes(loadCreatorMapNotes(persist));
    if (learnerMode) {
      setLearnerNotes(
        loadLearnerMapNotes({
          ...persist,
          learnerScopeId: resolvedLearnerScope,
        }),
      );
    } else {
      setLearnerNotes([]);
    }
  }, [mountMapNotes, overlayPersist, resolvedLearnerScope, learnerMode]);

  const mapNotes = useMemo(() => {
    if (!mountMapNotes) return [] as LearnerMapNote[];
    if (!learnerMode) return creatorNotes;
    const seen = new Set(creatorNotes.map((n) => n.id));
    const merged = [...creatorNotes];
    for (const n of learnerNotes) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      merged.push(n);
    }
    return merged;
  }, [mountMapNotes, learnerMode, creatorNotes, learnerNotes]);

  const mapNotesOnPlane = useMemo(
    () => mapNotesForPlaneRender(mapNotes, mapNotesPlaneVisible),
    [mapNotes, mapNotesPlaneVisible],
  );

  const persistCreatorNotes = useCallback(
    (next: LearnerMapNote[]) => {
      setCreatorNotes(next);
      if (viewOnly || !overlayPersist) return;
      saveCreatorMapNotes({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
        notes: next,
      });
    },
    [overlayPersist, viewOnly],
  );

  const persistLearnerNotes = useCallback(
    (next: LearnerMapNote[]) => {
      setLearnerNotes(next);
      if (viewOnly || !overlayPersist) return;
      saveLearnerMapNotes({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
        learnerScopeId: resolvedLearnerScope,
        notes: next,
      });
    },
    [overlayPersist, resolvedLearnerScope, viewOnly],
  );

  const findMapNote = useCallback(
    (noteId: string): LearnerMapNote | undefined =>
      mapNotes.find((n) => n.id === noteId),
    [mapNotes],
  );

  const patchMapNote = useCallback(
    (noteId: string, updater: (existing: LearnerMapNote) => LearnerMapNote) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      const updated = updater(existing);
      if (mapNoteSourceOf(existing) === "creator") {
        persistCreatorNotes(upsertLearnerMapNote(creatorNotes, updated));
      } else {
        persistLearnerNotes(upsertLearnerMapNote(learnerNotes, updated));
      }
    },
    [
      creatorNotes,
      findMapNote,
      learnerNotes,
      persistCreatorNotes,
      persistLearnerNotes,
    ],
  );

  const handleLearnerNoteToggle = useCallback(
    (noteId: string) => {
      patchMapNote(noteId, (existing) => toggleLearnerMapNoteCollapsed(existing));
    },
    [patchMapNote],
  );

  const handleLearnerNoteSaveBody = useCallback(
    (noteId: string, body: string) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canEditMapNoteContent(existing, { learnerMode, viewOnly })) return;
      patchMapNote(noteId, (n) => updateLearnerMapNote(n, { body }));
    },
    [findMapNote, learnerMode, patchMapNote, viewOnly],
  );

  const handleLearnerNoteDelete = useCallback(
    (noteId: string) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canDeleteMapNote(existing, { learnerMode, viewOnly })) return;
      if (mapNoteSourceOf(existing) === "creator") {
        persistCreatorNotes(deleteLearnerMapNote(creatorNotes, noteId));
      } else {
        persistLearnerNotes(deleteLearnerMapNote(learnerNotes, noteId));
      }
    },
    [
      creatorNotes,
      findMapNote,
      learnerMode,
      learnerNotes,
      persistCreatorNotes,
      persistLearnerNotes,
      viewOnly,
    ],
  );

  const handleLearnerNoteDragEnd = useCallback(
    (noteId: string, next: { x: number; y: number }) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canMutateMapNoteGeometry(existing, { learnerMode, viewOnly })) return;
      patchMapNote(noteId, (n) => updateLearnerMapNote(n, { x: next.x, y: next.y }));
    },
    [findMapNote, learnerMode, patchMapNote, viewOnly],
  );

  const handleLearnerNoteResizeEnd = useCallback(
    (noteId: string, next: { width: number; height: number }) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canMutateMapNoteGeometry(existing, { learnerMode, viewOnly })) return;
      patchMapNote(noteId, (n) =>
        applyLearnerNoteResize(n, {
          width: next.width,
          height: next.height,
        }),
      );
    },
    [findMapNote, learnerMode, patchMapNote, viewOnly],
  );

  const toggleNotesPlane = useCallback(() => {
    setMapNotesPlaneVisible((prev) => toggleMapNotesPlaneVisible(prev));
  }, []);

  return {
    creatorNotes,
    setCreatorNotes,
    learnerNotes,
    setLearnerNotes,
    mapNotesPlaneVisible,
    setMapNotesPlaneVisible,
    mapNotes,
    mapNotesOnPlane,
    persistCreatorNotes,
    persistLearnerNotes,
    findMapNote,
    patchMapNote,
    handleLearnerNoteToggle,
    handleLearnerNoteSaveBody,
    handleLearnerNoteDelete,
    handleLearnerNoteDragEnd,
    handleLearnerNoteResizeEnd,
    toggleNotesPlane,
  };
}
