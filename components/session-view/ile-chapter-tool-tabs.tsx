"use client";

import type { Tool } from "@/components/ToolsPanel";

/** Work is canvas-only: no chapter-tool tabs. */
export function IleChapterToolTabs({
  activeTool: _activeTool,
  onToolChange: _onToolChange,
}: {
  activeTool: Tool | null;
  onToolChange: (tool: Tool) => void;
}) {
  return null;
}
