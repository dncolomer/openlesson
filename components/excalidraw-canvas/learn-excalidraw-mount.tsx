"use client";

import dynamic from "next/dynamic";
import { Component, memo, useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
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

type IleExcalidrawPointerUpdate = {
  pointer: { x: number; y: number; tool: "pointer" | "laser" };
  button: "up" | "down";
  pointersMap: Map<number, unknown>;
};

type IleExcalidrawChange = (
  elements: readonly IleWorkCanvasElement[],
  appState: LiveExcalidrawAppState,
  files: IleWorkCanvasFiles,
) => void;

/**
 * Outer host always takes the latest callbacks. The inner board is memoized
 * so Excalidraw does not componentDidUpdate (and fire onChange) on every
 * parent render.
 */
function IleExcalidrawMount({
  onApi,
  onChange,
  onPointerUpdate,
  initialData,
  viewModeEnabled = false,
}: {
  onApi: (api: LiveExcalidrawAPI | null) => void;
  onChange: IleExcalidrawChange;
  onPointerUpdate?: (payload: IleExcalidrawPointerUpdate) => void;
  initialData: IleWorkCanvasScene & { scrollToContent?: boolean };
  viewModeEnabled?: boolean;
}) {
  const onApiRef = useRef(onApi);
  const onChangeRef = useRef(onChange);
  const onPointerUpdateRef = useRef(onPointerUpdate);
  const initialDataRef = useRef(initialData);
  onApiRef.current = onApi;
  onChangeRef.current = onChange;
  onPointerUpdateRef.current = onPointerUpdate;
  return (
    <IleExcalidrawStable
      onApiRef={onApiRef}
      onChangeRef={onChangeRef}
      onPointerUpdateRef={onPointerUpdateRef}
      initialData={initialDataRef.current}
      viewModeEnabled={viewModeEnabled}
      pointerEnabled={Boolean(onPointerUpdate)}
    />
  );
}

const IleExcalidrawStable = memo(function IleExcalidrawStable({
  onApiRef,
  onChangeRef,
  onPointerUpdateRef,
  initialData,
  viewModeEnabled,
  pointerEnabled,
}: {
  onApiRef: { current: (api: LiveExcalidrawAPI | null) => void };
  onChangeRef: { current: IleExcalidrawChange };
  onPointerUpdateRef: { current: ((payload: IleExcalidrawPointerUpdate) => void) | undefined };
  initialData: IleWorkCanvasScene & { scrollToContent?: boolean };
  viewModeEnabled: boolean;
  pointerEnabled: boolean;
}) {
  useLayoutEffect(() => {
    return () => {
      commitOpenExcalidrawTextEditor();
    };
  }, []);
  const bindApi = useCallback((api: unknown) => {
    onApiRef.current((api ?? null) as LiveExcalidrawAPI | null);
  }, [onApiRef]);
  const bindChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      onChangeRef.current(
        elements as readonly IleWorkCanvasElement[],
        appState as LiveExcalidrawAppState,
        files as IleWorkCanvasFiles,
      );
    },
    [onChangeRef],
  );
  const bindPointerUpdate = useCallback((payload: IleExcalidrawPointerUpdate) => {
    onPointerUpdateRef.current?.(payload);
  }, [onPointerUpdateRef]);
  return (
    <Excalidraw
      onExcalidrawAPI={bindApi}
      onChange={bindChange}
      onPointerUpdate={pointerEnabled ? bindPointerUpdate : undefined}
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
