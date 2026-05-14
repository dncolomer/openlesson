"use client";

import dynamic from "next/dynamic";
import { useRef, useCallback, useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

// Excalidraw CSS - required for proper rendering
import "@excalidraw/excalidraw/index.css";

// Dynamic import for Next.js SSR compatibility
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

interface ExcalidrawCanvasProps {
  initialData?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSceneData?: { elements: any[]; appState: any; files: any } | null;
  onCanvasChange?: (data: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSceneChange?: (data: { elements: any[]; appState: any; files: any }) => void;
  onSubmitToHelios?: (dataUrl?: string | null) => Promise<void> | void;
  canSubmitToHelios?: boolean;
  chapterLabel?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPIRef = any;

// Excalidraw's appState contains runtime-only fields like collaborators
// (a Map) that do not survive JSON storage. Persist only restorable state.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeSceneData(scene: { elements: any[]; appState: any; files: any } | null | undefined) {
  if (!scene) return undefined;
  const { collaborators: _collaborators, ...appState } = scene.appState ?? {};
  return {
    elements: scene.elements ?? [],
    appState,
    files: scene.files ?? {},
  };
}

/**
 * Excalidraw-based whiteboard canvas for desktop SessionView.
 * Replaces the old custom canvas implementation with Excalidraw's
 * full-featured drawing capabilities.
 * 
 * Exports PNG data URL on changes (debounced) for compatibility with
 * the existing storage/analysis pipeline.
 */
export function ExcalidrawCanvas({
  initialData,
  initialSceneData,
  onCanvasChange,
  onSceneChange,
  onSubmitToHelios,
  canSubmitToHelios = true,
  chapterLabel,
}: ExcalidrawCanvasProps) {
  const { t } = useI18n();
  const excalidrawAPIRef = useRef<ExcalidrawAPIRef>(null);
  const [isSubmittingToHelios, setIsSubmittingToHelios] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Store the latest scene data for PNG export
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneDataRef = useRef<{ elements: any[]; appState: any; files: any } | null>(null);
  const initialSceneDataRef = useRef(sanitizeSceneData(initialSceneData));
  const onSceneChangeRef = useRef(onSceneChange);
  const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scenePersistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExportingRef = useRef(false);
  const lastPersistedSceneJsonRef = useRef("");

  useEffect(() => {
    onSceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  /**
   * Export current scene to PNG data URL
   */
  const exportToPNG = useCallback(async (): Promise<string | null> => {
    const api = excalidrawAPIRef.current;
    if (!api) return null;

    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();

      // Skip if no elements
      if (!elements || elements.length === 0) {
        return null;
      }

      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: true,
          exportBackground: true,
          viewBackgroundColor: "#0a0a0a",
        },
        files,
        mimeType: "image/png",
      });

      // Convert blob to data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("[ExcalidrawCanvas] PNG export failed:", err);
      return null;
    }
  }, []);

  /**
   * Debounced PNG export - called on scene changes
   */
  const debouncedExportPNG = useCallback(() => {
    if (!onCanvasChange) return;

    // Clear any pending export
    if (exportTimeoutRef.current) {
      clearTimeout(exportTimeoutRef.current);
    }

    // Debounce: wait 500ms after last change before exporting
    exportTimeoutRef.current = setTimeout(async () => {
      if (isExportingRef.current) return;
      isExportingRef.current = true;

      try {
        const dataUrl = await exportToPNG();
        if (dataUrl) {
          onCanvasChange(dataUrl);
        }
      } finally {
        isExportingRef.current = false;
      }
    }, 500);
  }, [onCanvasChange, exportToPNG]);

  /**
   * Handle changes from Excalidraw
   */
  const handleChange = useCallback(
    (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: readonly any[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appState: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      files: any
    ) => {
      // Store scene data for potential immediate export
      const sceneData = sanitizeSceneData({ elements: [...elements], appState, files });
      sceneDataRef.current = sceneData ?? null;
      if (scenePersistTimeoutRef.current) clearTimeout(scenePersistTimeoutRef.current);
      scenePersistTimeoutRef.current = setTimeout(() => {
        if (!sceneData) return;
        const json = JSON.stringify(sceneData);
        if (json === lastPersistedSceneJsonRef.current) return;
        lastPersistedSceneJsonRef.current = json;
        onSceneChangeRef.current?.(sceneData);
      }, 250);
      
      // Trigger debounced PNG export
      debouncedExportPNG();
    },
    [debouncedExportPNG]
  );

  /**
   * Handle "Submit to Helios" click.
   * Forces an immediate PNG export before calling the parent handler.
   */
  const handleSubmitToHelios = useCallback(async () => {
    if (!onSubmitToHelios || isSubmittingToHelios || !canSubmitToHelios) return;

    setIsSubmittingToHelios(true);
    try {
      // Force immediate PNG export before submitting
      let dataUrl: string | null = null;
      if (onCanvasChange) {
        dataUrl = await exportToPNG();
        if (dataUrl) {
          onCanvasChange(dataUrl);
        }
      }
      await onSubmitToHelios(dataUrl);
    } finally {
      setIsSubmittingToHelios(false);
    }
  }, [onSubmitToHelios, isSubmittingToHelios, canSubmitToHelios, onCanvasChange, exportToPNG]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
      if (scenePersistTimeoutRef.current) {
        clearTimeout(scenePersistTimeoutRef.current);
      }
    };
  }, []);

  // Mark as loaded after mount
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      {/* Toolbar with Submit to Helios button */}
      <div className="flex items-center gap-2 p-2 border-b border-neutral-800 bg-neutral-900/30">
        <div className="min-w-0 flex-1 text-[11px] text-neutral-500">
          {chapterLabel && <span className="truncate">Canvas for {chapterLabel}</span>}
        </div>

        {onSubmitToHelios && (
          <button
            onClick={handleSubmitToHelios}
            disabled={isSubmittingToHelios || !canSubmitToHelios}
            title={
              canSubmitToHelios
                ? t("whiteboard.submitHint")
                : t("whiteboard.alreadySubmitted")
            }
            aria-label={t("whiteboard.submitToHelios")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-white bg-white/10 border border-white/30 hover:bg-white/20 hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmittingToHelios ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12l5 5L20 7"
                />
              </svg>
            )}
            <span className="whitespace-nowrap">
              {isSubmittingToHelios
                ? t("whiteboard.submitting")
                : t("whiteboard.submitToHelios")}
            </span>
          </button>
        )}
      </div>

      {/* Excalidraw container */}
      <div className="flex-1 min-h-0 relative">
        {isLoaded && (
          <Excalidraw
            excalidrawAPI={(api) => {
              excalidrawAPIRef.current = api;
            }}
            onChange={handleChange}
            initialData={initialSceneDataRef.current}
            theme="dark"
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveAsImage: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
