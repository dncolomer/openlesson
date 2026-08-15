"use client";

import type { BlockMapToolId, LassoShapeKind } from "@/lib/block-map-tools";
import { ToolIcon } from "@/components/block-skill-grid/map-tool-icons";

export function MapToolStripButton({
  tool,
  enabled,
  isActiveMode,
  title,
  cloneArmed,
  lassoShape,
  prereqEditActive,
  onClick,
}: {
  tool: BlockMapToolId;
  enabled: boolean;
  isActiveMode: boolean;
  title: string;
  cloneArmed?: boolean;
  lassoShape?: LassoShapeKind;
  prereqEditActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      key={tool}
      type="button"
      data-block-map-tool={tool}
      data-active={isActiveMode ? "true" : "false"}
      data-clone-armed={
        tool === "clone" ? (cloneArmed ? "true" : "false") : undefined
      }
      data-lasso-shape={tool === "lasso" ? lassoShape : undefined}
      data-prereq-edit-active={
        tool === "lock_until" && prereqEditActive ? "true" : undefined
      }
      disabled={!enabled}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={
        tool === "select" ||
        tool === "lasso" ||
        tool === "lock_until" ||
        tool === "clone"
          ? isActiveMode
          : undefined
      }
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm transition ${
        isActiveMode
          ? "border-white/40 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.12)]"
          : enabled
            ? "border-transparent bg-transparent text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/80 hover:text-white"
            : "border-transparent bg-transparent text-neutral-600 opacity-45"
      } disabled:cursor-not-allowed`}
    >
      <ToolIcon id={tool} lassoShape={lassoShape} />
    </button>
  );
}
