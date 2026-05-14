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
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [isSubmittingToHelios, setIsSubmittingToHelios] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
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

  const addImageToCanvas = useCallback(async (dataUrl: string) => {
    const api = excalidrawAPIRef.current;
    if (!api) return;

    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const fileId = `image-${Date.now()}`;
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      api.addFiles([
        {
          id: fileId,
          dataURL: dataUrl,
          mimeType: blob.type || "image/png",
          created: Date.now(),
        },
      ]);

      const appState = api.getAppState();
      const canvasWidth = appState.width || 800;
      const canvasHeight = appState.height || 600;
      const maxW = canvasWidth * 0.8;
      const maxH = canvasHeight * 0.8;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxW || h > maxH) {
        const scale = Math.min(maxW / w, maxH / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const imageElement = {
        id: `img-${Date.now()}`,
        type: "image",
        x: (canvasWidth - w) / 2,
        y: (canvasHeight - h) / 2,
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

      api.updateScene({ elements: [...api.getSceneElements(), imageElement] });
    } catch (err) {
      console.error("[ExcalidrawCanvas] Failed to add camera image:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  const openCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      }, 0);
    } catch (err) {
      setCameraError("Could not open webcam. Check browser camera permission.");
      console.error("[ExcalidrawCanvas] Camera open failed:", err);
    }
  }, []);

  const captureCameraFrame = useCallback(async () => {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    stopCamera();
    await addImageToCanvas(dataUrl);
  }, [addImageToCanvas, stopCamera]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (exportTimeoutRef.current) {
        clearTimeout(exportTimeoutRef.current);
      }
      if (scenePersistTimeoutRef.current) {
        clearTimeout(scenePersistTimeoutRef.current);
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
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

        <button
          type="button"
          onClick={openCamera}
          title="Open webcam"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 hover:text-white rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Camera</span>
        </button>

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
        {cameraOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6">
            <div className="w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-950 p-3 shadow-2xl">
              <video ref={cameraVideoRef} autoPlay muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" onClick={stopCamera} className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white">
                  Cancel
                </button>
                <button type="button" onClick={captureCameraFrame} className="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-950 hover:bg-white">
                  Capture to Canvas
                </button>
              </div>
            </div>
          </div>
        )}
        {cameraError && (
          <div className="absolute left-3 top-3 z-20 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {cameraError}
          </div>
        )}
      </div>
    </div>
  );
}
