"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { GridCell } from "@/lib/block-skill-grid";
import {
  blockCircularMenuDoubleClickIsNoop,
  blockCircularMenuOpensOnEmpty,
  blockCircularMenuOpensOnSelect,
  nextCircularMenuBlockIdOnClick,
  nextCircularMenuEmptyCellOnClick,
  type BlockCircularMenuActionId,
} from "@/lib/block-circular-menu";

export function useMapCircularMenu(input: {
  viewOnly: boolean;
  circularMenuSurfaceProp?: "ile" | "workspace-learner" | "none";
  onEmptyCellSelect?: (selected: boolean) => void;
  onBlockedCellSelect?: (selected: boolean) => void;
  emptyAddNonce?: number;
  unusableKeys: Set<string>;
  handleCellSelect: (blockId: string, event: ReactMouseEvent) => void;
  handleBlockDoubleClick: (blockId: string) => void;
  handleEmptyCellClickRaw: (
    cell: GridCell,
    event: ReactMouseEvent | ReactPointerEvent,
  ) => void;
  clearSelection: () => void;
  setLocalPendingCell: (cell: GridCell | null) => void;
  setPeekBlockId: (id: string | null) => void;
}) {
  const {
    viewOnly,
    circularMenuSurfaceProp,
    onEmptyCellSelect,
    onBlockedCellSelect,
    emptyAddNonce = 0,
    unusableKeys,
    handleCellSelect,
    handleBlockDoubleClick,
    handleEmptyCellClickRaw,
    clearSelection,
    setLocalPendingCell,
    setPeekBlockId,
  } = input;

  const [circularMenuBlockId, setCircularMenuBlockId] = useState<string | null>(
    null,
  );
  const [circularMenuEmptyCell, setCircularMenuEmptyCell] =
    useState<GridCell | null>(null);
  const [blockedCellKey, setBlockedCellKey] = useState<string | null>(null);

  useEffect(() => {
    onEmptyCellSelect?.(circularMenuEmptyCell != null);
  }, [circularMenuEmptyCell, onEmptyCellSelect]);
  useEffect(() => {
    onBlockedCellSelect?.(blockedCellKey != null);
  }, [blockedCellKey, onBlockedCellSelect]);
  useEffect(() => {
    if (circularMenuEmptyCell || circularMenuBlockId) setBlockedCellKey(null);
  }, [circularMenuBlockId, circularMenuEmptyCell]);

  const circularMenuSurface: "ile" | "workspace-learner" | "none" = viewOnly
    ? "none"
    : circularMenuSurfaceProp ?? "none";

  const handleCellSelectWithMenu = useCallback(
    (blockId: string, event: ReactMouseEvent) => {
      if (viewOnly) {
        handleCellSelect(blockId, event);
        return;
      }
      if (blockCircularMenuOpensOnSelect(circularMenuSurface)) {
        const nextMenuId = nextCircularMenuBlockIdOnClick({
          surface: circularMenuSurface,
          clickedId: blockId,
          currentMenuId: circularMenuBlockId,
        });
        setPeekBlockId(null);
        setCircularMenuEmptyCell(null);
        setCircularMenuBlockId(nextMenuId);
        if (nextMenuId == null) {
          event.stopPropagation();
          clearSelection();
          return;
        }
      }
      handleCellSelect(blockId, event);
    },
    [
      circularMenuBlockId,
      circularMenuSurface,
      clearSelection,
      handleCellSelect,
      viewOnly,
    ],
  );

  const handleBlockDoubleClickGuarded = useCallback(
    (blockId: string) => {
      if (blockCircularMenuDoubleClickIsNoop(circularMenuSurface)) return;
      handleBlockDoubleClick(blockId);
    },
    [circularMenuSurface, handleBlockDoubleClick],
  );

  const handleEmptyCellClick = useCallback(
    (cell: GridCell, event: ReactMouseEvent | ReactPointerEvent) => {
      const cellKey = `${cell.row}:${cell.col}`;
      if (unusableKeys.has(cellKey)) {
        setCircularMenuBlockId(null);
        setPeekBlockId(null);
        setCircularMenuEmptyCell(null);
        setBlockedCellKey((current) => (current === cellKey ? null : cellKey));
        handleEmptyCellClickRaw(cell, event);
        return;
      }
      if (blockCircularMenuOpensOnEmpty(circularMenuSurface, { unusable: false })) {
        const next = nextCircularMenuEmptyCellOnClick({
          surface: circularMenuSurface,
          clicked: cell,
          current: circularMenuEmptyCell,
        });
        setCircularMenuBlockId(null);
        setPeekBlockId(null);
        setCircularMenuEmptyCell(next);
        setBlockedCellKey(null);
        if (next == null) {
          event.stopPropagation();
          clearSelection();
          return;
        }
      } else {
        setCircularMenuBlockId(null);
      }
      handleEmptyCellClickRaw(cell, event);
    },
    [
      circularMenuEmptyCell,
      circularMenuSurface,
      clearSelection,
      handleEmptyCellClickRaw,
      unusableKeys,
    ],
  );

  const handleEmptyCircularMenuAction = useCallback(
    (action: BlockCircularMenuActionId) => {
      if (action !== "add_chapter" || !circularMenuEmptyCell) return;
      if (
        unusableKeys.has(
          `${circularMenuEmptyCell.row}:${circularMenuEmptyCell.col}`,
        )
      ) {
        return;
      }
      setLocalPendingCell(circularMenuEmptyCell);
      setCircularMenuEmptyCell(null);
    },
    [circularMenuEmptyCell, setLocalPendingCell, unusableKeys],
  );

  const emptyAddSeenRef = useRef(0);
  useEffect(() => {
    const n = emptyAddNonce || 0;
    if (n <= 0 || n === emptyAddSeenRef.current) return;
    emptyAddSeenRef.current = n;
    handleEmptyCircularMenuAction("add_chapter");
  }, [emptyAddNonce, handleEmptyCircularMenuAction]);

  return {
    circularMenuSurface,
    handleCellSelectWithMenu,
    handleBlockDoubleClickGuarded,
    handleEmptyCellClick,
  };
}
