"use client";

import { useCallback, useRef, useState } from "react";
import type { ResizablePaneHandle } from "@/components/ResizablePane";
import type { Tool } from "@/components/ToolsPanel";

export type PaneVis = { tools: boolean; tutor: boolean; plan: boolean };

export function useSessionPaneLayout() {
  const [activeTool, setActiveTool] = useState<Tool>("chapters");
  const prevToolRef = useRef<Tool | null>(null);
  const resizablePaneRef = useRef<ResizablePaneHandle>(null);
  const [paneVisibility, setPaneVisibility] = useState<PaneVis>({
    tools: true,
    tutor: true,
    plan: true,
  });

  const applyPaneVisibility = useCallback((next: PaneVis) => {
    next = { ...next, tutor: true };
    if (!next.tools && !next.tutor && !next.plan) return;
    setPaneVisibility(next);
    if (!next.tools) {
      resizablePaneRef.current?.setLayout({ collapsedSide: "left" });
    } else if (!next.tutor) {
      resizablePaneRef.current?.setLayout({ collapsedSide: "right" });
    } else {
      resizablePaneRef.current?.setLayout({ collapsedSide: null });
    }
  }, []);

  const ensureVisible = useCallback(
    (view: keyof PaneVis) => {
      if (paneVisibility[view]) return;
      applyPaneVisibility({ ...paneVisibility, [view]: true });
    },
    [paneVisibility, applyPaneVisibility]
  );

  const applyIleChapterGridStartup = useCallback(() => {
    prevToolRef.current = null;
    setActiveTool("chapters");
    applyPaneVisibility({ tools: true, tutor: true, plan: true });
  }, [applyPaneVisibility]);

  return {
    activeTool,
    setActiveTool,
    prevToolRef,
    resizablePaneRef,
    paneVisibility,
    setPaneVisibility,
    applyPaneVisibility,
    ensureVisible,
    applyIleChapterGridStartup,
  };
}
