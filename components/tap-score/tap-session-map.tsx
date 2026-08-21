"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import {
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_GAP,
  getCellKey,
} from "@/lib/block-skill-grid";
import { createMapFogLookup } from "@/lib/map-fog-of-war";
import {
  TAP_SESSION_MAP_PAD_PX,
  tapSessionMapCenterOnOrigin,
  tapSessionMapViewport,
  type TapSessionMapBlock,
} from "@/lib/tap-session-map";
import { learnerMapCellChromeClasses } from "@/lib/workspace-learner-chrome";
import { cn } from "@/lib/utils";

export function TapSessionMap({
  blocks,
  selectedId,
  onSelect,
  currentId,
  overlay,
}: {
  blocks: TapSessionMapBlock[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** When set, every occupied tile except this one is strongly greyed out. */
  currentId?: string | null;
  overlay?: ReactNode;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const userPannedRef = useRef(false);
  const applyingRef = useRef(false);

  const occupiedKeys = useMemo(
    () => blocks.map((block) => getCellKey(block.row, block.col)),
    [blocks],
  );
  const fog = useMemo(
    () => createMapFogLookup({ occupiedKeys }),
    [occupiedKeys],
  );
  const viewport = useMemo(() => tapSessionMapViewport(blocks), [blocks]);
  const byCell = useMemo(() => {
    const map = new Map<string, TapSessionMapBlock>();
    for (const block of blocks) {
      map.set(getCellKey(block.row, block.col), block);
    }
    return map;
  }, [blocks]);

  const rows: number[] = [];
  const cols: number[] = [];
  for (let row = viewport.minRow; row <= viewport.maxRow; row += 1) rows.push(row);
  for (let col = viewport.minCol; col <= viewport.maxCol; col += 1) cols.push(col);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    const scroller = scrollerRef.current;
    const inner = innerRef.current;
    if (!pane || !scroller || !inner) return;

    const applyCenter = () => {
      if (userPannedRef.current) return;
      const overlayEl = pane.querySelector<HTMLElement>("[data-tap-turn-overlay]");
      const insetBottom = overlayEl ? overlayEl.offsetHeight : 0;
      const layout = tapSessionMapCenterOnOrigin({
        viewport,
        cellSize: SKILL_GRID_CELL_SIZE,
        gap: SKILL_GRID_GAP,
        padding: TAP_SESSION_MAP_PAD_PX,
        viewportWidth: scroller.clientWidth,
        viewportHeight: scroller.clientHeight,
        insetBottom,
      });
      applyingRef.current = true;
      inner.style.padding = `${layout.padTop}px ${layout.padRight}px ${layout.padBottom}px ${layout.padLeft}px`;
      scroller.scrollLeft = layout.scrollLeft;
      scroller.scrollTop = layout.scrollTop;
      window.requestAnimationFrame(() => {
        applyingRef.current = false;
      });
    };

    applyCenter();
    const observer = new ResizeObserver(() => applyCenter());
    observer.observe(scroller);
    const overlayEl = pane.querySelector<HTMLElement>("[data-tap-turn-overlay]");
    if (overlayEl) observer.observe(overlayEl);
    return () => observer.disconnect();
  }, [viewport, overlay]);

  return (
    <div
      ref={paneRef}
      data-tap-session-map
      data-tap-session-map-origin="0,0"
      data-tap-session-map-window={`${rows.length}x${cols.length}`}
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#0b0b0b]"
    >
    <div
      ref={scrollerRef}
      className="scrollbar-hide h-full min-h-0 w-full overflow-auto"
      onScroll={() => {
        if (!applyingRef.current) userPannedRef.current = true;
      }}
      onPointerDown={() => {
        userPannedRef.current = true;
      }}
    >
      <div ref={innerRef} data-tap-session-map-center-inner>
        <div
          className="grid w-max"
          style={{
            gridTemplateColumns: `repeat(${cols.length}, ${SKILL_GRID_CELL_SIZE}px)`,
            gap: SKILL_GRID_GAP,
            padding: TAP_SESSION_MAP_PAD_PX,
          }}
        >
          {rows.map((row) =>
            cols.map((col) => {
              const key = getCellKey(row, col);
              const block = byCell.get(key);
              const vis = fog(row, col);
              if (block) {
                const selected = block.id === selectedId;
                const dimmed =
                  Boolean(block.done) ||
                  (Boolean(currentId) && block.id !== currentId);
                return (
                  <button
                    key={key}
                    type="button"
                    data-tap-session-block={block.id}
                    data-tap-session-block-kind={block.kind}
                    data-tap-session-block-done={block.done ? "true" : "false"}
                    data-tap-session-block-dimmed={dimmed ? "true" : "false"}
                    onClick={() => onSelect?.(block.id)}
                    style={{ width: SKILL_GRID_CELL_SIZE, height: SKILL_GRID_CELL_SIZE }}
                    className={cn(
                      "flex flex-col items-start justify-end overflow-hidden rounded-none border p-1.5 text-left",
                      learnerMapCellChromeClasses({
                        status: "available",
                        selected: selected && !dimmed,
                      }),
                      dimmed &&
                        "border-neutral-800 bg-neutral-950/40 text-neutral-600 opacity-25 grayscale",
                    )}
                  >
                    <span className="line-clamp-4 text-[10px] leading-tight text-neutral-100">
                      {block.title}
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={key}
                  data-tap-session-empty={`${row},${col}`}
                  data-tap-session-fog={vis.fullyVisible ? "full" : vis.opacity > 0 ? "fade" : "hidden"}
                  className="relative rounded-none"
                  style={{ width: SKILL_GRID_CELL_SIZE, height: SKILL_GRID_CELL_SIZE }}
                  aria-hidden
                >
                  <div className="absolute inset-0 rounded-none border border-dashed border-neutral-800/70 bg-neutral-950/20" />
                  <div
                    data-map-fog-veil
                    className="pointer-events-none absolute inset-0 rounded-none bg-[#080808]"
                    style={{ opacity: 1 - vis.opacity }}
                  />
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
      {overlay}
    </div>
  );
}
