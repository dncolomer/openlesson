"use client";

import dynamic from "next/dynamic";
import { Component, memo, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

type ExcalidrawAPIRef = any;
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
  onApi: (api: ExcalidrawAPIRef) => void;
  onChange: (
    elements: readonly any[],
    appState: any,
    files: any,
  ) => void;
  onPointerUpdate?: (payload: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "up" | "down";
    pointersMap: Map<number, unknown>;
  }) => void;
  initialData: { elements: any[]; appState: any; files: any; scrollToContent?: boolean };
  viewModeEnabled?: boolean;
}) {
  return (
    <Excalidraw
      excalidrawAPI={onApi}
      onChange={onChange}
      onPointerUpdate={onPointerUpdate}
      initialData={initialData}
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
