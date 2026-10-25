"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import { WorkspacePromptContextAlternatives } from "@/components/WorkspacePromptContextAlternatives";
import { buildSkillGridLayout, type SkillGridNode } from "@/lib/block-skill-grid";
import {
  BRIDGE_DENSITY_MAX,
  BRIDGE_DENSITY_MIN,
  BRIDGE_MAX_HALF_WIDTH,
  BRIDGE_WIDTH_MAX,
  BRIDGE_WIDTH_MIN,
  bridgeAnchorsFromPlacedBlocks,
  resolveBridgeSelection,
} from "@/lib/bridge-blocks";
import { unusableCellKeySet } from "@/lib/map-ground-rules";
import type { CombineBlockRef } from "@/components/WorkspaceCombineBlocksPane";

export function BridgeBlocksDrawer({
  selected,
  nodes,
  contiguous,
  busy,
  selectionKey,
  unusableCells,
  previewActive,
  onGenerateBridge,
  onBridgePreviewChange,
}: {
  selected: CombineBlockRef[];
  nodes: CombineBlockRef[];
  contiguous: boolean;
  busy: boolean;
  selectionKey: string;
  unusableCells?: Array<{ row: number; col: number }> | null;
  previewActive: boolean;
  onGenerateBridge?: (input: {
    blockIds: string[];
    density: number;
    width: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void> | void;
  onBridgePreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
}) {
  const [bridgeWidth, setBridgeWidth] = useState(BRIDGE_WIDTH_MIN);
  const [bridgeDensity, setBridgeDensity] = useState(BRIDGE_DENSITY_MAX);
  const [bridgePrompt, setBridgePrompt] = useState("");
  const [bridgeSubmitting, setBridgeSubmitting] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    setBridgeWidth(BRIDGE_WIDTH_MIN);
    setBridgeDensity(BRIDGE_DENSITY_MAX);
    setBridgePrompt("");
    setBridgeError(null);
  }, [selectionKey, nodes]);

  const allSkillNodes = useMemo(
    () =>
      nodes.map(
        (n) =>
          ({
            id: n.id,
            title: n.title || "",
            description: n.description ?? "",
            status: "available",
            is_start: false,
            next_block_ids: [],
            position_x: n.position_x ?? null,
            position_y: n.position_y ?? null,
            span_w: n.span_w ?? 1,
            span_h: n.span_h ?? 1,
            shape_cells: n.shape_cells ?? null,
          }) as SkillGridNode,
      ),
    [nodes],
  );
  const { occupancy } = useMemo(
    () => buildSkillGridLayout(allSkillNodes),
    [allSkillNodes],
  );
  const occupiedKeys = useMemo(
    () => new Set(occupancy.keys()),
    [occupancy],
  );
  const unusableKeys = useMemo(
    () => unusableCellKeySet(unusableCells || []),
    [unusableCells],
  );

  const bridgeAnchors = useMemo(
    () => bridgeAnchorsFromPlacedBlocks(selected),
    [selected],
  );
  const bridgeSelection = useMemo(
    () =>
      resolveBridgeSelection({
        anchors: bridgeAnchors,
        width: bridgeWidth,
        density: bridgeDensity,
        occupiedKeys,
        unusableKeys,
      }),
    [bridgeAnchors, bridgeWidth, bridgeDensity, occupiedKeys, unusableKeys],
  );
  const bridgeHalfWidth = bridgeSelection.halfWidth;
  const canBridge =
    Boolean(onGenerateBridge) &&
    bridgeAnchors.length >= 2 &&
    bridgeSelection.selected.length > 0;

  // Map preview for bridge corridor while the Bridge drawer is open.
  useEffect(() => {
    if (!onBridgePreviewChange) return;
    if (previewActive && bridgeSelection.selected.length > 0) {
      onBridgePreviewChange(
        bridgeSelection.selected.map((c) => ({ row: c.row, col: c.col })),
      );
    } else {
      onBridgePreviewChange(null);
    }
    return () => {
      onBridgePreviewChange(null);
    };
  }, [previewActive, bridgeSelection.selected, onBridgePreviewChange]);

  const submitBridge = async () => {
    if (!onGenerateBridge || bridgeSubmitting || busy || !canBridge) return;
    setBridgeSubmitting(true);
    setBridgeError(null);
    try {
      await onGenerateBridge({
        blockIds: selected.map((n) => n.id),
        density: bridgeDensity,
        width: bridgeWidth,
        userPrompt: bridgePrompt.trim() || undefined,
        frozenSlots: bridgeSelection.selected.map((c) => ({
          row: c.row,
          col: c.col,
        })),
        blockTitles: selected.map((n) => n.title || "Untitled"),
      });
      setBridgePrompt("");
    } catch (err) {
      setBridgeError(
        err instanceof Error ? err.message : "Failed to generate bridge",
      );
    } finally {
      setBridgeSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawer
      variant="section"
      title="Bridge Blocks"
      // Non-contiguous multi-select cannot combine — open Bridge by default.
      defaultExpanded={!contiguous}
      drawerId="bridge"
      bodyClassName="space-y-3"
      surfaceDataAttr="data-bridge-blocks-drawer"
    >
      <div data-bridge-blocks-pane className="space-y-3">
        <label className="block space-y-1" data-bridge-width>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400">Width</span>
            <span className="font-mono text-[10px] text-neutral-500">
              half-width {bridgeHalfWidth}/{BRIDGE_MAX_HALF_WIDTH} ·{" "}
              {bridgeSelection.candidates.length} corridor cells
            </span>
          </div>
          <input
            type="range"
            min={BRIDGE_WIDTH_MIN}
            max={BRIDGE_WIDTH_MAX}
            step={1}
            value={bridgeWidth}
            disabled={busy || bridgeSubmitting || selected.length < 2}
            onChange={(e) => setBridgeWidth(Number(e.target.value))}
            className="w-full accent-white"
            data-bridge-width-input
          />
        </label>

        <label className="block space-y-1" data-bridge-density>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400">Density</span>
            <span className="font-mono text-[10px] text-neutral-500">
              {bridgeDensity}% · {bridgeSelection.selected.length} selected
            </span>
          </div>
          <input
            type="range"
            min={BRIDGE_DENSITY_MIN}
            max={BRIDGE_DENSITY_MAX}
            step={5}
            value={bridgeDensity}
            disabled={busy || bridgeSubmitting || selected.length < 2}
            onChange={(e) => setBridgeDensity(Number(e.target.value))}
            className="w-full accent-white"
            data-bridge-density-input
          />
        </label>

        <div data-bridge-context-alternatives data-generative-context-alternatives>
          <WorkspacePromptContextAlternatives
            adhocValue={bridgePrompt}
            onAdhocChange={setBridgePrompt}
            disabled={busy || bridgeSubmitting}
            adhocPlaceholder="Optional guidance for the bridge (e.g. emphasize causality, shared vocabulary, or a transition exercise)…"
            adhocLabel="Bridging prompt"
            adhocInputDataAttr="data-bridge-prompt"
          />
        </div>

        {bridgeAnchors.length < 2 ? (
          <p
            className="rounded-none border border-neutral-600/30 bg-neutral-950/30 px-2.5 py-2 text-[11px] leading-snug text-neutral-300/90"
            data-bridge-need-anchors
          >
            Need at least two selected blocks with map positions to draw a
            bridge.
          </p>
        ) : bridgeSelection.selected.length === 0 ? (
          <p
            className="rounded-none border border-neutral-600/30 bg-neutral-950/30 px-2.5 py-2 text-[11px] leading-snug text-neutral-300/90"
            data-bridge-no-cells
          >
            No placeable empty cells along the corridor — clear space between
            the blocks or lower density.
          </p>
        ) : null}

        {bridgeError ? (
          <p className="text-xs text-red-400/90" data-bridge-error>
            {bridgeError}
          </p>
        ) : null}

        <button
          type="button"
          data-bridge-generate
          disabled={
            busy ||
            bridgeSubmitting ||
            !canBridge ||
            selected.length < 2
          }
          onClick={() => void submitBridge()}
          className="w-full rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {bridgeSubmitting
            ? "Starting bridge…"
            : bridgeSelection.selected.length > 0
              ? `Generate bridge (${bridgeSelection.selected.length} blocks)`
              : "Generate bridge"}
        </button>
      </div>
    </WorkspaceRightPaneDrawer>
  );
}
