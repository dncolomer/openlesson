"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import "@excalidraw/excalidraw/index.css";
import {
  emptyWorkspaceMapCanvasScene,
  normalizeWorkspaceMapCanvasScene,
  type WorkspaceMapCanvasScene,
} from "@/lib/workspace-map-canvas";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

/**
 * Workspace map right-pane infinite Excalidraw canvas with debounced persistence.
 */
export function WorkspaceMapCanvas({
  workspaceId,
  canEdit,
  ayclToken,
}: {
  workspaceId: string;
  canEdit: boolean;
  ayclToken?: string;
}) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initialSceneRef = useRef<WorkspaceMapCanvasScene>(emptyWorkspaceMapCanvasScene());
  const lastSavedJsonRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    loadedForIdRef.current = null;
    setReady(false);
    setLoadError(null);

    void (async () => {
      try {
        const qs = new URLSearchParams({ workspaceId });
        if (ayclToken) qs.set("ayclToken", ayclToken);
        const res = await fetch(`/api/workspace/map-canvas?${qs}`);
        const data = (await res.json().catch(() => ({}))) as {
          scene?: unknown;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          // Still show blank canvas
          initialSceneRef.current = emptyWorkspaceMapCanvasScene();
          setLoadError(data.error || null);
        } else {
          const scene = normalizeWorkspaceMapCanvasScene(data.scene);
          initialSceneRef.current = scene;
          lastSavedJsonRef.current = JSON.stringify(scene);
        }
        loadedForIdRef.current = workspaceId;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        initialSceneRef.current = emptyWorkspaceMapCanvasScene();
        setLoadError(err instanceof Error ? err.message : "Failed to load canvas");
        loadedForIdRef.current = workspaceId;
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [workspaceId, ayclToken]);

  const persist = useCallback(
    async (scene: WorkspaceMapCanvasScene) => {
      if (!canEdit || !workspaceId) return;
      const json = JSON.stringify(scene);
      if (json === lastSavedJsonRef.current) return;
      setSaving(true);
      try {
        const res = await fetch("/api/workspace/map-canvas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            scene,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        if (res.ok) {
          lastSavedJsonRef.current = json;
        }
      } catch {
        /* keep lastSaved so we retry on next change */
      } finally {
        setSaving(false);
      }
    },
    [canEdit, workspaceId, ayclToken],
  );

  const handleChange = useCallback(
    // Excalidraw types are heavy; match SessionView ExcalidrawCanvas pattern.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any, files: any) => {
      if (!canEdit) return;
      if (loadedForIdRef.current !== workspaceId) return;
      const scene = normalizeWorkspaceMapCanvasScene({
        elements: [...elements],
        appState,
        files,
      });
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persist(scene);
      }, 600);
    },
    [canEdit, workspaceId, persist],
  );

  return (
    <div
      data-workspace-map-canvas
      data-canvas-ready={ready ? "true" : "false"}
      data-canvas-editable={canEdit ? "true" : "false"}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-neutral-800/80 bg-neutral-950"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800/70 px-2.5 py-1.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Canvas
        </p>
        <p className="text-[10px] text-neutral-600" data-canvas-save-status>
          {!ready
            ? "Loading…"
            : saving
              ? "Saving…"
              : canEdit
                ? "Auto-saves"
                : "View only"}
        </p>
      </div>
      {loadError ? (
        <p className="px-2.5 py-1 text-[10px] text-neutral-200/90" data-canvas-load-error>
          {loadError}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {ready ? (
          <Excalidraw
            // Remount when workspace changes so initialData applies once
            key={workspaceId}
            theme="dark"
            // Cast: our normalized scene is JSON-safe; Excalidraw BinaryFiles is stricter.
            initialData={initialSceneRef.current as never}
            onChange={handleChange}
            viewModeEnabled={!canEdit}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveAsImage: true,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-600">
            Loading canvas…
          </div>
        )}
      </div>
    </div>
  );
}
