"use client";

import { ToolIcon, type Tool } from "@/components/ToolsPanel";
import {
  ILE_CHAPTER_WIDGET_TOOLS,
  isIleChapterWidgetTool,
} from "@/lib/ile-map-chrome";

const TAB_LABELS: Record<(typeof ILE_CHAPTER_WIDGET_TOOLS)[number] | "chapters", string> = {
  chapters: "Chapter",
  canvas: "Canvas",
  notebook: "Notes",
  grokipedia: "Grokipedia",
  dantes: "Dantes",
};

export function IleChapterToolTabs({
  activeTool,
  onToolChange,
}: {
  activeTool: Tool | null;
  onToolChange: (tool: Tool) => void;
}) {
  const current = isIleChapterWidgetTool(activeTool) ? activeTool : "chapters";
  return (
    <div
      data-ile-chapter-tool-tabs
      className="flex min-w-0 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-neutral-800 px-1 py-1"
    >
      <button
        type="button"
        data-ile-chapter-tool-tab="chapters"
        data-ile-chapter-tool-tab-active={current === "chapters" ? "true" : undefined}
        onClick={() => onToolChange("chapters")}
        className={`shrink-0 rounded-none px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
          current === "chapters"
            ? "bg-white text-neutral-950"
            : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
        }`}
      >
        {TAB_LABELS.chapters}
      </button>
      {ILE_CHAPTER_WIDGET_TOOLS.map((toolId) => (
        <button
          key={toolId}
          type="button"
          data-ile-chapter-tool-tab={toolId}
          data-ile-chapter-tool-tab-active={current === toolId ? "true" : undefined}
          title={TAB_LABELS[toolId]}
          onClick={() => onToolChange(toolId)}
          className={`flex shrink-0 items-center gap-1 rounded-none px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
            current === toolId
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <ToolIcon id={toolId} />
          <span className="hidden sm:inline">{TAB_LABELS[toolId]}</span>
        </button>
      ))}
    </div>
  );
}
