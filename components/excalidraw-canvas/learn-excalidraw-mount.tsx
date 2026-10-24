"use client";

import dynamic from "next/dynamic";
import { Component, memo, useLayoutEffect, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";
import { commitOpenExcalidrawTextEditor } from "@/lib/excalidraw-text-editor";
import type { IleWorkCanvasElement, IleWorkCanvasFiles, IleWorkCanvasScene } from "@/lib/learn-work-canvas";
import type { LiveExcalidrawAPI, LiveExcalidrawAppState } from "@/components/excalidraw-canvas/excalidraw-api";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const ILE_EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    export: false as false,
    saveAsImage: false,
    saveToActiveFile: false,
    toggleTheme: false,
  },
};

const IleExcalidrawMount = memo(function IleExcalidrawMount({
  onApi,
  onChange,
  onPointerUpdate,
  initialData,
  viewModeEnabled = false,
}: {
  onApi: (api: LiveExcalidrawAPI) => void;
  onChange: (
    elements: readonly IleWorkCanvasElement[],
    appState: LiveExcalidrawAppState,
    files: IleWorkCanvasFiles,
  ) => void;
  onPointerUpdate?: (payload: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "up" | "down";
    pointersMap: Map<number, unknown>;
  }) => void;
  initialData: IleWorkCanvasScene & { scrollToContent?: boolean };
  viewModeEnabled?: boolean;
}) {
  useLayoutEffect(() => {
    return () => {
      commitOpenExcalidrawTextEditor();
    };
  }, []);
  return (
    <Excalidraw
      excalidrawAPI={(api) => onApi(api as unknown as LiveExcalidrawAPI)}
      onChange={(elements, appState, files) =>
        onChange(
          elements as unknown as readonly IleWorkCanvasElement[],
          appState as unknown as LiveExcalidrawAppState,
          files as unknown as IleWorkCanvasFiles,
        )
      }
      onPointerUpdate={onPointerUpdate}
      initialData={initialData as never}
      theme="dark"
      viewModeEnabled={viewModeEnabled}
      UIOptions={ILE_EXCALIDRAW_UI_OPTIONS}
    />
  );
});

class IleExcalidrawErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[ExcalidrawCanvas] crashed:", error);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div
          data-ile-excalidraw-crash
          className="flex h-full items-center justify-center bg-[#0a0a0a] px-4 text-center font-mono text-[11px] uppercase tracking-wider text-neutral-400"
        >
          Canvas failed to load.
        </div>
      );
    }
    return this.props.children;
  }
}

export { IleExcalidrawMount, IleExcalidrawErrorBoundary };
