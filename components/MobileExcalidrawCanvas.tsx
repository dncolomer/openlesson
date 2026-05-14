"use client";

import dynamic from "next/dynamic";
import { useRef, useCallback, useState, useEffect } from "react";

// Excalidraw CSS - required for proper rendering
import "@excalidraw/excalidraw/index.css";

// Dynamic import for Next.js SSR compatibility
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

interface MobileExcalidrawCanvasProps {
  onCanvasChange?: (dataUrl: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSceneChange?: (data: { elements: any[]; appState: any; files: any }) => void;
  initialData?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSceneData?: { elements: any[]; appState: any; files: any } | null;
  onOpenCamera?: () => void;
  pendingImage?: string | null;
  onPendingImageUsed?: () => void;
  /**
   * Called when the user clicks "Submit to Helios". The parent is expected to
   * flush tool state to storage and trigger an analysis heartbeat so the
   * tutor can react to what's currently on the canvas.
   */
  onSubmitToHelios?: (dataUrl?: string | null) => Promise<void> | void;
  /**
   * When false, the Submit to Helios button is disabled. Parent flips this
   * based on whether the canvas has changed since the last submission.
   */
  canSubmitToHelios?: boolean;
  chapterLabel?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPIRef = any;

// Excalidraw appState includes runtime-only values like collaborators (Map),
// which become invalid after JSON sessionStorage serialization.
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
 * Excalidraw-based whiteboard canvas for mobile MobileSessionView.
 * Mobile-optimized version with camera integration and Submit to Helios.
 * 
 * Exports PNG data URL on changes (debounced) for compatibility with
 * the existing storage/analysis pipeline.
 */
export function MobileExcalidrawCanvas({
  onCanvasChange,
  onSceneChange,
  initialData,
  initialSceneData,
  onOpenCamera,
  pendingImage,
  onPendingImageUsed,
  onSubmitToHelios,
  canSubmitToHelios = true,
  chapterLabel,
}: MobileExcalidrawCanvasProps) {
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
      console.error("[MobileExcalidrawCanvas] PNG export failed:", err);
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

  /**
   * Add an image to the Excalidraw canvas
   */
  const addImageToCanvas = useCallback(async (dataUrl: string) => {
    const api = excalidrawAPIRef.current;
    if (!api) return;

    try {
      // Create an image element to get dimensions
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      // Generate unique ID for the file
      const fileId = `image-${Date.now()}`;

      // Convert data URL to binary for Excalidraw
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // Add file to Excalidraw
      api.addFiles([
        {
          id: fileId,
          dataURL: dataUrl,
          mimeType: blob.type || "image/png",
          created: Date.now(),
        },
      ]);

      // Get current canvas dimensions
      const appState = api.getAppState();
      const canvasWidth = appState.width || 800;
      const canvasHeight = appState.height || 600;

      // Scale image to fit within 80% of canvas
      const maxW = canvasWidth * 0.8;
      const maxH = canvasHeight * 0.8;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxW || h > maxH) {
        const scale = Math.min(maxW / w, maxH / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      // Center the image
      const x = (canvasWidth - w) / 2;
      const y = (canvasHeight - h) / 2;

      // Create image element
      const imageElement = {
        id: `img-${Date.now()}`,
        type: "image",
        x,
        y,
        width: w,
        height: h,
        angle: 0,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        fileId,
        scale: [1, 1] as [number, number],
      };

      // Add element to scene
      const currentElements = api.getSceneElements();
      api.updateScene({
        elements: [...currentElements, imageElement],
      });

      console.log("[MobileExcalidrawCanvas] Added image to canvas");
    } catch (err) {
      console.error("[MobileExcalidrawCanvas] Failed to add image:", err);
    }
  }, []);

  // Handle pending image from camera
  useEffect(() => {
    if (!pendingImage || !isLoaded) return;

    addImageToCanvas(pendingImage);
    onPendingImageUsed?.();
  }, [pendingImage, isLoaded, addImageToCanvas, onPendingImageUsed]);

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
    <div className="flex flex-col h-full bg-[#0a0a0a]" data-no-swipe="true">
      {/* Excalidraw container - fills space above toolbar */}
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

      {/* Bottom Toolbar */}
      <div className="shrink-0 bg-neutral-900 border-t border-neutral-800">
        <div className="flex items-center gap-2 px-2 py-2">
          {chapterLabel && (
            <div className="min-w-0 flex-1 px-1 text-[11px] text-neutral-500 truncate">
              Canvas for {chapterLabel}
            </div>
          )}
          {/* Camera */}
          <button
            onClick={() => onOpenCamera?.()}
            className="w-12 h-12 shrink-0 rounded-lg bg-neutral-800 text-neutral-400 flex items-center justify-center active:scale-[0.95] transition-transform"
            aria-label="Camera"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Submit to Helios */}
          {onSubmitToHelios && (
            <button
              onClick={handleSubmitToHelios}
              disabled={isSubmittingToHelios || !canSubmitToHelios}
              aria-label="Submit to Helios"
                className="flex-1 h-12 rounded-lg bg-white/10 border border-white/30 text-white active:bg-white/20 active:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              {isSubmittingToHelios ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                </svg>
              )}
              <span>{isSubmittingToHelios ? "Submitting…" : "Submit to Helios"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
